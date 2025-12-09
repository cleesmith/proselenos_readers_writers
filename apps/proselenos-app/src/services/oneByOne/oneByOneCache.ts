/**
 * IndexedDB cache for One-by-one editing sessions
 * Stores session data locally for fast access and page refresh resilience
 * Completely separate from e-reader's AppFileSystem database
 */

import { OneByOneSession } from '@/types/oneByOne';

const DB_NAME = 'ProselenosOneByOne';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

/**
 * Open the IndexedDB database, creating stores on upgrade
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('OneByOne IndexedDB error:', event);
      reject(new Error('Could not open IndexedDB'));
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectName', 'projectName', { unique: false });
        store.createIndex('filePath', 'filePath', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

/**
 * Save or update a session
 */
export async function saveSession(session: OneByOneSession): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Update timestamp
      session.updatedAt = Date.now();
      store.put(session);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = (event) => {
        db.close();
        console.error('Error saving session:', event);
        reject(new Error('Failed to save session'));
      };
    });
  } catch (error) {
    console.error('Failed to save session to IndexedDB:', error);
    throw error;
  }
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<OneByOneSession | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to get session from IndexedDB:', error);
    return null;
  }
}

/**
 * Get active (most recent) session for a specific file
 */
export async function getSessionForFile(
  projectName: string,
  filePath: string
): Promise<OneByOneSession | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('filePath');
      const request = index.getAll(filePath);

      request.onsuccess = () => {
        const sessions = (request.result as OneByOneSession[])
          .filter((s) => s.projectName === projectName)
          .sort((a, b) => b.updatedAt - a.updatedAt);

        resolve(sessions[0] || null);
      };

      request.onerror = () => {
        resolve(null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to get session for file:', error);
    return null;
  }
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(sessionId);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = (event) => {
        db.close();
        console.error('Error deleting session:', event);
        reject(new Error('Failed to delete session'));
      };
    });
  } catch (error) {
    console.error('Failed to delete session from IndexedDB:', error);
    throw error;
  }
}

/**
 * Delete all sessions for a project (cleanup utility)
 */
export async function deleteSessionsForProject(projectName: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('projectName');
      const request = index.getAll(projectName);

      request.onsuccess = () => {
        const sessions = request.result as OneByOneSession[];
        sessions.forEach((session) => {
          store.delete(session.id);
        });
      };

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  } catch (error) {
    console.error('Failed to delete sessions for project:', error);
    throw error;
  }
}

/**
 * Clear all sessions by deleting the entire IndexedDB database
 * More robust than store.clear() - doesn't require opening the database first
 */
export async function clearAllSessions(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve();
      return;
    }

    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log('OneByOne database deleted successfully');
      resolve();
    };

    request.onerror = (event) => {
      console.error('Error deleting OneByOne database:', event);
      resolve(); // Resolve anyway to not block UI
    };

    request.onblocked = () => {
      console.warn('OneByOne database deletion blocked - will complete when connections close');
      resolve(); // Resolve anyway - deletion will proceed when possible
    };
  });
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}
