/** Chapter text lives here (it can be large), keyed "manuscriptId/chapterId". */
export interface Draft {
  text: string;
  updatedAt: string;
}

export interface Version {
  at: string;
  text: string;
  words: number;
  label?: string;
}

/** A timed word sprint in the editor. */
export interface Sprint {
  id: string;
  /** When it started (ISO) and the local day it counts on. */
  at: string;
  day: string;
  ms: string;
  ch: string;
  /** Minutes planned, and minutes actually run. */
  planned: number;
  minutes: number;
  /** Net new words (never negative). */
  words: number;
  /** Ran the full planned time. */
  completed: boolean;
}

export const SPRINT_LENGTHS = [10, 15, 25, 45];

export interface DraftsData {
  /** Word sprints, newest last. */
  sprints?: Sprint[];
  drafts: Record<string, Draft>;
  versions: Record<string, Version[]>;
  /** The name on the manuscript's title page and running header. */
  author: { name: string; surname: string; contact: string };
}

export const KEEP_VERSIONS = 30;
/** A new version is kept after this much time of writing since the last one. */
export const VERSION_EVERY_MS = 10 * 60_000;

export const DEFAULT_DRAFTS: DraftsData = { drafts: {}, versions: {}, author: { name: 'Austin', surname: 'Austin', contact: '' } };
