import { addDays, mondayOf } from '../../core/dates';
import { dayTotal, gradeOf } from './logic';
import type { DayMap, Thresholds } from './types';

/** A star in your sky: a milestone of the writing life, and the day it was earned. */
export interface Milestone {
  id: string;
  name: string;
  desc: string;
  /** Position in the constellation field (0–100 × 0–100). */
  x: number;
  y: number;
  /** Size of the star once earned. */
  mag: number;
  earnedOn: string | null;
}

type Def = Omit<Milestone, 'earnedOn'>;

export const MILESTONES: Def[] = [
  { id: 'first-light', name: 'First Light', desc: 'The first day logged in the Ledger.', x: 8, y: 70, mag: 1 },
  { id: 'lantern', name: 'The Lantern', desc: '10 hours toward the book.', x: 18, y: 48, mag: 1 },
  { id: 'seven', name: 'Seven Sisters', desc: 'A 7-day streak. Lights the Lounge fireplace.', x: 27, y: 62, mag: 1.2 },
  { id: 'north-star', name: 'The North Star', desc: 'The first elite day.', x: 34, y: 22, mag: 1.6 },
  { id: 'hearth', name: 'The Hearth', desc: '50 hours. Fills the Lounge bookshelf.', x: 44, y: 44, mag: 1.2 },
  { id: 'long-week', name: 'The Long Week', desc: 'The first elite week. Brings the record player.', x: 52, y: 70, mag: 1.3 },
  { id: 'thirty', name: 'The Thirty', desc: 'A 30-day streak.', x: 61, y: 38, mag: 1.4 },
  { id: 'hundred', name: 'The Hundred', desc: '100 hours. The reading chair, and the aurora.', x: 70, y: 18, mag: 1.7 },
  { id: 'letter', name: 'The Letter', desc: 'The first minutes spent querying agents.', x: 74, y: 58, mag: 1.1 },
  { id: 'ten-fires', name: 'Ten Fires', desc: 'Ten elite days.', x: 83, y: 36, mag: 1.3 },
  { id: 'unbroken', name: 'The Unbroken', desc: 'A 100-day streak.', x: 90, y: 64, mag: 1.6 },
  { id: 'long-road', name: 'The Long Road', desc: '500 hours. The book is in there.', x: 95, y: 20, mag: 2 },
];

/** Walk the Ledger in order and note the day each milestone was first reached. */
export function milestones(days: DayMap, t: Thresholds, weekly: Thresholds): Milestone[] {
  const keys = Object.keys(days).filter((k) => dayTotal(days[k]) > 0).sort();
  const got: Record<string, string> = {};
  const hit = (id: string, day: string) => { if (!got[id]) got[id] = day; };
  let total = 0, run = 0, elites = 0, prev = '';
  const week: Record<string, number> = {};
  for (const k of keys) {
    const mins = dayTotal(days[k]);
    total += mins;
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    prev = k;
    const mon = mondayOf(k);
    week[mon] = (week[mon] ?? 0) + mins;
    if (gradeOf(mins, t) === 'elite') elites++;
    hit('first-light', k);
    if (total >= 600) hit('lantern', k);
    if (run >= 7) hit('seven', k);
    if (elites >= 1) hit('north-star', k);
    if (total >= 3000) hit('hearth', k);
    if (week[mon] >= weekly.elite) hit('long-week', k);
    if (run >= 30) hit('thirty', k);
    if (total >= 6000) hit('hundred', k);
    if ((Number(days[k].querying) || 0) > 0) hit('letter', k);
    if (elites >= 10) hit('ten-fires', k);
    if (run >= 100) hit('unbroken', k);
    if (total >= 30000) hit('long-road', k);
  }
  return MILESTONES.map((m) => ({ ...m, earnedOn: got[m.id] ?? null }));
}

/** Quick lookup: has this milestone been earned? */
export const earned = (list: Milestone[], id: string) => Boolean(list.find((m) => m.id === id)?.earnedOn);
