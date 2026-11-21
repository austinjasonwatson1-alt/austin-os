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
