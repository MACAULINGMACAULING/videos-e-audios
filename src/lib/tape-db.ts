import type { Tape, TapeMeta } from "./tape-types";

const DB_NAME = "rpg-vhs-archive";
const DB_VERSION = 1;
const STORE = "tapes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = fn(store);
    if (result instanceof IDBRequest) {
      result.onsuccess = () => resolve(result.result as T);
      result.onerror = () => reject(result.error);
    } else {
      result.then(resolve, reject);
    }
  });
}

export async function saveTape(tape: Tape): Promise<void> {
  await tx("readwrite", (s) => s.put(tape));
}

export async function getTape(id: string): Promise<Tape | undefined> {
  return tx("readonly", (s) => s.get(id) as IDBRequest<Tape | undefined>);
}

export async function deleteTape(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function listTapes(): Promise<TapeMeta[]> {
  const all = await tx<Tape[]>("readonly", (s) => s.getAll() as IDBRequest<Tape[]>);
  return all
    .map(({ cover: _c, video: _v, ...meta }) => meta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function newTapeId() {
  return `tape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
