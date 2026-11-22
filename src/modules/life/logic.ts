/** The whole life, seen together: balance across the areas, neglect, and patterns between them. Pure. */
import { addDays, parseISO } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { areaMinutes } from '../areas/logic';
import { chapelMinutes } from '../chapel/logic';
import type { ChapelDay } from '../chapel/types';
import { dayTotal } from '../ledger/logic';
import type { DayMap } from '../ledger/types';

export type LifeArea = 'writing' | 'faith' | 'work' | 'learning' | 'body' | 'family';

export const LIFE_AREAS: { id: LifeArea; name: string; place: string; path: string; glyph: string; color: string }[] = [
  { id: 'writing', name: 'Writing', place: 'The Cabin', path: '/cabin', glyph: '✒', color: '#E8A84B' },
  { id: 'faith', name: 'Faith', place: 'The Chapel', path: '/chapel', glyph: '✝', color: '#F2D58A' },
  { id: 'work', name: 'Work', place: 'The Office', path: '/office', glyph: '▣', color: '#6FB3F2' },
  { id: 'learning', name: 'Learning', place: 'The Observatory', path: '/observatory', glyph: '◐', color: '#8E7CF0' },
  { id: 'body', name: 'Body', place: 'The Forge', path: '/forge', glyph: '⚒', color: '#E07A3F' },
  { id: 'family', name: 'Family', place: 'The Hearth', path: '/hearth', glyph: '♥', color: '#D97BA4' },
];

/** Minutes a week that make an area "full" on the wheel. Austin can change these. */
export type Targets = Record<LifeArea, number>;
export const DEFAULT_TARGETS: Targets = { writing: 450, faith: 105, work: 1500, learning: 180, body: 210, family: 300 };

export interface LifeData { targets: Targets }
export const DEFAULT_LIFE: LifeData = { targets: DEFAULT_TARGETS };

/** Every area's minutes per day, from the stores. */
export interface LifeInput {
  ledger: DayMap;
  chapel: Record<string, ChapelDay>;
  office: Record<string, Record<string, number>>;
  observatory: Record<string, Record<string, number>>;
  forge: Record<string, Record<string, number>>;
  hearth: Record<string, Record<string, number>>;
  /** Dog walks per day (the Kennel), counted with the body. */
  walks?: Record<string, number>;
}

export function minutesOn(x: LifeInput, area: LifeArea, day: string): number {
  switch (area) {
    case 'writing': return dayTotal(x.ledger[day]);
    case 'faith': return chapelMinutes(x.chapel[day]);
    case 'work': return areaMinutes(x.office[day]);
    case 'learning': return areaMinutes(x.observatory[day]);
    case 'body': return areaMinutes(x.forge[day]) + (x.walks?.[day] ?? 0);
    case 'family': return areaMinutes(x.hearth[day]);
  }
}

const week = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export interface Spoke { area: LifeArea; mins: number; target: number; score: number }

/** The wheel for one week: each area's minutes against its target (0–1, capped). */
export function balanceWeek(x: LifeInput, monday: string, t: Targets, upTo?: string): Spoke[] {
  const days = week(monday).filter((d) => !upTo || d <= upTo);
  return LIFE_AREAS.map(({ id }) => {
    const mins = days.reduce((n, d) => n + minutesOn(x, id, d), 0);
    return { area: id, mins, target: t[id], score: t[id] > 0 ? Math.min(1, mins / t[id]) : 0 };
  });
}

/** One number for how even the week was: the mean, pulled down by the weakest spoke. */
export function balanceScore(spokes: Spoke[]): number {
  if (!spokes.length) return 0;
  const mean = spokes.reduce((n, s) => n + s.score, 0) / spokes.length;
  const low = Math.min(...spokes.map((s) => s.score));
  return Math.round((mean * 0.7 + low * 0.3) * 100);
}

/** Days since each area last got any time (null: never). The homestead dims what's been left alone. */
export function lastTended(x: LifeInput, today: string, lookback = 120): Record<LifeArea, number | null> {
  const out = {} as Record<LifeArea, number | null>;
  for (const { id } of LIFE_AREAS) {
    out[id] = null;
    for (let i = 0; i <= lookback; i++) if (minutesOn(x, id, addDays(today, -i)) > 0) { out[id] = i; break; }
  }
  return out;
}

/** How neglected a building looks: 0 cared for, 1 a little dusty (4–9 days), 2 cobwebs (10+ days). */
export const neglectLevel = (days: number | null, everUsed: boolean): 0 | 1 | 2 => (!everUsed || days === null ? 0 : days >= 10 ? 2 : days >= 4 ? 1 : 0);

/* ---------------- insights ---------------- */

export interface Insight {
  id: string;
  /** The finding, in one sentence. */
  title: string;
  /** The numbers behind it. */
  evidence: string;
  /** How strong the pattern is, for ordering (ratio-ish). */
  strength: number;
  area: LifeArea;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
const DOW = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * Patterns between the areas over the last `span` days, only where there's enough to go on
 * (at least 8 days on each side) and the difference is real (25% or more).
 */
export function insights(x: LifeInput, today: string, span = 120, sprints: { at: string; words: number; completed: boolean }[] = []): Insight[] {
  const days = Array.from({ length: span }, (_, i) => addDays(today, -i - 1)).reverse();
  const active = days.filter((d) => LIFE_AREAS.some((a) => minutesOn(x, a.id, d) > 0));
  if (active.length < 14) return [];
  const writing = (d: string) => minutesOn(x, 'writing', d);
  const out: Insight[] = [];

  // Does time in another area go with more writing that day?
  for (const a of ['faith', 'body', 'family', 'learning'] as const) {
    const withA = active.filter((d) => minutesOn(x, a, d) > 0);
    const without = active.filter((d) => minutesOn(x, a, d) === 0);
    if (withA.length < 8 || without.length < 8) continue;
    const w1 = avg(withA.map(writing)), w0 = avg(without.map(writing));
    if (w0 <= 0 && w1 > 0) {
      out.push({ id: `with-${a}`, area: a, strength: 3, title: `You only write on days with time in ${LIFE_AREAS.find((l) => l.id === a)!.place.replace('The ', 'the ')}.`, evidence: `${fm(w1)} of writing on ${withA.length} days with it, none on the ${without.length} without.` });
      continue;
    }
    const r = w1 / w0;
    const place = LIFE_AREAS.find((l) => l.id === a)!.place.replace('The ', 'the ');
    if (r >= 1.25) out.push({ id: `with-${a}`, area: a, strength: r, title: `You write ${r >= 1.95 ? `${(Math.round(r * 10) / 10).toString()}×` : `${Math.round((r - 1) * 100)}% more`} on days you spend time in ${place}.`, evidence: `${fm(w1)} a day with it (${withA.length} days) vs ${fm(w0)} without (${without.length} days).` });
    else if (r <= 0.75) out.push({ id: `with-${a}`, area: a, strength: 1 / r, title: `Writing drops on days with time in ${place}.`, evidence: `${fm(w1)} a day with it (${withA.length} days) vs ${fm(w0)} without (${without.length} days).` });
  }

  // Heavy work weeks and the writing.
  const mondays = [...new Set(days.map((d) => { const dt = parseISO(d); const off = (dt.getDay() + 6) % 7; return addDays(d, -off); }))].filter((m) => addDays(m, 6) < today);
  const wk = mondays.map((m) => ({ work: week(m).reduce((n, d) => n + minutesOn(x, 'work', d), 0), writing: week(m).reduce((n, d) => n + writing(d), 0) }));
  const worked = wk.filter((w) => w.work > 0);
  if (worked.length >= 6) {
    const sorted = [...worked].sort((a, b) => a.work - b.work);
    const half = Math.floor(sorted.length / 2);
    const light = avg(sorted.slice(0, half).map((w) => w.writing)), heavy = avg(sorted.slice(-half).map((w) => w.writing));
    if (light > 0 && heavy / light <= 0.75) out.push({ id: 'work-load', area: 'work', strength: light / Math.max(1, heavy), title: 'Your heaviest work weeks cost the book the most.', evidence: `${fm(heavy)} of writing in your busiest work weeks vs ${fm(light)} in the lighter ones (${worked.length} weeks).` });
  }

  // The strongest day of the week for writing.
  const byDow = Array.from({ length: 7 }, (_, i) => avg(active.filter((d) => parseISO(d).getDay() === i).map(writing)));
  const counts = Array.from({ length: 7 }, (_, i) => active.filter((d) => parseISO(d).getDay() === i).length);
  const overall = avg(active.map(writing));
  const best = byDow.indexOf(Math.max(...byDow));
  if (counts[best] >= 4 && overall > 0 && byDow[best] / overall >= 1.25) {
    out.push({ id: 'best-day', area: 'writing', strength: byDow[best] / overall, title: `${DOW[best]} are your strongest writing days.`, evidence: `${fm(byDow[best])} on an average ${DOW[best].slice(0, -1)} vs ${fm(overall)} across all days.` });
  }
  const worst = byDow.indexOf(Math.min(...byDow));
  if (counts[worst] >= 4 && overall > 0 && byDow[worst] / overall <= 0.5) {
    out.push({ id: 'worst-day', area: 'writing', strength: overall / Math.max(1, byDow[worst]), title: `${DOW[worst]} are where the writing slips.`, evidence: `${fm(byDow[worst])} on an average ${DOW[worst].slice(0, -1)} vs ${fm(overall)} across all days.` });
  }

  // When the best sprints happen.
  const done = sprints.filter((s) => s.completed && s.words > 0);
  if (done.length >= 6) {
    const hourOf = (s: { at: string }) => new Date(s.at).getHours();
    const early = done.filter((s) => hourOf(s) < 12), late = done.filter((s) => hourOf(s) >= 12);
    if (early.length >= 3 && late.length >= 3) {
      const e = avg(early.map((s) => s.words)), l = avg(late.map((s) => s.words));
      if (e / l >= 1.25) out.push({ id: 'sprint-time', area: 'writing', strength: e / l, title: 'Your sprints are stronger before noon.', evidence: `${Math.round(e)} words a sprint in the morning vs ${Math.round(l)} after (${done.length} sprints).` });
      else if (l / e >= 1.25) out.push({ id: 'sprint-time', area: 'writing', strength: l / e, title: 'Your sprints are stronger after noon.', evidence: `${Math.round(l)} words a sprint in the afternoon and evening vs ${Math.round(e)} before (${done.length} sprints).` });
    }
  }

  return out.sort((a, b) => b.strength - a.strength);
}

export const describeLife: Describer = {
  name: 'The Compass',
  size: (v) => Object.keys((v as Partial<LifeData> | undefined)?.targets ?? {}).length,
  detail: (v) => ((v as Partial<LifeData> | undefined)?.targets ? 'weekly targets for six areas' : 'nothing yet'),
};
