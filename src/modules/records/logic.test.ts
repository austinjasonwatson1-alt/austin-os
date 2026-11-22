import { describe, expect, it } from 'vitest';
import type { Book } from '../shelf/types';
import { hallOfRecords, latest, nearest, type HallInput } from './logic';

const T = { elite: 180, good: 80, warn: 30 };
const W = { elite: 700, good: 450, warn: 250 };
const empty: HallInput = { days: {}, thresholds: T, weekly: W, books: [], goals: {}, manuscripts: [], queries: [], contests: [], chapel: {}, prayers: [] };
const book = (i: number, finished: string, extra: Partial<Book> = {}): Book => ({ id: `b${i}`, title: `B${i}`, author: 'a', genre: '', status: 'read', rating: 4, craft: [], addedAt: '', finished, ...extra });

describe('hallOfRecords', () => {
  it('copes with an empty homestead: no records, every trophy locked', () => {
    const h = hallOfRecords(empty);
    expect(h.records).toEqual([]);
    expect(h.trophies.length).toBeGreaterThan(20);
    expect(h.trophies.every((t) => !t.earned)).toBe(true);
  });

  it('finds the writing bests', () => {
    const h = hallOfRecords({ ...empty, days: { '2026-01-05': { writing: 200 }, '2026-01-06': { writing: 30 }, '2026-01-07': { writing: 50 }, '2026-02-01': { editing: 40 } } });
    const r = Object.fromEntries(h.records.map((x) => [x.name, x]));
    expect(r['Best day']).toMatchObject({ value: '3h 20m', date: '2026-01-05' });
    expect(r['Best week']).toMatchObject({ value: '4h 40m', date: '2026-01-05' });
    expect(r['Longest streak'].value).toBe('3 days');
    expect(r['Elite days'].value).toBe('1');
    expect(h.trophies.find((t) => t.id === 'ledger-north-star')).toMatchObject({ earned: true, date: '2026-01-05' });
    expect(h.trophies.find((t) => t.id === 'ledger-seven')).toMatchObject({ earned: false, count: '3 / 7' });
  });

  it('dates reading trophies by the book that earned them', () => {
    const books = Array.from({ length: 10 }, (_, i) => book(i, `2026-0${(i % 9) + 1}-1${i % 10}`));
    books.push(book(99, '2025-05-05', { rating: 5, pages: 800 }));
    const h = hallOfRecords({ ...empty, books, goals: { '2026': 4 } });
    const t = Object.fromEntries(h.trophies.map((x) => [x.id, x]));
    expect(t['read-first']).toMatchObject({ earned: true, date: '2025-05-05' });
    expect(t['read-10y']).toMatchObject({ earned: true });
    expect(t['read-goal'].earned).toBe(true);
    expect(t['read-25y']).toMatchObject({ earned: false, count: '10 / 25' });
    expect(h.records.find((r) => r.name === 'Longest book')).toMatchObject({ value: '800 pp', detail: 'B99' });
  });

  it('reads the manuscript and the road', () => {
    const h = hallOfRecords({
      ...empty,
      manuscripts: [{ id: 'm', title: 'The Life I Deserve', target: 80000, chapters: [{ id: 'c', title: 'One', words: 12000, status: 'draft' }], history: { '2026-03-01': 4000, '2026-03-02': 10500, '2026-03-03': 12000 } }],
      queries: [{ id: 'q', agent: 'A', status: 'full', sentOn: '2026-05-01', respondedOn: '2026-05-20' }, { id: 'q2', agent: 'B', status: 'researching' }],
    });
    const t = Object.fromEntries(h.trophies.map((x) => [x.id, x]));
    expect(t['ms-10k']).toMatchObject({ earned: true, date: '2026-03-02' });
    expect(t['ms-draft']).toMatchObject({ earned: false, count: '12,000 / 80,000' });
    expect(h.records.find((r) => r.name === 'Best word day')).toMatchObject({ value: '+6,500', date: '2026-03-02' });
    expect(t['road-query']).toMatchObject({ earned: true, date: '2026-05-01' });
    expect(t['road-full']).toMatchObject({ earned: true, date: '2026-05-20' });
    expect(t['road-offer'].earned).toBe(false);
  });

  it('counts chapel runs and answers', () => {
    const chapel = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`2026-04-0${i + 1}`, { prayer: 10 }]));
    const h = hallOfRecords({ ...empty, chapel, prayers: [{ id: 'p', text: 'x', added: '2026-01-01', answeredOn: '2026-04-02' }] });
    const t = Object.fromEntries(h.trophies.map((x) => [x.id, x]));
    expect(t['chapel-7']).toMatchObject({ earned: true, date: '2026-04-07' });
    expect(t['chapel-answer']).toMatchObject({ earned: true, date: '2026-04-02' });
    expect(t['chapel-40'].count).toBe('8 / 40');
  });

  it('picks the latest earned and the nearest locked', () => {
    const { trophies } = hallOfRecords({ ...empty, days: { '2026-01-05': { writing: 200 }, '2026-01-06': { writing: 200 }, '2026-01-07': { writing: 200 } } });
    expect(latest(trophies)[0]).toMatchObject({ id: 'ledger-lantern', date: '2026-01-07' });
    expect(nearest(trophies).every((t) => !t.earned)).toBe(true);
  });
});
