/** Household money, read from bank and credit-card statements (CSV). */

export type CatKey =
  | 'groceries' | 'dining' | 'transport' | 'housing' | 'subscriptions' | 'shopping'
  | 'health' | 'pets' | 'giving' | 'income' | 'transfers' | 'writing' | 'other';

export interface Category {
  k: CatKey;
  label: string;
  color: string;
  glyph: string;
}

/** Display order. Colors sit in the cabin palette: warm lamp tones for spending, cool for money in. */
export const CATEGORIES: Category[] = [
  { k: 'writing', label: 'Writing', color: '#e8a84b', glyph: '✒' },
  { k: 'groceries', label: 'Groceries', color: '#8fbf6a', glyph: '◒' },
  { k: 'dining', label: 'Dining', color: '#e07b4f', glyph: '☕' },
  { k: 'transport', label: 'Transport & gas', color: '#c9a227', glyph: '⛽' },
  { k: 'housing', label: 'Housing & utilities', color: '#b08463', glyph: '⌂' },
  { k: 'subscriptions', label: 'Subscriptions', color: '#a98bd6', glyph: '↻' },
  { k: 'shopping', label: 'Shopping', color: '#d9739b', glyph: '◇' },
  { k: 'health', label: 'Health', color: '#5fc4b8', glyph: '✚' },
  { k: 'pets', label: 'Pets', color: '#d7a86e', glyph: '🐾' },
  { k: 'giving', label: 'Giving & church', color: '#f2d38a', glyph: '✝' },
  { k: 'income', label: 'Income', color: '#4fbf87', glyph: '↓' },
  { k: 'transfers', label: 'Transfers', color: '#7d8796', glyph: '⇄' },
  { k: 'other', label: 'Other', color: '#626c7b', glyph: '·' },
];

export const CAT_OF = Object.fromEntries(CATEGORIES.map((c) => [c.k, c])) as Record<CatKey, Category>;

export interface Txn {
  /** Derived from the fingerprint, so the same bank line imported on two devices gets the same id. */
  id: string;
  /** Local 'YYYY-MM-DD'. */
  date: string;
  desc: string;
  /** Signed whole cents: money in is positive, money out negative. */
  cents: number;
  category: CatKey;
  /** date|cents|normalized description|occurrence — what makes a re-import skip lines already here. */
  fp: string;
  /** True once Austin picked the category himself (rules then leave it alone). */
  manual?: boolean;
  /**
   * Entered by hand (not from a statement). Its id is random, its fp is `hand|<id>`, so a
   * statement import can never match, skip or replace it; and its date/description/amount stay editable.
   */
  hand?: boolean;
  /** File it came from, for the record. */
  source?: string;
  addedAt: string;
}

/** "Always categorize <match> as <category>". `match` is a normalized merchant phrase. */
export interface Rule {
  id: string;
  match: string;
  category: CatKey;
  createdAt: string;
}

export interface MoneyData {
  txns: Txn[];
  rules: Rule[];
}

export const DEFAULT_MONEY: MoneyData = { txns: [], rules: [] };
