// apps/proselenos-app/src/hooks/useBookImporter.ts

import { useCallback } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { Book } from '@/types/book';

export function useBookImporter() {
  const { appService, envConfig } = useEnv();
  const { library, updateBook, setLibrary } = useLibraryStore();

  /**
   * Core logic to import a File object into IndexedDB and persist the library.
   * This encapsulates the "dirty work" done by the Ereader.
   */
  const importEpubFile = useCallback(async (file: File): Promise<Book> => {
    if (!appService) throw new Error('App service not available');

    // 1. Import into IndexedDB (extracts metadata, cover, creates config.json)
    // Note: This mutates the passed 'library' array in memory
    const importedBook = await appService.importBook(file, library);

    if (!importedBook) {
      throw new Error('Failed to import book');
    }

    // 2. Persist the updated library metadata to IndexedDB (library.json)
    await appService.saveLibraryBooks(library);
    
    // 3. Update the store state so the UI reflects the new book immediately
    if (setLibrary) {
      setLibrary([...library]);
    }

    // 4. Mark as downloaded and update book-specific metadata
    importedBook.downloadedAt = Date.now();
    await updateBook(envConfig, importedBook);

    return importedBook;
  }, [appService, envConfig, library, updateBook, setLibrary]);

  /**
   * Helper to handle Base64 strings (used by both Repo Download and Publishing Assistant)
   */
  const importEpubBase64 = useCallback(async (base64Data: string, filename: string): Promise<Book> => {
    // Convert Base64 to Byte Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create File object
    const file = new File([bytes], filename, { type: 'application/epub+zip' });

    // Delegate to main import function
    return importEpubFile(file);
  }, [importEpubFile]);

  return {
    importEpubFile,
    importEpubBase64
  };
}
