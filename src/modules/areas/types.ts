/** A homestead building with its own time log and lists (the Office, the Observatory). Never counts toward writing. */
export type AreaKey = 'office' | 'observatory' | 'forge' | 'bank' | 'hearth';

export interface AreaItem {
  id: string;
  /** Which list it's on, e.g. "wins", "notes", "courses". */
  list: string;
  text: string;
  body?: string;
  date: string;
  /** 0–100 for things with progress (courses). */
  progress?: number;
  done?: boolean;
  /** Dollars, for money lists (whether it's in or out is decided by the list). */
  amount?: number;
  /** A date it's about (a birthday, a race), for dated lists. */
  when?: string;
}

export interface AreaData {
  /** Minutes per kind of time, per day. */
  days: Record<string, Record<string, number>>;
  items: AreaItem[];
}

export interface AreaKind { k: string; label: string; color: string }
export interface AreaList {
  id: string; title: string; placeholder: string; empty: string;
  progress?: boolean; body?: boolean;
  /** Each item carries an amount; `sign` says whether it's money in (+1) or out (-1). */
  amount?: boolean; sign?: 1 | -1;
  /** Each item carries a date; `yearly` ones come round every year (birthdays). */
  when?: boolean; yearly?: boolean;
  /** Items get a done checkbox (default true). */
  check?: boolean;
}

export interface AreaConfig {
  id: AreaKey;
  key: string;
  name: string;
  word: string;
  lede: string;
  accent: string;
  glyph: string;
  kinds: AreaKind[];
  lists: AreaList[];
  /** Minutes that make a full day here (lights the building fully). */
  fullDay: number;
}

export const DEFAULT_AREA: AreaData = { days: {}, items: [] };

export const OFFICE: AreaConfig = {
  id: 'office', key: 'area.office', name: 'The Office', word: 'Office.', glyph: '▣', accent: '#6FB3F2', fullDay: 240,
  lede: 'The PM job, kept in its own room: focus blocks, the week’s wins, and the notes worth keeping.',
  kinds: [{ k: 'focus', label: 'Deep focus', color: '#6FB3F2' }, { k: 'planning', label: 'Planning', color: '#8E7CF0' }],
  lists: [
    { id: 'wins', title: 'Wins this week', placeholder: 'Shipped the onboarding fix', empty: 'Every win, however small, for the review and the brag list.' },
    { id: 'notes', title: 'Notes & follow-ups', placeholder: 'Ask Dana about the Q1 roadmap', body: true, empty: 'Meeting notes, follow-ups, ideas for the team.' },
  ],
};

export const OBSERVATORY: AreaConfig = {
  id: 'observatory', key: 'area.observatory', name: 'The Observatory', word: 'Observatory.', glyph: '◐', accent: '#8E7CF0', fullDay: 120,
  lede: 'AI study and learning, counted on their own: hours at the telescope, courses in progress, and notes from the experiments.',
  kinds: [{ k: 'study', label: 'Study', color: '#8E7CF0' }, { k: 'build', label: 'Building', color: '#3FA8A0' }],
  lists: [
    { id: 'courses', title: 'Courses & papers', placeholder: 'Deep learning specialization', progress: true, empty: 'What you’re working through, and how far along.' },
    { id: 'notes', title: 'Notes & experiments', placeholder: 'Tried retrieval with smaller chunks', body: true, empty: 'Things learned, things tried, things to come back to.' },
  ],
};

export const FORGE: AreaConfig = {
  id: 'forge', key: 'area.forge', name: 'The Forge', word: 'Forge.', glyph: '⚒', accent: '#E07A3F', fullDay: 60,
  lede: 'The body that carries the work: training, walks and rest, goals with a finish line, and how it felt.',
  kinds: [{ k: 'strength', label: 'Strength', color: '#E07A3F' }, { k: 'cardio', label: 'Cardio', color: '#E0A426' }, { k: 'walk', label: 'Walks', color: '#4FBF87' }],
  lists: [
    { id: 'goals', title: 'Goals', placeholder: 'Run a 10K by spring', progress: true, when: true, empty: 'Something to train toward, with a date if it has one.' },
    { id: 'notes', title: 'Training log', placeholder: 'Felt strong on the hills', body: true, check: false, empty: 'How sessions went, injuries, what worked.' },
  ],
};

export const BANK: AreaConfig = {
  id: 'bank', key: 'area.bank', name: 'The Ledger House', word: 'Ledger House.', glyph: '¤', accent: '#C9A227', fullDay: 1,
  lede: 'What the writing life costs and what it pays: contest fees, editors, books and conferences, and every prize and advance.',
  kinds: [],
  lists: [
    { id: 'out', title: 'Spent on the writing', placeholder: 'Contest entry fee', amount: true, sign: -1, check: false, empty: 'Fees, editors, courses, books, conferences.' },
    { id: 'in', title: 'Earned from the writing', placeholder: 'Short story prize', amount: true, sign: 1, check: false, empty: 'Prizes, payments, advances, royalties.' },
  ],
};

export const HEARTH: AreaConfig = {
  id: 'hearth', key: 'area.hearth', name: 'The Hearth', word: 'Hearth.', glyph: '♥', accent: '#D97BA4', fullDay: 120,
  lede: 'Family and the people at the center of it: time together, the dates that matter, and moments worth keeping.',
  kinds: [{ k: 'together', label: 'Time together', color: '#D97BA4' }],
  lists: [
    { id: 'dates', title: 'Dates to remember', placeholder: 'Mom\u2019s birthday', when: true, yearly: true, check: false, empty: 'Birthdays and anniversaries; they come round every year.' },
    { id: 'moments', title: 'Moments', placeholder: 'Cooper stole the pancake', body: true, check: false, empty: 'The small things worth keeping.' },
  ],
};

export const AREA_CONFIGS: Record<AreaKey, AreaConfig> = { office: OFFICE, observatory: OBSERVATORY, forge: FORGE, bank: BANK, hearth: HEARTH };
