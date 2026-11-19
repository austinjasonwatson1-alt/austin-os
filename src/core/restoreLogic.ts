/** Pure planning for "restore everything from a backup file". No browser APIs in here. */

import { countEntries } from './autoBackupLogic';

/** How a module names and sizes its stored value, so the preview can say "270 days" not "1,083 entries". */
export interface Describer {
  name: string;
  /** A single number to compare "now" against "in the file" (e.g. days logged). */
  size: (v: unknown) => number;
  /** Human summary, e.g. "270 days · 1 deadline". */
  detail: (v: unknown) => string;
}

export type Change = 'new' | 'same' | 'more' | 'less' | 'different';

export interface RestoreItem {
  key: string;
  name: string;
  now: string | null;
  file: string;
  change: Change;
}

export interface RestorePlan {
  exportedAt: string | null;
  items: RestoreItem[];
  /** Exactly what will be written, by key (unchanged keys left out). */
  writes: Record<string, unknown>;
  /** Names of anything the restore would make smaller. */
  shrinks: string[];
}

/** Keys a backup may carry that a restore should leave alone. */
const SKIP = (k: string) => k.startsWith('snap:') || k.startsWith('sys:') || k === 'os.backupMeta';

const fallback = (key: string): Describer => ({
  name: key,
  size: countEntries,
  detail: (v) => `${countEntries(v)} entries`,
});

export function planRestore(
  current: Record<string, unknown>,
  parsed: unknown,
  describers: Record<string, Describer>,
): RestorePlan | { error: string } {
  const p = parsed as { app?: unknown; data?: unknown; exportedAt?: unknown } | null;
  if (!p || typeof p !== 'object' || p.app !== 'austin-os' || !p.data || typeof p.data !== 'object') {
    return { error: "That isn't an Austin OS backup. (An old Ledger export goes through The Ledger → Import backup.)" };
  }
  const items: RestoreItem[] = [];
  const writes: Record<string, unknown> = {};
  const shrinks: string[] = [];
  for (const [key, value] of Object.entries(p.data as Record<string, unknown>)) {
    if (SKIP(key) || value === undefined) continue;
    const d = describers[key] ?? fallback(key);
    const cur = current[key];
    let change: Change;
    if (cur === undefined) change = 'new';
    else if (JSON.stringify(cur) === JSON.stringify(value)) change = 'same';
    else {
      const a = d.size(cur), b = d.size(value);
      change = b > a ? 'more' : b < a ? 'less' : 'different';
    }
    if (change !== 'same') writes[key] = value;
    if (change === 'less') shrinks.push(d.name);
    items.push({ key, name: d.name, now: cur === undefined ? null : d.detail(cur), file: d.detail(value), change });
  }
  if (items.length === 0) return { error: 'That backup is empty — there is nothing in it to restore.' };
  return { exportedAt: typeof p.exportedAt === 'string' ? p.exportedAt : null, items, writes, shrinks };
}
