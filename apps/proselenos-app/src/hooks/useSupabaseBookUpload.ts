/**
 * Hook for uploading books directly to Supabase Storage
 *
 * Uses signed URLs to bypass Vercel's 4.5MB serverless function limit.
 * Files are uploaded directly from the browser to Supabase Storage.
 *
 * Flow:
 * 1. Read files from IndexedDB
 * 2. Get signed upload URLs from server action
 * 3. Upload directly to Supabase via fetch()
 * 4. Confirm upload via server action (updates metadata)
 */

import { useState } from 'react';
import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { getLocalBookFilename, getConfigFilename, getCoverFilename } from '@/utils/book';
import { createSignedUploadUrls, confirmEbookUpload } from '@/app/actions/ebook-actions';

export function useSupabaseBookUpload() {
  const { appService } = useEnv();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a book directly to Supabase Storage using signed URLs
   *
   * Reads from IndexedDB:
   * - {book.hash}/{title}.epub
   * - {book.hash}/config.json
   * - {book.hash}/cover.png (optional)
   *
   * Uploads directly to Supabase Storage:
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

      console.log(`[useSupabaseBookUpload] Starting DIRECT upload for "${book.title}" (bypasses Vercel limit)...`);

      // 1. Read EPUB from IndexedDB
      const epubFilename = getLocalBookFilename(book);
      const epubFile = await appService.openFile(epubFilename, 'Books');
      const epubData = await epubFile.arrayBuffer();

      if (!epubData) {
        throw new Error(`Failed to read epub file from IndexedDB: ${epubFilename}`);
      }

      console.log(`EPUB size: ${(epubData.byteLength / 1024 / 1024).toFixed(2)}MB`);

      // 2. Read config.json from IndexedDB
      const configFilename = getConfigFilename(book);
      const configFile = await appService.openFile(configFilename, 'Books');
      const configData = await configFile.text();

      if (!configData) {
        throw new Error(`Failed to read config.json from IndexedDB: ${configFilename}`);
      }

      // 3. Try to read cover from IndexedDB (optional)
      let coverData: ArrayBuffer | null = null;
      try {
        const coverFilename = getCoverFilename(book);
        const coverFile = await appService.openFile(coverFilename, 'Books');
        const data = await coverFile.arrayBuffer();
        if (data && data.byteLength > 0) {
          coverData = data;
          console.log(`Cover size: ${(data.byteLength / 1024).toFixed(1)}KB`);
        }
      } catch {
        // Cover is optional, ignore if not found
        console.log('No cover found for this book');
      }

      // 4. Create safe filename and get signed URLs from server
      const safeTitle = book.title.replace(/[^a-zA-Z0-9-_. ]/g, '_').substring(0, 100);
      const epubSafeFilename = `${safeTitle}.epub`;

      const urlResult = await createSignedUploadUrls(
        book.hash,
        epubSafeFilename,
        coverData !== null
      );

      if (!urlResult.success || !urlResult.urls) {
        throw new Error(urlResult.error || 'Failed to get upload URLs');
      }

      console.log('[useSupabaseBookUpload] Got signed URLs, uploading files directly to Supabase...');

      // 5. Upload files directly to Supabase in parallel
      const uploadPromises: Promise<Response>[] = [
        // EPUB upload
        fetch(urlResult.urls.epub.signedUrl, {
          method: 'PUT',
          body: epubData,
          headers: { 'Content-Type': 'application/epub+zip' },
        }),
        // Config upload
        fetch(urlResult.urls.config.signedUrl, {
          method: 'PUT',
          body: configData,
          headers: { 'Content-Type': 'application/json' },
        }),
      ];

      // Add cover upload if we have cover data and a signed URL
      if (coverData && urlResult.urls.cover) {
        uploadPromises.push(
          fetch(urlResult.urls.cover.signedUrl, {
            method: 'PUT',
            body: coverData,
            headers: { 'Content-Type': 'image/png' },
          })
        );
      }

      const uploadResults = await Promise.all(uploadPromises);

      // 6. Check if all uploads succeeded
      const failedUploads = uploadResults.filter((r) => !r.ok);
      if (failedUploads.length > 0) {
        const statuses = failedUploads.map((r) => r.status).join(', ');
        throw new Error(`File upload failed with status: ${statuses}`);
      }

      console.log('[useSupabaseBookUpload] Files uploaded to Supabase, confirming...');

      // 7. Confirm upload (update metadata in database)
      const confirmResult = await confirmEbookUpload(
        book.hash,
        book.title,
        book.author || ''
      );

      if (!confirmResult.success) {
        throw new Error(confirmResult.error || 'Failed to confirm upload');
      }

      console.log(`[useSupabaseBookUpload] SUCCESS: "${book.title}" uploaded via direct signed URL`);
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
