import { describe, expect, it } from 'vitest';
import { describeKennel, kennelPose, kennelWalkMinutes, latestWeight, nextCareFor, sparkPoints, upcomingCare, walkStreak, walkStrip, weekMinutes, weightChange, notesFor } from './logic';
import type { Care, Walk, Weight } from './types';

const W = (date: string, minutes = 30, who: Walk['who'] = 'both'): Walk => ({ id: `${date}-${minutes}-${who}`, date, minutes, who });
const C = (p: Partial<Care>): Care => ({ id: p.id ?? Math.random().toString(36), date: '2026-01-01', who: 'both', kind: 'vaccine', ...p });
const L = (date: string, dog: Weight['dog'], lb: number): Weight => ({ id: `${dog}${date}`, date, dog, lb });

describe('walks', () => {
  const walks = [W('2026-11-20'), W('2026-11-21', 20, 'cooper'), W('2026-11-22', 25), W('2026-11-22', 15, 'shadow'), W('2026-11-18')];

  it('sums walk minutes on a day (a walk with both counts once)', () => {
    expect(kennelWalkMinutes({ walks }, '2026-11-22')).toBe(40);
    expect(kennelWalkMinutes({ walks }, '2026-11-19')).toBe(0);
    expect(kennelWalkMinutes(undefined, '2026-11-22')).toBe(0);
  });

  it('counts the streak, holding from yesterday until today is walked', () => {
    expect(walkStreak(walks, '2026-11-22')).toBe(3);
    expect(walkStreak(walks, '2026-11-23')).toBe(3);
    expect(walkStreak(walks, '2026-11-24')).toBe(0);
    expect(walkStreak(walks, '2026-11-22', 'shadow')).toBe(1);
    expect(walkStreak(walks, '2026-11-22', 'cooper')).toBe(3);
  });

  it('builds a 7-day strip ending today', () => {
    const s = walkStrip(walks, '2026-11-22');
    expect(s).toHaveLength(7);
    expect(s[0].date).toBe('2026-11-16');
    expect(s[6]).toEqual({ date: '2026-11-22', minutes: 40, count: 2 });
  });

  it('totals a week per dog', () => {
    expect(weekMinutes(walks, '2026-11-16')).toBe(30 + 30 + 20 + 25 + 15);
    expect(weekMinutes(walks, '2026-11-16', 'cooper')).toBe(30 + 30 + 20 + 25);
    expect(weekMinutes(walks, '2026-11-23')).toBe(0);
  });
});

describe('care', () => {
  it('lists what comes due within 30 days, overdue flagged, soonest first', () => {
    const care = [
      C({ id: 'a', kind: 'flea', nextDue: '2026-12-10' }),
      C({ id: 'b', kind: 'heartworm', who: 'cooper', nextDue: '2026-11-15' }),
      C({ id: 'c', kind: 'vet', nextDue: '2027-06-01' }),
    ];
    const u = upcomingCare(care, '2026-11-22');
    expect(u.map((d) => d.care.id)).toEqual(['b', 'a']);
    expect(u[0].overdue).toBe(true);
    expect(u[0].days).toBe(-7);
    expect(u[1].days).toBe(18);
  });

  it('a newer record of the same thing settles an older due date', () => {
    const care = [
      C({ id: 'old', title: 'Rabies', date: '2025-11-01', nextDue: '2026-11-01' }),
      C({ id: 'new', title: 'rabies ', date: '2026-11-05', nextDue: '2029-11-05' }),
    ];
    expect(upcomingCare(care, '2026-11-22')).toEqual([]);
    expect(nextCareFor(care, 'cooper', '2026-11-22')?.care.id).toBe('new');
  });

  it('settles per dog: a shot for one dog leaves the other still due', () => {
    const care = [C({ id: 'both', kind: 'flea', date: '2026-10-01', nextDue: '2026-11-01' }), C({ id: 'coop', kind: 'flea', who: 'cooper', date: '2026-11-02', nextDue: '2026-12-02' })];
    expect(nextCareFor(care, 'shadow', '2026-11-22')?.care.id).toBe('both');
    expect(nextCareFor(care, 'cooper', '2026-11-22')?.care.id).toBe('coop');
  });
});

describe('weight', () => {
  const ws = [L('2026-09-01', 'cooper', 78), L('2026-11-01', 'cooper', 80.5), L('2026-10-01', 'cooper', 79), L('2026-11-01', 'shadow', 44)];

  it('finds the latest by date and the change', () => {
    expect(latestWeight(ws, 'cooper')?.lb).toBe(80.5);
    expect(latestWeight(ws, 'shadow')?.lb).toBe(44);
    expect(weightChange(ws, 'cooper')).toBe(1.5);
    expect(weightChange(ws, 'shadow')).toBeNull();
    expect(latestWeight([], 'cooper')).toBeNull();
  });

  it('draws a sparkline in the box, x by date', () => {
    const p = sparkPoints(ws, 'cooper', 100, 20, 0);
    expect(p[0]).toEqual([0, 20]);
    expect(p[2]).toEqual([100, 0]);
    expect(sparkPoints(ws, 'shadow', 100, 20)).toEqual([[50, 10]]);
    expect(sparkPoints([], 'cooper')).toEqual([]);
  });
});

describe('the rest', () => {
  it('picks a pose from the day and the hour', () => {
    expect(kennelPose(true, 14)).toBe('proud');
    expect(kennelPose(false, 14)).toBe('rest');
    expect(kennelPose(true, 23)).toBe('sleep');
  });

  it('filters notes per dog, newest first', () => {
    const n = [{ id: '1', date: '2026-01-01', who: 'cooper' as const, text: 'pancake' }, { id: '2', date: '2026-02-01', who: 'both' as const, text: 'snow' }];
    expect(notesFor(n, 'shadow').map((x) => x.id)).toEqual(['2']);
    expect(notesFor(n).map((x) => x.id)).toEqual(['2', '1']);
  });

  it('describes a backup', () => {
    expect(describeKennel.detail({ walks: [W('2026-01-01'), W('2026-01-02')], care: [C({})] })).toBe('2 walks · 1 care record');
    expect(describeKennel.size({ walks: [W('2026-01-01')], weights: [L('2026-01-01', 'cooper', 1)] })).toBe(2);
    expect(describeKennel.detail(undefined)).toBe('0 walks · 0 care records');
  });
});
