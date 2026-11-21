/**
 * Plugs two-device sync into auto-backup: when the shared file holds another device's changes,
 * merge them in (adding only), with a restore point for each area first, then reload the stores.
 */
import { setPullHandler } from '../core/autoBackup';
import { dumpAll, saveWithSnapshot, snapshotNow } from '../core/storage';
import { syncMerge } from '../core/syncLogic';
import { DESCRIBERS, reloadStores } from './RestoreBackup';

export function startSync() {
  setPullHandler(async (remote, fileName) => {
    const current = await dumpAll();
    const writes = syncMerge(current, remote);
    const changes: string[] = [];
    for (const [key, value] of Object.entries(writes)) {
      if (current[key] !== undefined) await snapshotNow(key, current[key], `Before syncing from ${fileName}`);
      await saveWithSnapshot(key, value);
      const d = DESCRIBERS[key];
      changes.push(d ? `${d.name}: ${current[key] === undefined ? `new, ${d.detail(value)}` : `${d.detail(current[key])} → ${d.detail(value)}`}` : key);
    }
    if (changes.length) await reloadStores();
    return changes;
  });
}
