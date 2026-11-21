import { describe, expect, it } from 'vitest';
import { daysOut, describePub, dueSoon, queryStats, road, upcomingContests } from './logic';
import { DEFAULT_PUB, type Query } from './types';

const Q = (p: Partial<Query>): Query => ({ id: Math.random().toString(), agent: 'A', status: 'queried', ...p });

describe('road to publication', () => {
  const queries = [
    Q({ sentOn: '2026-09-01' }), Q({ sentOn: '2026-11-01', status: 'partial' }), Q({ sentOn: '2026-10-01', status: 'pass' }),
    Q({ sentOn: '2026-10-20', status: 'full' }), Q({ status: 'researching' }),
  ];

  it('tracks the querying', () => {
    const s = queryStats(queries, '2026-11-21');
    expect([s.sent, s.requests, s.rate, s.passes, s.offers, s.waiting]).toEqual([4, 2, 50, 1, 0, 1]);
    expect(s.followUps).toHaveLength(1);
    expect(daysOut(queries[0], '2026-11-21')).toBe(81);
  });

  it('lists what is due soon', () => {
    const p = { ...DEFAULT_PUB, queries: [Q({ agent: 'Jo', sentOn: '2026-09-30' })], contests: [
      { id: 'c', name: 'Short Story Prize', deadline: '2026-11-28', status: 'considering' as const },
      { id: 'd', name: 'Later', deadline: '2027-03-01', status: 'considering' as const },
      { id: 'e', name: 'Entered', deadline: '2026-11-25', status: 'entered' as const },
    ] };
    expect(dueSoon(p, '2026-11-21').map((x) => [x.kind, x.title, x.left])).toEqual([['contest', 'Short Story Prize', 7], ['follow-up', 'Jo', 4]].sort((a, b) => (a[2] as number) - (b[2] as number)));
    expect(upcomingContests(p.contests, '2026-11-21').map((c) => c.name)).toEqual(['Short Story Prize', 'Later']);
  });

  it('reads the road from the rest of the cabin', () => {
    const ms = { id: 'm', title: 'T', target: 1000, history: {}, chapters: [{ id: '1', title: '', words: 950, status: 'done' as const }] };
    const r = road({ ...DEFAULT_PUB, queries }, ms);
    expect(r.filter((s) => s.done).map((s) => s.id)).toEqual(['words', 'draft', 'revised', 'queries', 'request']);
    expect(road({ ...DEFAULT_PUB, road: { signed: '2027-05-01' } }, undefined).find((s) => s.id === 'deal')!.done).toBe(true);
  });

  it('describes itself', () => {
    expect(describePub.detail({ queries: [1], contests: [], feedback: [1, 2], outreach: [] })).toBe('1 queries · 0 contests · 2 notes · 0 contacts');
  });
});
