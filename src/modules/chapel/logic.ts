import { addDays } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { ChapelData, ChapelDay, Prayer } from './types';

export const chapelMinutes = (d: ChapelDay | undefined) => (d ? (d.prayer || 0) + (d.scripture || 0) : 0);

/** Days in a row with any time with God. An empty today doesn't break it until tomorrow. */
export function chapelStreak(days: Record<string, ChapelDay>, today: string): number {
  let cursor = chapelMinutes(days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (chapelMinutes(days[cursor]) > 0) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** The seven days from `monday`, with minutes each. */
export function chapelWeek(days: Record<string, ChapelDay>, monday: string): { date: string; mins: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, mins: chapelMinutes(days[date]) };
  });
}

/** Candle brightness for a day, 0–1: 30 minutes is a full flame. */
export const candleHeat = (mins: number) => Math.max(0, Math.min(1, mins / 30));

/** Open prayers newest first; answered ones newest answer first. */
export function sortPrayers(prayers: Prayer[]): { open: Prayer[]; answered: Prayer[] } {
  return {
    open: prayers.filter((p) => !p.answeredOn).sort((a, b) => b.added.localeCompare(a.added)),
    answered: prayers.filter((p) => p.answeredOn).sort((a, b) => (b.answeredOn ?? '').localeCompare(a.answeredOn ?? '')),
  };
}

/** How long a prayer was carried before it was answered, e.g. "3 weeks". */
export function carried(p: Prayer): string | null {
  if (!p.answeredOn) return null;
  const days = Math.round((Date.parse(`${p.answeredOn}T12:00:00`) - Date.parse(`${p.added}T12:00:00`)) / 86_400_000);
  if (days < 1) return 'the same day';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

export const describeChapel: Describer = {
  name: 'The Chapel',
  size: (v) => {
    const d = v as Partial<ChapelData>;
    return Object.keys(d.days ?? {}).length + (d.prayers?.length ?? 0) + (d.verses?.length ?? 0);
  },
  detail: (v) => {
    const d = v as Partial<ChapelData>;
    const p = d.prayers ?? [];
    const answered = p.filter((x) => x.answeredOn).length;
    return `${Object.keys(d.days ?? {}).length} days · ${p.length} prayers (${answered} answered) · ${(d.verses ?? []).length} verses`;
  },
};

/** From 7pm, if the candle hasn't been lit today, Home offers a gentle reminder. */
export const chapelNudge = (now: Date, minsToday: number) => now.getHours() >= 19 && minsToday === 0;
