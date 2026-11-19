import { create } from 'zustand';
import { dumpAll, kvGet, kvSet } from './storage';
import { todayISO } from './dates';

const META_KEY = 'os.backupMeta';

interface BackupState {
  lastBackupAt: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  exportAll: () => Promise<void>;
}

/** Whole-OS backup: one JSON file holding every module's data. */
export const useBackup = create<BackupState>((set) => ({
  lastBackupAt: null,
  loaded: false,
  async load() {
    const meta = await kvGet<{ lastBackupAt: string }>(META_KEY);
    set({ lastBackupAt: meta?.lastBackupAt ?? null, loaded: true });
  },
  async exportAll() {
    const payload = { app: 'austin-os', version: 1, exportedAt: new Date().toISOString(), data: await dumpAll() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }));
    a.download = `austin-os-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    const lastBackupAt = new Date().toISOString();
    await kvSet(META_KEY, { lastBackupAt });
    set({ lastBackupAt });
  },
}));

export function daysSinceBackup(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
