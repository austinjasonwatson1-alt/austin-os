import { addDays } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { chapelMinutes } from '../chapel/logic';
import type { ChapelDay } from '../chapel/types';
import { dayTotal, gradeOf } from '../ledger/logic';
import type { CatKey, DayMap, GradeKey, Thresholds } from '../ledger/types';
import { CATS } from '../ledger/types';
import type { Manuscript } from '../manuscripts/types';
import type { Book } from '../shelf/types';
import type { ReviewData } from './types';

export interface WeekSummary {
  monday: string;
  sunday: string;
  minutes: number;
  grade: GradeKey;
  prevMinutes: number;
  days: { date: string; mins: number; grade: GradeKey; future: boolean }[];
  best: { date: string; mins: number } | null;
  zeroDays: string[];
  logged: number;
  byCat: { k: CatKey; mins: number }[];
  chapel: { minutes: number; days: number };
  words: number | null;
  booksFinished: Book[];
}

export interface WeekInputs {
  days: DayMap;
  thresholds: Thresholds;
  weekly: Thresholds;
  chapel: Record<string, ChapelDay>;
  manuscripts: Manuscript[];
  books: Book[];
}

const sumWeek = (days: DayMap, monday: string) => Array.from({ length: 7 }, (_, i) => dayTotal(days[addDays(monday, i)])).reduce((a, b) => a + b, 0);

/** Last known word total on or before `day` for one manuscript. */
const wordsAt = (h: Record<string, number>, day: string): number | null => {
  const k = Object.keys(h).filter((d) => d <= day).sort().pop();
  return k ? h[k] : null;
};

/** Everything the Sunday review shows for the week starting `monday`, counting only days up to `today`. */
export function weekSummary(w: WeekInputs, monday: string, today: string): WeekSummary {
  const sunday = addDays(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const mins = dayTotal(w.days[date]);
    return { date, mins, grade: gradeOf(mins, w.thresholds), future: date > today };
  });
  const past = days.filter((d) => !d.future);
  const minutes = past.reduce((s, d) => s + d.mins, 0);
  const best = past.reduce<{ date: string; mins: number } | null>((b, d) => (d.mins > (b?.mins ?? 0) ? { date: d.date, mins: d.mins } : b), null);
  const byCat = CATS.map((c) => ({ k: c.k, mins: past.reduce((s, d) => s + (Number(w.days[d.date]?.[c.k]) || 0), 0) })).filter((x) => x.mins > 0).sort((a, b) => b.mins - a.mins);
  const chapelDays = past.map((d) => chapelMinutes(w.chapel[d.date]));

  // Words: change in each manuscript's total across the week, where there's history to tell.
  let words: number | null = null;
  for (const m of w.manuscripts) {
    const end = wordsAt(m.history, sunday < today ? sunday : today);
    const start = wordsAt(m.history, addDays(monday, -1));
    if (end !== null && start !== null) words = (words ?? 0) + (end - start);
  }

  return {
    monday, sunday, minutes,
    grade: gradeOf(minutes, w.weekly),
    prevMinutes: sumWeek(w.days, addDays(monday, -7)),
    days, best,
    zeroDays: past.filter((d) => d.mins === 0).map((d) => d.date),
    logged: past.filter((d) => d.mins > 0).length,
    byCat,
    chapel: { minutes: chapelDays.reduce((a, b) => a + b, 0), days: chapelDays.filter(Boolean).length },
    words,
    booksFinished: w.books.filter((b) => b.status === 'read' && b.finished && b.finished >= monday && b.finished <= sunday),
  };
}

/** Sunday, or Monday morning before noon: time to look back at the week. */
export const reviewTime = (d: Date) => d.getDay() === 0 || (d.getDay() === 1 && d.getHours() < 12);

/** Which week the review should open on: this week on Sunday, otherwise the week just finished on Monday morning, else this week. */
export function reviewWeek(d: Date, mondayOfToday: string): string {
  return d.getDay() === 1 && d.getHours() < 12 ? addDays(mondayOfToday, -7) : mondayOfToday;
}

/**
 * Whether the Keeper should write this week's letter by itself: only for the current week, only
 * from Saturday evening through Sunday, only once, and only if the Keeper is on.
 */
export function letterDue(d: Date, week: string, mondayOfToday: string, has: boolean, enabled: boolean): boolean {
  if (!enabled || has || week !== mondayOfToday) return false;
  return d.getDay() === 0 || (d.getDay() === 6 && d.getHours() >= 17);
}

/** Percent change against last week, e.g. +12 or -30; null with nothing to compare. */
export const vsLast = (now: number, prev: number): number | null => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);

export const describeReview: Describer = {
  name: 'Weekly reviews',
  size: (v) => Object.keys((v as Partial<ReviewData>).reviews ?? {}).length,
  detail: (v) => {
    const r = (v as Partial<ReviewData>).reviews ?? {};
    const sealed = Object.values(r).filter((x) => x.sealedAt).length;
    return `${Object.keys(r).length} week${Object.keys(r).length === 1 ? '' : 's'} · ${sealed} sealed`;
  },
};

/* ---------------- the year in review ---------------- */

export interface YearReview {
  year: number;
  minutes: number;
  logged: number;
  elapsed: number;
  elite: number;
  zero: number;
  longest: { days: number; from: string; to: string } | null;
  months: number[];
  bestMonth: { m: number; mins: number } | null;
  bestDay: { date: string; mins: number } | null;
  byCat: { k: CatKey; mins: number }[];
  chapel: { minutes: number; days: number };
  answered: number;
  books: Book[];
  pages: number;
  words: number | null;
}

/** The whole year at a glance, counting only days up to `today`. */
export function yearReview(w: WeekInputs & { answeredOn?: string[] }, year: number, today: string): YearReview {
  const start = `${year}-01-01`;
  const end = `${year}-12-31` < today ? `${year}-12-31` : today;
  const months = Array(12).fill(0);
  const cats: Record<string, number> = {};
  let minutes = 0, logged = 0, elite = 0, zero = 0, elapsed = 0, chapelMin = 0, chapelDays = 0;
  let bestDay: YearReview['bestDay'] = null;
  let run = 0, runFrom = '';
  let longest: YearReview['longest'] = null;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    elapsed++;
    const e = w.days[d];
    const mins = dayTotal(e);
    minutes += mins;
    months[Number(d.slice(5, 7)) - 1] += mins;
    for (const c of CATS) cats[c.k] = (cats[c.k] ?? 0) + (Number(e?.[c.k]) || 0);
    if (mins) {
      logged++;
      if (gradeOf(mins, w.thresholds) === 'elite') elite++;
      if (!bestDay || mins > bestDay.mins) bestDay = { date: d, mins };
      if (!run) runFrom = d;
      run++;
      if (!longest || run > longest.days) longest = { days: run, from: runFrom, to: d };
    } else {
      zero++;
      run = 0;
    }
    const cm = chapelMinutes(w.chapel[d]);
    chapelMin += cm;
    if (cm) chapelDays++;
  }
  const bm = months.reduce<YearReview['bestMonth']>((b, mins, m) => (mins > (b?.mins ?? 0) ? { m, mins } : b), null);
  const books = w.books.filter((b) => b.status === 'read' && b.finished && b.finished >= start && b.finished <= end);
  let words: number | null = null;
  for (const m of w.manuscripts) {
    const a = wordsAt(m.history, addDays(start, -1)) ?? 0;
    const b = wordsAt(m.history, end);
    if (b !== null) words = (words ?? 0) + (b - a);
  }
  return {
    year, minutes, logged, elapsed, elite, zero, longest, months,
    bestMonth: bm, bestDay,
    byCat: CATS.map((c) => ({ k: c.k, mins: cats[c.k] ?? 0 })).filter((x) => x.mins > 0).sort((a, b) => b.mins - a.mins),
    chapel: { minutes: chapelMin, days: chapelDays },
    answered: (w.answeredOn ?? []).filter((d) => d >= start && d <= end).length,
    books, pages: books.reduce((s, b) => s + (b.pages ?? 0), 0), words,
  };
}

/* ---------------- the Library of You ---------------- */

export interface ArchiveMonth {
  key: string;
  minutes: number;
  logged: number;
  books: string[];
  answered: { text: string; answer?: string }[];
  milestones: string[];
  reviews: { monday: string; worked?: string; intention?: string }[];
  moments: string[];
  wins: string[];
}

export interface ArchiveInputs {
  days: DayMap;
  chapel: Record<string, ChapelDay>;
  books: Book[];
  prayers: { text: string; answer?: string; answeredOn?: string }[];
  milestones: { name: string; earnedOn: string | null }[];
  reviews: Record<string, { worked?: string; intention?: string; sealedAt?: string }>;
  moments: { text: string; date: string }[];
  wins: { text: string; date: string }[];
}

/** Every month with anything in it, newest first: the journal of a life, read back. */
export function archive(a: ArchiveInputs): ArchiveMonth[] {
  const months = new Map<string, ArchiveMonth>();
  const m = (key: string) => {
    if (!months.has(key)) months.set(key, { key, minutes: 0, logged: 0, books: [], answered: [], milestones: [], reviews: [], moments: [], wins: [] });
    return months.get(key)!;
  };
  for (const [d, e] of Object.entries(a.days)) {
    const mins = dayTotal(e);
    if (!mins) continue;
    const x = m(d.slice(0, 7));
    x.minutes += mins;
    x.logged++;
  }
  for (const b of a.books) if (b.status === 'read' && b.finished) m(b.finished.slice(0, 7)).books.push(b.title);
  for (const p of a.prayers) if (p.answeredOn) m(p.answeredOn.slice(0, 7)).answered.push({ text: p.text, answer: p.answer });
  for (const s of a.milestones) if (s.earnedOn) m(s.earnedOn.slice(0, 7)).milestones.push(s.name);
  for (const [monday, r] of Object.entries(a.reviews)) if (r.sealedAt && (r.worked || r.intention)) m(monday.slice(0, 7)).reviews.push({ monday, worked: r.worked, intention: r.intention });
  for (const x of a.moments) m(x.date.slice(0, 7)).moments.push(x.text);
  for (const x of a.wins) m(x.date.slice(0, 7)).wins.push(x.text);
  return [...months.values()].sort((x, y) => y.key.localeCompare(x.key));
}
