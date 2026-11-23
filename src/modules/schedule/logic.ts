/** The schedule: pure block maths, "where are we now", the week's grid and its tasks. */
import { addDays, parseISO } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { DayPlan, ScheduleData, ScheduleSettings, WeekTask } from './types';

export interface Block { i: number; start: string; end: string; /** minutes after midnight */ from: number; to: number }

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** "9:00", "1:50 pm" style for people. */
export const clock12 = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? ' pm' : ' am'}`; };

/** The day's work blocks: work minutes, then a break, from start until the next block wouldn't fit. */
export function blocksFor(s: ScheduleSettings): Block[] {
  const out: Block[] = [];
  const end = toMin(s.end), work = Math.max(5, s.work), step = work + Math.max(0, s.brk);
  for (let t = toMin(s.start), i = 0; t + work <= end && i < 24; t += step, i++) out.push({ i, from: t, to: t + work, start: hhmm(t), end: hhmm(t + work) });
  return out;
}

export const isWorkday = (s: ScheduleSettings, date: string) => s.days.includes(parseISO(date).getDay());

export type Now = { phase: 'before' | 'work' | 'break' | 'after' | 'off'; block?: Block; next?: Block; minsLeft: number; /** 0–1 through the current block or break */ through: number };

/** Where the day stands at `minute` (minutes after midnight). */
export function nowIn(blocks: Block[], minute: number, workday = true): Now {
  if (!workday || !blocks.length) return { phase: 'off', minsLeft: 0, through: 0 };
  if (minute < blocks[0].from) return { phase: 'before', next: blocks[0], minsLeft: blocks[0].from - minute, through: 0 };
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k], n = blocks[k + 1];
    if (minute >= b.from && minute < b.to) return { phase: 'work', block: b, next: n, minsLeft: b.to - minute, through: (minute - b.from) / (b.to - b.from) };
    if (n && minute >= b.to && minute < n.from) return { phase: 'break', block: b, next: n, minsLeft: n.from - minute, through: (minute - b.to) / (n.from - b.to) };
  }
  return { phase: 'after', minsLeft: 0, through: 1 };
}

/** What a block is for: today's own label, else the weekly repeat for that weekday. */
export function labelOf(data: Pick<ScheduleData, 'days' | 'repeat'>, date: string, i: number): { text: string; repeats: boolean } {
  const own = data.days[date]?.labels[String(i)];
  const rep = data.repeat[String(parseISO(date).getDay())]?.[String(i)];
  return own !== undefined && own !== '' ? { text: own, repeats: false } : { text: rep ?? '', repeats: Boolean(rep) };
}

export const EMPTY_PLAN: DayPlan = { labels: {}, done: [] };
export const planOf = (data: Pick<ScheduleData, 'days'>, date: string): DayPlan => data.days[date] ?? EMPTY_PLAN;

/** Check or uncheck a block. */
export function toggleBlock(p: DayPlan, i: number, now: string): DayPlan {
  const done = p.done.includes(i) ? p.done.filter((x) => x !== i) : [...p.done, i].sort((a, b) => a - b);
  return { ...p, done, edited: now };
}

export function setLabel(p: DayPlan, i: number, text: string, now: string): DayPlan {
  const labels = { ...p.labels };
  if (text.trim()) labels[String(i)] = text.trim(); else delete labels[String(i)];
  return { ...p, labels, edited: now };
}

/** The working week, Monday to Friday (or whichever days are working days), blocks done of blocks. */
export function weekGrid(data: ScheduleData, monday: string): { date: string; done: number[]; total: number }[] {
  const total = blocksFor(data.settings).length;
  return Array.from({ length: 7 }, (_, k) => addDays(monday, k))
    .filter((d) => isWorkday(data.settings, d))
    .map((date) => ({ date, done: planOf(data, date).done.filter((i) => i < total), total }));
}

/** Tasks still open last week that aren't already on this week (by text), to bring forward. */
export function carryable(data: Pick<ScheduleData, 'weeks'>, monday: string): WeekTask[] {
  const here = new Set((data.weeks[monday] ?? []).filter((t) => !t.gone).map((t) => t.text.trim().toLowerCase()));
  return (data.weeks[addDays(monday, -7)] ?? []).filter((t) => !t.done && !t.gone && !here.has(t.text.trim().toLowerCase()));
}

/** This week's tasks still on the list (removed ones are kept only as markers). */
export const liveTasks = (ts: WeekTask[] | undefined) => (ts ?? []).filter((t) => !t.gone);

/** Merge two devices' copies: each day keeps its newest version, tasks by id (newest edit), repeats and settings from here. */
export function mergeSchedule(l: Partial<ScheduleData>, r: Partial<ScheduleData>): Partial<ScheduleData> {
  const days: Record<string, DayPlan> = { ...(r.days ?? {}) };
  for (const [d, p] of Object.entries(l.days ?? {})) { const o = days[d]; days[d] = !o || String(p.edited ?? '') >= String(o.edited ?? '') ? p : o; }
  const weeks: Record<string, WeekTask[]> = { ...(r.weeks ?? {}) };
  for (const [w, ts] of Object.entries(l.weeks ?? {})) {
    const byId = new Map((weeks[w] ?? []).map((t) => [t.id, t]));
    for (const t of ts) { const o = byId.get(t.id); byId.set(t.id, !o || String(t.edited ?? '') >= String(o.edited ?? '') ? t : o); }
    weeks[w] = [...byId.values()];
  }
  const repeat = { ...(r.repeat ?? {}) };
  for (const [wd, m] of Object.entries(l.repeat ?? {})) repeat[wd] = { ...(repeat[wd] ?? {}), ...m };
  return { ...r, ...l, days, weeks, repeat };
}

export const describeSchedule: Describer = {
  name: 'The schedule',
  size: (v) => { const d = v as Partial<ScheduleData>; return Object.values(d.days ?? {}).reduce((n, p) => n + (p?.done?.length ?? 0), 0); },
  detail: (v) => {
    const d = v as Partial<ScheduleData>;
    const done = Object.values(d.days ?? {}).reduce((n, p) => n + (p?.done?.length ?? 0), 0);
    const tasks = Object.values(d.weeks ?? {}).reduce((n, ts) => n + (ts ?? []).filter((t) => !t?.gone).length, 0);
    return `${done} blocks done · ${tasks} weekly tasks`;
  },
};
