/** Pure logic for Seasons of Life: quarters, progress, the season review, and the road's geometry. */

import { addDays, daysUntil, iso, parseISO } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { LIFE_AREAS, type Goal, type GoalsData, type Horizon, type LifeArea, type Milestone, type Quarter } from './types';

/* ---------------- quarters ---------------- */

export function quarterOf(day: string): Quarter {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

export function parseQuarter(q: Quarter): { year: number; n: 1 | 2 | 3 | 4 } {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m) throw new Error(`Not a quarter: ${q}`);
  return { year: Number(m[1]), n: Number(m[2]) as 1 | 2 | 3 | 4 };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** First and last day of a quarter (inclusive). */
export function quarterRange(q: Quarter): { start: string; end: string } {
  const { year, n } = parseQuarter(q);
  const start = `${year}-${pad2((n - 1) * 3 + 1)}-01`;
  const nq = nextQuarter(q);
  const { year: ny, n: nn } = parseQuarter(nq);
  const end = addDays(`${ny}-${pad2((nn - 1) * 3 + 1)}-01`, -1);
  return { start, end };
}

export function nextQuarter(q: Quarter): Quarter {
  const { year, n } = parseQuarter(q);
  return n === 4 ? `${year + 1}-Q1` : `${year}-Q${n + 1}`;
}

export function prevQuarter(q: Quarter): Quarter {
  const { year, n } = parseQuarter(q);
  return n === 1 ? `${year - 1}-Q4` : `${year}-Q${n - 1}`;
}

/** Days from `day` to the quarter's last day (0 on the last day). */
export function daysLeftInQuarter(day: string): number {
  return daysUntil(quarterRange(quarterOf(day)).end, day);
}

/** 'Q4' for the current year, 'Q1 2027' otherwise. */
export function quarterLabel(q: Quarter, thisYear?: number): string {
  const { year, n } = parseQuarter(q);
  return year === thisYear ? `Q${n}` : `Q${n} ${year}`;
}

export const quartersOfYear = (year: number): Quarter[] => [1, 2, 3, 4].map((n) => `${year}-Q${n}`);

/** The quarter compares as a string ('2026-Q4' < '2027-Q1'), which is all ordering needs. */
export const quarterBefore = (a: Quarter, b: Quarter) => a < b;

/** Last day of the calendar year in which the horizon ends, counted from `today`. */
export function defaultBy(horizon: Horizon, today: string): string {
  const years = horizon === '10y' ? 10 : horizon === '3y' ? 3 : 1;
  const d = parseISO(today);
  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() - 1);
  return `${iso(d).slice(0, 4)}-12-31`;
}

/* ---------------- milestones & progress ---------------- */

export const isOpen = (m: Milestone) => !m.done && !m.dropped;

/** A goal's own id plus every goal beneath it (3y under 10y, 1y under 3y…). */
export function goalFamily(goals: Goal[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of goals) if (g.parent && out.has(g.parent) && !out.has(g.id)) { out.add(g.id); grew = true; }
  }
  return out;
}

export interface Progress { done: number; total: number; pct: number }

/** Milestones reached out of those planned for a goal and everything beneath it (let-go ones don't count). */
export function goalProgress(goals: Goal[], milestones: Milestone[], id: string): Progress {
  const fam = goalFamily(goals, id);
  const mine = milestones.filter((m) => fam.has(m.goal) && !m.dropped);
  const done = mine.filter((m) => m.done).length;
  return { done, total: mine.length, pct: mine.length ? done / mine.length : 0 };
}

export function milestonesIn(milestones: Milestone[], q: Quarter): Milestone[] {
  return milestones.filter((m) => m.quarter === q && !m.dropped);
}

export interface SeasonProgress { done: number; total: number; daysLeft: number; quarter: Quarter }

export function seasonProgress(milestones: Milestone[], today: string): SeasonProgress {
  const q = quarterOf(today);
  const ms = milestonesIn(milestones, q);
  return { quarter: q, done: ms.filter((m) => m.done).length, total: ms.length, daysLeft: daysLeftInQuarter(today) };
}

/** Area of a milestone, through its goal ('writing' when the goal has gone). */
export function areaOfMilestone(goals: Goal[], m: Milestone): LifeArea {
  return goals.find((g) => g.id === m.goal)?.area ?? 'writing';
}

/** This quarter's milestones, grouped by area in the homestead's order. */
export function groupByArea(goals: Goal[], ms: Milestone[]): { area: LifeArea; items: Milestone[] }[] {
  return LIFE_AREAS.map((a) => ({ area: a.id, items: ms.filter((m) => areaOfMilestone(goals, m) === a.id) })).filter((g) => g.items.length);
}

/* ---------------- the season review ---------------- */

export interface SeasonReview {
  quarter: Quarter;
  byArea: { area: LifeArea; done: number; open: number }[];
  done: number;
  open: Milestone[];
  /** Milestones in this quarter that were carried in from an earlier one. */
  carried: Milestone[];
  /** Still-open milestones left behind in earlier quarters. */
  behind: Milestone[];
  /** Open 1-year goals with no milestone planned this quarter. */
  unplanned: Goal[];
}

export function seasonReview(goals: Goal[], milestones: Milestone[], quarter: Quarter): SeasonReview {
  const ms = milestonesIn(milestones, quarter);
  const byArea = LIFE_AREAS.map((a) => {
    const mine = ms.filter((m) => areaOfMilestone(goals, m) === a.id);
    return { area: a.id, done: mine.filter((m) => m.done).length, open: mine.filter((m) => !m.done).length };
  }).filter((r) => r.done + r.open > 0);
  const planned = new Set(ms.map((m) => m.goal));
  return {
    quarter,
    byArea,
    done: ms.filter((m) => m.done).length,
    open: ms.filter((m) => !m.done),
    carried: ms.filter((m) => m.carriedFrom),
    behind: milestones.filter((m) => isOpen(m) && quarterBefore(m.quarter, quarter)),
    unplanned: goals.filter((g) => g.horizon === '1y' && !g.done && !planned.has(g.id)),
  };
}

/** The "Plan next season" panel opens itself in the last two weeks of a quarter. */
export const PLAN_WINDOW = 14;
export const planningSeason = (today: string) => daysLeftInQuarter(today) < PLAN_WINDOW;

/** Move a milestone on (to the next quarter by default), remembering where it started. */
export function carried(m: Milestone, to: Quarter = nextQuarter(m.quarter)): Milestone {
  return { ...m, quarter: to, done: undefined, dropped: undefined, carriedFrom: m.carriedFrom ?? m.quarter };
}

/* ---------------- the road ---------------- */

export const ROAD = { W: 1000, H: 470, horizon: 168, bottom: 470, cx: 500, sway: 290, halfWidth: 120 } as const;
/** How much of the road (0 = at your feet, 1 = the horizon) the current year takes up. */
export const YEAR_SPAN = 0.82;
/** The current quarter gets this much more road than the others, so it reads up close. */
export const CURRENT_WEIGHT = 2.2;

export interface RoadPoint { x: number; y: number; w: number; scale: number }

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A point on the road at `t` (0 near, 1 at the horizon): center x/y, half-width and a size scale. */
export function roadPoint(t: number): RoadPoint {
  const c = Math.min(1, Math.max(0, t));
  const k = 1 - c;
  const y = ROAD.horizon + (ROAD.bottom - ROAD.horizon) * Math.pow(k, 0.82);
  const x = ROAD.cx + ROAD.sway * Math.pow(k, 0.85) * Math.sin(c * Math.PI * 2.3 + 0.35);
  const w = 2 + ROAD.halfWidth * Math.pow(k, 1.35);
  return { x: r1(x), y: r1(y), w: r1(w), scale: Math.round((0.42 + 0.58 * k) * 100) / 100 };
}

/** The road as a filled ribbon (left edge up, right edge back down). */
export function roadOutline(steps = 72): string {
  const pts = Array.from({ length: steps + 1 }, (_, i) => roadPoint(i / steps));
  const left = pts.map((p) => `${r1(p.x - p.w)},${p.y}`);
  const right = pts.reverse().map((p) => `${r1(p.x + p.w)},${p.y}`);
  return `M${left.join(' L')} L${right.join(' L')} Z`;
}

/** The road's center line from t0 to t1, for the dashes and the lit stretch. */
export function roadLine(t0 = 0, t1 = 1, steps = 60): string {
  const n = Math.max(2, Math.round(steps * Math.abs(t1 - t0)) + 1);
  return Array.from({ length: n + 1 }, (_, i) => roadPoint(t0 + ((t1 - t0) * i) / n)).map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
}

export interface Span { quarter: Quarter; t0: number; t1: number }

/** Where each quarter of the year sits on the road, the current one given extra length. */
export function quarterSpans(year: number, current?: Quarter): Span[] {
  const qs = quartersOfYear(year);
  const weights = qs.map((q) => (q === current ? CURRENT_WEIGHT : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  return qs.map((q, i) => {
    const t0 = at;
    at += (weights[i] / total) * YEAR_SPAN;
    return { quarter: q, t0: round4(t0), t1: round4(at) };
  });
}
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Evenly space `count` markers inside a span, clear of both ends. */
export function lanternTs(count: number, span: { t0: number; t1: number }): number[] {
  return Array.from({ length: count }, (_, i) => round4(span.t0 + ((i + 1) / (count + 1)) * (span.t1 - span.t0)));
}

/** Where a day falls on the road. Before the year: 0. After it: just past the year, toward the horizon. */
export function dayT(day: string, spans: Span[]): number {
  const first = quarterRange(spans[0].quarter).start;
  const last = quarterRange(spans[spans.length - 1].quarter).end;
  if (day < first) return 0;
  if (day > last) return round4(Math.min(0.93, YEAR_SPAN + 0.03 + 0.012 * Math.min(4, daysUntil(day, last) / 90)));
  const s = spans.find((x) => x.quarter === quarterOf(day))!;
  const { start, end } = quarterRange(s.quarter);
  const f = daysUntil(day, start) / Math.max(1, daysUntil(end, start) + 1);
  return round4(s.t0 + f * (s.t1 - s.t0));
}

export interface PostSlot { id: string; t: number; side: 1 | -1; lift: number }

/** Signposts along the road: alternate sides in road order, and raise a board that would sit on its neighbour. */
export function signpostSlots(items: { id: string; t: number }[], gap = 22): PostSlot[] {
  const sorted = [...items].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  const out: PostSlot[] = [];
  sorted.forEach((it, i) => {
    const side: 1 | -1 = i % 2 ? 1 : -1;
    const y = roadPoint(it.t).y;
    const prev = [...out].reverse().find((o) => o.side === side);
    const lift = prev && Math.abs(roadPoint(prev.t).y - prev.lift - y) < gap ? prev.lift + gap : 0;
    out.push({ id: it.id, t: it.t, side, lift });
  });
  return out;
}

/* ---------------- restore preview ---------------- */

export const describeGoals: Describer = {
  name: 'Seasons of Life',
  size: (v) => {
    const d = v as Partial<GoalsData>;
    return (d.goals?.length ?? 0) + (d.milestones?.length ?? 0);
  },
  detail: (v) => {
    const d = v as Partial<GoalsData>;
    const g = d.goals?.length ?? 0, m = d.milestones?.length ?? 0;
    return `${g} goal${g === 1 ? '' : 's'} · ${m} milestone${m === 1 ? '' : 's'}`;
  },
};
