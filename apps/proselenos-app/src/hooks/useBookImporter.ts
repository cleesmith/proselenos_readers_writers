// apps/proselenos-app/src/hooks/useBookImporter.ts

import { useCallback } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { Book } from '@/types/book';

export function useBookImporter() {
  const { appService, envConfig } = useEnv();
  const { updateBook, setLibrary } = useLibraryStore(); // Removed 'library' from here to avoid using stale state

  const importEpubFile = useCallback(async (file: File, options: { deduplicate?: boolean } = {}): Promise<Book> => {
    if (!appService) throw new Error('App service not available');

    // 1. CRITICAL FIX: Load the LATEST library from disk first.
    // This prevents overwriting existing books if this tab's memory is stale.
    const currentLibrary = await appService.loadLibraryBooks();

    // 2. Import the new book (merging it into our fresh list)
    const importedBook = await appService.importBook(file, currentLibrary);

    if (!importedBook) {
      throw new Error('Failed to import book');
    }

    // 3. Deduplication (using the fresh list)
    if (options.deduplicate) {
      const duplicates = currentLibrary.filter((b) => 
        b.hash !== importedBook.hash && 
        !b.deletedAt &&
        b.title === importedBook.title &&
        b.author === importedBook.author
      );

      if (duplicates.length > 0) {
        console.log(`[Importer] Removing ${duplicates.length} older version(s) of "${importedBook.title}"`);
        for (const duplicate of duplicates) {
          await appService.deleteBook(duplicate, 'local');
        }
      }
    }

    // 4. Persist the COMPLETE list (Old + New)
    await appService.saveLibraryBooks(currentLibrary);
    
    // 5. Update the UI store
    if (setLibrary) {
      setLibrary([...currentLibrary]);
    }

    // 6. Mark downloaded
    importedBook.downloadedAt = Date.now();
    await updateBook(envConfig, importedBook);

    return importedBook;
  }, [appService, envConfig, updateBook, setLibrary]); // Removed 'library' dependency

  const importEpubBase64 = useCallback(async (base64Data: string, filename: string, options: { deduplicate?: boolean } = {}): Promise<Book> => {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const file = new File([bytes], filename, { type: 'application/epub+zip' });
    return importEpubFile(file, options);
  }, [importEpubFile]);

  return {
    importEpubFile,
    importEpubBase64
  };
}
