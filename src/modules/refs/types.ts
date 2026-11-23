/** The Scene Library: scenes worth learning from, marked while reading, found again while writing. */

export interface SceneRef {
  id: string;
  /** A scene type: one of SCENE_KINDS' keys, or Austin's own word. */
  kind: string;
  /** A short name for it: "The detective breaks the husband". */
  label: string;
  /** Where it's from: a book's title (and author), a film, a show. */
  source: string;
  /** The book on the Shelf, when it's from one. */
  bookId?: string;
  /** Page, chapter or percent: "p. 212", "ch. 14", "62%". */
  where?: string;
  /** The passage itself, or a line of it. */
  passage?: string;
  /** Why it works: the technique to borrow. */
  why?: string;
  tags: string[];
  /** Local 'YYYY-MM-DD' it was marked. */
  added: string;
  /** Last edited by hand (ISO time), so sync keeps the newest edit. */
  edited?: string;
}

export interface RefsData { scenes: SceneRef[] }
export const DEFAULT_REFS: RefsData = { scenes: [] };
