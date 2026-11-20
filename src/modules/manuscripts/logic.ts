import { addDays } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { Chapter, ChapterStatus, Manuscript, ManuscriptsData } from './types';

export const totalWords = (m: Pick<Manuscript, 'chapters'>) => m.chapters.reduce((s, c) => s + (c.words || 0), 0);

export const progress = (m: Pick<Manuscript, 'chapters' | 'target'>) => (m.target > 0 ? Math.min(1, totalWords(m) / m.target) : 0);

export function byStatus(chapters: Chapter[]): Record<ChapterStatus, Chapter[]> {
  const out: Record<ChapterStatus, Chapter[]> = { idea: [], draft: [], revise: [], done: [] };
  for (const c of chapters) out[c.status].push(c);
  return out;
}

/** Record today's total, keeping one number per day. */
export function recordHistory(history: Record<string, number>, day: string, total: number): Record<string, number> {
  return history[day] === total ? history : { ...history, [day]: total };
}

/**
 * Words added since the end of the day before `from`. null when there's no record from before
 * then (words typed in on the first day shouldn't all count as "this week").
 */
export function wordsSince(history: Record<string, number>, from: string, total: number): number | null {
  const before = Object.keys(history).filter((d) => d < from).sort().pop();
  return before ? total - history[before] : null;
}

/** Total words at the end of each of the last `n` days (carrying forward days with no change). */
export function dailyTotals(history: Record<string, number>, today: string, n: number): number[] {
  const days = Object.keys(history).sort();
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - n + 1);
    const last = days.filter((k) => k <= d).pop();
    return last ? history[last] : 0;
  });
}

/** Move chapter `id` to a new status and/or position among all chapters. */
export function moveChapter(chapters: Chapter[], id: string, status: ChapterStatus, beforeId?: string): Chapter[] {
  const c = chapters.find((x) => x.id === id);
  if (!c) return chapters;
  const rest = chapters.filter((x) => x.id !== id);
  const moved = { ...c, status };
  const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1;
  if (at < 0) return [...rest, moved];
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

/** Reading time for a word count (about 250 words a minute), e.g. "5h 40m". */
export function readTime(words: number): string {
  const m = Math.round(words / 250);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** The chapter number as it appears in book order (1-based). */
export const chapterNo = (chapters: Chapter[], id: string) => chapters.findIndex((c) => c.id === id) + 1;

export const fmtWords = (n: number) => n.toLocaleString('en-US');

export const describeManuscripts: Describer = {
  name: 'Manuscripts',
  size: (v) => (v as Partial<ManuscriptsData>).manuscripts?.reduce((s, m) => s + m.chapters.length, 0) ?? 0,
  detail: (v) => {
    const ms = (v as Partial<ManuscriptsData>).manuscripts ?? [];
    const ch = ms.reduce((s, m) => s + m.chapters.length, 0);
    const w = ms.reduce((s, m) => s + totalWords(m), 0);
    return `${ms.length} manuscript${ms.length === 1 ? '' : 's'} · ${ch} chapters · ${fmtWords(w)} words`;
  },
};
