import { addDays, daysOfYear, iso, mondayOf, pad } from '../../core/dates';
import { CATS, type CatKey, type DayEntry, type DayMap, type GradeKey, type Thresholds } from './types';

export const dayTotal = (e: DayEntry | undefined): number =>
  e ? CATS.reduce((s, c) => s + (Number(e[c.k]) || 0), 0) : 0;

export const hasEntry = (e: DayEntry | undefined): boolean => dayTotal(e) > 0;

export function gradeOf(mins: number, t: Thresholds): GradeKey {
  if (mins <= 0) return 'zero';
  if (mins >= t.elite) return 'elite';
  if (mins >= t.good) return 'good';
  if (mins >= t.warn) return 'warn';
  return 'bad';
}

export const GRADE_LABEL: Record<GradeKey, string> = {
  zero: 'Zero day',
  bad: 'Slipping',
  warn: 'Warning',
  good: 'Good',
  elite: 'Elite',
};

export const fmtMins = (m: number): string => (m >= 60 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)}h` : `${m}m`);

export interface MonthStats {
  total: number;
  byCat: Record<CatKey, number>;
  logged: number;
  zero: number;
  best: number;
  bestDay: number | null;
  elite: number;
  elapsed: number;
  avg: number;
}

/** Stats for month `m` (0-11) of year `y`, counting only days up to and including `today`. */
export function monthStats(days: DayMap, y: number, m: number, today: string, t: Thresholds): MonthStats {
  const dim = new Date(y, m + 1, 0).getDate();
  const byCat = Object.fromEntries(CATS.map((c) => [c.k, 0])) as Record<CatKey, number>;
  const st: MonthStats = { total: 0, byCat, logged: 0, zero: 0, best: 0, bestDay: null, elite: 0, elapsed: 0, avg: 0 };
  for (let d = 1; d <= dim; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    if (key > today) break;
    const e = days[key];
    for (const c of CATS) st.byCat[c.k] += Number(e?.[c.k]) || 0;
    const tot = dayTotal(e);
    st.total += tot;
    if (hasEntry(e)) st.logged++;
    if (tot === 0) st.zero++;
    if (tot > st.best) {
      st.best = tot;
      st.bestDay = d;
    }
    if (gradeOf(tot, t) === 'elite') st.elite++;
    st.elapsed = d;
  }
  st.avg = st.elapsed ? Math.round(st.total / st.elapsed) : 0;
  return st;
}

export function monthLabel(st: MonthStats, t: Thresholds): { label: string; key: GradeKey } {
  if (!st.total) return { label: 'No data', key: 'zero' };
  const key = gradeOf(st.avg, t);
  return { label: key === 'good' ? 'Solid' : GRADE_LABEL[key], key };
}

export function weekTotal(days: DayMap, monday: string): number {
  let t = 0;
  for (let i = 0; i < 7; i++) t += dayTotal(days[addDays(monday, i)]);
  return t;
}

export { mondayOf };

/**
 * Current streak of days with any counted minutes. A still-empty today does not break it:
 * the streak is measured up to yesterday until today has an entry.
 */
export function currentStreak(days: DayMap, today: string): number {
  let cursor = today;
  if (dayTotal(days[cursor]) === 0) cursor = addDays(cursor, -1);
  let n = 0;
  while (dayTotal(days[cursor]) > 0) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function yearSummary(days: DayMap, year: number) {
  const keys = daysOfYear(year);
  return {
    logged: keys.filter((k) => hasEntry(days[k])).length,
    minutes: keys.reduce((s, k) => s + dayTotal(days[k]), 0),
  };
}

export interface MergePreview {
  add: number;
  update: number;
  keep: number;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Merge incoming days into existing ones. For a date present in both, the bigger total wins. */
export function mergeDays(current: DayMap, incoming: DayMap): { merged: DayMap; preview: MergePreview } {
  const merged: DayMap = { ...current };
  const preview: MergePreview = { add: 0, update: 0, keep: 0 };
  for (const [k, entry] of Object.entries(incoming)) {
    if (!DAY_KEY.test(k) || typeof entry !== 'object' || entry === null) continue;
    const cur = current[k];
    if (!cur) {
      merged[k] = entry;
      preview.add++;
    } else if (dayTotal(entry) > dayTotal(cur)) {
      merged[k] = entry;
      preview.update++;
    } else {
      preview.keep++;
    }
  }
  return { merged, preview };
}

export const isoToday = () => iso(new Date());
