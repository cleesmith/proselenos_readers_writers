import { useState } from 'react';
import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { getLocalBookFilename, getConfigFilename } from '@/utils/book';
import { uploadBook } from '@/app/actions/upload-book';

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

      // Read epub from IndexedDB
      const epubFilename = getLocalBookFilename(book);
      const epubFile = await appService.openFile(epubFilename, 'Books');
      const epubData = await epubFile.arrayBuffer();

      if (!epubData) {
        throw new Error(`Failed to read epub file from IndexedDB: ${epubFilename}`);
      }

      // Read config.json from IndexedDB
      const configFilename = getConfigFilename(book);
      console.log('Reading config from:', configFilename);

      const configFile = await appService.openFile(configFilename, 'Books');
      const configData = await configFile.text();

      if (!configData) {
        throw new Error(`Failed to read config.json from IndexedDB: ${configFilename}`);
      }

      // Upload to GitHub via server action
      const result = await uploadBook(book, epubData, configData);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      return { success: true };
    } catch (err: any) {
      console.error('Upload error details:', err);
      const errorMessage = err.message || 'Failed to upload book';
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
