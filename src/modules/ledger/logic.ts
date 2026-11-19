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
