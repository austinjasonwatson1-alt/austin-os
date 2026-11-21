import type { Describer } from '../../core/restoreLogic';
import type { Book, BookStatus, ShelfData } from './types';

/** Spine colors: leather and cloth bindings that sit well in the dark cabin. */
const SPINES = ['#5a2a22', '#2e3f5a', '#3d4a2e', '#6a4a22', '#4a2e4a', '#2a4a4a', '#6b3a2a', '#33384f', '#4f3b26', '#2f2a3d', '#5b4e2a', '#3a2f2f'];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The same book always gets the same spine color and height. */
export function spine(b: Pick<Book, 'title' | 'author' | 'pages'>): { color: string; height: number; width: number } {
  const h = hash(`${b.title}|${b.author}`);
  const pages = b.pages ?? 250 + (h % 250);
  return { color: SPINES[h % SPINES.length], height: 104 + (h % 5) * 7, width: Math.max(24, Math.min(46, Math.round(pages / 11))) };
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const bookKey = (b: Pick<Book, 'title' | 'author'>) => `${norm(b.title)}|${norm(b.author)}`;

export interface ShelfFilter {
  q?: string;
  status?: BookStatus | 'all';
  genre?: string | null;
}

export function filterBooks(books: Book[], f: ShelfFilter): Book[] {
  const q = norm(f.q ?? '');
  return books.filter((b) =>
    (!f.status || f.status === 'all' || b.status === f.status) &&
    (!f.genre || b.genre === f.genre) &&
    (!q || norm(`${b.title} ${b.author} ${b.genre} ${b.notes ?? ''} ${b.craft.join(' ')}`).includes(q)));
}

/** Shelf order: reading first, then most recently finished, then the rest by title. */
export function shelfOrder(books: Book[]): Book[] {
  const rank: Record<BookStatus, number> = { reading: 0, read: 1, want: 2, dnf: 3 };
  return [...books].sort((a, b) =>
    rank[a.status] - rank[b.status] || (b.finished ?? '').localeCompare(a.finished ?? '') || a.title.localeCompare(b.title));
}

export function genres(books: Book[]): string[] {
  return [...new Set(books.map((b) => b.genre).filter(Boolean))].sort();
}

/** Books finished in `year`, and their pages. */
export function readingYear(books: Book[], year: number) {
  const done = books.filter((b) => b.status === 'read' && b.finished?.startsWith(String(year)));
  return { count: done.length, pages: done.reduce((s, b) => s + (b.pages ?? 0), 0), books: done };
}

/* ---------------- importing an old shelf ---------------- */

const pick = (o: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase().replace(/[^a-z]/g, ''))) return o[k];
  return undefined;
};
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const date = (v: unknown): string | undefined => {
  const s = str(v);
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : undefined;
};

function status(v: unknown, finished?: string): BookStatus {
  const s = norm(str(v));
  if (/(reading|current|in progress)/.test(s)) return 'reading';
  if (/(want|to read|tbr|wish|queue)/.test(s)) return 'want';
  if (/(dnf|abandon|did not|set aside|stopped)/.test(s)) return 'dnf';
  if (/(read|done|finished|complete)/.test(s) || finished) return 'read';
  return 'want';
}

/**
 * Turn an old shelf export into books. Accepts a bare array, `{books: [...]}`, an Austin OS
 * backup, or anything with an array of objects that have a title — field names are matched
 * loosely (title/name, author/by, rating/stars, genre/category, notes/review, finished/dateRead…).
 */
export function parseShelfJson(parsed: unknown, now: string): Book[] | null {
  const find = (v: unknown, depth = 0): Record<string, unknown>[] | null => {
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object' && pick(x as Record<string, unknown>, 'title', 'name', 'booktitle')) as Record<string, unknown>[];
    if (v && typeof v === 'object' && depth < 4) {
      for (const val of Object.values(v)) {
        const got = find(val, depth + 1);
        if (got && got.length) return got;
      }
    }
    return null;
  };
  const rows = find(parsed);
  if (!rows || rows.length === 0) return null;
  return rows.map((o, i) => {
    const finished = date(pick(o, 'finished', 'dateread', 'datefinished', 'readon', 'enddate', 'completed'));
    const craftRaw = pick(o, 'craft', 'takeaways', 'lessons', 'craftnotes', 'analysis');
    const rating = Number(pick(o, 'rating', 'stars', 'myrating', 'score')) || 0;
    const pages = Number(pick(o, 'pages', 'pagecount', 'numberofpages')) || undefined;
    return {
      id: `b-imp-${i}-${hash(JSON.stringify(o)).toString(36)}`,
      title: str(pick(o, 'title', 'name', 'booktitle')),
      author: str(pick(o, 'author', 'by', 'authors', 'writer')),
      genre: str(pick(o, 'genre', 'category', 'shelf', 'type')),
      status: status(pick(o, 'status', 'state', 'exclusiveshelf', 'shelf'), finished),
      rating: Math.max(0, Math.min(5, rating > 5 ? rating / 2 : rating)),
      started: date(pick(o, 'started', 'datestarted', 'startdate')),
      finished,
      pages,
      notes: str(pick(o, 'notes', 'review', 'note', 'myreview', 'thoughts')) || undefined,
      cover: /^https:\/\//.test(str(pick(o, 'cover', 'coverurl', 'image', 'img'))) ? str(pick(o, 'cover', 'coverurl', 'image', 'img')) : undefined,
      craft: Array.isArray(craftRaw) ? craftRaw.map(str).filter(Boolean) : str(craftRaw) ? str(craftRaw).split(/\n+/).map((s) => s.trim()).filter(Boolean) : [],
      addedAt: now,
    } satisfies Book;
  }).filter((b) => b.title);
}

/** What an import would do: books that are new, and ones already on the shelf (kept as they are). */
export function previewImport(current: Book[], incoming: Book[]): { add: Book[]; skip: number } {
  const have = new Set(current.map(bookKey));
  const add: Book[] = [];
  for (const b of incoming) {
    const k = bookKey(b);
    if (have.has(k)) continue;
    have.add(k);
    add.push(b);
  }
  return { add, skip: incoming.length - add.length };
}

export const describeShelf: Describer = {
  name: 'The Shelf',
  size: (v) => (v as Partial<ShelfData>).books?.length ?? 0,
  detail: (v) => {
    const b = (v as Partial<ShelfData>).books ?? [];
    const read = b.filter((x) => x.status === 'read').length;
    return `${b.length} book${b.length === 1 ? '' : 's'} · ${read} read`;
  },
};

/** A CSV export (e.g. Goodreads) as objects keyed by its header row, ready for parseShelfJson. */
export function csvToObjects(rows: string[][]): Record<string, string>[] {
  const [head, ...rest] = rows;
  if (!head) return [];
  return rest.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/* ---------------- covers (Open Library, free, no key) ---------------- */

export interface CoverHit { cover: string; title: string; author: string; pages?: number; year?: number }

export const coverUrl = (coverId: number, size: 'M' | 'L' = 'L') => `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;

export function coverSearchUrl(title: string, author: string): string {
  const q = new URLSearchParams({ title: title.trim(), limit: '12', fields: 'title,author_name,cover_i,number_of_pages_median,first_publish_year' });
  if (author.trim()) q.set('author', author.trim());
  return `https://openlibrary.org/search.json?${q}`;
}

/** Turn an Open Library search response into cover choices (only results that have a cover, no repeats). */
export function parseCoverResults(json: unknown): CoverHit[] {
  const docs = (json as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];
  const seen = new Set<number>();
  const out: CoverHit[] = [];
  for (const d of docs as Record<string, unknown>[]) {
    const id = Number(d.cover_i);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      cover: coverUrl(id), title: String(d.title ?? ''),
      author: Array.isArray(d.author_name) ? String(d.author_name[0] ?? '') : '',
      pages: Number(d.number_of_pages_median) || undefined, year: Number(d.first_publish_year) || undefined,
    });
  }
  return out.slice(0, 8);
}

/** Every book read, newest year first, newest finish first; ones with no finish date last. */
export function readWall(books: Book[]): { year: string; books: Book[] }[] {
  const read = books.filter((b) => b.status === 'read');
  const groups = new Map<string, Book[]>();
  for (const b of read) {
    const y = b.finished?.slice(0, 4) ?? 'Undated';
    groups.set(y, [...(groups.get(y) ?? []), b]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Undated' ? 1 : b === 'Undated' ? -1 : b.localeCompare(a)))
    .map(([year, bs]) => ({ year, books: bs.sort((a, b) => (b.finished ?? '').localeCompare(a.finished ?? '') || a.title.localeCompare(b.title)) }));
}

/* ---------------- finishing a book ---------------- */

export interface Milestone { headline: string; line: string; big: boolean }

const ROUND = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];

/** What to say when a book is just marked read: its place in the year, and any round number it hits. */
export function finishMilestone(books: Book[], book: Book): Milestone {
  const read = books.filter((b) => b.status === 'read');
  const year = (book.finished ?? '').slice(0, 4);
  const inYear = year ? read.filter((b) => b.finished?.startsWith(year)) : [];
  const nth = inYear.length;
  const pages = inYear.reduce((n, b) => n + (b.pages ?? 0), 0);
  const total = read.length;
  const bits = [year ? `Book ${nth} of ${year}` : `Book ${total}`, pages ? `${pages.toLocaleString('en-US')} pages this year` : ''].filter(Boolean);
  const line = `${book.title} · ${bits.join(' · ')}`;
  if (year && ROUND.includes(nth)) return { headline: `${nth} books in ${year}.`, line, big: true };
  if (ROUND.includes(total)) return { headline: `${total} books, all time.`, line, big: true };
  if (book.rating === 5) return { headline: 'A new favorite.', line, big: true };
  if (nth === 1 && year) return { headline: `The first book of ${year}.`, line, big: true };
  return { headline: 'Finished.', line, big: false };
}
