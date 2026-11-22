import { describe, expect, it } from 'vitest';
import { bookKey, describeShelf, filterBooks, genres, parseShelfJson, previewImport, readingYear, shelfOrder, spine, coverSearchUrl, coverUrl, parseCoverResults, readWall, finishMilestone, goalPace, readingStats, readingYears, isGoodreads, parseGoodreads } from './logic';
import type { Book } from './types';

const B = (p: Partial<Book>): Book => ({ id: p.title ?? 'x', title: 'T', author: 'A', genre: '', status: 'want', rating: 0, craft: [], addedAt: '', ...p });

describe('the shelf', () => {
  it('gives each book a stable spine', () => {
    expect(spine({ title: 'Gone Girl', author: 'Flynn' })).toEqual(spine({ title: 'Gone Girl', author: 'Flynn' }));
    expect(spine({ title: 'X', author: 'Y', pages: 700 }).width).toBe(46);
  });

  it('filters by search, status and genre', () => {
    const books = [B({ title: 'Gone Girl', author: 'Gillian Flynn', genre: 'Thriller', status: 'read', craft: ['unreliable narrator'] }), B({ title: 'On Writing', author: 'King', genre: 'Craft' })];
    expect(filterBooks(books, { q: 'unreliable' }).map((b) => b.title)).toEqual(['Gone Girl']);
    expect(filterBooks(books, { status: 'want' }).map((b) => b.title)).toEqual(['On Writing']);
    expect(filterBooks(books, { genre: 'Thriller' })).toHaveLength(1);
    expect(genres(books)).toEqual(['Craft', 'Thriller']);
  });

  it('orders reading first, then latest finished', () => {
    const o = shelfOrder([B({ title: 'a', status: 'want' }), B({ title: 'b', status: 'read', finished: '2026-01-01' }), B({ title: 'c', status: 'read', finished: '2026-05-01' }), B({ title: 'd', status: 'reading' })]);
    expect(o.map((b) => b.title)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('counts the reading year', () => {
    const y = readingYear([B({ status: 'read', finished: '2026-03-02', pages: 300 }), B({ status: 'read', finished: '2025-12-30', pages: 200 })], 2026);
    expect([y.count, y.pages]).toEqual([1, 300]);
  });

  it('imports an old shelf with loose field names, skipping books already there', () => {
    const old = { library: [
      { Title: 'Gone Girl', Author: 'Gillian Flynn', 'My Rating': 9, 'Date Read': '2025/07/04', Category: 'Thriller', Review: 'Twisty', Takeaways: ['Two narrators', 'Diary as weapon'] },
      { name: 'The Silent Patient', by: 'Alex Michaelides', status: 'currently reading' },
      { title: 'Rebecca', author: 'du Maurier', status: 'TBR' },
      { nope: true },
    ] };
    const books = parseShelfJson(old, 'now')!;
    expect(books.map((b) => [b.title, b.status])).toEqual([['Gone Girl', 'read'], ['The Silent Patient', 'reading'], ['Rebecca', 'want']]);
    expect(books[0]).toMatchObject({ rating: 4.5, finished: '2025-07-04', genre: 'Thriller', notes: 'Twisty', craft: ['Two narrators', 'Diary as weapon'] });
    const p = previewImport([B({ title: 'Gone girl', author: 'gillian flynn' })], books);
    expect([p.add.length, p.skip]).toEqual([2, 1]);
    expect(parseShelfJson({ days: {} }, 'now')).toBeNull();
    expect(bookKey({ title: 'Gone Girl!', author: 'G. Flynn' })).toBe('gone girl|g flynn');
  });

  it('describes itself for restore previews', () => {
    expect(describeShelf.detail({ books: [B({ status: 'read' }), B({})] })).toBe('2 books · 1 read');
  });
});

import { csvToObjects } from './logic';

describe('csv shelves', () => {
  it('reads a Goodreads-style export', () => {
    const objs = csvToObjects([['Title', 'Author', 'My Rating', 'Exclusive Shelf', 'Date Read'], ['Rebecca', 'du Maurier', '5', 'read', '2024/10/31'], ['', '', '', '', '']]);
    const books = parseShelfJson(objs, 'now')!;
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({ title: 'Rebecca', rating: 5, status: 'read', finished: '2024-10-31' });
  });
});

describe('covers', () => {
  it('builds the search url', () => {
    const u = coverSearchUrl(' The Silent Patient ', 'Alex Michaelides');
    expect(u).toContain('title=The+Silent+Patient');
    expect(u).toContain('author=Alex+Michaelides');
    expect(coverSearchUrl('Rebecca', ' ')).not.toContain('author=');
  });
  it('keeps only results with covers, once each', () => {
    const hits = parseCoverResults({ docs: [
      { title: 'A', author_name: ['X'], cover_i: 5, number_of_pages_median: 300, first_publish_year: 2019 },
      { title: 'A2', cover_i: 5 }, { title: 'B' }, { title: 'C', cover_i: 9 },
    ] });
    expect(hits.map((h) => h.cover)).toEqual([coverUrl(5), coverUrl(9)]);
    expect(hits[0]).toMatchObject({ author: 'X', pages: 300, year: 2019 });
    expect(parseCoverResults(null)).toEqual([]);
  });
});

describe('readWall', () => {
  const bk = (title: string, status: Book['status'], finished?: string): Book => ({ id: title, title, author: 'a', genre: '', status, rating: 0, craft: [], addedAt: '', finished });
  it('groups read books by year, newest first, undated last', () => {
    const w = readWall([bk('a', 'read', '2025-03-01'), bk('b', 'read', '2026-01-02'), bk('c', 'read'), bk('d', 'reading'), bk('e', 'read', '2026-05-01')]);
    expect(w.map((g) => g.year)).toEqual(['2026', '2025', 'Undated']);
    expect(w[0].books.map((b) => b.id)).toEqual(['e', 'b']);
  });
});

describe('finishMilestone', () => {
  const bk = (id: string, finished: string, extra: Partial<Book> = {}): Book => ({ id, title: id, author: 'a', genre: '', status: 'read', rating: 4, craft: [], addedAt: '', finished, pages: 100, ...extra });
  it('places the book in its year', () => {
    const books = [bk('a', '2026-01-02'), bk('b', '2026-03-02'), bk('c', '2025-03-02')];
    expect(finishMilestone(books, books[1])).toEqual({ headline: 'Finished.', line: 'b · Book 2 of 2026 · 200 pages this year', big: false });
  });
  it('celebrates the first of a year, favorites and round numbers', () => {
    expect(finishMilestone([bk('a', '2026-01-02')], bk('a', '2026-01-02')).headline).toBe('The first book of 2026.');
    const two = [bk('x', '2026-01-01'), bk('y', '2026-02-01', { rating: 5 })];
    expect(finishMilestone(two, two[1]).headline).toBe('A new favorite.');
    const ten = Array.from({ length: 10 }, (_, i) => bk(`b${i}`, `2026-0${(i % 9) + 1}-01`));
    expect(finishMilestone(ten, ten[9])).toMatchObject({ headline: '10 books in 2026.', big: true });
  });
});

describe('goalPace', () => {
  const r = (f: string): Book => B({ status: 'read', finished: f, title: f });
  it('measures against an even pace through the year', () => {
    const books = [r('2026-01-10'), r('2026-02-10'), r('2026-03-10'), r('2025-05-01')];
    const p = goalPace(books, 24, 2026, '2026-07-01');
    expect(p.read).toBe(3);
    expect(p.expected).toBeCloseTo(24 * 182 / 365, 5);
    expect(p.ahead).toBe(-9);
    expect(p.perMonth).toBeCloseTo(21 / (184 / 365 * 12), 0);
    expect(p.done).toBe(false);
  });
  it('is done once the goal is met', () => {
    const p = goalPace([r('2026-01-01'), r('2026-01-02')], 2, 2026, '2026-01-03');
    expect(p).toMatchObject({ done: true, perMonth: 0 });
    expect(p.ahead).toBeGreaterThan(0);
  });
});

describe('readingStats', () => {
  const books = [
    B({ title: 'a', author: 'Flynn', genre: 'Thriller', status: 'read', rating: 5, pages: 400, started: '2026-01-01', finished: '2026-01-10' }),
    B({ title: 'b', author: 'Flynn', genre: 'Thriller', status: 'read', rating: 3.5, pages: 200, started: '2026-02-01', finished: '2026-02-03' }),
    B({ title: 'c', author: 'Tartt', genre: 'Literary', status: 'read', rating: 0, finished: '2025-06-01' }),
    B({ title: 'd', status: 'reading', pages: 900 }),
  ];
  it('sums a year', () => {
    const s = readingStats(books, 2026);
    expect(s).toMatchObject({ count: 2, pages: 600, avgRating: 4.3, avgPages: 300, avgDays: 7, favorites: 1 });
    expect(s.stars).toEqual([0, 0, 1, 0, 1]);
    expect(s.longest?.title).toBe('a');
    expect(s.shortest?.title).toBe('b');
    expect(s.fastest).toMatchObject({ days: 3 });
    expect(s.authors[0]).toEqual({ name: 'Flynn', n: 2 });
    expect(s.months?.slice(0, 3)).toEqual([1, 1, 0]);
  });
  it('covers all time and handles an empty shelf', () => {
    expect(readingStats(books, null)).toMatchObject({ count: 3, months: null });
    expect(readingStats([], 2026)).toMatchObject({ count: 0, avgRating: null, longest: null, fastest: null });
    expect(readingYears(books)).toEqual([2026, 2025]);
  });
});

describe('Goodreads import', () => {
  const row = (o: Record<string, string>) => ({ 'Book Id': '1', Title: '', Author: '', 'My Rating': '0', 'Exclusive Shelf': 'read', Bookshelves: '', 'Date Read': '', 'Date Added': '', ISBN13: '', ISBN: '', 'Number of Pages': '', 'My Review': '', ...o });
  it('recognizes the export', () => {
    expect(isGoodreads([row({})])).toBe(true);
    expect(isGoodreads([{ Title: 'x' }])).toBe(false);
  });
  it('maps shelves, dates, ratings, covers and series titles', () => {
    const [a, b, c] = parseGoodreads([
      row({ 'Book Id': '19288043', Title: 'Gone Girl (Gone Girl, #1)', Author: 'Gillian  Flynn', 'My Rating': '5', 'Date Read': '2024/03/07', ISBN13: '="9780307588371"', 'Number of Pages': '432', Bookshelves: 'favorites, domestic-thriller', 'My Review': 'Wow.<br/><br/>Twist.' }),
      row({ 'Book Id': '2', Title: 'Rebecca', Author: 'Daphne du Maurier', 'Exclusive Shelf': 'currently-reading', 'Date Added': '2026/11/01', ISBN13: '=""' }),
      row({ 'Book Id': '3', Title: 'The Secret History', 'Exclusive Shelf': 'to-read' }),
    ], '2026-11-22T00:00:00.000Z');
    expect(a).toMatchObject({ id: 'b-gr-19288043', title: 'Gone Girl', author: 'Gillian Flynn', status: 'read', rating: 5, finished: '2024-03-07', pages: 432, genre: 'Domestic Thriller', notes: 'Wow.\n\nTwist.' });
    expect(a.cover).toBe('https://covers.openlibrary.org/b/isbn/9780307588371-L.jpg?default=false');
    expect(b).toMatchObject({ status: 'reading', started: '2026-11-01', cover: undefined, finished: undefined });
    expect(c.status).toBe('want');
  });
});
