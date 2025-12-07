/**
 * Hook for listing and downloading books from Supabase Storage
 *
 * Same interface so BookRepoModal can swap with minimal changes.
 */

import { useState, useCallback } from 'react';
import { listUserEbooks, downloadUserEbook } from '@/app/actions/ebook-actions';
import { useBookImporter } from '@/hooks/useBookImporter';
import { useLibraryStore } from '@/store/libraryStore';
import { useEnv } from '@/context/EnvContext';

interface SupabaseBook {
  id: string;
  hash: string;
  title: string;
  author: string;
  uploadedAt: string;
}

export function useSupabaseBookRepo() {
  const { importEpubBase64 } = useBookImporter();
  const { library, setLibrary } = useLibraryStore();
  const { appService } = useEnv();

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [availableBooks, setAvailableBooks] = useState<SupabaseBook[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all books backed up to Supabase
   */
  const fetchAvailableBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listUserEbooks();

      if (!result.success || !result.ebooks) {
        throw new Error(result.error || 'Failed to fetch books from Supabase');
      }

      // Map to our format
      const supabaseBooks: SupabaseBook[] = result.ebooks.map((ebook) => ({
        id: ebook.id,
        hash: ebook.bookHash,
        title: ebook.title || 'Untitled',
        author: ebook.authorName || 'Unknown Author',
        uploadedAt: ebook.uploadedAt,
      }));

      // Show ALL backed-up books (don't filter out local copies)
      setAvailableBooks(supabaseBooks);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch available books';
      setError(errorMessage);
      console.error('Error fetching available books from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Download a book from Supabase Storage and import to IndexedDB
   * Always replaces existing book with same hash
   */
  const downloadBook = useCallback(
    async (book: SupabaseBook) => {
      setDownloading(book.hash);
      setError(null);

      try {
        // 1. Download epub from Supabase Storage
        const result = await downloadUserEbook(book.hash);

        if (!result.success || !result.epubBase64 || !result.epubFilename) {
          throw new Error(result.error || 'Failed to download book from Supabase');
        }

        console.log(`Downloaded ${book.title} from Supabase (${result.epubFilename})`);

        // 2. Delete existing book with same hash (if any) to ensure clean replacement
        const existingBook = library.find((b) => b.hash === book.hash);
        if (existingBook && appService) {
          console.log(`Replacing existing local copy of "${book.title}"`);
          await appService.deleteBook(existingBook, 'local');
        }

        // 3. Import the epub to IndexedDB
        await importEpubBase64(result.epubBase64, result.epubFilename);

        // 4. Force refresh library from disk to get fresh cover data
        if (appService && setLibrary) {
          const freshLibrary = await appService.loadLibraryBooks();
          setLibrary([...freshLibrary]);
        }

        return { success: true };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to download book';
        setError(errorMessage);
        console.error('Error downloading book from Supabase:', err);
        return { success: false, error: errorMessage };
      } finally {
        setDownloading(null);
      }
    },
    [importEpubBase64, library, appService, setLibrary]
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
