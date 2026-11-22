import { describe, expect, it } from 'vitest';
import { jobClock, movesOn, weekMoves } from './jobLogic';

describe('Job Search HQ', () => {
  it('counts down to March 1', () => {
    expect(jobClock('2026-11-22')).toMatchObject({ left: 99 });
    expect(jobClock('2026-11-22').used).toBeCloseTo(41 / 140, 3);
    expect(jobClock('2026-10-01').used).toBe(0);
    expect(jobClock('2027-03-05')).toMatchObject({ left: -4, used: 1 });
  });
  it('tallies the week’s moves and referral asks', () => {
    const w = weekMoves({ '2026-11-16': { brief: 1, apply: 1 }, '2026-11-17': { referral: 1 }, '2026-11-18': { referral: 1, brief: 0 }, '2026-11-23': { brief: 1 } }, '2026-11-16', '2026-11-18');
    expect(w.days.map((d) => d.n)).toEqual([2, 1, 1, 0, 0, 0, 0]);
    expect(w.referrals).toBe(2);
  });
});

describe('moves on a day', () => {
  it('counts only the four moves, never old minutes', () => {
    expect(movesOn({ '2026-11-22': { work: 300, brief: 1, apply: 1 } }, '2026-11-22')).toBe(2);
    expect(movesOn({ '2026-11-22': { work: 300 } }, '2026-11-22')).toBe(0);
    expect(movesOn({}, '2026-11-22')).toBe(0);
  });
});
