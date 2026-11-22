/** Memories (photos pinned to a day) and the Time Capsule (letters to future Austin). */

export const TAGS = ['cooper', 'shadow', 'writing', 'family', 'faith', 'place', 'other'] as const;
export type MemoryTag = (typeof TAGS)[number];

export const TAG_LABEL: Record<MemoryTag, string> = {
  cooper: 'Cooper', shadow: 'Shadow', writing: 'Writing', family: 'Family', faith: 'Faith', place: 'Place', other: 'Other',
};

/** One photo. The full-size image lives under its own key (`photoKey(id)`) so this list stays small. */
export interface Memory {
  id: string;
  /** Local 'YYYY-MM-DD' the photo belongs to. */
  day: string;
  caption: string;
  tag?: MemoryTag;
  /** ~360px JPEG data URL for grids. */
  thumb: string;
  /** ISO timestamp it was added. */
  addedAt: string;
}

/** A letter to future Austin. Sealed until `opensOn` (or until he opens it for `event`). */
export interface Capsule {
  id: string;
  title: string;
  body: string;
  /** Local 'YYYY-MM-DD' it was written. */
  written: string;
  /** Local 'YYYY-MM-DD' it unseals. */
  opensOn?: string;
  /** Or an event, opened by hand: "The day I sign with an agent". */
  event?: string;
  /** Local 'YYYY-MM-DD' it was opened. */
  openedOn?: string;
}

export interface MemoriesData {
  items: Memory[];
  capsules: Capsule[];
}

export const DEFAULT_MEMORIES: MemoriesData = { items: [], capsules: [] };

export const KEY = 'memories.v1';
export const PHOTO_PREFIX = 'memories.photo.';
export const photoKey = (id: string) => PHOTO_PREFIX + id;
