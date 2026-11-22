/** Pure logic for the Kennel. No browser APIs in here. */

import { addDays, daysUntil } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { DogPose } from '../lounge/logic';
import { CARE_KINDS, type Care, type DogId, type KennelData, type Walk, type Weight, type Who } from './types';

/** Does a record about `who` include this dog? */
export const includes = (who: Who, dog: DogId) => who === 'both' || who === dog;

/** Walk minutes on a day (a walk with both dogs counts once — it's the same walk). */
export function kennelWalkMinutes(data: Partial<KennelData> | undefined, day: string): number {
  return (data?.walks ?? []).filter((w) => w.date === day).reduce((s, w) => s + (Number(w.minutes) || 0), 0);
}

/** Walks on a day, optionally only those a dog went on. */
export function walksOn(walks: Walk[], day: string, dog?: DogId): Walk[] {
  return walks.filter((w) => w.date === day && (!dog || includes(w.who, dog)));
}

/**
 * Consecutive days with at least one walk, ending today. If today has no walk yet,
 * the streak still stands from yesterday (the day isn't over).
 */
export function walkStreak(walks: Walk[], today: string, dog?: DogId): number {
  const days = new Set(walks.filter((w) => !dog || includes(w.who, dog)).map((w) => w.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}

/** The last `n` days ending on `today`, oldest first, with walk minutes and count. */
export function walkStrip(walks: Walk[], today: string, n = 7): { date: string; minutes: number; count: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    const on = walksOn(walks, date);
    return { date, minutes: on.reduce((s, w) => s + w.minutes, 0), count: on.length };
  });
}

/** Walk minutes from `monday` through the following Sunday, optionally for one dog. */
export function weekMinutes(walks: Walk[], monday: string, dog?: DogId): number {
  const end = addDays(monday, 6);
  return walks.filter((w) => w.date >= monday && w.date <= end && (!dog || includes(w.who, dog))).reduce((s, w) => s + w.minutes, 0);
}

export interface Due {
  care: Care;
  due: string;
  /** Days until due; negative when overdue. */
  days: number;
  overdue: boolean;
}

const careSlot = (c: Care) => `${c.kind}|${(c.title ?? '').trim().toLowerCase()}`;

/**
 * The record that currently stands for each recurring thing: for every dog, the latest
 * record of each kind + title. An older rabies shot's "next due" is settled by a newer one.
 */
function standing(care: Care[], dog: DogId): Care[] {
  const best = new Map<string, Care>();
  for (const c of care) {
    if (!includes(c.who, dog)) continue;
    const k = careSlot(c);
    const cur = best.get(k);
    if (!cur || c.date >= cur.date) best.set(k, c);
  }
  return [...best.values()];
}

/** Care coming due within `within` days (overdue included), soonest first. A both-dogs record appears once. */
export function upcomingCare(care: Care[], today: string, within = 30, dog?: DogId): Due[] {
  const seen = new Set<string>();
  const out: Due[] = [];
  for (const d of dog ? [dog] : (['cooper', 'shadow'] as DogId[])) {
    for (const c of standing(care, d)) {
      if (!c.nextDue || seen.has(c.id)) continue;
      const days = daysUntil(c.nextDue, today);
      if (days > within) continue;
      seen.add(c.id);
      out.push({ care: c, due: c.nextDue, days, overdue: days < 0 });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** The very next thing due for a dog (no window), or null. */
export function nextCareFor(care: Care[], dog: DogId, today: string): Due | null {
  return upcomingCare(care, today, Infinity, dog)[0] ?? null;
}

/** Care history, newest first. */
export const careHistory = (care: Care[]): Care[] => [...care].sort((a, b) => b.date.localeCompare(a.date));

export const careLabel = (c: Care) => c.title?.trim() || CARE_KINDS.find((k) => k.k === c.kind)?.label || 'Care';

/** A dog's weights, oldest first. */
export const weightsOf = (weights: Weight[], dog: DogId): Weight[] =>
  weights.filter((w) => w.dog === dog && w.lb > 0).sort((a, b) => a.date.localeCompare(b.date));

/** Latest weight for a dog (by date), or null. */
export function latestWeight(weights: Weight[], dog: DogId): Weight | null {
  const w = weightsOf(weights, dog);
  return w[w.length - 1] ?? null;
}

/** Change from the previous weigh-in, in lb (null with fewer than two). */
export function weightChange(weights: Weight[], dog: DogId): number | null {
  const w = weightsOf(weights, dog);
  return w.length < 2 ? null : Math.round((w[w.length - 1].lb - w[w.length - 2].lb) * 10) / 10;
}

/**
 * Sparkline points for a dog's weight in a `w`×`h` box (with `pad` inset), x by date.
 * One weigh-in sits in the middle; a flat line sits halfway up.
 */
export function sparkPoints(weights: Weight[], dog: DogId, w = 120, h = 36, pad = 3): [number, number][] {
  const ws = weightsOf(weights, dog).slice(-12);
  if (!ws.length) return [];
  const t = ws.map((x) => -daysUntil(x.date, ws[0].date));
  const t1 = t[t.length - 1];
  const lo = Math.min(...ws.map((x) => x.lb)), hi = Math.max(...ws.map((x) => x.lb));
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return ws.map((x, i) => [
    r1(t1 === 0 ? w / 2 : pad + (t[i] / t1) * (w - pad * 2)),
    r1(hi === lo ? h / 2 : h - pad - ((x.lb - lo) / (hi - lo)) * (h - pad * 2)),
  ]);
}

/** How a dog should be drawn: asleep late at night, proud once walked today, resting otherwise. */
export function kennelPose(walkedToday: boolean, hour: number): DogPose {
  if (hour >= 22 || hour < 5) return 'sleep';
  return walkedToday ? 'proud' : 'rest';
}

/** Notes, newest first, optionally for one dog. */
export const notesFor = <T extends { date: string; who: Who }>(notes: T[], dog?: DogId): T[] =>
  notes.filter((n) => !dog || includes(n.who, dog)).sort((a, b) => b.date.localeCompare(a.date));

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const describeKennel: Describer = {
  name: 'The Kennel',
  size: (v) => {
    const d = (v ?? {}) as Partial<KennelData>;
    return (d.walks?.length ?? 0) + (d.care?.length ?? 0) + (d.weights?.length ?? 0) + (d.notes?.length ?? 0);
  },
  detail: (v) => {
    const d = (v ?? {}) as Partial<KennelData>;
    const parts = [plural(d.walks?.length ?? 0, 'walk'), plural(d.care?.length ?? 0, 'care record')];
    if (d.weights?.length) parts.push(plural(d.weights.length, 'weigh-in'));
    if (d.notes?.length) parts.push(plural(d.notes.length, 'note'));
    return parts.join(' · ');
  },
};
