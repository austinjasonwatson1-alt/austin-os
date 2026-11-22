import { describe, expect, it } from 'vitest';
import { syncMerge, unionById } from './syncLogic';

describe('two-device sync', () => {
  it('keeps everything local and adds what only the other device has', () => {
    const local = {
      'ledger.v3': { days: { '2026-11-20': { writing: 60 } }, deadlines: [{ n: 'Q', d: '2026-12-31' }], thresholds: {} },
      'shelf.v1': { books: [{ id: 'a', title: 'Mine' }] },
    };
    const remote = {
      'ledger.v3': { days: { '2026-11-20': { writing: 30 }, '2026-11-21': { reading: 40 } }, deadlines: [{ n: 'Q', d: '2026-12-31' }, { n: 'Contest', d: '2027-01-15' }], thresholds: {} },
      'shelf.v1': { books: [{ id: 'a', title: 'Changed there' }, { id: 'b', title: 'Theirs' }] },
      'chapel.v1': { days: { '2026-11-21': { prayer: 10 } }, prayers: [], verses: [] },
      'sys:autoBackup': {},
      'os.prefs': { chime: true },
    };
    const w = syncMerge({ ...local, 'os.prefs': { chime: false } }, remote) as Record<string, any>;
    expect(Object.keys(w).sort()).toEqual(['chapel.v1', 'ledger.v3', 'shelf.v1']);
    expect(w['ledger.v3'].days['2026-11-20']).toEqual({ writing: 60 }); // the bigger day stays
    expect(w['ledger.v3'].days['2026-11-21']).toEqual({ reading: 40 });
    expect(w['ledger.v3'].deadlines).toHaveLength(2);
    expect(w['shelf.v1'].books.map((b: any) => b.title)).toEqual(['Mine', 'Theirs']);
  });

  it('carries "bought" and "answered" across, and merges chapel minutes', () => {
    const w = syncMerge(
      { 'lounge.v1': { rewards: [], claims: [{ id: 'c', cost: 1 }] }, 'chapel.v1': { days: { d: { prayer: 10 } }, prayers: [{ id: 'p', text: 'x' }], verses: [] } },
      { 'lounge.v1': { rewards: [], claims: [{ id: 'c', cost: 1, boughtAt: 'T' }] }, 'chapel.v1': { days: { d: { prayer: 5, scripture: 15 } }, prayers: [{ id: 'p', text: 'x', answeredOn: '2026-11-21', answer: 'yes' }], verses: [] } },
    ) as Record<string, any>;
    expect(w['lounge.v1'].claims[0].boughtAt).toBe('T');
    expect(w['chapel.v1'].days.d).toMatchObject({ prayer: 10, scripture: 15 });
    expect(w['chapel.v1'].prayers[0].answeredOn).toBe('2026-11-21');
  });

  it('merges manuscripts chapter by chapter, and areas', () => {
    const w = syncMerge(
      { 'manuscripts.v1': { manuscripts: [{ id: 'm', chapters: [{ id: '1' }], history: { a: 1 } }] }, 'area.office': { days: { d: { focus: 30 } }, wins: [{ id: 'x' }] } },
      { 'manuscripts.v1': { manuscripts: [{ id: 'm', chapters: [{ id: '1' }, { id: '2' }], history: { b: 2 } }] }, 'area.office': { days: { d: { focus: 50 } }, wins: [{ id: 'y' }] } },
    ) as Record<string, any>;
    expect(w['manuscripts.v1'].manuscripts[0].chapters.map((c: any) => c.id)).toEqual(['1', '2']);
    expect(w['manuscripts.v1'].manuscripts[0].history).toEqual({ a: 1, b: 2 });
    expect(w['area.office'].days.d.focus).toBe(50);
    expect(w['area.office'].wins.map((x: any) => x.id)).toEqual(['x', 'y']);
  });

  it('changes nothing when the other device has nothing new', () => {
    const d = { 'shelf.v1': { books: [{ id: 'a' }] } };
    expect(syncMerge(d, d)).toEqual({});
    expect(unionById([{ id: 'a' }], [])).toEqual([{ id: 'a' }]);
  });
});

describe('drafts sync', () => {
  it('keeps the most recently edited chapter text from either computer', () => {
    const w = syncMerge(
      { 'drafts.v1': { drafts: { 'm/1': { text: 'old', updatedAt: '2026-11-21T10:00:00Z' }, 'm/2': { text: 'mine', updatedAt: '2026-11-21T12:00:00Z' } }, versions: { 'm/1': [{ at: 'a' }] } } },
      { 'drafts.v1': { drafts: { 'm/1': { text: 'newer', updatedAt: '2026-11-21T11:00:00Z' }, 'm/2': { text: 'theirs', updatedAt: '2026-11-21T09:00:00Z' } }, versions: { 'm/1': [{ at: 'b' }] } } },
    ) as Record<string, any>;
    expect(w['drafts.v1'].drafts['m/1'].text).toBe('newer');
    expect(w['drafts.v1'].drafts['m/2'].text).toBe('mine');
    expect(w['drafts.v1'].versions['m/1'].map((v: any) => v.at)).toEqual(['b', 'a']);
  });
});

import { prune } from './syncLogic';

describe('deletions sync', () => {
  it('a delete on one computer sticks on the other', () => {
    const local = { 'shelf.v1': { books: [{ id: 'a' }, { id: 'b' }] }, 'sync.deleted': {} };
    const remote = { 'shelf.v1': { books: [{ id: 'a' }] }, 'sync.deleted': { 'shelf.v1': { b: '2026-11-21T10:00:00Z' } } };
    const w = syncMerge(local, remote) as Record<string, any>;
    expect(w['shelf.v1'].books.map((x: any) => x.id)).toEqual(['a']);
    expect(w['sync.deleted']).toEqual({ 'shelf.v1': { b: '2026-11-21T10:00:00Z' } });
  });
  it('the deleting computer does not get the item back', () => {
    const local = { 'shelf.v1': { books: [{ id: 'a' }] }, 'sync.deleted': { 'shelf.v1': { b: 'x' } } };
    const remote = { 'shelf.v1': { books: [{ id: 'a' }, { id: 'b' }] } };
    expect(syncMerge(local, remote)).toEqual({});
  });
  it('prunes nested items like chapters', () => {
    expect(prune({ manuscripts: [{ id: 'm', chapters: [{ id: '1' }, { id: '2' }] }] }, { '2': 'x' })).toEqual({ manuscripts: [{ id: 'm', chapters: [{ id: '1' }] }] });
  });
});

describe('shelf goals sync', () => {
  it('keeps both devices\' goals, local winning a clash', () => {
    const out = syncMerge({ 'shelf.v1': { books: [], goals: { '2026': 30 } } }, { 'shelf.v1': { books: [], goals: { '2026': 20, '2027': 40 } } }) as Record<string, { goals: unknown }>;
    expect(out['shelf.v1'].goals).toEqual({ '2026': 30, '2027': 40 });
  });
});

describe('sprint sync', () => {
  it('keeps sprints from both devices', () => {
    const out = syncMerge({ 'drafts.v1': { drafts: {}, versions: {}, sprints: [{ id: 'a', words: 1 }] } }, { 'drafts.v1': { drafts: {}, versions: {}, sprints: [{ id: 'b', words: 2 }] } }) as Record<string, { sprints: { id: string }[] }>;
    expect(out['drafts.v1'].sprints.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
});

describe('kennel sync', () => {
  it('keeps walks and care from both devices', () => {
    const out = syncMerge({ 'kennel.v1': { walks: [{ id: 'a' }], care: [], weights: [], notes: [] } }, { 'kennel.v1': { walks: [{ id: 'b' }], care: [{ id: 'c' }] } }) as Record<string, { walks: { id: string }[]; care: { id: string }[] }>;
    expect(out['kennel.v1'].walks.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(out['kennel.v1'].care.map((x) => x.id)).toEqual(['c']);
  });
});

describe('money sync', () => {
  it('keeps transactions and rules from both devices, once each', () => {
    const out = syncMerge({ 'money.v1': { txns: [{ id: 't-1' }, { id: 't-2' }], rules: [] } }, { 'money.v1': { txns: [{ id: 't-2' }, { id: 't-3' }], rules: [{ id: 'r' }] } }) as Record<string, { txns: { id: string }[]; rules: { id: string }[] }>;
    expect(out['money.v1'].txns.map((x) => x.id).sort()).toEqual(['t-1', 't-2', 't-3']);
    expect(out['money.v1'].rules).toHaveLength(1);
  });
});

describe('memories sync', () => {
  it('merges photos and letters, and keeps a deleted photo deleted', () => {
    const out = syncMerge(
      { 'memories.v1': { items: [{ id: 'm-1' }], capsules: [{ id: 'c-1', openedOn: undefined }] }, 'sync.deleted': { 'memories.v1': { 'm-2': '2026-11-20' } } },
      { 'memories.v1': { items: [{ id: 'm-2' }, { id: 'm-3' }], capsules: [{ id: 'c-1', openedOn: '2026-11-21' }] }, 'memories.photo.m-2': 'data:old', 'memories.photo.m-3': 'data:new' },
    ) as Record<string, unknown>;
    const m = out['memories.v1'] as { items: { id: string }[]; capsules: { openedOn?: string }[] };
    expect(m.items.map((x) => x.id).sort()).toEqual(['m-1', 'm-3']);
    expect(m.capsules[0].openedOn).toBe('2026-11-21');
    expect(out['memories.photo.m-2']).toBeUndefined();
    expect(out['memories.photo.m-3']).toBe('data:new');
  });
});

describe('goals sync', () => {
  it('keeps goals and milestones from both devices', () => {
    const out = syncMerge({ 'goals.v1': { goals: [{ id: 'g-1' }], milestones: [] } }, { 'goals.v1': { goals: [{ id: 'g-2' }], milestones: [{ id: 'ms-1' }] } }) as Record<string, { goals: unknown[]; milestones: unknown[] }>;
    expect(out['goals.v1'].goals).toHaveLength(2);
    expect(out['goals.v1'].milestones).toHaveLength(1);
  });
});
