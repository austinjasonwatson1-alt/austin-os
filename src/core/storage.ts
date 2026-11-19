/**
 * Local-first storage. IndexedDB is the primary store; every write also lands in a small
 * rolling snapshot ring so one bad save (or bad import) can be undone.
 *
 * IMPORTANT: browsers wipe IndexedDB when the user clears "cookies and site data".
 * That is why backups (see backup.ts) are a first-class feature, not an afterthought.
 */

const DB_NAME = 'austin-os';
const STORE = 'kv';
const SNAP_PREFIX = 'snap:';
const SNAP_KEEP = 8;
const SNAP_MIN_GAP_MS = 5 * 60 * 1000;

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const kvGet = <T>(key: string): Promise<T | undefined> => tx('readonly', (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key));
export const kvKeys = (): Promise<string[]> => tx('readonly', (s) => s.getAllKeys() as IDBRequest<string[]>);

export interface Snapshot<T = unknown> {
  at: string;
  value: T;
}

/** Save `value` under `key` and, at most every few minutes, push it onto the snapshot ring. */
export async function saveWithSnapshot<T>(key: string, value: T): Promise<void> {
  await kvSet(key, value);
  const ring = (await kvGet<Snapshot<T>[]>(SNAP_PREFIX + key)) ?? [];
  const last = ring[0];
  if (last && Date.now() - new Date(last.at).getTime() < SNAP_MIN_GAP_MS) return;
  const next = [{ at: new Date().toISOString(), value }, ...ring].slice(0, SNAP_KEEP);
  await kvSet(SNAP_PREFIX + key, next);
}

export const listSnapshots = <T>(key: string) => kvGet<Snapshot<T>[]>(SNAP_PREFIX + key).then((r) => r ?? []);

/** Ask the browser not to evict our data under storage pressure. Best effort. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Every user-data key (snapshots excluded) — what a full backup contains. */
export async function dumpAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const k of await kvKeys()) {
    if (k.startsWith(SNAP_PREFIX)) continue;
    out[k] = await kvGet(k);
  }
  return out;
}
