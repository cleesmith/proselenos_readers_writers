// src/services/libraryManuscriptService.ts
// Saves/loads extracted manuscript data in AppFileSystem > manuscript store.
// Uses { key, value } records — mirrors ProselenosLocal > manuscript pattern.
// Only one manuscript at a time — each new extraction overwrites the previous.
//
// This is the library-side equivalent of manuscriptStorage.ts,
// but targets AppFileSystem (same DB as webAppService.ts) instead
// of ProselenosLocal.

import type { ParsedEpub } from '@/services/epubService';
import type { ElementType } from '@/app/authors/elementTypes';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';

// ─── Types ──────────────────────────────────────────────────

export interface LibraryManuscriptMeta {
  title: string;
  author: string;
  language: string;
  subtitle?: string;
  publisher?: string;
  coverImageId: string | null;
  sections: LibrarySectionMeta[];
}

export interface LibrarySectionMeta {
  id: string;
  title: string;
  type: ElementType;
  sceneCraftConfig?: SceneCraftConfig;
}

// ─── IndexedDB helpers (AppFileSystem v2 — manuscript store) ─

const DB_NAME = 'AppFileSystem';
const DB_VERSION = 2;
const STORE = 'manuscript';

function openAppFileSystemDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains('manuscript')) {
        db.createObjectStore('manuscript', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putRecord(db: IDBDatabase, key: string, value: string | Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRecord<T = string | Blob>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result.value as T);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Clear all entries from AppFileSystem > manuscript store.
 */
export async function clearLibraryManuscript(): Promise<void> {
  const db = await openAppFileSystemDB();
  await clearStore(db);
}

/**
 * Extract a ParsedEpub into AppFileSystem > manuscript store.
 * Clears any existing manuscript first.
 */
export async function saveLibraryManuscript(parsed: ParsedEpub): Promise<void> {
  // Clear previous manuscript
  await clearLibraryManuscript();

  const db = await openAppFileSystemDB();

  // Save images
  if (parsed.images && parsed.images.length > 0) {
    for (const img of parsed.images) {
      await putRecord(db, `images/${img.filename}`, img.blob);
    }
  }

  // Save audio files
  if (parsed.audios && parsed.audios.length > 0) {
    for (const aud of parsed.audios) {
      await putRecord(db, `audio/${aud.filename}`, aud.blob);
    }
  }

  // Save cover image
  let coverImageId: string | null = null;
  if (parsed.coverImage) {
    const ext = parsed.coverImage.type === 'image/png' ? 'png' : 'jpg';
    coverImageId = `cover.${ext}`;
    await putRecord(db, coverImageId, parsed.coverImage);
  }

  // Save each section with normalized IDs (section-001, section-002, ...)
  const sectionMetas: LibrarySectionMeta[] = [];

  for (let i = 0; i < parsed.sections.length; i++) {
    const section = parsed.sections[i];
    if (!section) continue;

    const normalizedId = `section-${String(i + 1).padStart(3, '0')}`;
    const sectionType = section.type || 'chapter';

    // Save XHTML content
    await putRecord(db, `${normalizedId}.xhtml`, section.xhtml);

    sectionMetas.push({
      id: normalizedId,
      title: section.title,
      type: sectionType as ElementType,
      sceneCraftConfig: section.sceneCraftConfig,
    });
  }

  // Save meta.json
  const meta: LibraryManuscriptMeta = {
    title: parsed.title,
    author: parsed.author,
    language: parsed.language,
    subtitle: parsed.subtitle,
    publisher: parsed.publisher,
    coverImageId,
    sections: sectionMetas,
  };
  await putRecord(db, 'meta.json', JSON.stringify(meta));
}

/**
 * Load manuscript metadata from AppFileSystem > manuscript store.
 */
export async function loadLibraryManuscriptMeta(): Promise<LibraryManuscriptMeta | null> {
  const db = await openAppFileSystemDB();
  const raw = await getRecord<string>(db, 'meta.json');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LibraryManuscriptMeta;
  } catch {
    return null;
  }
}

/**
 * Load a section's XHTML content.
 */
export async function getLibraryManuscriptSection(sectionId: string): Promise<string | null> {
  const db = await openAppFileSystemDB();
  return getRecord<string>(db, `${sectionId}.xhtml`);
}

/**
 * Load an inline image blob.
 */
export async function getLibraryManuscriptImage(filename: string): Promise<Blob | null> {
  const db = await openAppFileSystemDB();
  return getRecord<Blob>(db, `images/${filename}`);
}

/**
 * Load an audio file blob.
 */
export async function getLibraryManuscriptAudio(filename: string): Promise<Blob | null> {
  const db = await openAppFileSystemDB();
  return getRecord<Blob>(db, `audio/${filename}`);
}

/**
 * Load the cover image blob using coverImageId from meta.
 */
export async function getLibraryManuscriptCover(): Promise<Blob | null> {
  const meta = await loadLibraryManuscriptMeta();
  if (!meta?.coverImageId) return null;
  const db = await openAppFileSystemDB();
  return getRecord<Blob>(db, meta.coverImageId);
}
