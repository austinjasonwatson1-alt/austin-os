import { lazy, type ComponentType } from 'react';

export type AreaId = 'cabin' | 'chapel' | 'office' | 'observatory';

/** A building on the homestead: one part of life. Without `live` it shows as being built. */
export interface AreaDef {
  id: AreaId;
  path: string;
  name: string;
  glyph: string;
  blurb: string;
  /** What it will hold, shown while it's being built. */
  plans: string[];
  live: boolean;
  /** The area's own page, once it's built. */
  component?: ComponentType;
}

export const AREAS: AreaDef[] = [
  {
    id: 'cabin', path: '/cabin', name: "The Writer's Cabin", glyph: '⌂', live: true,
    blurb: 'The writing career: the Ledger, the Lounge, the Shelf, manuscripts, queries.',
    plans: [],
  },
  {
    id: 'chapel', path: '/chapel', name: 'The Chapel', glyph: '✝', live: true,
    component: lazy(() => import('./chapel/ChapelPage')),
    blurb: 'Prayer and faith: time with God, a prayer list, answered prayers.',
    plans: ['Daily prayer and Bible-reading time, kept apart from writing minutes', 'A prayer list with dates, so answered prayers can be marked and remembered', 'Verses and notes worth keeping'],
  },
  {
    id: 'office', path: '/office', name: 'The Office', glyph: '▣', live: true,
    component: lazy(() => import('./areas/OfficePage')),
    blurb: 'The PM job: focus blocks, weekly wins, notes.',
    plans: ['Deep-work focus blocks with the lamp timer', 'Weekly wins and a running brag list for reviews', 'Meeting notes and follow-ups'],
  },
  {
    id: 'observatory', path: '/observatory', name: 'The Observatory', glyph: '◐', live: true,
    component: lazy(() => import('./areas/ObservatoryPage')),
    blurb: 'AI study and learning: courses, notes, hours.',
    plans: ['Study hours, logged like the Ledger but counted on their own', 'Courses and papers with progress', 'Notes and experiments worth coming back to'],
  },
];

export const areaByPath = (p: string) => AREAS.find((a) => a.path === p);

export interface ModuleDef {
  id: string;
  path: string;
  name: string;
  glyph: string;
  blurb: string;
  section: AreaId;
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
  {
    id: 'timer', path: '/cabin/timer', name: 'Lamp Mode', glyph: '◉', section: 'cabin',
    blurb: 'A focus timer. Everything goes dark but the lamp; stop and the minutes land in the Ledger.',
    component: lazy(() => import('./timer/TimerPage')),
  },
  {
    id: 'lounge', path: '/cabin/lounge', name: 'The Lounge', glyph: '✦', section: 'cabin',
    blurb: 'Writing earns points. Spend them on real things you want, then mark them bought.',
    component: lazy(() => import('./lounge/LoungePage')),
  },
  {
    id: 'shelf', path: '/cabin/shelf', name: 'The Shelf', glyph: '▥', section: 'cabin', blurb: 'Your library — every book read, rated, and mined for craft.',
    component: lazy(() => import('./shelf/ShelfPage')),
  },
  {
    id: 'manuscripts', path: '/cabin/manuscripts', name: 'Manuscripts', glyph: '❡', section: 'cabin', blurb: 'The Life I Deserve and Silence Speaks — chapter boards and word counts.',
    component: lazy(() => import('./manuscripts/ManuscriptsPage')),
  },
  { id: 'queries', path: '/cabin/queries', name: 'Query Tracker', glyph: '✉', section: 'cabin', blurb: 'Agents, submissions, responses, follow-ups.',
    component: lazy(() => import('./pub/PubPages').then((m) => ({ default: m.QueriesPage }))) },
  { id: 'contests', path: '/cabin/contests', name: 'Contests', glyph: '✧', section: 'cabin', blurb: 'Short-story contests: deadlines, rules, what you entered.',
    component: lazy(() => import('./pub/PubPages').then((m) => ({ default: m.ContestsPage }))) },
  { id: 'editorial', path: '/cabin/editorial', name: 'Editorial Vault', glyph: '✎', section: 'cabin', blurb: 'Feedback, craft notes, and your standing editing brief.',
    component: lazy(() => import('./pub/PubPages').then((m) => ({ default: m.EditorialPage }))) },
  { id: 'marketing', path: '/cabin/marketing', name: 'Outreach', glyph: '◎', section: 'cabin', blurb: 'Who you plan to reach for the debut, and where each stands.',
    component: lazy(() => import('./pub/PubPages').then((m) => ({ default: m.OutreachPage }))) },
];

export const byPath = (p: string) => MODULES.find((m) => m.path === p);
