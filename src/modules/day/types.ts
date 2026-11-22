import type { LifeArea } from '../life/logic';

export type { LifeArea };

/** How an intention went, marked at the evening close. */
export type IntentionState = 'kept' | 'partly' | 'not';

/** One thing Austin means to do today, at most one per life area. */
export interface Intention {
  area: LifeArea;
  text: string;
  state?: IntentionState;
}

/** A small recurring check ("Scripture reading", "Walk Cooper & Shadow"). */
export interface Habit {
  id: string;
  name: string;
  /** Optional: some habits ("No phone first hour") belong to no one area. */
  area?: LifeArea;
  /** Weekdays it's due, JS numbering (0 = Sunday … 6 = Saturday). Empty or missing = every day. */
  days: number[];
  /** ISO timestamp. Days before its local date are never counted as missed. */
  createdAt: string;
  archived?: boolean;
}

/** One day: what was intended, which habits were done, and how it closed. */
export interface DayEntry {
  intentions: Intention[];
  /** Habit ids checked off that day. */
  done: string[];
  /** "What went well." */
  well?: string;
  /** "What I'll carry into tomorrow." */
  carry?: string;
  /** ISO timestamp the day was sealed. */
  closedAt?: string;
}

export interface DayData {
  /** Keyed by local 'YYYY-MM-DD'. */
  days: Record<string, DayEntry>;
  habits: Habit[];
}

export const DEFAULT_DAY: DayData = { days: {}, habits: [] };

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const STATE_LABEL: Record<IntentionState, string> = { kept: 'Kept', partly: 'Partly', not: 'Not today' };

/** One-tap starters. */
export const STARTERS: { name: string; area?: LifeArea }[] = [
  { name: 'Scripture reading', area: 'faith' },
  { name: 'Walk Cooper & Shadow', area: 'body' },
  { name: '8 glasses of water', area: 'body' },
  { name: 'Read 20 pages', area: 'writing' },
  { name: 'No phone first hour' },
];
