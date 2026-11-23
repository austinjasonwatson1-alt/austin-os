import { describe, expect, it } from 'vitest';
import { jobClock, movesOn, upcomingInterviews, weekMoves, weekScore } from './jobLogic';

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

describe('the week’s scoreboard', () => {
  it('adds up the counted moves and says how the pace looks', () => {
    const days = { '2026-11-16': { apply: 2, referral: 1 }, '2026-11-17': { apply: 1, followup: 1 }, '2026-11-18': { apply: 3 } };
    const s = weekScore(days, '2026-11-16', '2026-11-18');
    expect(s.map((x) => [x.k, x.n, x.target, x.pace])).toEqual([['apply', 6, 10, 'ahead'], ['followup', 1, 5, 'on'], ['referral', 1, 5, 'on']]);
    const late = weekScore(days, '2026-11-16', '2026-11-22');
    expect(late.find((x) => x.k === 'followup')!.pace).toBe('behind');
    expect(weekScore({}, '2026-11-16', '2026-11-16').every((x) => x.n === 0 && x.pace === 'on')).toBe(true);
  });
});

describe('interviews', () => {
  it('lists the ones ahead, soonest first, with prep done', () => {
    const items = [
      { id: 'a', list: 'interviews', text: 'Toast — PM screen', when: '2026-11-26', checks: ['research', 'stories', 'bogus'] },
      { id: 'b', list: 'interviews', text: 'Past one', when: '2026-11-01' },
      { id: 'c', list: 'interviews', text: 'Stripe — onsite', when: '2026-11-24' },
      { id: 'd', list: 'wins', text: 'Not an interview', when: '2026-11-25' },
    ];
    expect(upcomingInterviews(items, '2026-11-23')).toEqual([
      { id: 'c', text: 'Stripe — onsite', when: '2026-11-24', in: 1, prepped: 0 },
      { id: 'a', text: 'Toast — PM screen', when: '2026-11-26', in: 3, prepped: 2 },
    ]);
  });
});
