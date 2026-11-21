/**
 * Auto-backup: the user picks a file once (File System Access API) and every save rewrites it
 * with a full backup a moment later. The file lives outside the browser, so clearing site data
 * can't take it — put it in a synced folder and it survives a dead laptop too.
 *
 * The file handle is kept in IndexedDB under a `sys:` key (never inside a backup). After a browser
 * restart, writing usually needs the user's OK again, which can only be asked for on a click.
 */
import { create } from 'zustand';
import { buildBackupPayload, overwriteRisk, type OverwriteRisk } from './autoBackupLogic';
import { useBackup } from './backup';
import { dumpAll, kvDel, kvGet, kvSet, onSave, SYS_PREFIX } from './storage';

type PermState = 'granted' | 'denied' | 'prompt';
interface PermDesc { mode: 'readwrite' }
interface Writable { write(data: string): Promise<void>; close(): Promise<void> }
/** The parts of FileSystemFileHandle we use, typed locally since not every DOM lib has them. */
interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
  queryPermission?(d: PermDesc): Promise<PermState>;
  requestPermission?(d: PermDesc): Promise<PermState>;
}
type SavePicker = (opts: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileHandle>;

const KEY = SYS_PREFIX + 'autoBackup';
const DEBOUNCE_MS = 2000;
const RW: PermDesc = { mode: 'readwrite' };

interface Saved { handle: FileHandle; lastWriteAt: string | null }

type OpenPicker = (opts: { types?: { description: string; accept: Record<string, string[]> }[]; multiple?: boolean }) => Promise<FileHandle[]>;
const openPicker = (): OpenPicker | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { showOpenFilePicker?: OpenPicker }).showOpenFilePicker;

const picker = (): SavePicker | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;

interface AutoBackupState {
  supported: boolean;
  started: boolean;
  fileName: string | null;
  permission: PermState | null;
  lastWriteAt: string | null;
  error: string | null;
  risk: OverwriteRisk | null;
  writing: boolean;
  /** Load the saved file, listen for saves. Safe to call more than once. */
  start: () => Promise<void>;
  /** Pick (or change) the backup file. Must run from a click. */
  choose: () => Promise<void>;
  /** Join the backup file another device already writes to (e.g. in iCloud Drive). Must run from a click. */
  connect: () => Promise<void>;
  /** Re-grant write access after a browser restart. Must run from a click. */
  reconnect: () => Promise<void>;
  retry: () => Promise<void>;
  /** Write even though the file looks like it holds more data. The UI must confirm first. */
  overwrite: () => Promise<void>;
  turnOff: () => Promise<void>;
  /** The next write may make the file smaller (the user deliberately restored older data). */
  expectShrink: () => void;
  /** Read the backup file's current contents (e.g. to restore from it after a wipe). */
  readFile: () => Promise<{ name: string; text: string } | null>;
  /** Bring in changes another device wrote to the shared file. */
  pull: () => Promise<void>;
  /** The last time something came in from another device, and what. */
  lastSync: { at: string; changes: string[] } | null;
}

/** Set by the shell: merges another device's data in and returns a line per changed area. */
type PullHandler = (data: Record<string, unknown>, fileName: string) => Promise<string[]>;
let onPull: PullHandler | null = null;
export const setPullHandler = (fn: PullHandler) => { onPull = fn; };

let handle: FileHandle | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let again = false;
let allowShrink = false;
let pulling = false;

export const useAutoBackup = create<AutoBackupState>((set, get) => {
  const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function write(force = false): Promise<void> {
    if (!handle || get().permission !== 'granted') return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    set({ writing: true });
    try {
      const payload = buildBackupPayload(await dumpAll(), new Date());
      if (!force) {
        const existing = await (await handle.getFile()).text();
        const risk = overwriteRisk(existing, payload);
        if (risk && !(risk.kind === 'shrink' && allowShrink)) return void set({ risk });
      }
      const w = await handle.createWritable();
      await w.write(JSON.stringify(payload, null, 1));
      await w.close();
      const at = payload.exportedAt;
      await kvSet(KEY, { handle, lastWriteAt: at } satisfies Saved);
      await useBackup.getState().markBackedUp(at);
      allowShrink = false;
      set({ lastWriteAt: at, error: null, risk: null });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') set({ permission: 'prompt' });
      else set({ error: errText(e) });
    } finally {
      busy = false;
      set({ writing: false });
      if (again) {
        again = false;
        schedule();
      }
    }
  }

  function schedule() {
    if (!handle) return;
    clearTimeout(timer);
    timer = setTimeout(() => void write(), DEBOUNCE_MS);
  }

  return {
    supported: typeof picker() === 'function',
    started: false,
    fileName: null,
    permission: null,
    lastWriteAt: null,
    error: null,
    risk: null,
    writing: false,
    lastSync: null,

    async pull() {
      if (!handle || get().permission !== 'granted' || !onPull || pulling) return;
      pulling = true;
      try {
        const text = await (await handle.getFile()).text();
        let p: { app?: string; exportedAt?: string; data?: Record<string, unknown> } | null = null;
        try { p = JSON.parse(text); } catch { return; }
        // Our own last write: nothing new. Anything else was written by another device.
        if (!p || p.app !== 'austin-os' || !p.data || !p.exportedAt || p.exportedAt === get().lastWriteAt) return;
        const changes = await onPull(p.data, handle.name);
        if (changes.length) set({ lastSync: { at: new Date().toISOString(), changes } });
        // The local copy now holds everything in the file plus our own, so the file can be rewritten safely.
        allowShrink = false;
        await write();
      } catch (e) {
        set({ error: errText(e) });
      } finally {
        pulling = false;
      }
    },

    async start() {
      if (get().started) return;
      set({ started: true });
      onSave(schedule);
      if (!get().supported) return;
      const saved = await kvGet<Saved>(KEY);
      if (!saved?.handle) return;
      handle = saved.handle;
      let permission: PermState = 'prompt';
      try {
        permission = (await handle.queryPermission?.(RW)) ?? 'prompt';
      } catch {
        /* treat as needing a prompt */
      }
      set({ fileName: handle.name, lastWriteAt: saved.lastWriteAt, permission });
      if (permission === 'granted') await get().pull().then(() => write());
      // Check for the other device's changes whenever the app comes back into view, and every few minutes.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void get().pull(); });
      setInterval(() => { if (document.visibilityState === 'visible') void get().pull(); }, 5 * 60_000);
    },

    async choose() {
      const pick = picker();
      if (!pick) return;
      let h: FileHandle;
      try {
        h = await pick({
          suggestedName: 'austin-os-autobackup.json',
          types: [{ description: 'Austin OS backup', accept: { 'application/json': ['.json'] } }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        return void set({ error: errText(e) });
      }
      handle = h;
      await kvSet(KEY, { handle: h, lastWriteAt: null } satisfies Saved);
      set({ fileName: h.name, permission: 'granted', lastWriteAt: null, error: null, risk: null });
      // Picking a file another device already writes to: bring its data in first, then keep both in step.
      await get().pull();
      await write();
    },

    async connect() {
      const pick = openPicker();
      if (!pick) return;
      let h: FileHandle;
      try {
        [h] = await pick({ types: [{ description: 'Austin OS backup', accept: { 'application/json': ['.json'] } }] });
        const perm = (await h.requestPermission?.(RW)) ?? 'granted';
        if (perm !== 'granted') return void set({ error: 'Write access to that file was not given.' });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        return void set({ error: errText(e) });
      }
      handle = h;
      await kvSet(KEY, { handle: h, lastWriteAt: null } satisfies Saved);
      set({ fileName: h.name, permission: 'granted', lastWriteAt: null, error: null, risk: null });
      await get().pull();
      await write();
    },

    async reconnect() {
      if (!handle) return;
      try {
        const permission = (await handle.requestPermission?.(RW)) ?? 'granted';
        set({ permission });
      } catch (e) {
        return void set({ error: errText(e) });
      }
      await get().pull();
      await write();
    },

    retry: () => write(),

    overwrite: () => write(true),

    expectShrink() {
      allowShrink = true;
    },

    async readFile() {
      if (!handle) return null;
      return { name: handle.name, text: await (await handle.getFile()).text() };
    },

    async turnOff() {
      clearTimeout(timer);
      handle = null;
      await kvDel(KEY);
      set({ fileName: null, permission: null, lastWriteAt: null, error: null, risk: null });
    },
  };
});
