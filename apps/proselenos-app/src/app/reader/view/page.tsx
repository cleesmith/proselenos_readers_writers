'use client';
import { useEffect } from 'react';

export default function ReaderViewPage() {
  useEffect(() => {
    (async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('AppFileSystem', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const result = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        const get = store.get('__reader_view_html');
        get.onsuccess = () => {
          const html = get.result?.content;
          // Clean up after reading
          store.delete('__reader_view_html');
          resolve(html || null);
        };
        get.onerror = () => reject(get.error);
      });
      db.close();

      if (result) {
        document.open();
        document.write(result);
        document.close();
      }
    })();
  }, []);

  return null;
}
