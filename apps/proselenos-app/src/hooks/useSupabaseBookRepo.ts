/**
 * Hook for listing and downloading books from Supabase Storage
 *
 * Replaces useBookRepo which used GitHub.
 * Same interface so BookRepoModal can swap with minimal changes.
 */

import { useState, useCallback } from 'react';
import { useLibraryStore } from '@/store/libraryStore';
import { listUserEbooks, downloadUserEbook } from '@/app/actions/supabase-ebook-actions';
import { useBookImporter } from '@/hooks/useBookImporter';

interface SupabaseBook {
  id: string;
  hash: string;
  title: string;
  author: string;
  uploadedAt: string;
}

export function useSupabaseBookRepo() {
  const { library } = useLibraryStore();
  const { importEpubBase64 } = useBookImporter();

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [availableBooks, setAvailableBooks] = useState<SupabaseBook[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch list of books from Supabase that user doesn't have locally
   */
  const fetchAvailableBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listUserEbooks();

      if (!result.success || !result.ebooks) {
        throw new Error(result.error || 'Failed to fetch books from Supabase');
      }

      // Map to our format and filter out books already in local library
      const supabaseBooks: SupabaseBook[] = result.ebooks.map((ebook) => ({
        id: ebook.id,
        hash: ebook.bookHash,
        title: ebook.title || 'Untitled',
        author: ebook.authorName || 'Unknown Author',
        uploadedAt: ebook.uploadedAt,
      }));

      // Filter out books that already exist in local library (match by hash)
      const filteredBooks = supabaseBooks.filter(
        (supaBook) => !library.some((localBook) => localBook.hash === supaBook.hash)
      );

      setAvailableBooks(filteredBooks);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch available books';
      setError(errorMessage);
      console.error('Error fetching available books from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [library]);

  /**
   * Download a book from Supabase Storage and import to IndexedDB
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

        // 2. Import the epub to IndexedDB
        await importEpubBase64(result.epubBase64, result.epubFilename, {
          deduplicate: false, // Keep as separate edition
        });

        // 3. If config.json was included, we could apply it here
        // For now, just import the epub - config will be default
        if (result.configJson) {
          console.log('Config.json downloaded - TODO: apply to imported book');
        }

        // 4. Remove from available list in UI
        setAvailableBooks((prev) => prev.filter((b) => b.hash !== book.hash));

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
