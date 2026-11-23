import { describe, expect, it } from 'vitest';
import { describeReview, letterDue, reviewTime, reviewWeek, vsLast, weekSummary } from './logic';

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

import { yearReview } from './logic';

describe('year in review', () => {
  it('adds up the year so far', () => {
    const y = yearReview({
      days: { '2026-01-01': { writing: 200 }, '2026-01-02': { writing: 40 }, '2026-01-03': { reading: 30 }, '2026-03-10': { editing: 90 }, '2025-12-31': { writing: 999 } },
      thresholds: { elite: 180, good: 80, warn: 30 }, weekly: { elite: 700, good: 450, warn: 250 },
      chapel: { '2026-01-02': { prayer: 10 } }, manuscripts: [{ id: 'm', title: '', target: 1, chapters: [], history: { '2025-12-20': 1000, '2026-02-01': 4000 } }],
      books: [{ id: 'b', title: 'R', author: '', genre: '', status: 'read', rating: 5, craft: [], addedAt: '', finished: '2026-02-02', pages: 300 }],
      answeredOn: ['2026-02-01', '2025-06-01'],
    }, 2026, '2026-03-31');
    expect(y.minutes).toBe(360);
    expect([y.logged, y.elite, y.elapsed, y.zero]).toEqual([4, 1, 90, 86]);
    expect(y.longest).toEqual({ days: 3, from: '2026-01-01', to: '2026-01-03' });
    expect(y.bestMonth).toEqual({ m: 0, mins: 270 });
    expect(y.bestDay).toEqual({ date: '2026-01-01', mins: 200 });
    expect(y.months[2]).toBe(90);
    expect(y.chapel).toEqual({ minutes: 10, days: 1 });
    expect([y.answered, y.books.length, y.pages, y.words]).toEqual([1, 1, 300, 3000]);
  });
});

import { archive } from './logic';

describe('the Library of You', () => {
  it('gathers each month, newest first', () => {
    const a = archive({
      days: { '2026-10-03': { writing: 60 }, '2026-11-01': { reading: 30 }, '2026-11-02': { writing: 0 } },
      chapel: {},
      books: [{ id: 'b', title: 'Rebecca', author: '', genre: '', status: 'read', rating: 5, craft: [], addedAt: '', finished: '2026-11-10' }],
      prayers: [{ text: 'A new job', answer: 'The offer came', answeredOn: '2026-10-13' }, { text: 'Open' }],
      milestones: [{ name: 'Seven Sisters', earnedOn: '2026-10-09' }, { name: 'Later', earnedOn: null }],
      reviews: { '2026-11-09': { intention: 'Finish ch 7', sealedAt: 'x' }, '2026-11-16': { intention: 'unsealed' } },
      moments: [{ text: 'Cooper stole the pancake', date: '2026-11-05' }],
      wins: [],
    });
    expect(a.map((x) => x.key)).toEqual(['2026-11', '2026-10']);
    expect(a[0]).toMatchObject({ minutes: 30, logged: 1, books: ['Rebecca'], moments: ['Cooper stole the pancake'] });
    expect(a[0].reviews.map((r) => r.intention)).toEqual(['Finish ch 7']);
    expect(a[1]).toMatchObject({ minutes: 60, milestones: ['Seven Sisters'] });
    expect(a[1].answered[0].text).toBe('A new job');
  });
});

describe('the Keeper\u2019s Sunday letter', () => {
  const sun = new Date(2026, 10, 22, 10), satEve = new Date(2026, 10, 21, 18), satNoon = new Date(2026, 10, 21, 12), wed = new Date(2026, 10, 18, 10);
  it('writes once, for this week, from Saturday evening through Sunday, if the Keeper is on', () => {
    expect(letterDue(sun, '2026-11-16', '2026-11-16', false, true)).toBe(true);
    expect(letterDue(satEve, '2026-11-16', '2026-11-16', false, true)).toBe(true);
    expect(letterDue(satNoon, '2026-11-16', '2026-11-16', false, true)).toBe(false);
    expect(letterDue(wed, '2026-11-16', '2026-11-16', false, true)).toBe(false);
    expect(letterDue(sun, '2026-11-16', '2026-11-16', true, true)).toBe(false);
    expect(letterDue(sun, '2026-11-16', '2026-11-16', false, false)).toBe(false);
    expect(letterDue(sun, '2026-11-09', '2026-11-16', false, true)).toBe(false);
  });
});
