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

export interface DraftsData {
  drafts: Record<string, Draft>;
  versions: Record<string, Version[]>;
  /** The name on the manuscript's title page and running header. */
  author: { name: string; surname: string; contact: string };
}

export const KEEP_VERSIONS = 30;
/** A new version is kept after this much time of writing since the last one. */
export const VERSION_EVERY_MS = 10 * 60_000;

export const DEFAULT_DRAFTS: DraftsData = { drafts: {}, versions: {}, author: { name: 'Austin', surname: 'Austin', contact: '' } };
