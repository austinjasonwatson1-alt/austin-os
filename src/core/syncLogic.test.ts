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
