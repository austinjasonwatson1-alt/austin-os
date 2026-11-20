import { addDays, mondayOf } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { dayTotal, gradeOf } from '../ledger/logic';
import type { DayMap, Thresholds } from '../ledger/types';
import type { Claim, LoungeData, Rates } from './types';

export interface Earnings {
  total: number;
  minutes: number;
  days: number;
  weeks: number;
  streaks: number;
  /** Points earned on each date (minutes + day bonus + any streak milestone hit that day). */
  byDay: Record<string, number>;
  /** Week bonuses by Monday. */
  byWeek: Record<string, number>;
}

/** Points a single day is worth on its own: minutes plus its grade bonus. */
export function dayPoints(mins: number, t: Thresholds, r: Rates): number {
  if (mins <= 0) return 0;
  const g = gradeOf(mins, t);
  return Math.floor(mins / 10) * r.perTenMin + (g === 'elite' ? r.elite : g === 'good' ? r.good : 0);
}

/** Streak milestone paid on the day a run of logged days reaches `n`. */
export function streakBonus(n: number, r: Rates): number {
  if (n === 7) return r.streak7;
  if (n === 30) return r.streak30;
  if (n > 0 && n % 100 === 0) return r.streak100;
  return 0;
}

/** Everything the Ledger has earned, recomputed from scratch so it can never drift. */
export function earnings(days: DayMap, t: Thresholds, weekly: Thresholds, r: Rates, countFrom: string | null): Earnings {
  const e: Earnings = { total: 0, minutes: 0, days: 0, weeks: 0, streaks: 0, byDay: {}, byWeek: {} };
  const keys = Object.keys(days).filter((k) => (!countFrom || k >= countFrom) && dayTotal(days[k]) > 0).sort();
  const weekMins: Record<string, number> = {};
  let run = 0;
  let prev = '';
  for (const k of keys) {
    const mins = dayTotal(days[k]);
    const m = Math.floor(mins / 10) * r.perTenMin;
    const d = dayPoints(mins, t, r) - m;
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    prev = k;
    const s = streakBonus(run, r);
    e.minutes += m;
    e.days += d;
    e.streaks += s;
    e.byDay[k] = m + d + s;
    const mon = mondayOf(k);
    weekMins[mon] = (weekMins[mon] ?? 0) + mins;
  }
  for (const [mon, mins] of Object.entries(weekMins)) {
    const b = mins >= weekly.elite ? r.weekElite : mins >= weekly.good ? r.weekGood : 0;
    if (b) {
      e.byWeek[mon] = b;
      e.weeks += b;
    }
  }
  e.total = e.minutes + e.days + e.weeks + e.streaks;
  return e;
}

export const spent = (claims: Claim[]): number => claims.reduce((s, c) => s + c.cost, 0);

/** Points earned between two dates inclusive, counting a week bonus in the week it lands. */
export function earnedBetween(e: Earnings, from: string, to: string): number {
  let n = 0;
  for (const [k, v] of Object.entries(e.byDay)) if (k >= from && k <= to) n += v;
  for (const [k, v] of Object.entries(e.byWeek)) if (k >= mondayOf(from) && k <= to) n += v;
  return n;
}

/** How far the wallet is toward a reward, 0–1. */
export const progressTo = (balance: number, cost: number): number => (cost <= 0 ? 1 : Math.max(0, Math.min(1, balance / cost)));

export const fmtPts = (n: number): string => n.toLocaleString('en-US');

export const describeLounge: Describer = {
  name: 'The Lounge',
  size: (v) => {
    const d = v as Partial<LoungeData>;
    return (d.rewards?.length ?? 0) + (d.claims?.length ?? 0);
  },
  detail: (v) => {
    const d = v as Partial<LoungeData>;
    const r = d.rewards?.length ?? 0;
    const c = d.claims?.length ?? 0;
    return `${r} reward${r === 1 ? '' : 's'} · ${c} claimed`;
  },
};
