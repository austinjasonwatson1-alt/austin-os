import { describe, expect, it } from 'vitest';
import { agoLabel, leanFor, orphanPhotoIds, capsuleState, countdownLabel, daysToOpen, describeMemories, filterByTag, groupByMonth, onThisDay, readyCapsules, sealProblem, sealedFor, sortCapsules, tagCounts } from './logic';
import type { Capsule, Memory } from './types';

const M = (id: string, day: string, p: Partial<Memory> = {}): Memory => ({ id, day, caption: '', thumb: 'data:', addedAt: `${day}T12:00:00Z`, ...p });
const C = (id: string, p: Partial<Capsule> = {}): Capsule => ({ id, title: id, body: 'secret', written: '2026-01-01', ...p });

describe('memories', () => {
  it('groups the wall by month, newest first', () => {
    const g = groupByMonth([M('a', '2026-10-03'), M('b', '2026-11-20'), M('c', '2026-11-02'), M('d', '2025-11-30')]);
    expect(g.map((x) => x.key)).toEqual(['2026-11', '2026-10', '2025-11']);
    expect(g[0].label).toBe('November 2026');
    expect(g[0].items.map((m) => m.id)).toEqual(['b', 'c']);
  });

  it('breaks same-day ties by when they were added', () => {
    const g = groupByMonth([M('a', '2026-11-20', { addedAt: '2026-11-20T08:00:00Z' }), M('b', '2026-11-20', { addedAt: '2026-11-20T09:00:00Z' })]);
    expect(g[0].items.map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('filters and counts by tag', () => {
    const items = [M('a', '2026-01-01', { tag: 'cooper' }), M('b', '2026-01-02', { tag: 'shadow' }), M('c', '2026-01-03', { tag: 'cooper' }), M('d', '2026-01-04')];
    expect(filterByTag(items, 'cooper').map((m) => m.id)).toEqual(['a', 'c']);
    expect(filterByTag(items, null)).toHaveLength(4);
    expect(tagCounts(items)).toEqual([{ tag: 'cooper', n: 2 }, { tag: 'shadow', n: 1 }]);
  });

  it('finds this day in earlier years, most recent year first', () => {
    const items = [M('a', '2024-11-22'), M('b', '2025-11-22'), M('c', '2026-11-22'), M('d', '2025-11-21')];
    const r = onThisDay(items, '2026-11-22');
    expect(r?.kind).toBe('day');
    expect(r?.items.map((m) => m.id)).toEqual(['b', 'a']);
    expect(agoLabel('2024-11-22', '2026-11-22')).toBe('2 years ago today');
    expect(agoLabel('2025-11-22', '2026-11-22')).toBe('1 year ago today');
  });

  it('falls back to the same week a year ago', () => {
    const items = [M('a', '2025-11-19'), M('b', '2025-11-25'), M('c', '2025-11-18'), M('e', '2025-11-26'), M('d', '2024-11-20')];
    const r = onThisDay(items, '2026-11-22');
    expect(r?.kind).toBe('week');
    expect(r?.items.map((m) => m.id)).toEqual(['b', 'a']);
    expect(agoLabel('2025-11-19', '2026-11-22', 'week')).toBe('A year ago this week');
  });

  it('shows nothing when there is nothing', () => {
    expect(onThisDay([M('a', '2026-11-22')], '2026-11-22')).toBeNull();
    expect(onThisDay([], '2026-11-22')).toBeNull();
  });

  it('remembers leap days on Feb 28', () => {
    expect(onThisDay([M('a', '2024-02-29')], '2027-02-28')?.items).toHaveLength(1);
    expect(onThisDay([M('a', '2024-02-29')], '2028-02-28')).toBeNull();
  });
});

describe('the time capsule', () => {
  const today = '2026-11-22';

  it('knows sealed, ready and open', () => {
    expect(capsuleState(C('a', { opensOn: '2027-06-24' }), today)).toBe('sealed');
    expect(capsuleState(C('a', { opensOn: today }), today)).toBe('ready');
    expect(capsuleState(C('a', { opensOn: '2026-01-01', openedOn: '2026-02-01' }), today)).toBe('open');
    expect(capsuleState(C('a', { event: 'The day I sign with an agent' }), today)).toBe('sealed');
    expect(capsuleState(C('a', { event: 'x', openedOn: today }), today)).toBe('open');
  });

  it('counts down to the opening day', () => {
    expect(daysToOpen(C('a', { opensOn: '2027-06-24' }), today)).toBe(214);
    expect(daysToOpen(C('a', { opensOn: '2026-11-01' }), today)).toBe(0);
    expect(daysToOpen(C('a', { event: 'x' }), today)).toBeNull();
    expect(countdownLabel(214)).toBe('opens in 214 days');
    expect(countdownLabel(1)).toBe('opens tomorrow');
    expect(countdownLabel(0)).toBe('ready to open');
    expect(countdownLabel(366)).toBe('opens in 1 year, 1 day');
    expect(countdownLabel(730)).toBe('opens in 2 years');
  });

  it('sorts ready, then sealed by date (events last), then opened', () => {
    const list = [
      C('open-old', { openedOn: '2026-01-05' }),
      C('event', { event: 'agent' }),
      C('later', { opensOn: '2030-01-01' }),
      C('ready', { opensOn: '2026-11-20' }),
      C('soon', { opensOn: '2027-01-01' }),
      C('open-new', { openedOn: '2026-10-01' }),
    ];
    expect(sortCapsules(list, today).map((c) => c.id)).toEqual(['ready', 'soon', 'later', 'event', 'open-new', 'open-old']);
    expect(readyCapsules(list, today).map((c) => c.id)).toEqual(['ready']);
  });

  it('only seals a complete letter with a future date or an event', () => {
    expect(sealProblem({ title: 't', body: '' }, today)).toMatch(/Write/);
    expect(sealProblem({ title: '', body: 'b', opensOn: '2027-01-01' }, today)).toMatch(/name/);
    expect(sealProblem({ title: 't', body: 'b' }, today)).toMatch(/Choose/);
    expect(sealProblem({ title: 't', body: 'b', opensOn: today }, today)).toMatch(/future/);
    expect(sealProblem({ title: 't', body: 'b', opensOn: '2027-01-01' }, today)).toBeNull();
    expect(sealProblem({ title: 't', body: 'b', event: 'The day I sign with an agent' }, today)).toBeNull();
  });

  it('knows how long a letter was sealed', () => {
    expect(sealedFor(C('a', { written: '2026-11-01', openedOn: '2026-11-22' }), today)).toBe(21);
  });
});

describe('restore preview', () => {
  it('describes photos and letters', () => {
    const v = { items: [M('a', '2026-01-01'), M('b', '2026-01-02')], capsules: [C('x', { opensOn: '2027-01-01' }), C('y', { openedOn: '2026-02-01' }), C('z', { event: 'e' })] };
    expect(describeMemories.detail(v)).toBe('2 photos · 3 letters (2 sealed)');
    expect(describeMemories.size(v)).toBe(5);
    expect(describeMemories.detail({ items: [M('a', '2026-01-01')], capsules: [] })).toBe('1 photo');
    expect(describeMemories.detail(undefined)).toBe('0 photos');
  });
});

describe('housekeeping', () => {
  it('only drops photos whose memory was deleted', () => {
    const keys = ['memories.v1', 'memories.photo.a', 'memories.photo.b', 'memories.photo.c'];
    expect(orphanPhotoIds(keys, 'memories.photo.', [M('a', '2026-01-01')], { b: 't', a: 't' })).toEqual(['b']);
    expect(orphanPhotoIds(keys, 'memories.photo.', [], undefined)).toEqual([]);
  });
});

describe('the wall', () => {
  it('leans each polaroid a little, the same way every time', () => {
    for (const id of ['m-a', 'm-b', 'm-xyz123']) {
      expect(leanFor(id)).toBe(leanFor(id));
      expect(Math.abs(leanFor(id))).toBeLessThanOrEqual(2.5);
    }
  });
});
