/** The Day & Habits: intentions, habit chains, the evening close. Pure functions only. */
import { addDays, iso, parseISO } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { LIFE_AREAS } from '../life/logic';
import { EVERY_DAY, type DayData, type DayEntry, type Habit, type Intention, type IntentionState, type LifeArea } from './types';

export const EMPTY_ENTRY: DayEntry = { intentions: [], done: [] };

export const AREA = Object.fromEntries(LIFE_AREAS.map((a) => [a.id, a])) as Record<LifeArea, (typeof LIFE_AREAS)[number]>;

/** A day's entry, always well-formed (old or synced data may be missing fields). */
export function entryOf(days: Record<string, DayEntry> | undefined, day: string): DayEntry {
  const e = days?.[day];
  if (!e) return EMPTY_ENTRY;
  return { ...e, intentions: Array.isArray(e.intentions) ? e.intentions : [], done: Array.isArray(e.done) ? e.done : [] };
}

/** True when an entry holds nothing worth keeping. */
export const isEmptyEntry = (e: DayEntry) =>
  !e.intentions.length && !e.done.length && !e.well?.trim() && !e.carry?.trim() && !e.closedAt;

/** The local calendar day a habit was created (null if the timestamp is unreadable). */
export function createdDay(h: Pick<Habit, 'createdAt'>): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(h.createdAt)) return h.createdAt;
  const d = new Date(h.createdAt);
  return Number.isNaN(d.getTime()) ? null : iso(d);
}

/** Is the habit due on this day? (Its weekdays, and not before it existed.) */
export function scheduledOn(h: Pick<Habit, 'days' | 'createdAt'>, day: string): boolean {
  const from = createdDay(h);
  if (from && day < from) return false;
  const wd = h.days?.length ? h.days : EVERY_DAY;
  return wd.includes(parseISO(day).getDay());
}

/** The habits to show on a day: not archived, and due (or already done that day). */
export function habitsFor(habits: Habit[], entry: DayEntry, day: string): Habit[] {
  return habits.filter((h) => !h.archived && (scheduledOn(h, day) || entry.done.includes(h.id)));
}

export type Link = 'done' | 'missed' | 'off' | 'today';

export interface Chain {
  /** Scheduled days done in a row, up to today (today still open doesn't break it). */
  current: number;
  best: number;
  /** Oldest first, ending today. 'today' = due today and not done yet. */
  last14: Link[];
}

/** How one day looks for one habit. Done always counts, even on an unscheduled day. */
function linkOn(h: Habit, days: Record<string, DayEntry>, day: string, today: string): Link {
  if (entryOf(days, day).done.includes(h.id)) return 'done';
  if (!scheduledOn(h, day) || day > today) return 'off';
  return day === today ? 'today' : 'missed';
}

/** A habit's chain: current and best runs of scheduled days done, and the last 14 days as lanterns. */
export function habitChain(h: Habit, days: Record<string, DayEntry>, today: string): Chain {
  const last14 = Array.from({ length: 14 }, (_, i) => linkOn(h, days, addDays(today, i - 13), today));

  // Start from whichever is earlier: the day it was made, or the first day it was checked.
  let start = createdDay(h) ?? today;
  for (const [d, e] of Object.entries(days ?? {})) if (d < start && Array.isArray(e?.done) && e.done.includes(h.id)) start = d;
  if (start > today) start = today;

  let run = 0;
  let best = 0;
  for (let d = start, guard = 0; d <= today && guard < 20000; d = addDays(d, 1), guard++) {
    const l = linkOn(h, days, d, today);
    if (l === 'done') best = Math.max(best, ++run);
    else if (l === 'missed') run = 0;
  }
  return { current: run, best, last14 };
}

/** 0–1: kept = 1, partly = ½, not or unmarked = 0. Null when nothing was intended. */
export function dayScore(e: DayEntry): number | null {
  const xs = e.intentions.filter((i) => i.text.trim());
  if (!xs.length) return null;
  const pts = xs.reduce((n, i) => n + (i.state === 'kept' ? 1 : i.state === 'partly' ? 0.5 : 0), 0);
  return pts / xs.length;
}

/** What rolls into tomorrow: every intention not fully kept, unmarked again. */
export function carryOver(e: DayEntry): Intention[] {
  return e.intentions.filter((i) => i.text.trim() && i.state !== 'kept').map(({ area, text }) => ({ area, text }));
}

/** Put carried intentions into a day. What that day already has for an area wins. */
export function withCarried(target: DayEntry, carried: Intention[]): { entry: DayEntry; added: number } {
  const have = new Set(target.intentions.map((i) => i.area));
  const add = carried.filter((i) => !have.has(i.area));
  return { entry: { ...target, intentions: sortIntentions([...target.intentions, ...add]) }, added: add.length };
}

/** Intentions in area order (Cabin, Chapel, Office, Observatory, Forge, Hearth). */
export function sortIntentions(xs: Intention[]): Intention[] {
  const order = (a: LifeArea) => LIFE_AREAS.findIndex((x) => x.id === a);
  return [...xs].sort((a, b) => order(a.area) - order(b.area));
}

/**
 * Replace a day's intentions from the "Set the day" form (one line per area; blank removes it).
 * An intention whose text didn't change keeps its mark.
 */
export function setIntentions(e: DayEntry, lines: Partial<Record<LifeArea, string>>): DayEntry {
  const out: Intention[] = [];
  for (const { id } of LIFE_AREAS) {
    const text = (lines[id] ?? '').trim();
    if (!text) continue;
    const old = e.intentions.find((i) => i.area === id);
    out.push(old && old.text.trim() === text ? old : { area: id, text });
  }
  return { ...e, intentions: out };
}

/** Tap-to-mark cycle: unmarked → kept → partly → not → unmarked. */
export function nextState(s?: IntentionState): IntentionState | undefined {
  return s === undefined ? 'kept' : s === 'kept' ? 'partly' : s === 'partly' ? 'not' : undefined;
}

/** The day can be sealed once there is something in it and every intention is marked. */
export function closeable(e: DayEntry): boolean {
  if (e.closedAt) return false;
  const xs = e.intentions.filter((i) => i.text.trim());
  if (xs.some((i) => !i.state)) return false;
  return xs.length > 0 || e.done.length > 0 || Boolean(e.well?.trim() || e.carry?.trim());
}

export type Phase = 'morning' | 'day' | 'evening';

/** Morning 5:00–11:59, evening from 19:00 (and the small hours), day in between. */
export function phase(now: Date): Phase {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 19 || h < 5) return 'evening';
  return 'day';
}

export interface StripDay {
  day: string;
  score: number | null;
  intentions: number;
  /** Habits done that day / due that day. */
  done: number;
  due: number;
  closed: boolean;
}

/** The last `n` days, oldest first, for the history strip. */
export function historyStrip(data: DayData, today: string, n = 30): StripDay[] {
  const ids = new Set(data.habits.map((h) => h.id));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    const e = entryOf(data.days, day);
    const due = data.habits.filter((h) => !h.archived && scheduledOn(h, day)).length;
    return {
      day,
      score: dayScore(e),
      intentions: e.intentions.length,
      done: e.done.filter((id) => ids.has(id)).length,
      due,
      closed: Boolean(e.closedAt),
    };
  });
}

/** "Mon, Wed, Fri" / "Every day" / "Weekdays". */
export function daysLabel(days: number[] | undefined): string {
  const d = [...new Set(days?.length ? days : EVERY_DAY)].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  if (d.join() === '0,6') return 'Weekends';
  return d.map((x) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x]).join(', ');
}

/** Starters Austin hasn't added yet (by name, ignoring case). */
export function unusedStarters<T extends { name: string }>(starters: T[], habits: Habit[]): T[] {
  const have = new Set(habits.map((h) => h.name.trim().toLowerCase()));
  return starters.filter((s) => !have.has(s.name.toLowerCase()));
}

export const describeDay: Describer = {
  name: 'The Day',
  size: (v) => Object.keys((v as Partial<DayData>)?.days ?? {}).length,
  detail: (v) => {
    const d = Object.keys((v as Partial<DayData>)?.days ?? {}).length;
    const h = ((v as Partial<DayData>)?.habits ?? []).filter((x) => !x.archived).length;
    return `${d} day${d === 1 ? '' : 's'} · ${h} habit${h === 1 ? '' : 's'}`;
  },
};

/* ---------------- sync ---------------- */

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Merge one day from two devices: habits done on either count, intentions by area (local wins), sealed if either sealed. */
export function mergeEntry(l: DayEntry, r: DayEntry): DayEntry {
  const lx = Array.isArray(l.intentions) ? l.intentions : [];
  const rx = Array.isArray(r.intentions) ? r.intentions : [];
  const intentions = sortIntentions([
    ...lx.map((i) => {
      const o = rx.find((x) => x.area === i.area);
      return !i.state && o?.state && o.text === i.text ? { ...i, state: o.state } : i;
    }),
    ...rx.filter((i) => !lx.some((x) => x.area === i.area)),
  ]);
  const out: DayEntry = {
    ...r, ...l,
    intentions,
    done: [...new Set([...(Array.isArray(l.done) ? l.done : []), ...(Array.isArray(r.done) ? r.done : [])])],
  };
  const well = l.well?.trim() ? l.well : r.well;
  const carry = l.carry?.trim() ? l.carry : r.carry;
  const closedAt = l.closedAt ?? r.closedAt;
  if (well) out.well = well; else delete out.well;
  if (carry) out.carry = carry; else delete out.carry;
  if (closedAt) out.closedAt = closedAt; else delete out.closedAt;
  return out;
}

/** Merge 'day.v1' from two devices. Only ever adds; local wins a clash. */
export function mergeDayData(l: Partial<DayData>, r: Partial<DayData>): DayData {
  const days: Record<string, DayEntry> = { ...(isObj(r.days) ? (r.days as Record<string, DayEntry>) : {}) };
  for (const [d, v] of Object.entries(isObj(l.days) ? (l.days as Record<string, DayEntry>) : {})) {
    days[d] = days[d] ? mergeEntry(v, days[d]) : v;
  }
  const lh = Array.isArray(l.habits) ? l.habits : [];
  const rh = Array.isArray(r.habits) ? r.habits : [];
  const have = new Set(lh.map((h) => h.id));
  return { ...r, ...l, days, habits: [...lh, ...rh.filter((h) => !have.has(h.id))] } as DayData;
}
