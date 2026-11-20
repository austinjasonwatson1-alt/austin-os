import { describe, expect, it } from 'vitest';
import { bookKey, describeShelf, filterBooks, genres, parseShelfJson, previewImport, readingYear, shelfOrder, spine } from './logic';
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
