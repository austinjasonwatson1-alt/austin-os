import { lazy, type ComponentType } from 'react';

export interface ModuleDef {
  id: string;
  path: string;
  name: string;
  glyph: string;
  blurb: string;
  section: 'os' | 'cabin';
  /** Present once the module is built; absent means it renders as a "coming soon" room. */
  component?: ComponentType;
}

/** Add a module here and it appears in the rail and on its section's home. */
export const MODULES: ModuleDef[] = [
  {
    id: 'ledger', path: '/cabin/ledger', name: 'The Ledger', glyph: '▤', section: 'cabin',
    blurb: 'Daily minutes toward the book. Grades, streaks, the year wall.',
    component: lazy(() => import('./ledger/LedgerPage')),
  },
  { id: 'shelf', path: '/cabin/shelf', name: 'The Shelf', glyph: '▥', section: 'cabin', blurb: 'Your library — every book read, rated, and mined for craft.' },
  { id: 'manuscripts', path: '/cabin/manuscripts', name: 'Manuscripts', glyph: '❡', section: 'cabin', blurb: 'The Life I Deserve and Silence Speaks — chapter boards and word counts.' },
  { id: 'queries', path: '/cabin/queries', name: 'Query Tracker', glyph: '✉', section: 'cabin', blurb: 'Agents, submissions, responses, follow-ups.' },
  { id: 'contests', path: '/cabin/contests', name: 'Contests', glyph: '✧', section: 'cabin', blurb: 'Short-story contests: deadlines, rules, what you entered.' },
  { id: 'editorial', path: '/cabin/editorial', name: 'Editorial Vault', glyph: '✎', section: 'cabin', blurb: 'Feedback, craft notes, and your standing editing brief.' },
  { id: 'marketing', path: '/cabin/marketing', name: 'Outreach', glyph: '◎', section: 'cabin', blurb: 'Who you plan to reach for the debut, and where each stands.' },
];

export const byPath = (p: string) => MODULES.find((m) => m.path === p);
