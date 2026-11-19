export type CatKey = 'writing' | 'editing' | 'reading' | 'research' | 'learning' | 'querying';

export interface Cat {
  k: CatKey;
  name: string;
  color: string;
}

/** Everything here counts toward the dream. Faith, AI study and PM work live elsewhere. */
export const CATS: Cat[] = [
  { k: 'writing', name: 'Writing', color: '#6FB3F2' },
  { k: 'editing', name: 'Editing', color: '#8E7CF0' },
  { k: 'reading', name: 'Reading', color: '#4FBF87' },
  { k: 'research', name: 'Research', color: '#3FA8A0' },
  { k: 'learning', name: 'Craft', color: '#E0A426' },
  { k: 'querying', name: 'Querying', color: '#D97BA4' },
];

export type DayEntry = Partial<Record<CatKey, number>> & { note?: string };
export type DayMap = Record<string, DayEntry>;

export interface Thresholds {
  elite: number;
  good: number;
  warn: number;
}

export interface Deadline {
  n: string;
  d: string;
}

export interface LedgerData {
  days: DayMap;
  thresholds: Thresholds;
  weekly: Thresholds;
  deadlines: Deadline[];
}

export type GradeKey = 'zero' | 'bad' | 'warn' | 'good' | 'elite';

export const DEFAULT_DATA: LedgerData = {
  days: {},
  thresholds: { elite: 180, good: 80, warn: 30 },
  weekly: { elite: 700, good: 450, warn: 250 },
  deadlines: [{ n: 'Query-ready', d: '2026-12-31' }],
};
