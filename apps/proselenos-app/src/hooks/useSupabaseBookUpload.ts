/**
 * Hook for uploading books to Supabase Storage
 *
 * Similar to useBookUpload but targets Supabase instead of GitHub.
 * Reads epub, config, and cover from IndexedDB and uploads to Supabase.
 */

import { useState } from 'react';
import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { getLocalBookFilename, getConfigFilename, getCoverFilename } from '@/utils/book';
import { uploadEbookToSupabase } from '@/app/actions/supabase-ebook-actions';

export function useSupabaseBookUpload() {
  const { appService } = useEnv();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a book to Supabase Storage
   *
   * Reads from IndexedDB:
   * - {book.hash}/{title}.epub
   * - {book.hash}/config.json
   * - {book.hash}/cover.png (optional)
   *
   * Uploads to Supabase Storage:
   * - private-ebooks/{google_id}/{book.hash}/{title}.epub
   * - private-ebooks/{google_id}/{book.hash}/config.json
   * - private-ebooks/{google_id}/{book.hash}/cover.png
   */
  const uploadBookToSupabase = async (book: Book) => {
    setUploading(true);
    setError(null);

    try {
      if (!appService) {
        throw new Error('App service not available');
      }

      console.log(`Uploading ${book.title} to Supabase...`);

      // Read EPUB from IndexedDB
      const epubFilename = getLocalBookFilename(book);
      const epubFile = await appService.openFile(epubFilename, 'Books');
      const epubData = await epubFile.arrayBuffer();

      if (!epubData) {
        throw new Error(`Failed to read epub file from IndexedDB: ${epubFilename}`);
      }

      // Convert EPUB to base64 for server action
      const epubBase64 = arrayBufferToBase64(epubData);
      console.log(`EPUB size: ${(epubData.byteLength / 1024 / 1024).toFixed(2)}MB`);

      // Read config.json from IndexedDB
      const configFilename = getConfigFilename(book);
      const configFile = await appService.openFile(configFilename, 'Books');
      const configData = await configFile.text();

      if (!configData) {
        throw new Error(`Failed to read config.json from IndexedDB: ${configFilename}`);
      }

      // Try to read cover from IndexedDB (optional)
      let coverBase64: string | null = null;
      try {
        const coverFilename = getCoverFilename(book);
        const coverFile = await appService.openFile(coverFilename, 'Books');
        const coverData = await coverFile.arrayBuffer();
        if (coverData && coverData.byteLength > 0) {
          coverBase64 = arrayBufferToBase64(coverData);
          console.log(`Cover size: ${(coverData.byteLength / 1024).toFixed(1)}KB`);
        }
      } catch {
        // Cover is optional, ignore if not found
        console.log('No cover found for this book');
      }

      // Call server action to upload to Supabase
      const result = await uploadEbookToSupabase(
        book.hash,
        book.title,
        book.author,
        epubBase64,
        configData,
        coverBase64
      );

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      console.log(`Successfully uploaded ${book.title} to Supabase`);
      return { success: true };
    } catch (err: unknown) {
      console.error('Supabase upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload book';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadBookToSupabase,
    uploading,
    error,
  };
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
