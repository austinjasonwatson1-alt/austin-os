import { describe, expect, it } from 'vitest';
import {
  carried, dayT, daysLeftInQuarter, defaultBy, describeGoals, goalProgress, groupByArea, lanternTs, nextQuarter, planningSeason,
  prevQuarter, quarterLabel, quarterOf, quarterRange, quarterSpans, roadLine, signpostSlots, roadOutline, roadPoint, ROAD, seasonProgress, seasonReview, YEAR_SPAN,
} from './logic';
import type { Goal, Milestone } from './types';

const G = (p: Partial<Goal> & { id: string }): Goal => ({ area: 'writing', horizon: '1y', title: p.id, by: '2026-12-31', ...p });
const M = (p: Partial<Milestone> & { id: string }): Milestone => ({ goal: 'g1', quarter: '2026-Q4', title: p.id, ...p });

describe('quarters', () => {
  it('finds the quarter of a day', () => {
    expect(quarterOf('2026-01-01')).toBe('2026-Q1');
    expect(quarterOf('2026-03-31')).toBe('2026-Q1');
    expect(quarterOf('2026-04-01')).toBe('2026-Q2');
    expect(quarterOf('2026-11-22')).toBe('2026-Q4');
  });

  it('gives the first and last day of a quarter', () => {
    expect(quarterRange('2026-Q1')).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(quarterRange('2028-Q1')).toEqual({ start: '2028-01-01', end: '2028-03-31' });
    expect(quarterRange('2026-Q3')).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(quarterRange('2026-Q4')).toEqual({ start: '2026-10-01', end: '2026-12-31' });
  });

  it('steps across years', () => {
    expect(nextQuarter('2026-Q4')).toBe('2027-Q1');
    expect(nextQuarter('2026-Q2')).toBe('2026-Q3');
    expect(prevQuarter('2027-Q1')).toBe('2026-Q4');
  });

  it('counts the days left', () => {
    expect(daysLeftInQuarter('2026-11-22')).toBe(39);
    expect(daysLeftInQuarter('2026-12-31')).toBe(0);
    expect(daysLeftInQuarter('2026-03-01')).toBe(30);
  });

  it('opens planning in the last two weeks', () => {
    expect(planningSeason('2026-11-22')).toBe(false);
    expect(planningSeason('2026-12-18')).toBe(true);
    expect(planningSeason('2026-12-17')).toBe(false);
  });

  it('labels quarters briefly in the current year', () => {
    expect(quarterLabel('2026-Q4', 2026)).toBe('Q4');
    expect(quarterLabel('2027-Q1', 2026)).toBe('Q1 2027');
  });

  it('defaults a target to the end of the horizon', () => {
    expect(defaultBy('1y', '2026-11-22')).toBe('2027-12-31');
    expect(defaultBy('1y', '2026-01-01')).toBe('2026-12-31');
    expect(defaultBy('3y', '2026-11-22')).toBe('2029-12-31');
    expect(defaultBy('10y', '2026-11-22')).toBe('2036-12-31');
  });
});

describe('progress', () => {
  const goals = [G({ id: 'v', horizon: '10y' }), G({ id: 'g3', horizon: '3y', parent: 'v' }), G({ id: 'g1', parent: 'g3' }), G({ id: 'g2', area: 'faith' })];
  const ms = [
    M({ id: 'a', done: '2026-11-01' }), M({ id: 'b' }), M({ id: 'c', dropped: '2026-11-02' }),
    M({ id: 'd', goal: 'g2', done: '2026-10-05' }), M({ id: 'e', goal: 'g3', quarter: '2026-Q3' }),
  ];

  it('counts a goal and everything beneath it, ignoring let-go milestones', () => {
    expect(goalProgress(goals, ms, 'g1')).toEqual({ done: 1, total: 2, pct: 0.5 });
    expect(goalProgress(goals, ms, 'v')).toMatchObject({ done: 1, total: 3 });
    expect(goalProgress(goals, [], 'v')).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('measures the season', () => {
    expect(seasonProgress(ms, '2026-11-22')).toEqual({ quarter: '2026-Q4', done: 2, total: 3, daysLeft: 39 });
  });

  it('groups by area in homestead order', () => {
    const g = groupByArea(goals, ms.filter((m) => m.quarter === '2026-Q4'));
    expect(g.map((x) => x.area)).toEqual(['writing', 'faith']);
    expect(g[0].items.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('the season review', () => {
  const goals = [G({ id: 'g1' }), G({ id: 'g2', area: 'body' }), G({ id: 'g3', area: 'money' }), G({ id: 'g4', done: '2026-06-01' }), G({ id: 'big', horizon: '3y' })];
  const ms = [
    M({ id: 'a', done: '2026-11-01' }), M({ id: 'b', carriedFrom: '2026-Q3' }), M({ id: 'c', goal: 'g2' }),
    M({ id: 'old', goal: 'g2', quarter: '2026-Q2' }), M({ id: 'gone', goal: 'g3', dropped: '2026-10-01' }),
  ];
  const r = seasonReview(goals, ms, '2026-Q4');

  it('counts done and open per area', () => {
    expect(r.byArea).toEqual([{ area: 'writing', done: 1, open: 1 }, { area: 'body', done: 0, open: 1 }]);
    expect(r.done).toBe(1);
    expect(r.open.map((m) => m.id)).toEqual(['b', 'c']);
  });

  it('finds carried-over and left-behind milestones', () => {
    expect(r.carried.map((m) => m.id)).toEqual(['b']);
    expect(r.behind.map((m) => m.id)).toEqual(['old']);
  });

  it('lists open 1-year goals with nothing planned this quarter', () => {
    expect(r.unplanned.map((g) => g.id)).toEqual(['g3']);
  });

  it('carries a milestone forward, remembering where it began', () => {
    expect(carried(M({ id: 'x' }))).toMatchObject({ quarter: '2027-Q1', carriedFrom: '2026-Q4' });
    expect(carried(M({ id: 'x', quarter: '2027-Q1', carriedFrom: '2026-Q3' }))).toMatchObject({ quarter: '2027-Q2', carriedFrom: '2026-Q3' });
    expect(carried(M({ id: 'x', quarter: '2026-Q2' }), '2027-Q1')).toMatchObject({ quarter: '2027-Q1', carriedFrom: '2026-Q2' });
  });
});

describe('the road', () => {
  it('runs from your feet to the horizon, narrowing', () => {
    const near = roadPoint(0), far = roadPoint(1);
    expect(near.y).toBe(ROAD.bottom);
    expect(far.y).toBe(ROAD.horizon);
    expect(far.x).toBe(ROAD.cx);
    expect(near.w).toBeGreaterThan(far.w);
    let y = Infinity;
    for (let i = 0; i <= 20; i++) { const p = roadPoint(i / 20); expect(p.y).toBeLessThanOrEqual(y); y = p.y; }
    expect(roadPoint(-1)).toEqual(near);
  });

  it('stays inside the picture', () => {
    for (let i = 0; i <= 50; i++) {
      const p = roadPoint(i / 50);
      expect(p.x - p.w).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(ROAD.W);
    }
  });

  it('draws paths', () => {
    expect(roadOutline(10)).toMatch(/^M[\d.]+,[\d.]+ L.* Z$/);
    expect(roadLine(0, 0.5).startsWith('M')).toBe(true);
  });

  it('gives the current quarter extra road', () => {
    const s = quarterSpans(2026, '2026-Q4');
    expect(s.map((x) => x.quarter)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
    expect(s[0].t0).toBe(0);
    expect(s[3].t1).toBeCloseTo(YEAR_SPAN);
    expect(s[3].t1 - s[3].t0).toBeGreaterThan(s[0].t1 - s[0].t0);
    for (let i = 1; i < 4; i++) expect(s[i].t0).toBe(s[i - 1].t1);
    const even = quarterSpans(2026);
    expect(even[1].t1 - even[1].t0).toBeCloseTo(YEAR_SPAN / 4);
  });

  it('spaces lanterns inside their quarter', () => {
    expect(lanternTs(3, { t0: 0, t1: 0.4 })).toEqual([0.1, 0.2, 0.3]);
    expect(lanternTs(0, { t0: 0, t1: 1 })).toEqual([]);
  });

  it('places days on the road', () => {
    const s = quarterSpans(2026, '2026-Q4');
    expect(dayT('2026-01-01', s)).toBe(0);
    expect(dayT('2025-06-01', s)).toBe(0);
    const mid = dayT('2026-11-15', s);
    expect(mid).toBeGreaterThan(s[3].t0);
    expect(mid).toBeLessThan(s[3].t1);
    expect(dayT('2027-06-30', s)).toBeGreaterThan(YEAR_SPAN);
    expect(dayT('2040-01-01', s)).toBeLessThanOrEqual(0.93);
  });
});

describe('signposts', () => {
  it('alternates sides in road order and lifts boards that would collide', () => {
    const s = signpostSlots([{ id: 'c', t: 0.8 }, { id: 'a', t: 0.1 }, { id: 'b', t: 0.5 }, { id: 'd', t: 0.81 }]);
    expect(s.map((x) => [x.id, x.side])).toEqual([['a', -1], ['b', 1], ['c', -1], ['d', 1]]);
    expect(s.every((x) => x.lift === 0)).toBe(true);
    const close = signpostSlots([{ id: 'a', t: 0.8 }, { id: 'b', t: 0.6 }, { id: 'x', t: 0.802 }, { id: 'c', t: 0.805 }]);
    expect(close.find((x) => x.id === 'c')!.lift).toBeGreaterThan(0);
    expect(close.find((x) => x.id === 'b')!.lift).toBe(0);
  });
});

describe('restore preview', () => {
  it('describes goals and milestones', () => {
    expect(describeGoals.detail({ goals: [G({ id: 'a' })], milestones: [M({ id: 'x' }), M({ id: 'y' })] })).toBe('1 goal · 2 milestones');
    expect(describeGoals.size({ goals: [G({ id: 'a' })], milestones: [M({ id: 'x' })] })).toBe(2);
    expect(describeGoals.detail({})).toBe('0 goals · 0 milestones');
  });
});
