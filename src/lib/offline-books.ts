// Lokaler Offline-Cache für Bücher (Blobs) und Bibliotheks-Metadaten.
// Nutzt IndexedDB direkt (keine Dependencies).

const DB_NAME = "pages-offline";
const DB_VERSION = 1;
const STORE_BOOKS = "books"; // key: bookId -> { blob, mime, savedAt }
const STORE_META = "meta"; // key: string -> any (z.B. "library" -> Book[])

type BookCacheEntry = {
  blob: Blob;
  mime: string;
  savedAt: number;
  title?: string;
  format?: "pdf" | "epub";
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nicht verfügbar."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) db.createObjectStore(STORE_BOOKS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
    t.onerror = () => reject(t.error);
  });
}

export async function saveBookBlob(bookId: string, blob: Blob, info?: { title?: string; format?: "pdf" | "epub" }) {
  const entry: BookCacheEntry = {
    blob,
    mime: blob.type || "application/octet-stream",
    savedAt: Date.now(),
    title: info?.title,
    format: info?.format,
  };
  await tx(STORE_BOOKS, "readwrite", (s) => s.put(entry, bookId));
}

export async function getBookBlob(bookId: string): Promise<Blob | null> {
  try {
    const entry = await tx<BookCacheEntry | undefined>(STORE_BOOKS, "readonly", (s) => s.get(bookId));
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

export async function hasBookCached(bookId: string): Promise<boolean> {
  try {
    const key = await tx<IDBValidKey | undefined>(STORE_BOOKS, "readonly", (s) => s.getKey(bookId));
    return key !== undefined;
  } catch {
    return false;
  }
}

export async function listCachedBookIds(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>(STORE_BOOKS, "readonly", (s) => s.getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  }
}

export async function removeBookBlob(bookId: string) {
  await tx(STORE_BOOKS, "readwrite", (s) => s.delete(bookId));
}

export async function saveMeta<T>(key: string, value: T) {
  await tx(STORE_META, "readwrite", (s) => s.put(value, key));
}

export async function getMeta<T>(key: string): Promise<T | null> {
  try {
    const v = await tx<T | undefined>(STORE_META, "readonly", (s) => s.get(key));
    return (v ?? null) as T | null;
  } catch {
    return null;
  }
}
