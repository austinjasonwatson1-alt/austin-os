import { create } from 'zustand';
import { kvGet, saveWithSnapshot, snapshotNow, markDeleted } from '../../core/storage';
import { previewImport } from './logic';
import { DEFAULT_SHELF, type Book, type ShelfData } from './types';

export const KEY = 'shelf.v1';

interface ShelfState extends ShelfData {
  loaded: boolean;
  /** Read from storage once; `force` re-reads after a restore. */
  load: (force?: boolean) => Promise<void>;
  save: (b: Omit<Book, 'id' | 'addedAt'> & { id?: string }) => Book;
  remove: (id: string) => void;
  /** Add books from an old shelf (only ones not already here), after a restore point. */
  importBooks: (incoming: Book[], why: string) => Promise<number>;
}

const newId = () => `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useShelf = create<ShelfState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { books: get().books } satisfies ShelfData); };

  return {
    ...DEFAULT_SHELF,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<ShelfData>(KEY);
      set({ ...DEFAULT_SHELF, ...(saved ?? {}), loaded: true });
    },

    save(b) {
      const books = get().books;
      const existing = b.id ? books.find((x) => x.id === b.id) : undefined;
      const book: Book = { ...b, title: b.title.trim(), author: b.author.trim(), genre: b.genre.trim(), id: existing?.id ?? newId(), addedAt: existing?.addedAt ?? new Date().toISOString() };
      set({ books: existing ? books.map((x) => (x.id === book.id ? book : x)) : [...books, book] });
      persist();
      return book;
    },

    remove(id) {
      void markDeleted(KEY, id);
      set({ books: get().books.filter((b) => b.id !== id) });
      persist();
    },

    async importBooks(incoming, why) {
      const { add } = previewImport(get().books, incoming);
      if (!add.length) return 0;
      await snapshotNow(KEY, { books: get().books }, why);
      set({ books: [...get().books, ...add] });
      persist();
      return add.length;
    },
  };
});
