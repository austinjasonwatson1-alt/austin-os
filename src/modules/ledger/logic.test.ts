import { describe, expect, it } from 'vitest';
import { currentStreak, dayTotal, gradeOf, mergeDays, monthStats, weekTotal } from './logic';
import { DEFAULT_DATA } from './types';

const T = DEFAULT_DATA.thresholds;

describe('grading', () => {
  it('uses the 180/80/30 thresholds', () => {
    expect(gradeOf(0, T)).toBe('zero');
    expect(gradeOf(29, T)).toBe('bad');
    expect(gradeOf(30, T)).toBe('warn');
    expect(gradeOf(80, T)).toBe('good');
    expect(gradeOf(180, T)).toBe('elite');
  });
});

describe('dayTotal', () => {
  it('sums counted categories and ignores notes', () => {
    expect(dayTotal({ writing: 30, reading: 15, note: 'x' })).toBe(45);
    expect(dayTotal(undefined)).toBe(0);
  });
});

describe('currentStreak', () => {
  const days = {
    '2026-11-16': { writing: 10 },
    '2026-11-17': { reading: 20 },
    '2026-11-18': { editing: 5 },
  };
  it('does not break on an empty today', () => {
    expect(currentStreak(days, '2026-11-19')).toBe(3);
  });
  it('includes today once logged', () => {
    expect(currentStreak({ ...days, '2026-11-19': { writing: 1 } }, '2026-11-19')).toBe(4);
  });
  it('is zero after a gap', () => {
    expect(currentStreak(days, '2026-11-21')).toBe(0);
  });
});

describe('monthStats', () => {
  it('only counts days up to today', () => {
    const days = { '2026-11-01': { writing: 200 }, '2026-11-25': { writing: 999 } };
    const st = monthStats(days, 2026, 10, '2026-11-10', T);
    expect(st.total).toBe(200);
    expect(st.elapsed).toBe(10);
    expect(st.elite).toBe(1);
    expect(st.bestDay).toBe(1);
    expect(st.avg).toBe(20);
  });
});

describe('weekTotal', () => {
  it('sums Monday through Sunday', () => {
    const days = { '2026-11-16': { writing: 10 }, '2026-11-22': { writing: 5 }, '2026-11-23': { writing: 99 } };
    expect(weekTotal(days, '2026-11-16')).toBe(15);
  });
});

describe('mergeDays', () => {
  it('adds new days, upgrades bigger ones, keeps the rest', () => {
    const current = { '2026-01-01': { writing: 30 }, '2026-01-02': { writing: 60 } };
    const incoming = {
      '2026-01-01': { writing: 45 },
      '2026-01-02': { writing: 10 },
      '2026-01-03': { writing: 5 },
      'not-a-date': { writing: 1 },
    };
    const { merged, preview } = mergeDays(current, incoming);
    expect(preview).toEqual({ add: 1, update: 1, keep: 1 });
    expect(merged['2026-01-01']).toEqual({ writing: 45 });
    expect(merged['2026-01-02']).toEqual({ writing: 60 });
    expect(merged['not-a-date']).toBeUndefined();
  });
});
