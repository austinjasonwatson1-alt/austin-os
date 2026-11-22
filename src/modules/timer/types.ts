import type { CatKey } from '../ledger/types';

/** A session in progress. Absolute timestamps, so it survives a refresh or a closed tab. */
export interface Running {
  cat: CatKey;
  startedAt: number;
  pausedAt: number | null;
  /** Total time spent paused so far. */
  pausedMs: number;
  /** Target length in minutes; 0 = open-ended. */
  goal: number;
  /** The manuscript chapter being worked on, if one was picked. */
  chapter?: ChapterRef;
}

export interface ChapterRef { ms: string; id: string }

export interface Session {
  id: string;
  cat: CatKey;
  startedAt: number;
  endedAt: number;
  minutes: number;
  /** Minutes credited to each day (a session can cross midnight). */
  credit: Record<string, number>;
  chapter?: ChapterRef;
}

export type Ambient = 'off' | 'rain' | 'fire' | 'wind' | 'calm';

export interface TimerData {
  running: Running | null;
  sessions: Session[];
  ambient: Ambient;
  lastCat: CatKey;
  lastGoal: number;
  lastChapter?: ChapterRef | null;
}

export const GOALS = [25, 50, 90, 0];
export const KEEP_SESSIONS = 300;
export const DEFAULT_TIMER: TimerData = { running: null, sessions: [], ambient: 'off', lastCat: 'writing', lastGoal: 50 };
