/** How the rooms are grouped in the rail, and which ones Austin uses most. Pure. */

export interface NavItem { path: string; glyph: string; name: string; soon?: boolean }
export interface NavGroup { id: string; label: string; items: NavItem[] }

/** Paths that are always at the top, so never repeated under "Your rooms". */
export const PINNED = ['/home', '/day', '/keeper'];

/** The group a route belongs to (sub-pages like /cabin/write/… count as their room). */
export function groupOf(groups: NavGroup[], route: string): string | null {
  const r = route.split('?')[0];
  if (['/year', '/library', '/records', '/film'].includes(r)) return groupOf(groups, '/review');
  for (const g of groups) if (g.items.some((i) => r === i.path || (i.path !== '/cabin' && r.startsWith(`${i.path}/`)))) return g.id;
  if (r.startsWith('/cabin')) return groups.find((g) => g.items.some((i) => i.path === '/cabin'))?.id ?? null;
  return null;
}

/** The room a route counts as (the editor counts as Manuscripts). */
export function roomOf(items: NavItem[], route: string): string | null {
  const r = route.split('?')[0];
  if (r.startsWith('/cabin/write')) return '/cabin/manuscripts';
  // Looking back is one room with several views.
  if (['/year', '/library', '/records', '/film'].includes(r)) return '/review';
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
