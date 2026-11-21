/** A homestead building with its own time log and lists (the Office, the Observatory). Never counts toward writing. */
export type AreaKey = 'office' | 'observatory';

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
}

export interface AreaData {
  /** Minutes per kind of time, per day. */
  days: Record<string, Record<string, number>>;
  items: AreaItem[];
}

export interface AreaKind { k: string; label: string; color: string }
export interface AreaList { id: string; title: string; placeholder: string; progress?: boolean; body?: boolean; empty: string }

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

export const AREA_CONFIGS: Record<AreaKey, AreaConfig> = { office: OFFICE, observatory: OBSERVATORY };
