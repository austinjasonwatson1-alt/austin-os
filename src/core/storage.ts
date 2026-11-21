/**
 * Local-first storage. IndexedDB is the primary store; every write also lands in a small
 * rolling snapshot ring so one bad save (or bad import) can be undone.
 *
 * IMPORTANT: browsers wipe IndexedDB when the user clears "cookies and site data".
 * That is why backups (see backup.ts) are a first-class feature, not an afterthought.
 */

import { pushSnapshot, type Snapshot } from './snapshots';

const DB_NAME = 'austin-os';
const STORE = 'kv';

const SNAP_PREFIX = 'snap:';
/** Device-local settings (e.g. the auto-backup file handle). Never part of a backup. */
export const SYS_PREFIX = 'sys:';

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
export const kvDel = (key: string) => tx('readwrite', (s) => s.delete(key));
export const kvKeys = (): Promise<string[]> => tx('readonly', (s) => s.getAllKeys() as IDBRequest<string[]>);

export type { Snapshot };

type SaveListener = (key: string) => void;
const saveListeners = new Set<SaveListener>();

/** Be told whenever user data is saved (the auto-backup listens here). Returns an unsubscribe. */
export function onSave(fn: SaveListener): () => void {
  saveListeners.add(fn);
  return () => void saveListeners.delete(fn);
}

/** Ring updates are read-modify-write, so they run one at a time or entries get lost. */
let ringQueue: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = ringQueue.then(fn, fn);
  ringQueue = run.catch(() => undefined);
  return run;
}

/** Resolves once every snapshot write queued so far has landed. */
export const snapshotsSettled = () => ringQueue.then(() => undefined);

async function addToRing<T>(key: string, snap: Snapshot<T>) {
  const ring = (await kvGet<Snapshot<T>[]>(SNAP_PREFIX + key)) ?? [];
  const next = pushSnapshot(ring, snap);
  if (next !== ring) await kvSet(SNAP_PREFIX + key, next);
}

/** Save `value` under `key` and, at most every few minutes, push it onto the snapshot ring. */
export function saveWithSnapshot<T>(key: string, value: T): Promise<void> {
  return queued(async () => {
    await kvSet(key, value);
    saveListeners.forEach((fn) => fn(key));
    await addToRing(key, { at: new Date().toISOString(), value });
  });
}

/**
 * Record a named restore point right now — call it with the data as it is BEFORE an import,
 * load or restore, so that change can be undone.
 */
export function snapshotNow<T>(key: string, value: T, label: string): Promise<void> {
  return queued(() => addToRing(key, { at: new Date().toISOString(), value, label }));
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

/** Every user-data key (snapshots and device-local settings excluded) — what a full backup contains. */
export async function dumpAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const k of await kvKeys()) {
    if (k.startsWith(SNAP_PREFIX) || k.startsWith(SYS_PREFIX)) continue;
    out[k] = await kvGet(k);
  }
  return out;
}

/**
 * Note that an item was deleted, so other devices drop it too when they sync.
 * Kept under 'sync.deleted' as { storeKey: { itemId: when } }.
 */
export function markDeleted(storeKey: string, id: string): Promise<void> {
  return queued(async () => {
    const cur = (await kvGet<Record<string, Record<string, string>>>('sync.deleted')) ?? {};
    const next = { ...cur, [storeKey]: { ...(cur[storeKey] ?? {}), [id]: new Date().toISOString() } };
    await kvSet('sync.deleted', next);
    saveListeners.forEach((fn) => fn('sync.deleted'));
  });
}
