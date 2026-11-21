/**
 * Plugs sync into the app: whenever another device's data arrives (the shared backup file, or the
 * encrypted cloud vault), merge it in (adding only, honouring deletions), with a restore point for
 * each area first, then reload the stores. Returns a line per area that changed.
 */
import { setPullHandler } from '../core/autoBackup';
import { dumpAll, saveWithSnapshot, snapshotNow } from '../core/storage';
import { DELETED, syncMerge } from '../core/syncLogic';
import { DESCRIBERS, reloadStores } from './RestoreBackup';

export async function applyRemote(remote: Record<string, unknown>, source: string): Promise<string[]> {
  const current = await dumpAll();
  const writes = syncMerge(current, remote);
  const changes: string[] = [];
  for (const [key, value] of Object.entries(writes)) {
    if (key !== DELETED && current[key] !== undefined) await snapshotNow(key, current[key], `Before syncing from ${source}`);
    await saveWithSnapshot(key, value);
    if (key === DELETED) continue;
    const d = DESCRIBERS[key];
    changes.push(d ? `${d.name}: ${current[key] === undefined ? `new, ${d.detail(value)}` : `${d.detail(current[key])} → ${d.detail(value)}`}` : key);
  }
  if (Object.keys(writes).length) await reloadStores();
  return changes;
}

export function startSync() {
  setPullHandler((remote, fileName) => applyRemote(remote, fileName));
}
