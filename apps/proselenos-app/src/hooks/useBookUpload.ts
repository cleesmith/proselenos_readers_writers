import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { getLocalBookFilename, getConfigFilename } from '@/utils/book';
import { uploadBook } from '@/app/actions/upload-book';

// 4MB threshold (leaving buffer below 4.5MB server action limit)
const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024;

export function useBookUpload() {
  const { appService } = useEnv();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadBookToGitHub = async (book: Book) => {
    setUploading(true);
    setError(null);

    try {
      if (!appService) {
        throw new Error('App service not available');
      }

      // Read EPUB from IndexedDB
      const epubFilename = getLocalBookFilename(book);
      const epubFile = await appService.openFile(epubFilename, 'Books');
      const epubData = await epubFile.arrayBuffer();

      if (!epubData) {
        throw new Error(`Failed to read epub file from IndexedDB: ${epubFilename}`);
      }

      // Read config.json from IndexedDB
      const configFilename = getConfigFilename(book);
      const configFile = await appService.openFile(configFilename, 'Books');
      const configData = await configFile.text();

      if (!configData) {
        throw new Error(`Failed to read config.json from IndexedDB: ${configFilename}`);
      }

      // HYBRID: Choose upload method based on file size
      if (epubData.byteLength <= SMALL_FILE_THRESHOLD) {
        // Small file: Use existing server action (works on localhost)
        console.log(`Uploading ${book.title} via server action (${(epubData.byteLength / 1024 / 1024).toFixed(1)}MB)`);
        const result = await uploadBook(book, epubData, configData);
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
      } else {
        // Large file: Use Vercel Blob (production only)
        const isLocalDev = typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (isLocalDev) {
          throw new Error(
            `File too large for localhost (${(epubData.byteLength / 1024 / 1024).toFixed(1)}MB).`
          );
        }

        console.log(`Uploading ${book.title} via Vercel Blob (${(epubData.byteLength / 1024 / 1024).toFixed(1)}MB)`);

        // Upload EPUB via Vercel Blob (bypasses 4.5MB server action limit)
        const epubBlob = new Blob([epubData], { type: 'application/epub+zip' });
        const justFilename = epubFilename.split('/').pop() || `${book.hash}.epub`;
        const blobPathname = `${book.hash}/${justFilename}`;

        await upload(blobPathname, epubBlob, {
          access: 'public',
          handleUploadUrl: '/api/upload-book',
          clientPayload: JSON.stringify({
            bookHash: book.hash,
            bookTitle: book.title,
            epubFilename: justFilename,
            configData: configData,
          }),
        });
      }

      return { success: true };
    } catch (err: unknown) {
      console.error('Upload error details:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload book';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadBookToGitHub,
    uploading,
    error,
  };
}
