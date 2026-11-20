/** The Chapel keeps its own time. None of it counts toward the writing Ledger. */
export interface ChapelDay {
  prayer?: number;
  scripture?: number;
  note?: string;
}

export interface Prayer {
  id: string;
  text: string;
  /** Who or what it's for, optional. */
  for?: string;
  added: string;
  answeredOn?: string;
  /** How it was answered, in his words. */
  answer?: string;
}

export interface Verse {
  id: string;
  ref: string;
  text: string;
}

export interface ChapelData {
  days: Record<string, ChapelDay>;
  prayers: Prayer[];
  verses: Verse[];
}

export const DEFAULT_CHAPEL: ChapelData = { days: {}, prayers: [], verses: [] };
