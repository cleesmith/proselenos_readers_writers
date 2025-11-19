// apps/proselenos-app/src/hooks/useBookRepo.ts

import { useState, useCallback } from 'react';
import { Book } from '@/types/book';
import { useLibraryStore } from '@/store/libraryStore';
import { listRepoBooks, downloadRepoBook } from '@/app/actions/book-repo';
import { useBookImporter } from '@/hooks/useBookImporter';

export function useBookRepo() {
  const { library } = useLibraryStore();
  const { importEpubBase64 } = useBookImporter();
  
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch list of books from repo that user doesn't have locally
   */
  const fetchAvailableBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listRepoBooks();

      if (!result.success || !result.books) {
        throw new Error(result.error || 'Failed to fetch books from repo');
      }

      // Filter out books that already exist in local library (match by hash)
      const filteredBooks = result.books.filter(
        (repoBook) => !library.some((localBook) => localBook.hash === repoBook.hash)
      );
      setAvailableBooks(filteredBooks);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch available books';
      setError(errorMessage);
      console.error('Error fetching available books:', err);
    } finally {
      setLoading(false);
    }
  }, [library]);

  /**
   * Download a book from repo and save to IndexedDB
   */
  const downloadBook = useCallback(
    async (book: Book) => {
      setDownloading(book.hash);
      setError(null);

      try {
        // 1. Download epub from GitHub
        const result = await downloadRepoBook(book.hash);

        if (!result.success || !result.epubBase64 || !result.epubFilename) {
          throw new Error(result.error || 'Failed to download book');
        }

        // 2. Use SHARED importer (Handles Base64 -> File -> IndexedDB -> Save Library)
        await importEpubBase64(result.epubBase64, result.epubFilename);

        // 3. Remove from available list in UI
        setAvailableBooks((prev) => prev.filter((b) => b.hash !== book.hash));

        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to download book';
        setError(errorMessage);
        console.error('Error downloading book:', err);
        return { success: false, error: errorMessage };
      } finally {
        setDownloading(null);
      }
    },
    [importEpubBase64]
  );

  return {
    availableBooks,
    loading,
    downloading,
    error,
    fetchAvailableBooks,
    downloadBook,
  };
}
