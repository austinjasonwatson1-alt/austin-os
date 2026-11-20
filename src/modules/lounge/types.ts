/** Points are earned from the Ledger (never stored, always recomputed) and spent on real-world rewards. */

export interface Rates {
  /** Points for every 10 counted minutes. */
  perTenMin: number;
  /** Day bonuses (an elite day gets `elite`, not both). */
  good: number;
  elite: number;
  /** Week bonuses, Monday–Sunday (an elite week gets `weekElite`, not both). */
  weekGood: number;
  weekElite: number;
  /** Paid once when a streak reaches 7 and 30 days, and at every 100. */
  streak7: number;
  streak30: number;
  streak100: number;
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
  note?: string;
  glyph: string;
}

/** A reward you've spent points on. `boughtAt` is set once you mark it bought in real life. */
export interface Claim {
  id: string;
  rewardId: string;
  name: string;
  glyph: string;
  cost: number;
  claimedAt: string;
  boughtAt?: string;
}

export interface LoungeData {
  rewards: Reward[];
  claims: Claim[];
  rates: Rates;
  /** Only days on or after this date earn points. null = all of history. */
  countFrom: string | null;
}

export const DEFAULT_RATES: Rates = { perTenMin: 1, good: 5, elite: 15, weekGood: 20, weekElite: 50, streak7: 25, streak30: 100, streak100: 300 };

/** Text presentation selector so ☕ and friends render as glyphs, not color emoji. */
export const asText = (g: string) => g.replace(/\uFE0F/g, '') + '\uFE0E';

export const GLYPHS = ['❦', '☕', '✎', '♫', '✈', '⌂', '✦', '☾', '♨', '❖', '✿', '⚑'];

export const DEFAULT_REWARDS: Reward[] = [
  { id: 'r-hardcover', name: 'A new hardcover', cost: 300, glyph: '❦', note: 'Any book, no guilt.' },
  { id: 'r-coffee', name: 'Coffee-shop writing session', cost: 150, glyph: '☕', note: 'Order the good drink.' },
  { id: 'r-notebook', name: 'New notebook and pen', cost: 200, glyph: '✎' },
  { id: 'r-night', name: 'Guilt-free night off', cost: 400, glyph: '☾', note: 'No writing, no apology.' },
  { id: 'r-dinner', name: 'Dinner out', cost: 600, glyph: '♨' },
  { id: 'r-retreat', name: 'Weekend writing retreat', cost: 3000, glyph: '⌂', note: 'A cabin for real.' },
];

export const DEFAULT_LOUNGE: LoungeData = { rewards: DEFAULT_REWARDS, claims: [], rates: DEFAULT_RATES, countFrom: null };
