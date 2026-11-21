/**
 * Encrypted cloud sync through the user's own Supabase project. Off until set up in Settings.
 * The config (project URL, public key, passphrase) lives only on this device (`sys:` key, never
 * in backups). Every sync: read the vault, decrypt, merge in (adding only, deletions respected),
 * then encrypt everything and write it back.
 */
import { create } from 'zustand';
import { buildBackupPayload } from '../core/autoBackupLogic';
import { deriveKey, fetchVault, open, seal, storeVault, vaultId, type CloudConfig } from '../core/cloudCrypto';
import { dumpAll, kvDel, kvGet, kvSet, onSave, SYS_PREFIX } from '../core/storage';
import { applyRemote } from './sync';

const KEY = SYS_PREFIX + 'cloud';

interface CloudState {
  configured: boolean;
  busy: boolean;
  lastSync: string | null;
  lastChanges: string[];
  error: string | null;
  start: () => Promise<void>;
  connect: (cfg: CloudConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
}

let cfg: CloudConfig | null = null;
let key: CryptoKey | null = null;
let id = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let again = false;

export const useCloud = create<CloudState>((set, get) => ({
  configured: false,
  busy: false,
  lastSync: null,
  lastChanges: [],
  error: null,

  async start() {
    if (started) return;
    started = true;
    const saved = await kvGet<CloudConfig>(KEY);
    if (saved) {
      cfg = saved;
      key = await deriveKey(saved.passphrase);
      id = await vaultId(saved.passphrase);
      set({ configured: true });
      void get().syncNow();
    }
    // After a save, push a few seconds later; when the app comes back into view, pull.
    onSave((k) => {
      if (!cfg || k.startsWith(SYS_PREFIX) || k === 'os.backupMeta') return;
      clearTimeout(timer);
      timer = setTimeout(() => void get().syncNow(), 5000);
    });
    document.addEventListener('visibilitychange', () => { if (cfg && document.visibilityState === 'visible') void get().syncNow(); });
    setInterval(() => { if (cfg && document.visibilityState === 'visible') void get().syncNow(); }, 5 * 60_000);
  },

  async connect(next) {
    set({ busy: true, error: null });
    try {
      const k = await deriveKey(next.passphrase);
      const vid = await vaultId(next.passphrase);
      // Prove the settings work (and the passphrase opens any existing vault) before saving them.
      const row = await fetchVault(next, vid);
      if (row) await open(k, row.data);
      cfg = next; key = k; id = vid;
      await kvSet(KEY, next);
      set({ configured: true, busy: false });
      await get().syncNow();
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? (e.name === 'OperationError' ? 'That passphrase doesn’t open the vault already in this project.' : e.message) : String(e) });
    }
  },

  async disconnect() {
    cfg = null; key = null; id = '';
    await kvDel(KEY);
    set({ configured: false, lastSync: null, lastChanges: [], error: null });
  },

  async syncNow() {
    if (!cfg || !key) return;
    if (get().busy) { again = true; return; }
    set({ busy: true });
    try {
      const row = await fetchVault(cfg, id);
      let changes: string[] = [];
      if (row) {
        const payload = JSON.parse(await open(key, row.data)) as { data?: Record<string, unknown> };
        if (payload.data) changes = await applyRemote(payload.data, 'the cloud');
      }
      const out = buildBackupPayload(await dumpAll(), new Date());
      await storeVault(cfg, id, await seal(key, JSON.stringify(out)));
      set({ lastSync: new Date().toISOString(), lastChanges: changes.length ? changes : get().lastChanges, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
      if (again) { again = false; void get().syncNow(); }
    }
  },
}));
