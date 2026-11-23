import { describe, expect, it } from 'vitest';
import { groupOf, mostUsed, railPath, recordVisit, ROOM_SETS, roomOf, setOf, tucked, type NavGroup } from './navLogic';

const groups: NavGroup[] = [
  { id: 'cabin', label: 'Cabin', items: [{ path: '/cabin', glyph: '', name: 'The Cabin' }, { path: '/cabin/ledger', glyph: '', name: 'Ledger' }, { path: '/cabin/manuscripts', glyph: '', name: 'Manuscripts' }] },
  { id: 'home', label: 'Homestead', items: [{ path: '/chapel', glyph: '', name: 'Chapel' }, { path: '/forge', glyph: '', name: 'Forge' }] },
];
const all = groups.flatMap((g) => g.items);
const DAY = 86_400_000;

describe('nav', () => {
  it('finds the group and room for a route', () => {
    expect(groupOf(groups, '/cabin/ledger')).toBe('cabin');
    expect(groupOf(groups, '/cabin/write/m/c')).toBe('cabin');
    expect(groupOf(groups, '/chapel')).toBe('home');
    expect(groupOf(groups, '/settings')).toBeNull();
    expect(roomOf(all, '/cabin/write/m/c')).toBe('/cabin/manuscripts');
    expect(roomOf(all, '/cabin/ledger?x=1')).toBe('/cabin/ledger');
    expect(roomOf(all, '/nowhere')).toBeNull();
    expect(railPath('/records')).toBe('/review');
  });

  it('surfaces the rooms used most lately', () => {
    let v = {};
    const now = 100 * DAY;
    for (let i = 0; i < 6; i++) v = recordVisit(v, '/chapel', now - i * DAY);
    for (let i = 0; i < 3; i++) v = recordVisit(v, '/cabin/ledger', now);
    for (let i = 0; i < 9; i++) v = recordVisit(v, '/forge', now - 300 * DAY); // long ago
    v = recordVisit(v, '/cabin/manuscripts', now); // once: not enough
    expect(mostUsed(v, all, now).map((i) => i.path)).toEqual(['/chapel', '/cabin/ledger']);
  });

  it('folds room families into one rail entry, keeping every old link', () => {
    expect(railPath('/cabin/lounge')).toBe('/cabin/ledger');
    expect(railPath('/money?m=2026-11')).toBe('/bank');
    expect(railPath('/memories')).toBe('/hearth');
    expect(railPath('/cabin/timer')).toBe('/cabin');
    expect(railPath('/cabin/scenes')).toBe('/cabin/shelf');
    expect(railPath('/chapel')).toBe('/chapel');
    expect(setOf('/cabin/contests')?.id).toBe('publication');
    expect(setOf('/chapel')).toBeNull();
    expect(tucked('/kennel')).toBe(true);
    expect(tucked('/hearth')).toBe(false);
    expect(roomOf(all, '/cabin/lounge')).toBe('/cabin/ledger');
    expect(groupOf(groups, '/cabin/lounge')).toBe('cabin');
    // no path sits in two families
    const paths = ROOM_SETS.flatMap((x) => x.tabs.map((t) => t.path));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
