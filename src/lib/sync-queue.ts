// Offline-Outbox für Lese-Fortschritt und Annotationen.
// Speichert ausstehende Operationen in IndexedDB und flusht sie bei Online-Status.
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "pages-sync";
const DB_VERSION = 1;
const STORE = "outbox";

export type QueueOp =
  | { kind: "progress"; bookId: string; page: number; pages: number | null; ts: number }
  | { kind: "annotation.insert"; tempId: string; row: {
      user_id: string; book_id: string; page: number; type: string; data: any;
    }; ts: number }
  | { kind: "annotation.delete"; id: string; ts: number };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no idb"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    Promise.resolve(fn(s)).then((v) => { t.oncomplete = () => { db.close(); resolve(v); }; }).catch(reject);
    t.onerror = () => reject(t.error);
  });
}

export async function enqueue(op: QueueOp): Promise<void> {
  // Für progress: vorhandene Einträge desselben Buches ersetzen (nur letzter zählt)
  await withStore("readwrite", async (s) => {
    if (op.kind === "progress") {
      const all = await reqToPromise<any[]>(s.getAll());
      for (const e of all) {
        if (e.op?.kind === "progress" && e.op.bookId === op.bookId) {
          s.delete(e.key);
        }
      }
    }
    s.add({ op });
  });
}

export async function listQueue(): Promise<{ key: number; op: QueueOp }[]> {
  return withStore("readonly", async (s) => {
    const all = await reqToPromise<any[]>(s.getAll());
    const keys = await reqToPromise<any[]>(s.getAllKeys());
    return all.map((e, i) => ({ key: keys[i] as number, op: e.op as QueueOp }));
  });
}

async function removeKey(key: number) {
  await withStore("readwrite", (s) => { s.delete(key); });
}

function reqToPromise<T>(r: IDBRequest): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result as T); r.onerror = () => rej(r.error); });
}

let flushing = false;
type FlushResult = { flushed: number; remaining: number; inserts: Array<{ tempId: string; row: any }> };

export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { flushed: 0, remaining: 0, inserts: [] };
  flushing = true;
  const inserts: FlushResult["inserts"] = [];
  let flushed = 0;
  try {
    const items = await listQueue();
    for (const { key, op } of items) {
      try {
        if (op.kind === "progress") {
          const upd: any = { current_page: op.page };
          if (op.pages != null) upd.pages = op.pages;
          const { error } = await supabase.from("books").update(upd).eq("id", op.bookId);
          if (error) throw error;
        } else if (op.kind === "annotation.insert") {
          const { data, error } = await supabase.from("annotations").insert(op.row).select("*").single();
          if (error) throw error;
          inserts.push({ tempId: op.tempId, row: data });
        } else if (op.kind === "annotation.delete") {
          const { error } = await supabase.from("annotations").delete().eq("id", op.id);
          if (error) throw error;
        }
        await removeKey(key);
        flushed++;
      } catch {
        // Bei Fehler abbrechen — beim nächsten Versuch erneut
        break;
      }
    }
    const remaining = (await listQueue()).length;
    return { flushed, remaining, inserts };
  } finally {
    flushing = false;
  }
}
