/** Seasons of Life: long-horizon goals across the homestead, laddered down to quarterly milestones. */

export type LifeArea = 'writing' | 'faith' | 'work' | 'learning' | 'body' | 'family' | 'money';
export type Horizon = '10y' | '3y' | '1y';
/** A calendar quarter, 'YYYY-Qn' (n = 1–4). */
export type Quarter = string;

export interface Goal {
  id: string;
  area: LifeArea;
  horizon: Horizon;
  title: string;
  why?: string;
  /** Target day, YYYY-MM-DD (defaults to the end of the horizon). */
  by: string;
  /** The day it was reached. */
  done?: string;
  /** A longer-horizon goal this one ladders up to. */
  parent?: string;
}

export interface Milestone {
  id: string;
  goal: string;
  quarter: Quarter;
  title: string;
  /** The day it was done. */
  done?: string;
  /** The quarter it was first planned for, when it has been carried forward. */
  carriedFrom?: Quarter;
  /** The day it was let go (kept for the record, but no longer open). */
  dropped?: string;
}

export interface GoalsData {
  goals: Goal[];
  milestones: Milestone[];
}

export const DEFAULT_GOALS: GoalsData = { goals: [], milestones: [] };

export interface AreaInfo { id: LifeArea; name: string; place: string; color: string; glyph: string }

/** Colors match each area's building on the homestead. */
export const LIFE_AREAS: AreaInfo[] = [
  { id: 'writing', name: 'Writing', place: "The Writer's Cabin", color: '#E8A84B', glyph: '⌂' },
  { id: 'faith', name: 'Faith', place: 'The Chapel', color: '#CFD8FF', glyph: '✝' },
  { id: 'work', name: 'Work', place: 'The Office', color: '#6FB3F2', glyph: '▣' },
  { id: 'learning', name: 'Learning', place: 'The Observatory', color: '#8E7CF0', glyph: '◐' },
  { id: 'body', name: 'Body', place: 'The Forge', color: '#E07A3F', glyph: '⚒' },
  { id: 'family', name: 'Family', place: 'The Hearth', color: '#D97BA4', glyph: '♥' },
  { id: 'money', name: 'Money', place: 'The Ledger House', color: '#C9A227', glyph: '¤' },
];
export const AREA_INFO = Object.fromEntries(LIFE_AREAS.map((a) => [a.id, a])) as Record<LifeArea, AreaInfo>;

export const HORIZONS: { id: Horizon; label: string; long: string; years: number }[] = [
  { id: '10y', label: '10 years', long: 'The vision', years: 10 },
  { id: '3y', label: '3 years', long: 'The next ridge', years: 3 },
  { id: '1y', label: '1 year', long: 'This year’s road', years: 1 },
];
