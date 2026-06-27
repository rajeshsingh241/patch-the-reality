/**
 * Simple IndexedDB-backed media store for mock poll images/videos.
 * localStorage can't hold large base64 data URLs, so we store
 * the actual File blobs here keyed by poll ID.
 */

const DB_NAME = "ptr_media_store";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a File/Blob under the given key (poll ID). */
export async function saveMedia(key: string, file: File | Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load a Blob for the given key and return an object URL you can use in <img>/<video>. */
export async function loadMediaUrl(key: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => {
      const blob = req.result;
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
