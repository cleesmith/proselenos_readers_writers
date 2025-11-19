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
   * * @param file The EPUB file to import
   * @param options Configuration options
   * @param options.deduplicate If true, removes older non-identical books with the same Title & Author
   */
  const importEpubFile = useCallback(async (file: File, options: { deduplicate?: boolean } = {}): Promise<Book> => {
    if (!appService) throw new Error('App service not available');

    // 1. Import the NEW book into IndexedDB
    const importedBook = await appService.importBook(file, library);

    if (!importedBook) {
      throw new Error('Failed to import book');
    }

    // 2. OPTIONAL Deduplication (Only runs if requested)
    if (options.deduplicate) {
      // Find other books with the SAME Title & Author but DIFFERENT Hash
      const duplicates = library.filter((b) => 
        b.hash !== importedBook.hash && 
        !b.deletedAt &&
        b.title === importedBook.title &&
        b.author === importedBook.author
      );

      if (duplicates.length > 0) {
        console.log(`[Importer] Removing ${duplicates.length} older version(s) of "${importedBook.title}"`);
        
        // Delete the older versions
        for (const duplicate of duplicates) {
          await appService.deleteBook(duplicate, 'local');
        }
      }
    }

    // 3. Persist the updated library metadata
    await appService.saveLibraryBooks(library);
    
    // 4. Update the store state
    if (setLibrary) {
      setLibrary([...library]);
    }

    // 5. Mark as downloaded and update book-specific metadata
    importedBook.downloadedAt = Date.now();
    await updateBook(envConfig, importedBook);

    return importedBook;
  }, [appService, envConfig, library, updateBook, setLibrary]);

  /**
   * Helper to handle Base64 strings
   */
  const importEpubBase64 = useCallback(async (base64Data: string, filename: string, options: { deduplicate?: boolean } = {}): Promise<Book> => {
    // Convert Base64 to Byte Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create File object
    const file = new File([bytes], filename, { type: 'application/epub+zip' });

    // Delegate to main import function with options
    return importEpubFile(file, options);
  }, [importEpubFile]);

  return {
    importEpubFile,
    importEpubBase64
  };
}
