/** Pure logic for Memories and the Time Capsule. No browser APIs in here. */

import type { Describer } from '../../core/restoreLogic';
import { addDays, daysUntil, iso, MONTHS_LONG } from '../../core/dates';
import { TAGS, type Capsule, type Memory, type MemoriesData, type MemoryTag } from './types';

/* ---------------- memories ---------------- */

/** Newest day first; within a day, the most recently added first. */
export const byNewest = (a: Memory, b: Memory) => (a.day === b.day ? b.addedAt.localeCompare(a.addedAt) : b.day.localeCompare(a.day));

export const filterByTag = (items: Memory[], tag: MemoryTag | null | undefined): Memory[] => (tag ? items.filter((m) => m.tag === tag) : items);

/** How many photos carry each tag (only tags in use, in the canonical order). */
export function tagCounts(items: Memory[]): { tag: MemoryTag; n: number }[] {
  return TAGS.map((tag) => ({ tag, n: items.filter((m) => m.tag === tag).length })).filter((x) => x.n > 0);
}

export interface MonthGroup {
  /** 'YYYY-MM' */
  key: string;
  label: string;
  items: Memory[];
}

/** The photo wall: one group per month, newest month first, newest photo first inside it. */
export function groupByMonth(items: Memory[]): MonthGroup[] {
  const out: MonthGroup[] = [];
  for (const m of [...items].sort(byNewest)) {
    const key = m.day.slice(0, 7);
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: `${MONTHS_LONG[Number(key.slice(5, 7)) - 1] ?? ''} ${key.slice(0, 4)}`, items: [] };
      out.push(g);
    }
    g.items.push(m);
  }
  return out;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface OnThisDay {
  /** 'day': same month-day in earlier years. 'week': nothing on the day, so the same week a year ago. */
  kind: 'day' | 'week';
  items: Memory[];
}

/**
 * Memories from this month-day in earlier years (most recent year first). On Feb 28 of a
 * non-leap year, Feb 29 memories count too. If there are none, the week around this day a
 * year ago (±3 days). Null when there is nothing to show.
 */
export function onThisDay(items: Memory[], today: string): OnThisDay | null {
  const y = Number(today.slice(0, 4));
  const md = today.slice(5);
  const mds = new Set([md]);
  if (md === '02-28' && !isLeap(y)) mds.add('02-29');
  const day = items.filter((m) => m.day < today && m.day.slice(0, 4) < today.slice(0, 4) && mds.has(m.day.slice(5))).sort(byNewest);
  if (day.length) return { kind: 'day', items: day };
  const mid = `${y - 1}-${md === '02-29' ? '02-28' : md}`;
  const from = addDays(mid, -3), to = addDays(mid, 3);
  const week = items.filter((m) => m.day >= from && m.day <= to).sort(byNewest);
  return week.length ? { kind: 'week', items: week } : null;
}

/** "1 year ago today" / "3 years ago today" / "A year ago this week". */
export function agoLabel(day: string, today: string, kind: OnThisDay['kind'] = 'day'): string {
  if (kind === 'week') return 'A year ago this week';
  const n = Number(today.slice(0, 4)) - Number(day.slice(0, 4));
  return `${n} year${n === 1 ? '' : 's'} ago today`;
}

/** The local calendar day of a timestamp (e.g. a file's lastModified). */
export const dayOf = (ms: number): string => iso(new Date(ms));

/* ---------------- the time capsule ---------------- */

export type CapsuleState = 'sealed' | 'ready' | 'open';

/** Open once opened; ready once its date has come; otherwise sealed (event letters stay sealed until opened by hand). */
export function capsuleState(c: Capsule, today: string): CapsuleState {
  if (c.openedOn) return 'open';
  if (c.opensOn && c.opensOn <= today) return 'ready';
  return 'sealed';
}

/** Days until a dated letter unseals (0 when ready); null for event letters and opened ones. */
export function daysToOpen(c: Capsule, today: string): number | null {
  if (c.openedOn || !c.opensOn) return null;
  return Math.max(0, daysUntil(c.opensOn, today));
}

/** "opens tomorrow", "opens in 214 days", "opens in 2 years, 14 days". */
export function countdownLabel(days: number): string {
  if (days <= 0) return 'ready to open';
  if (days === 1) return 'opens tomorrow';
  if (days < 365) return `opens in ${days} days`;
  const y = Math.floor(days / 365), d = days % 365;
  return `opens in ${y} year${y === 1 ? '' : 's'}${d ? `, ${d} day${d === 1 ? '' : 's'}` : ''}`;
}

const RANK: Record<CapsuleState, number> = { ready: 0, sealed: 1, open: 2 };

/**
 * Ready letters first (longest-waiting first), then sealed ones by opening date (event
 * letters after dated ones, oldest written first), then opened letters, most recently opened first.
 */
export function sortCapsules(list: Capsule[], today: string): Capsule[] {
  return [...list].sort((a, b) => {
    const sa = capsuleState(a, today), sb = capsuleState(b, today);
    if (sa !== sb) return RANK[sa] - RANK[sb];
    if (sa === 'open') return (b.openedOn ?? '').localeCompare(a.openedOn ?? '');
    const oa = a.opensOn ?? '9999', ob = b.opensOn ?? '9999';
    return oa === ob ? a.written.localeCompare(b.written) : oa.localeCompare(ob);
  });
}

export const readyCapsules = (list: Capsule[], today: string) => sortCapsules(list.filter((c) => capsuleState(c, today) === 'ready'), today);

export interface CapsuleDraft { title: string; body: string; opensOn?: string; event?: string }

/** Why a letter can't be sealed yet, or null when it can. */
export function sealProblem(d: CapsuleDraft, today: string): string | null {
  if (!d.body.trim()) return 'Write the letter first.';
  if (!d.title.trim()) return 'Give it a name for the envelope.';
  if (!d.opensOn && !d.event?.trim()) return 'Choose a day it opens, or the moment you’ll open it.';
  if (d.opensOn && d.opensOn <= today) return 'The opening day has to be in the future.';
  return null;
}

/** Whole days between writing and opening ("sealed for 214 days"). */
export const sealedFor = (c: Capsule, today: string) => Math.max(0, daysUntil(c.openedOn ?? today, c.written));

/* ---------------- restore preview ---------------- */

export const describeMemories: Describer = {
  name: 'Memories & Time Capsule',
  size: (v) => ((v as Partial<MemoriesData>)?.items?.length ?? 0) + ((v as Partial<MemoriesData>)?.capsules?.length ?? 0),
  detail: (v) => {
    const d = (v ?? {}) as Partial<MemoriesData>;
    const items = Array.isArray(d.items) ? d.items : [];
    const caps = Array.isArray(d.capsules) ? d.capsules : [];
    const sealed = caps.filter((c) => !c.openedOn).length;
    const p = `${items.length} photo${items.length === 1 ? '' : 's'}`;
    if (!caps.length) return p;
    return `${p} · ${caps.length} letter${caps.length === 1 ? '' : 's'}${sealed ? ` (${sealed} sealed)` : ''}`;
  },
};

/* ---------------- housekeeping ---------------- */

/**
 * Full-size photo keys whose memory was deleted (on this device or another) and so can be
 * dropped. Only ids with a tombstone count, so a photo that arrived before its list entry is never lost.
 */
export function orphanPhotoIds(keys: string[], prefix: string, items: Memory[], deleted: Record<string, string> | undefined): string[] {
  if (!deleted) return [];
  const live = new Set(items.map((m) => m.id));
  return keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).filter((id) => !live.has(id) && deleted[id]);
}

/** A small, stable lean for each polaroid on the wall (−2.5° … 2.5°). */
export function leanFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.round(((Math.abs(h) % 1000) / 1000 - 0.5) * 50) / 10;
}
