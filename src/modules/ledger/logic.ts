import { addDays, daysOfYear, iso, mondayOf, pad } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { CATS, type CatKey, type DayEntry, type DayMap, type GradeKey, type LedgerData, type Thresholds } from './types';

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
      // Bigger minutes win, but never drop a note the incoming day doesn't have.
      merged[k] = !entry.note && cur.note ? { ...entry, note: cur.note } : entry;
      preview.update++;
    } else {
      preview.keep++;
    }
  }
  return { merged, preview };
}

/** What restoring `target` would do to `current`: days that come back, disappear, or change. */
export function compareDays(current: DayMap, target: DayMap): { back: number; gone: number; changed: number; minutes: number } {
  let back = 0, gone = 0, changed = 0;
  for (const k of Object.keys(target)) {
    if (!current[k]) back++;
    else if (JSON.stringify(current[k]) !== JSON.stringify(target[k])) changed++;
  }
  for (const k of Object.keys(current)) if (!target[k]) gone++;
  const sum = (d: DayMap) => Object.values(d).reduce((s, e) => s + dayTotal(e), 0);
  return { back, gone, changed, minutes: sum(target) - sum(current) };
}

/** Split CSV text into rows, honouring quoted fields ("a, b" and "" escapes). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export interface CsvImport {
  days: DayMap;
  /** Data rows read (including empty days that were skipped). */
  rows: number;
  minutes: number;
  /** Dates whose "Counted total" / "Total" column disagrees with the sum of the categories. */
  badTotals: string[];
}

/**
 * Read a Ledger CSV — either this app's export or the old Ledger's (which adds Prayer, AI research
 * and PM work columns; those are ignored on purpose). Columns are matched by header name.
 * Days with no counted minutes and no note are skipped. Returns null if it isn't a Ledger CSV.
 */
export function parseLedgerCsv(text: string): CsvImport | null {
  const [head, ...body] = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (!head) return null;
  const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const dateCol = col('Date');
  const cats = CATS.map((c) => ({ k: c.k, i: col(c.name) >= 0 ? col(c.name) : col(c.k) })).filter((c) => c.i >= 0);
  if (dateCol < 0 || cats.length === 0) return null;
  const totalCol = col('Counted total') >= 0 ? col('Counted total') : col('Total');
  const noteCol = col('Note');

  const days: DayMap = {};
  const badTotals: string[] = [];
  let minutes = 0;
  for (const r of body) {
    const date = (r[dateCol] ?? '').trim();
    if (!DAY_KEY.test(date)) continue;
    const entry: DayEntry = {};
    for (const c of cats) {
      const v = Math.round(Number(r[c.i]) || 0);
      if (v > 0) entry[c.k] = v;
    }
    const note = noteCol >= 0 ? (r[noteCol] ?? '').trim() : '';
    if (note) entry.note = note;
    const sum = dayTotal(entry);
    if (totalCol >= 0 && r[totalCol]?.trim() && Number(r[totalCol]) !== sum) badTotals.push(date);
    if (sum === 0 && !note) continue;
    days[date] = entry;
    minutes += sum;
  }
  return { days, rows: body.length, minutes, badTotals };
}

export const isoToday = () => iso(new Date());

/** How the Ledger shows up in a restore preview: compared by days logged. */
export const describeLedger: Describer = {
  name: 'The Ledger',
  size: (v) => Object.keys((v as Partial<LedgerData> | undefined)?.days ?? {}).length,
  detail: (v) => {
    const d = (v ?? {}) as Partial<LedgerData>;
    const days = d.days ?? {};
    const mins = Object.values(days).reduce((t, e) => t + dayTotal(e), 0);
    const dl = d.deadlines?.length ?? 0;
    return `${Object.keys(days).length} days · ${fmtMins(mins)} · ${dl} deadline${dl === 1 ? '' : 's'}`;
  },
};

/* ---------------- home dashboard ---------------- */

export interface DayPoint {
  date: string;
  mins: number;
  grade: GradeKey;
  future: boolean;
}

/** The seven days Monday→Sunday of the week holding `monday`, graded; days after `today` are marked future. */
export function weekDays(days: DayMap, monday: string, today: string, t: Thresholds): DayPoint[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const mins = dayTotal(days[date]);
    return { date, mins, grade: gradeOf(mins, t), future: date > today };
  });
}

/** Weekly totals for the last `n` weeks, oldest first, ending with the week holding `today`. */
export function recentWeeks(days: DayMap, today: string, n: number): { monday: string; mins: number }[] {
  const last = mondayOf(today);
  return Array.from({ length: n }, (_, i) => {
    const monday = addDays(last, (i - n + 1) * 7);
    return { monday, mins: weekTotal(days, monday) };
  });
}

/** Longest run of consecutive logged days anywhere in the data. */
export function longestStreak(days: DayMap): number {
  const keys = Object.keys(days).filter((k) => hasEntry(days[k])).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Minutes per category over the `n` days ending `today`, biggest first, zero categories dropped. */
export function catMix(days: DayMap, today: string, n: number): { k: CatKey; mins: number }[] {
  const tot = Object.fromEntries(CATS.map((c) => [c.k, 0])) as Record<CatKey, number>;
  for (let i = 0; i < n; i++) {
    const e = days[addDays(today, -i)];
    for (const c of CATS) tot[c.k] += Number(e?.[c.k]) || 0;
  }
  return CATS.map((c) => ({ k: c.k, mins: tot[c.k] })).filter((x) => x.mins > 0).sort((a, b) => b.mins - a.mins);
}

/** The next grade within reach today and how many minutes it needs; null once elite. */
export function nextMark(mins: number, t: Thresholds): { grade: GradeKey; need: number } | null {
  for (const grade of ['warn', 'good', 'elite'] as const) if (mins < t[grade]) return { grade, need: t[grade] - mins };
  return null;
}

/** 0–1 brightness of the cabin lamp: how far today has climbed toward elite. */
export const lampHeat = (mins: number, t: Thresholds): number => Math.max(0, Math.min(1, mins / t.elite));

/** The soonest deadline on or after `today`, with days left. */
export function nextDeadline(deadlines: { n: string; d: string }[], today: string): { n: string; d: string; left: number } | null {
  const up = deadlines.filter((x) => x.d >= today).sort((a, b) => a.d.localeCompare(b.d))[0];
  if (!up) return null;
  return { ...up, left: Math.round((Date.parse(`${up.d}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000) };
}

/** One line under the lamp: where today stands and what the next push earns. */
export function lampLine(mins: number, t: Thresholds, streak: number): string {
  const next = nextMark(mins, t);
  if (mins === 0) return streak > 0 ? `The lamp is cold. ${t.warn}m keeps ${streak === 1 ? 'yesterday’s start' : `a ${streak}-day streak`} alive.` : `The lamp is cold. ${t.warn}m lights it.`;
  if (!next) return 'Elite day. The lamp is roaring — anything more is a gift.';
  const label = next.grade === 'warn' ? 'warning line' : `${GRADE_LABEL[next.grade].toLowerCase()} day`;
  return `${next.need}m more to ${next.grade === 'elite' ? 'an' : 'a'} ${label}.`;
}

/**
 * Where day `i` of `n` sits in the year-as-a-galaxy view: three spiral arms winding out from the
 * core, January at the centre and December at the rim. Returns -1..1 coordinates.
 */
export function galaxyPoint(i: number, n: number): { x: number; y: number } {
  const t = n > 1 ? i / (n - 1) : 0;
  const arm = i % 3;
  const angle = (arm * 2 * Math.PI) / 3 + t * 3.4 * Math.PI;
  const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const r = 0.1 + 0.86 * t + jitter * 0.025;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/** Minutes for each day of month `m` (0-11), with null for days that haven't happened yet. */
export function monthDays(days: DayMap, y: number, m: number, today: string): (number | null)[] {
  const dim = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: dim }, (_, i) => {
    const key = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
    return key > today ? null : dayTotal(days[key]);
  });
}

/* ---------------- the whole ledger, like the original: week pace, year of weeks, trend, totals, log ---------------- */

/** This week against the weekly targets: total, grade, the share of the week gone, and where the pace points. */
export function weekPace(days: DayMap, monday: string, today: string, weekly: Thresholds): { total: number; grade: GradeKey; through: number; projected: number; toElite: number } {
  const total = weekTotal(days, monday);
  const elapsed = Math.max(1, Math.min(7, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${monday}T12:00:00`)) / 86_400_000) + 1));
  return { total, grade: gradeOf(total, weekly), through: elapsed / 7, projected: Math.round((total / elapsed) * 7), toElite: Math.max(0, weekly.elite - total) };
}

/** Every week that touches `year`, up to the week holding `today`, with its total and its weekly grade. */
export function yearWeeks(days: DayMap, year: number, today: string, weekly: Thresholds): { monday: string; mins: number; grade: GradeKey; now: boolean }[] {
  const out: { monday: string; mins: number; grade: GradeKey; now: boolean }[] = [];
  const last = mondayOf(today);
  for (let m = mondayOf(`${year}-01-01`); m <= `${year}-12-31` && m <= last; m = addDays(m, 7)) {
    const mins = weekTotal(days, m);
    out.push({ monday: m, mins, grade: gradeOf(mins, weekly), now: m === last });
  }
  return out;
}

/** The 7-day rolling average (minutes a day) for each day of `year` up to `today`. */
export function rolling7(days: DayMap, year: number, today: string): { date: string; avg: number }[] {
  const keys = daysOfYear(year).filter((d) => d <= today);
  return keys.map((date) => {
    let t = 0;
    for (let i = 0; i < 7; i++) t += dayTotal(days[addDays(date, -i)]);
    return { date, avg: Math.round(t / 7) };
  });
}

/** Minutes per month of `year`. */
export function monthTotals(days: DayMap, year: number): number[] {
  const out = Array.from({ length: 12 }, () => 0);
  for (const [d, e] of Object.entries(days)) if (d.startsWith(`${year}-`)) out[Number(d.slice(5, 7)) - 1] += dayTotal(e);
  return out;
}

/** Where the year went: minutes per category, biggest first (every category listed). */
export function yearByCat(days: DayMap, year: number): { k: CatKey; mins: number }[] {
  const tot = Object.fromEntries(CATS.map((c) => [c.k, 0])) as Record<CatKey, number>;
  for (const [d, e] of Object.entries(days)) if (d.startsWith(`${year}-`)) for (const c of CATS) tot[c.k] += Number(e[c.k]) || 0;
  return CATS.map((c) => ({ k: c.k, mins: tot[c.k] })).sort((a, b) => b.mins - a.mins);
}

/** The log for one month ('YYYY-MM'): every day up to `today`, newest first, zero days included (they count too). */
export function monthLog(days: DayMap, ym: string, today: string): { date: string; e: DayEntry; total: number }[] {
  const [y, m] = ym.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const out: { date: string; e: DayEntry; total: number }[] = [];
  for (let d = dim; d >= 1; d--) {
    const date = `${ym}-${pad(d)}`;
    if (date > today) continue;
    out.push({ date, e: days[date] ?? {}, total: dayTotal(days[date]) });
  }
  return out;
}

/** The months that have anything logged, newest first (for the log's month picker), always including this month. */
export function loggedMonths(days: DayMap, today: string): string[] {
  const set = new Set(Object.keys(days).filter((d) => hasEntry(days[d]) || days[d]?.note).map((d) => d.slice(0, 7)));
  set.add(today.slice(0, 7));
  return [...set].sort().reverse();
}
