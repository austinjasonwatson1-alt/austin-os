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
  /** Re-grant write access after a browser restart. Must run from a click. */
  reconnect: () => Promise<void>;
  retry: () => Promise<void>;
  /** Write even though the file looks like it holds more data. The UI must confirm first. */
  overwrite: () => Promise<void>;
  turnOff: () => Promise<void>;
  /** The next write may make the file smaller (the user deliberately restored older data). */
  expectShrink: () => void;
}

let handle: FileHandle | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let again = false;
let allowShrink = false;

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
      if (permission === 'granted') await write();
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
      await write();
    },

    retry: () => write(),

    overwrite: () => write(true),

    expectShrink() {
      allowShrink = true;
    },

    async turnOff() {
      clearTimeout(timer);
      handle = null;
      await kvDel(KEY);
      set({ fileName: null, permission: null, lastWriteAt: null, error: null, risk: null });
    },
  };
});
