import { describe, expect, it } from 'vitest';
import { describeReview, reviewTime, reviewWeek, vsLast, weekSummary } from './logic';

const T = { elite: 180, good: 80, warn: 30 };
const W = { elite: 700, good: 450, warn: 250 };

describe('weekly review', () => {
  const inputs = {
    days: {
      '2026-11-09': { writing: 100 }, // last week
      '2026-11-16': { writing: 90, reading: 30 }, '2026-11-17': { editing: 200 }, '2026-11-19': { writing: 40 },
    },
    thresholds: T, weekly: W,
    chapel: { '2026-11-16': { prayer: 10 }, '2026-11-18': { scripture: 15 } },
    manuscripts: [{ id: 'm', title: 'x', target: 1, chapters: [], history: { '2026-11-14': 4000, '2026-11-18': 5200 } }],
    books: [{ id: 'b', title: 'Rebecca', author: 'd', genre: '', status: 'read' as const, rating: 5, craft: [], addedAt: '', finished: '2026-11-18' }],
  };

  it('sums up the week, counting only days that have happened', () => {
    const s = weekSummary(inputs, '2026-11-16', '2026-11-20');
    expect(s.minutes).toBe(360);
    expect(s.grade).toBe('warn');
    expect(s.prevMinutes).toBe(100);
    expect(s.best).toEqual({ date: '2026-11-17', mins: 200 });
    expect(s.zeroDays).toEqual(['2026-11-18', '2026-11-20']);
    expect(s.logged).toBe(3);
    expect(s.byCat.map((c) => c.k)).toEqual(['editing', 'writing', 'reading']);
    expect(s.chapel).toEqual({ minutes: 25, days: 2 });
    expect(s.words).toBe(1200);
    expect(s.booksFinished.map((b) => b.title)).toEqual(['Rebecca']);
    expect(s.days.filter((d) => d.future).length).toBe(2);
  });

  it('has no word count without history from before the week', () => {
    expect(weekSummary({ ...inputs, manuscripts: [{ ...inputs.manuscripts[0], history: { '2026-11-18': 5200 } }] }, '2026-11-16', '2026-11-20').words).toBeNull();
  });

  it('knows when it is review time and which week to open', () => {
    expect(reviewTime(new Date('2026-11-22T19:00:00'))).toBe(true);
    expect(reviewTime(new Date('2026-11-23T09:00:00'))).toBe(true);
    expect(reviewTime(new Date('2026-11-23T15:00:00'))).toBe(false);
    expect(reviewWeek(new Date('2026-11-23T09:00:00'), '2026-11-23')).toBe('2026-11-16');
    expect(reviewWeek(new Date('2026-11-22T19:00:00'), '2026-11-16')).toBe('2026-11-16');
    expect([vsLast(360, 100), vsLast(50, 100), vsLast(5, 0)]).toEqual([260, -50, null]);
  });

  it('describes itself for restore previews', () => {
    expect(describeReview.detail({ reviews: { a: { sealedAt: 'x' }, b: {} } })).toBe('2 weeks · 1 sealed');
  });
});
