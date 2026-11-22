import { addDays } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { AreaData } from './types';

export const areaMinutes = (d: Record<string, number> | undefined) => (d ? Object.values(d).reduce((s, n) => s + (Number(n) || 0), 0) : 0);

export function areaStreak(days: AreaData['days'], today: string): number {
  let cursor = areaMinutes(days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (areaMinutes(days[cursor]) > 0) { n++; cursor = addDays(cursor, -1); }
  return n;
}

/** Each day Monday→Sunday with minutes by kind. */
export function areaWeek(days: AreaData['days'], monday: string): { date: string; total: number; byKind: Record<string, number> }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, total: areaMinutes(days[date]), byKind: { ...(days[date] ?? {}) } };
  });
}

/** 0–1: how lit the building is today. */
export const areaHeat = (mins: number, fullDay: number) => Math.max(0, Math.min(1, mins / fullDay));

export const describeArea = (name: string): Describer => ({
  name,
  size: (v) => Object.keys((v as Partial<AreaData>).days ?? {}).length + ((v as Partial<AreaData>).items?.length ?? 0),
  detail: (v) => {
    const d = v as Partial<AreaData>;
    const mins = Object.values(d.days ?? {}).reduce((s, x) => s + areaMinutes(x), 0);
    return `${Object.keys(d.days ?? {}).length} days · ${Math.round(mins / 6) / 10}h · ${(d.items ?? []).length} items`;
  },
});

/** The next time a date comes round: itself if one-off, or this/next year's anniversary if yearly. */
export function nextOccurrence(when: string, today: string, yearly: boolean): string {
  if (!yearly) return when;
  const y = Number(today.slice(0, 4));
  const md = when.slice(5);
  const thisYear = `${y}-${md}`;
  return thisYear >= today ? thisYear : `${y + 1}-${md}`;
}

/** Days from `today` to `date` (negative if past). */
export const daysTo = (date: string, today: string) => Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000);

/** Money in, out and net for a year, from lists marked with a sign. */
export function moneyYear(items: { list: string; amount?: number; date: string; when?: string }[], signs: Record<string, 1 | -1>, year: number) {
  let inn = 0, out = 0;
  for (const i of items) {
    const sign = signs[i.list];
    if (!sign || !i.amount || !(i.when ?? i.date).startsWith(String(year))) continue;
    if (sign > 0) inn += i.amount; else out += i.amount;
  }
  return { in: inn, out, net: inn - out };
}

export const money = (n: number) => `${n < 0 ? '\u2212' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: Math.abs(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** The Hearth at a glance: the next date that matters, time together this week, the last moment kept. */
export function hearthGlance(items: { list: string; text: string; date: string; when?: string }[], days: AreaData['days'], today: string, monday: string): {
  next: { text: string; in: number; also: number } | null; weekMins: number; lastMoment: { text: string; ago: number } | null;
} {
  const ahead = items.filter((i) => i.list === 'dates' && i.when)
    .map((i) => ({ text: i.text, in: daysTo(nextOccurrence(i.when!, today, true), today) }))
    .sort((a, b) => a.in - b.in);
  const next = ahead[0] ? { ...ahead[0], also: ahead.filter((a) => a.in <= 30).length - (ahead[0].in <= 30 ? 1 : 0) } : null;
  let weekMins = 0;
  for (let d = monday; d <= today; d = addDays(d, 1)) weekMins += areaMinutes(days[d]);
  const m = items.filter((i) => i.list === 'moments').sort((a, b) => b.date.localeCompare(a.date))[0];
  return { next, weekMins, lastMoment: m ? { text: m.text, ago: Math.max(0, daysTo(today, m.date)) } : null };
}
