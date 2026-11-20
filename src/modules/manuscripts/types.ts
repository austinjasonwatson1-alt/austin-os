export type ChapterStatus = 'idea' | 'draft' | 'revise' | 'done';

export interface Chapter {
  id: string;
  title: string;
  words: number;
  status: ChapterStatus;
  pov?: string;
  note?: string;
}

export interface Manuscript {
  id: string;
  title: string;
  logline?: string;
  /** Target length in words. */
  target: number;
  chapters: Chapter[];
  /** Total words at the end of each day it changed, so the page can say "+1,240 this week". */
  history: Record<string, number>;
}

export interface ManuscriptsData {
  manuscripts: Manuscript[];
  active: string | null;
}

export const STATUSES: ChapterStatus[] = ['idea', 'draft', 'revise', 'done'];
export const STATUS_NAME: Record<ChapterStatus, string> = { idea: 'Idea', draft: 'Drafting', revise: 'Revising', done: 'Done' };

export const DEFAULT_MANUSCRIPTS: ManuscriptsData = {
  manuscripts: [
    { id: 'm-life', title: 'The Life I Deserve', logline: '', target: 85000, chapters: [], history: {} },
    { id: 'm-silence', title: 'Silence Speaks', logline: '', target: 85000, chapters: [], history: {} },
  ],
  active: 'm-life',
};
