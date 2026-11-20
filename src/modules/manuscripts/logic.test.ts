import { describe, expect, it } from 'vitest';
import { byStatus, chapterNo, dailyTotals, describeManuscripts, moveChapter, progress, readTime, recordHistory, totalWords, wordsSince } from './logic';
import type { Chapter } from './types';

const C = (id: string, words: number, status: Chapter['status'] = 'draft'): Chapter => ({ id, title: id, words, status });

describe('manuscripts', () => {
  const chapters = [C('a', 3000, 'done'), C('b', 2500), C('c', 0, 'idea')];

  it('adds up words and progress', () => {
    expect(totalWords({ chapters })).toBe(5500);
    expect(progress({ chapters, target: 11000 })).toBe(0.5);
    expect(byStatus(chapters).draft.map((c) => c.id)).toEqual(['b']);
    expect(readTime(15000)).toBe('1h 0m');
    expect(chapterNo(chapters, 'c')).toBe(3);
  });

  it('tracks words over time', () => {
    let h: Record<string, number> = {};
    h = recordHistory(h, '2026-11-14', 4000);
    h = recordHistory(h, '2026-11-17', 4800);
    h = recordHistory(h, '2026-11-20', 5500);
    expect(wordsSince(h, '2026-11-16', 5500)).toBe(1500);
    expect(wordsSince({ '2026-11-18': 100 }, '2026-11-16', 5500)).toBeNull();
    expect(dailyTotals(h, '2026-11-20', 4)).toEqual([4800, 4800, 4800, 5500]);
    expect(recordHistory(h, '2026-11-20', 5500)).toBe(h);
  });

  it('moves chapters between columns and positions', () => {
    expect(moveChapter(chapters, 'c', 'draft').map((x) => `${x.id}:${x.status}`)).toEqual(['a:done', 'b:draft', 'c:draft']);
    expect(moveChapter(chapters, 'c', 'done', 'a').map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('describes itself for restore previews', () => {
    expect(describeManuscripts.detail({ manuscripts: [{ chapters }, { chapters: [] }] })).toBe('2 manuscripts · 3 chapters · 5,500 words');
  });
});
