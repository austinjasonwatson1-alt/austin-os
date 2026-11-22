import { describe, expect, it } from 'vitest';
import type { HallInput } from '../records/logic';
import { timeline, yearFilm, SCENE_SECONDS } from './logic';

const T = { elite: 180, good: 80, warn: 30 };
const W = { elite: 700, good: 450, warn: 250 };
const empty: HallInput = { days: {}, thresholds: T, weekly: W, books: [], goals: {}, manuscripts: [], queries: [], contests: [], chapel: {}, prayers: [] };

describe('yearFilm', () => {
  it('is just a title and a goodbye for an empty year', () => {
    expect(yearFilm(empty, 2026).map((s) => s.kind)).toEqual(['title', 'end']);
  });

  it('tells the year from its numbers', () => {
    const days = { '2026-03-01': { writing: 120 }, '2026-03-02': { writing: 60 }, '2026-03-03': { writing: 60 }, '2026-07-10': { editing: 30 }, '2025-12-31': { writing: 999 } };
    const film = yearFilm({
      ...empty, days,
      books: [
        { id: 'a', title: 'Gone Girl', author: 'Flynn', genre: '', status: 'read', rating: 5, craft: [], addedAt: '', finished: '2026-02-01', pages: 400 },
        { id: 'b', title: 'Old', author: 'x', genre: '', status: 'read', rating: 5, craft: [], addedAt: '', finished: '2025-02-01' },
      ],
      manuscripts: [{ id: 'm', title: 'M', target: 80000, chapters: [], history: { '2025-12-30': 1000, '2026-04-01': 5000, '2026-09-01': 9000, '2027-01-02': 12000 } }],
      queries: [{ id: 'q', agent: 'A', status: 'full', sentOn: '2026-05-01' }, { id: 'q2', agent: 'B', status: 'queried', sentOn: '2025-05-01' }],
      chapel: { '2026-04-01': { prayer: 30 } },
    }, 2026);
    const by = Object.fromEntries(film.map((s) => [s.kind, s]));
    expect(by.hours).toMatchObject({ hours: 5, days: 4 });
    expect(by.months).toMatchObject({ best: 2 });
    expect((by.months as { hours: number[] }).hours[2]).toBe(4);
    expect(by.streak).toMatchObject({ days: 3, from: '2026-03-01', to: '2026-03-03' });
    expect(by.words).toMatchObject({ words: 8000 });
    expect(by.books).toMatchObject({ count: 1, pages: 400, favorite: 'Gone Girl' });
    expect(by.road).toMatchObject({ sent: 1, requests: 1, offers: 0 });
    expect(by.chapel).toMatchObject({ hours: 0.5, days: 1 });
    expect(film[0]).toEqual({ kind: 'title', year: 2026 });
    expect(film[film.length - 1]).toEqual({ kind: 'end', next: 2027 });
  });

  it('can leave the Chapel out', () => {
    const film = yearFilm({ ...empty, chapel: { '2026-04-01': { prayer: 30 } } }, 2026, { chapel: false });
    expect(film.some((s) => s.kind === 'chapel')).toBe(false);
  });
});

describe('timeline', () => {
  it('maps a moment to a scene and how far through it', () => {
    const scenes = yearFilm(empty, 2026);
    const tl = timeline(scenes);
    expect(tl.total).toBeCloseTo(SCENE_SECONDS.title + SCENE_SECONDS.end);
    expect(tl.at(0)).toMatchObject({ i: 0, p: 0 });
    expect(tl.at(SCENE_SECONDS.title + 1).i).toBe(1);
    expect(tl.at(999)).toMatchObject({ i: 1, p: 1 });
  });
});
