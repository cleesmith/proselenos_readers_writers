import { useState, useCallback } from 'react';
import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { listRepoBooks, downloadRepoBook } from '@/app/actions/book-repo';

export function useBookRepo() {
  const { appService, envConfig } = useEnv();
  const { updateBook, library } = useLibraryStore();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null); // hash of book being downloaded
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
      if (!appService) {
        throw new Error('App service not available');
      }

      setDownloading(book.hash);
      setError(null);

      try {
        // Download epub from GitHub
        const result = await downloadRepoBook(book.hash);

        if (!result.success || !result.epubBase64 || !result.epubFilename) {
          throw new Error(result.error || 'Failed to download book');
        }

        // Convert base64 to ArrayBuffer
        const binaryString = atob(result.epubBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create a File object from the ArrayBuffer
        const epubFile = new File([bytes], result.epubFilename, { type: 'application/epub+zip' });

        // Use importBook to process the epub (same as big + button)
        // This will extract metadata, generate cover, create config.json
        const importedBook = await appService.importBook(epubFile, library);

        if (!importedBook) {
          throw new Error('Failed to import downloaded book');
        }

        // Mark as downloaded
        importedBook.downloadedAt = Date.now();
        await updateBook(envConfig, importedBook);

        // Remove from available list
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
    [appService, envConfig, updateBook, library],
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
