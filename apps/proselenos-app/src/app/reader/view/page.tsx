'use client';

import { useState, useEffect, useRef } from 'react';
import FullBookView from './FullBookView';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';

// ─── Types matching libraryManuscriptService store layout ────

interface LibraryManuscriptMeta {
  title: string;
  author: string;
  sections: Array<{
    id: string;
    title: string;
    sceneCraftConfig?: SceneCraftConfig;
  }>;
  coverImageId: string | null;
}

interface LoadedData {
  bookTitle: string;
  bookAuthor: string;
  sections: Array<{
    title: string;
    xhtml: string;
    sceneCraftConfig: SceneCraftConfig | null;
  }>;
  imageUrls: Map<string, string>;
  audioUrls: Map<string, string>;
}

// ─── IndexedDB helpers ───────────────────────────────────────

const DB_NAME = 'AppFileSystem';
const DB_VERSION = 2;
const STORE = 'manuscript';

function openDB(): Promise<IDBDatabase> {
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

function getRecord<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
    req.onerror = () => reject(req.error);
  });
}

function getAllKeys(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

// ─── Component ───────────────────────────────────────────────

export default function ReaderViewPage() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadManuscript() {
      try {
        const db = await openDB();

        // 1. Read meta.json
        const metaRaw = await getRecord<string>(db, 'meta.json');
        if (!metaRaw) {
          setError('No manuscript found. Please open a book from the library first.');
          setLoading(false);
          return;
        }

        const meta: LibraryManuscriptMeta = JSON.parse(metaRaw);

        // 2. Read all section XHTML
        const sections: LoadedData['sections'] = [];
        for (const sec of meta.sections) {
          const xhtml = await getRecord<string>(db, `${sec.id}.xhtml`);
          sections.push({
            title: sec.title,
            xhtml: xhtml || '',
            sceneCraftConfig: sec.sceneCraftConfig || null,
          });
        }

        if (cancelled) return;

        // 3. Enumerate all keys to find images/* and audio/*
        const allKeys = await getAllKeys(db);
        const imageKeys = allKeys.filter(k => k.startsWith('images/'));
        const audioKeys = allKeys.filter(k => k.startsWith('audio/'));

        // 4. Read all images → blob URLs
        const imageUrls = new Map<string, string>();
        const blobUrls: string[] = [];
        for (const key of imageKeys) {
          const blob = await getRecord<Blob>(db, key);
          if (blob && blob instanceof Blob) {
            const url = URL.createObjectURL(blob);
            const filename = key.replace(/^images\//, '');
            imageUrls.set(filename, url);
            // Also store with full key for lookups that include prefix
            imageUrls.set(key, url);
            blobUrls.push(url);
          }
        }

        if (cancelled) {
          blobUrls.forEach(u => URL.revokeObjectURL(u));
          return;
        }

        // 5. Read all audio → blob URLs
        const audioUrls = new Map<string, string>();
        for (const key of audioKeys) {
          const blob = await getRecord<Blob>(db, key);
          if (blob && blob instanceof Blob) {
            const url = URL.createObjectURL(blob);
            const filename = key.replace(/^audio\//, '');
            audioUrls.set(filename, url);
            audioUrls.set(key, url);
            blobUrls.push(url);
          }
        }

        if (cancelled) {
          blobUrls.forEach(u => URL.revokeObjectURL(u));
          return;
        }

        // 6. Read cover image → blob URL (stored under imageUrls too)
        if (meta.coverImageId) {
          const coverBlob = await getRecord<Blob>(db, meta.coverImageId);
          if (coverBlob && coverBlob instanceof Blob) {
            const url = URL.createObjectURL(coverBlob);
            imageUrls.set(meta.coverImageId, url);
            blobUrls.push(url);
          }
        }

        db.close();

        if (cancelled) {
          blobUrls.forEach(u => URL.revokeObjectURL(u));
          return;
        }

        blobUrlsRef.current = blobUrls;
        setData({
          bookTitle: meta.title,
          bookAuthor: meta.author,
          sections,
          imageUrls,
          audioUrls,
        });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load manuscript:', err);
          setError(`Failed to load manuscript: ${(err as Error).message}`);
          setLoading(false);
        }
      }
    }

    loadManuscript();

    return () => {
      cancelled = true;
      // Revoke all blob URLs on unmount
      blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      blobUrlsRef.current = [];
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#060608',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#5a554e', fontFamily: "Georgia, 'EB Garamond', serif",
        fontSize: '14px', letterSpacing: '0.1em',
      }}>
        Loading manuscript...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#060608',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#c8c0b4', fontFamily: "Georgia, 'EB Garamond', serif",
        fontSize: '14px', letterSpacing: '0.05em',
      }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <FullBookView
      bookTitle={data.bookTitle}
      bookAuthor={data.bookAuthor}
      sections={data.sections}
      imageUrls={data.imageUrls}
      audioUrls={data.audioUrls}
    />
  );
}
