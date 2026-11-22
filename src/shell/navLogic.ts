/** How the rooms are grouped in the rail, and which ones Austin uses most. Pure. */

export interface NavItem { path: string; glyph: string; name: string; soon?: boolean }
export interface NavGroup { id: string; label: string; items: NavItem[] }

/** Paths that are always at the top, so never repeated under "Your rooms". */
export const PINNED = ['/home', '/day', '/keeper'];

/** Rooms that are one room with tabs: the rail shows the first, the rest are views inside it. */
export interface RoomSet { id: string; label: string; tabs: { path: string; label: string; glyph: string }[] }
export const ROOM_SETS: RoomSet[] = [
  { id: 'lookback', label: 'Looking back', tabs: [
    { path: '/review', label: 'This week', glyph: '◷' }, { path: '/year', label: 'The year', glyph: '◎' },
    { path: '/library', label: 'Library of You', glyph: '❦' }, { path: '/records', label: 'Hall of Records', glyph: '♛' },
    { path: '/film', label: 'The film', glyph: '▶' },
  ] },
  { id: 'publication', label: 'Road to publication', tabs: [
    { path: '/cabin/queries', label: 'Queries', glyph: '✉' }, { path: '/cabin/contests', label: 'Contests', glyph: '✧' },
    { path: '/cabin/editorial', label: 'Editorial Vault', glyph: '✎' }, { path: '/cabin/marketing', label: 'Outreach', glyph: '◎' },
  ] },
  { id: 'ledger', label: 'The Ledger', tabs: [
    { path: '/cabin/ledger', label: 'Minutes', glyph: '▤' }, { path: '/cabin/lounge', label: 'The Lounge', glyph: '✦' },
  ] },
  { id: 'bank', label: 'The Ledger House', tabs: [
    { path: '/bank', label: 'The house', glyph: '⌂' }, { path: '/money', label: 'Money', glyph: '$' },
  ] },
  { id: 'hearth', label: 'The Hearth', tabs: [
    { path: '/hearth', label: 'Family', glyph: '♥' }, { path: '/kennel', label: 'The Kennel', glyph: '🐾' }, { path: '/memories', label: 'Memories', glyph: '❀' },
  ] },
];

/** Rooms reached from inside another (a button, not a rail entry), and where they count. */
const INSIDE: Record<string, string> = { '/cabin/timer': '/cabin' };

/** The family a route belongs to, if it is one of several views. */
export function setOf(route: string): RoomSet | null {
  const r = route.split('?')[0];
  return ROOM_SETS.find((s) => s.tabs.some((t) => t.path === r)) ?? null;
}

/** Where a route lives in the rail: the first tab of its family, its host room, or itself. */
export function railPath(route: string): string {
  const r = route.split('?')[0];
  return setOf(r)?.tabs[0].path ?? INSIDE[r] ?? r;
}

/** True for paths the rail leaves out because they live inside another room. */
export const tucked = (path: string) => railPath(path) !== path;

/** The group a route belongs to (sub-pages like /cabin/write/… count as their room). */
export function groupOf(groups: NavGroup[], route: string): string | null {
  const r = railPath(route);
  for (const g of groups) if (g.items.some((i) => r === i.path || (i.path !== '/cabin' && r.startsWith(`${i.path}/`)))) return g.id;
  if (r.startsWith('/cabin')) return groups.find((g) => g.items.some((i) => i.path === '/cabin'))?.id ?? null;
  return null;
}

/** The room a route counts as (the editor counts as Manuscripts). */
export function roomOf(items: NavItem[], route: string): string | null {
  const r = railPath(route);
  if (r.startsWith('/cabin/write')) return '/cabin/manuscripts';
  const exact = items.find((i) => i.path === r);
  if (exact) return exact.path;
  const parent = items.filter((i) => r.startsWith(`${i.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
  return parent?.path ?? null;
}

/** Visits with a gentle fade, so last month's habits outweigh last year's. */
export type Visits = Record<string, { n: number; last: number }>;
export function recordVisit(v: Visits, path: string, now: number): Visits {
  const cur = v[path];
  const days = cur ? (now - cur.last) / 86_400_000 : 0;
  const n = cur ? cur.n * Math.pow(0.5, days / 30) + 1 : 1;
  return { ...v, [path]: { n, last: now } };
}

/** The most-used rooms, excluding the pinned ones, best first. */
export function mostUsed(v: Visits, items: NavItem[], now: number, k = 5): NavItem[] {
  const score = (p: string) => { const e = v[p]; return e ? e.n * Math.pow(0.5, (now - e.last) / 86_400_000 / 30) : 0; };
  return items.filter((i) => !i.soon && !PINNED.includes(i.path) && score(i.path) >= 2)
    .sort((a, b) => score(b.path) - score(a.path)).slice(0, k);
}
