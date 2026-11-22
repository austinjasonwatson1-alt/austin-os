import { describe, expect, it } from 'vitest';
import { groupOf, mostUsed, recordVisit, roomOf, type NavGroup } from './navLogic';

const groups: NavGroup[] = [
  { id: 'cabin', label: 'Cabin', items: [{ path: '/cabin', glyph: '', name: 'The Cabin' }, { path: '/cabin/ledger', glyph: '', name: 'Ledger' }, { path: '/cabin/manuscripts', glyph: '', name: 'Manuscripts' }] },
  { id: 'home', label: 'Homestead', items: [{ path: '/chapel', glyph: '', name: 'Chapel' }, { path: '/kennel', glyph: '', name: 'Kennel' }] },
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
  });

  it('surfaces the rooms used most lately', () => {
    let v = {};
    const now = 100 * DAY;
    for (let i = 0; i < 6; i++) v = recordVisit(v, '/chapel', now - i * DAY);
    for (let i = 0; i < 3; i++) v = recordVisit(v, '/cabin/ledger', now);
    for (let i = 0; i < 9; i++) v = recordVisit(v, '/kennel', now - 300 * DAY); // long ago
    v = recordVisit(v, '/cabin/manuscripts', now); // once: not enough
    expect(mostUsed(v, all, now).map((i) => i.path)).toEqual(['/chapel', '/cabin/ledger']);
  });
});
