import { describe, expect, it } from 'vitest';
import { dayPoints, describeLounge, earnedBetween, earnings, progressTo, spent, streakBonus } from './logic';
import { DEFAULT_RATES as R } from './types';

const T = { elite: 180, good: 80, warn: 30 };
const W = { elite: 700, good: 450, warn: 250 };

describe('points', () => {
  it('pays 1 per 10 minutes plus a day bonus', () => {
    expect(dayPoints(0, T, R)).toBe(0);
    expect(dayPoints(45, T, R)).toBe(4);
    expect(dayPoints(90, T, R)).toBe(9 + 5);
    expect(dayPoints(200, T, R)).toBe(20 + 15);
  });

  it('pays streak milestones at 7, 30 and every 100', () => {
    expect([6, 7, 8, 30, 99, 100, 200].map((n) => streakBonus(n, R))).toEqual([0, 25, 0, 100, 0, 300, 300]);
  });

  it('adds it all up, with week bonuses and a streak', () => {
    // Mon 2026-11-02 .. Sun 2026-11-08: 7 straight days of 100m = 700m, an elite week and a 7-day streak
    const days = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-11-0${i + 2}`, { writing: 100 }]));
    const e = earnings(days, T, W, R, null);
    expect(e.minutes).toBe(70);
    expect(e.days).toBe(35);
    expect(e.weeks).toBe(50);
    expect(e.streaks).toBe(25);
    expect(e.total).toBe(180);
    expect(e.byDay['2026-11-08']).toBe(10 + 5 + 25);
    expect(e.byWeek['2026-11-02']).toBe(50);
  });

  it('only counts days from the start date', () => {
    const days = { '2026-10-01': { writing: 100 }, '2026-11-01': { writing: 20 } };
    expect(earnings(days, T, W, R, '2026-10-15').total).toBe(2);
  });

  it('counts a range, spending and progress', () => {
    const days = { '2026-11-16': { writing: 50 }, '2026-11-18': { writing: 30 } };
    const e = earnings(days, T, W, R, null);
    expect(earnedBetween(e, '2026-11-17', '2026-11-18')).toBe(3);
    expect(spent([{ id: 'a', rewardId: 'x', name: 'x', glyph: '', cost: 150, claimedAt: '' }, { id: 'b', rewardId: 'y', name: 'y', glyph: '', cost: 50, claimedAt: '' }])).toBe(200);
    expect(progressTo(75, 300)).toBe(0.25);
    expect(progressTo(900, 300)).toBe(1);
  });

  it('describes itself for restore previews', () => {
    expect(describeLounge.detail({ rewards: [1, 2], claims: [1] })).toBe('2 rewards · 1 claimed');
  });
});
