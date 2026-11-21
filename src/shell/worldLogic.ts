/** How the homestead itself changes with the life lived in it. Pure functions. */
import type { Phase } from '../core/skyLogic';

export interface Growth {
  /** Flowers in the garden by the cabin: one for every three days of the current streak, up to 12. */
  flowers: number;
  /** Young pines planted along the path: one per 50 hours, up to 10. */
  saplings: number;
  /** The lighthouse on the far point: lit at 1,000 hours. */
  lighthouse: boolean;
  hoursToLighthouse: number;
  /** The publishing house rises the day an offer of representation comes in. */
  publishingHouse: boolean;
}

export function growth(totalMinutes: number, streak: number, hasOffer: boolean): Growth {
  const hours = totalMinutes / 60;
  return {
    flowers: Math.min(12, Math.floor(streak / 3)),
    saplings: Math.min(10, Math.floor(hours / 50)),
    lighthouse: hours >= 1000,
    hoursToLighthouse: Math.max(0, Math.ceil(1000 - hours)),
    publishingHouse: hasOffer,
  };
}

/** Whole years since the first logged day, if today is its anniversary. */
export function anniversary(firstDay: string | null, today: string): number | null {
  if (!firstDay || firstDay.slice(5) !== today.slice(5)) return null;
  const years = Number(today.slice(0, 4)) - Number(firstDay.slice(0, 4));
  return years > 0 ? years : null;
}

/** Cooper and Shadow go grey at the muzzle over the years (0 → 1 across about eight years). */
export const greyness = (firstDay: string | null, today: string) => (firstDay ? Math.max(0, Math.min(1, (Date.parse(today) - Date.parse(firstDay)) / (8 * 365.25 * 86_400_000))) : 0);

export type Trick = 'shake' | 'spin' | 'roll' | 'howl';
export const TRICKS: { t: Trick; name: string; how: string }[] = [
  { t: 'shake', name: 'Shake', how: 'learned at 100 hours' },
  { t: 'spin', name: 'Spin', how: 'learned with the first elite week' },
  { t: 'roll', name: 'Roll over', how: 'learned at a 30-day streak' },
  { t: 'howl', name: 'Howl at the moon', how: 'learned at 500 hours' },
];

/** Tricks the dogs know, from milestones earned. */
export function tricks(earned: (id: string) => boolean): Trick[] {
  const out: Trick[] = [];
  if (earned('hundred')) out.push('shake');
  if (earned('long-week')) out.push('spin');
  if (earned('thirty')) out.push('roll');
  if (earned('long-road')) out.push('howl');
  return out;
}

/** Late at night the homestead turns in: windows go dark unless that building was used today. */
export const bedtime = (d: Date) => d.getHours() >= 23 || d.getHours() < 5;

/** How the buildings are lit by the sky (separate from their own lamps). */
export function daylight(p: Phase): { wall: number; glow: number } {
  return { night: { wall: 0, glow: 1 }, dusk: { wall: 0.25, glow: 0.85 }, dawn: { wall: 0.3, glow: 0.7 }, golden: { wall: 0.45, glow: 0.6 }, day: { wall: 0.6, glow: 0.35 } }[p];
}

/** A book finished today or yesterday, for Cooper and Shadow to make a fuss about (the newest one). */
export function freshFinish(books: { title: string; status: string; finished?: string }[], today: string, yesterday: string): string | null {
  const hit = books.filter((b) => b.status === 'read' && (b.finished === today || b.finished === yesterday))
    .sort((a, b) => (b.finished ?? '').localeCompare(a.finished ?? ''))[0];
  return hit?.title ?? null;
}
