/** Pure helpers for whole-OS backups and the auto-backup file. No browser APIs in here. */

export interface BackupPayload {
  app: 'austin-os';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function buildBackupPayload(data: Record<string, unknown>, now: Date): BackupPayload {
  return { app: 'austin-os', version: 1, exportedAt: now.toISOString(), data };
}

/** How much data a value holds: the number of primitive leaves (minutes, notes, dates…). */
export function countEntries(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v !== 'object') return 1;
  return Object.values(v as Record<string, unknown>).reduce<number>((n, x) => n + countEntries(x), 0);
}

export interface OverwriteRisk {
  /** `foreign`: the file isn't an Austin OS backup. `shrink`: it holds clearly more than the browser does. */
  kind: 'foreign' | 'shrink';
  fileEntries: number;
  nextEntries: number;
}

/** Losing this many entries (or 10%, whichever is larger) counts as a suspicious shrink. */
export const SHRINK_MIN_LOST = 5;

/**
 * Decide whether writing `next` over a file whose current text is `existing` could destroy data.
 * The case this exists for: browser data gets cleared, the app reopens empty, and the auto-backup
 * would happily overwrite the only good copy with nothing.
 */
export function overwriteRisk(existing: string | null, next: BackupPayload): OverwriteRisk | null {
  if (!existing || !existing.trim()) return null;
  const nextEntries = countEntries(next.data);
  let parsed: unknown;
  try {
    parsed = JSON.parse(existing);
  } catch {
    return { kind: 'foreign', fileEntries: 0, nextEntries };
  }
  const p = parsed as { app?: unknown; data?: unknown } | null;
  if (!p || typeof p !== 'object' || p.app !== 'austin-os') {
    return { kind: 'foreign', fileEntries: countEntries(parsed), nextEntries };
  }
  const fileEntries = countEntries(p.data);
  const lost = fileEntries - nextEntries;
  return lost > Math.max(SHRINK_MIN_LOST, fileEntries * 0.1) ? { kind: 'shrink', fileEntries, nextEntries } : null;
}

export function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export type AbTone = 'ok' | 'warn' | 'bad' | 'off';
export type AbAction = 'choose' | 'reconnect' | 'review' | 'retry' | null;

export interface AbInput {
  supported: boolean;
  fileName: string | null;
  permission: 'granted' | 'prompt' | 'denied' | null;
  lastWriteAt: string | null;
  error: string | null;
  risk: OverwriteRisk | null;
  now: number;
}

/** One status line for the auto-backup, in priority order: anything that stops saving wins. */
export function autoBackupStatus(i: AbInput): { tone: AbTone; label: string; action: AbAction } {
  if (!i.supported) return { tone: 'off', label: 'Not available in this browser', action: null };
  if (!i.fileName) return { tone: 'off', label: 'Off', action: 'choose' };
  if (i.risk) {
    return {
      tone: 'bad',
      label: i.risk.kind === 'shrink' ? 'Paused · file holds more than this browser' : 'Paused · not an Austin OS backup',
      action: 'review',
    };
  }
  if (i.permission !== 'granted') return { tone: 'warn', label: 'Paused · needs your OK to write', action: 'reconnect' };
  if (i.error) return { tone: 'bad', label: 'Last save failed', action: 'retry' };
  if (!i.lastWriteAt) return { tone: 'warn', label: 'Waiting for first save', action: null };
  return { tone: 'ok', label: `Saved ${timeAgo(i.lastWriteAt, i.now)}`, action: null };
}
