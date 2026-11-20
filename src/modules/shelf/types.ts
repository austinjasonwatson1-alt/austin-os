export type BookStatus = 'reading' | 'read' | 'want' | 'dnf';

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  status: BookStatus;
  /** 0 = unrated, otherwise 1–5 (halves allowed). */
  rating: number;
  started?: string;
  finished?: string;
  pages?: number;
  notes?: string;
  /** What this book taught about the craft: one line each. */
  craft: string[];
  addedAt: string;
}

export interface ShelfData {
  books: Book[];
}

export const STATUS_LABEL: Record<BookStatus, string> = { reading: 'Reading now', read: 'Read', want: 'Want to read', dnf: 'Set aside' };

export const DEFAULT_SHELF: ShelfData = { books: [] };
