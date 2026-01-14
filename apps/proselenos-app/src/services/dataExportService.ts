// src/services/dataExportService.ts
// Exports and imports ALL browser storage for this app

import JSZip from 'jszip';

// ============================================
// Database constants (matching existing services)
// ============================================

const EREADER_DB_NAME = 'AppFileSystem';
const EREADER_DB_VERSION = 1;

const AUTHORS_DB_NAME = 'ProselenosLocal';
const AUTHORS_DB_VERSION = 1;
const AUTHORS_STORES = ['settings', 'manuscript', 'ai', 'publish'] as const;

// ============================================
// Helper: Open IndexedDB
// ============================================

async function openDB(dbName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Export localStorage
// ============================================

function exportLocalStorage(): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      data[key] = localStorage.getItem(key) || '';
    }
  }
  return data;
}

// ============================================
// Export E-Reader Database (AppFileSystem)
// ============================================

async function exportEreaderData(): Promise<Array<{ path: string; content: string | ArrayBuffer | Blob }>> {
  try {
    const db = await openDB(EREADER_DB_NAME, EREADER_DB_VERSION);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result || [];
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Database doesn't exist or is empty
    return [];
  }
}

// ============================================
// Export Authors Database (ProselenosLocal)
// ============================================

interface AuthorsStoreData {
  storeName: string;
  entries: Array<{ key: string; value: unknown }>;
}

async function exportAuthorsData(): Promise<AuthorsStoreData[]> {
  try {
    const db = await openDB(AUTHORS_DB_NAME, AUTHORS_DB_VERSION);
    const result: AuthorsStoreData[] = [];

    for (const storeName of AUTHORS_STORES) {
      if (!db.objectStoreNames.contains(storeName)) continue;

      const entries = await new Promise<Array<{ key: string; value: unknown }>>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result || [];
          resolve(items);
        };
        request.onerror = () => reject(request.error);
      });

      result.push({ storeName, entries });
    }

    return result;
  } catch {
    // Database doesn't exist or is empty
    return [];
  }
}

// ============================================
// Convert content to appropriate format for ZIP
// ============================================

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

// ============================================
// Main Export Function
// ============================================

export async function exportAllData(): Promise<Blob> {
  const zip = new JSZip();

  // 1. Add manifest
  const manifest = {
    version: 1,
    app: 'EverythingEbooks',
    exportDate: new Date().toISOString(),
    contents: {
      hasLocalStorage: true,
      hasEreader: false,
      hasAuthors: false,
    },
  };

  // 2. Export localStorage
  const localStorageData = exportLocalStorage();
  zip.file('localStorage.json', JSON.stringify(localStorageData, null, 2));

  // 3. Export E-Reader data
  const ereaderFiles = await exportEreaderData();
  if (ereaderFiles.length > 0) {
    manifest.contents.hasEreader = true;
    const ereaderFolder = zip.folder('ereader');
    if (ereaderFolder) {
      for (const file of ereaderFiles) {
        const { path, content } = file;
        // Keep original path exactly as stored in IndexedDB
        const cleanPath = path;

        if (content instanceof Blob) {
          const arrayBuffer = await blobToArrayBuffer(content);
          ereaderFolder.file(cleanPath, new Uint8Array(arrayBuffer));
        } else if (content instanceof ArrayBuffer) {
          ereaderFolder.file(cleanPath, new Uint8Array(content));
        } else if (typeof content === 'string') {
          ereaderFolder.file(cleanPath, content);
        } else {
          // JSON serialize anything else
          ereaderFolder.file(cleanPath, JSON.stringify(content, null, 2));
        }
      }
    }
  }

  // 4. Export Authors data
  const authorsData = await exportAuthorsData();
  if (authorsData.some(s => s.entries.length > 0)) {
    manifest.contents.hasAuthors = true;
    const authorsFolder = zip.folder('authors');
    if (authorsFolder) {
      for (const storeData of authorsData) {
        const { storeName, entries } = storeData;
        if (entries.length === 0) continue;

        const storeFolder = authorsFolder.folder(storeName);
        if (!storeFolder) continue;

        for (const entry of entries) {
          const { key, value } = entry;
          // Clean up key for filename (remove .json if we're adding it)
          const filename = key.endsWith('.json') || key.endsWith('.txt') || key.endsWith('.epub') || key.endsWith('.docx')
            ? key
            : `${key}.json`;

          if (value instanceof Blob) {
            const arrayBuffer = await blobToArrayBuffer(value);
            storeFolder.file(filename, new Uint8Array(arrayBuffer));
          } else if (value instanceof ArrayBuffer) {
            storeFolder.file(filename, new Uint8Array(value));
          } else if (typeof value === 'string') {
            storeFolder.file(filename, value);
          } else {
            // JSON serialize objects
            storeFolder.file(filename, JSON.stringify(value, null, 2));
          }
        }
      }
    }
  }

  // 5. Add manifest (now with accurate content flags)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 6. Generate ZIP
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// ============================================
// Download Helper
// ============================================

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// One-click Export & Download
// ============================================

export async function exportAndDownload(): Promise<void> {
  const blob = await exportAllData();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  downloadBlob(blob, `everythingebooks_backup_${date}.zip`);
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

// File picker helper
function selectZipFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = () => {
      const file = input.files?.[0] || null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// Validate ZIP has expected structure
async function validateBackupZip(zip: JSZip): Promise<boolean> {
  // Must have manifest.json
  const manifest = zip.file('manifest.json');
  if (!manifest) {
    return false;
  }

  try {
    const content = await manifest.async('string');
    const parsed = JSON.parse(content);
    // Check it's our backup format
    return parsed.app === 'EverythingEbooks' && typeof parsed.version === 'number';
  } catch {
    return false;
  }
}

// Clear localStorage
function clearLocalStorage(): void {
  localStorage.clear();
}

// Clear E-Reader IndexedDB
async function clearEreaderDB(): Promise<void> {
  try {
    const db = await openDB(EREADER_DB_NAME, EREADER_DB_VERSION);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Database might not exist, that's fine
  }
}

// Clear Authors IndexedDB
async function clearAuthorsDB(): Promise<void> {
  try {
    const db = await openDB(AUTHORS_DB_NAME, AUTHORS_DB_VERSION);
    for (const storeName of AUTHORS_STORES) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch {
    // Database might not exist, that's fine
  }
}

// Import localStorage from ZIP
async function importLocalStorage(zip: JSZip): Promise<void> {
  const file = zip.file('localStorage.json');
  if (!file) return;

  try {
    const content = await file.async('string');
    const data = JSON.parse(content) as Record<string, string>;
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    console.error('Failed to import localStorage:', err);
  }
}

// Import E-Reader data from ZIP
async function importEreaderData(zip: JSZip): Promise<void> {
  const ereaderFolder = zip.folder('ereader');
  if (!ereaderFolder) return;

  try {
    // Ensure database and store exist
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(EREADER_DB_NAME, EREADER_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Import each file
    const files: Array<{ relativePath: string; file: JSZip.JSZipObject }> = [];
    ereaderFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        files.push({ relativePath, file });
      }
    });

    for (const { relativePath, file } of files) {
      // Use path exactly as stored in ZIP (matches original IndexedDB path)
      const fullPath = relativePath;

      // Determine content type and read accordingly
      let content: string | ArrayBuffer;
      if (relativePath.endsWith('.json') || relativePath.endsWith('.txt')) {
        content = await file.async('string');
      } else {
        // Binary file (epub, png, etc.)
        content = await file.async('arraybuffer');
      }

      // Write to IndexedDB
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        store.put({ path: fullPath, content });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (err) {
    console.error('Failed to import E-Reader data:', err);
  }
}

// Import Authors data from ZIP
async function importAuthorsData(zip: JSZip): Promise<void> {
  const authorsFolder = zip.folder('authors');
  if (!authorsFolder) return;

  try {
    // Ensure database and stores exist
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(AUTHORS_DB_NAME, AUTHORS_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of AUTHORS_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Import each store
    for (const storeName of AUTHORS_STORES) {
      const storeFolder = authorsFolder.folder(storeName);
      if (!storeFolder) continue;

      const files: Array<{ relativePath: string; file: JSZip.JSZipObject }> = [];
      storeFolder.forEach((relativePath, file) => {
        if (!file.dir) {
          files.push({ relativePath, file });
        }
      });

      for (const { relativePath, file } of files) {
        // The key is the filename (may or may not have extension)
        const key = relativePath;

        // Determine content type and read accordingly
        let value: unknown;
        if (relativePath.endsWith('.epub') || relativePath.endsWith('.docx') ||
            relativePath.endsWith('.png') || relativePath.endsWith('.jpg') || relativePath.endsWith('.jpeg')) {
          // Binary file
          value = await file.async('arraybuffer');
        } else if (relativePath.endsWith('.txt')) {
          // Plain text
          value = await file.async('string');
        } else {
          // JSON file - parse it
          const content = await file.async('string');
          try {
            value = JSON.parse(content);
          } catch {
            value = content; // If not valid JSON, store as string
          }
        }

        // Write to IndexedDB
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.put({ key, value });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    }
  } catch (err) {
    console.error('Failed to import Authors data:', err);
  }
}

// Pick and validate a backup file (returns the zip if valid, null if cancelled/invalid)
export async function pickAndValidateBackup(): Promise<{ zip: JSZip; file: File } | { error: string } | null> {
  const file = await selectZipFile();
  if (!file) {
    return null; // User cancelled
  }

  try {
    const zip = await JSZip.loadAsync(file);
    const isValid = await validateBackupZip(zip);
    if (!isValid) {
      return { error: 'Invalid backup file. Please select a valid EverythingEbooks backup.' };
    }
    return { zip, file };
  } catch {
    return { error: 'Could not read the backup file. It may be corrupted.' };
  }
}

// Perform the actual import (call after user confirms)
export async function performImport(zip: JSZip): Promise<{ success: boolean; error?: string }> {
  try {
    // Clear existing data
    clearLocalStorage();
    await clearEreaderDB();
    await clearAuthorsDB();

    // Import from ZIP
    await importLocalStorage(zip);
    await importEreaderData(zip);
    await importAuthorsData(zip);

    return { success: true };
  } catch (err) {
    console.error('Import failed:', err);
    return { success: false, error: 'Import failed. The backup file may be corrupted.' };
  }
}
