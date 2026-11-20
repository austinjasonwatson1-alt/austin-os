import { describe, expect, it } from 'vitest';
import { compareDays, describeLedger, currentStreak, dayTotal, gradeOf, mergeDays, monthStats, parseCsvRows, parseLedgerCsv, weekTotal } from './logic';
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

describe('mergeDays notes', () => {
  it('keeps an existing note when a bigger day without one replaces it', () => {
    const { merged } = mergeDays({ '2026-01-01': { writing: 10, note: 'keep me' } }, { '2026-01-01': { writing: 20 } });
    expect(merged['2026-01-01']).toEqual({ writing: 20, note: 'keep me' });
  });
});

describe('parseCsvRows', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    expect(parseCsvRows('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  });
});

describe('parseLedgerCsv', () => {
  const OLD = [
    'Date,Writing,Editing,Reading,Research,Craft,Querying,Prayer,AI research,PM work,Counted total,Note',
    '2026-02-25,0,0,20,5,0,0,0,0,240,25,',
    '2026-03-30,32,30,45,5,20,0,0,0,20,132,Edited at night',
    '2026-05-10,0,0,0,0,0,0,0,0,0,0,',
    '2026-05-11,1,0,0,0,0,0,0,0,0,9,typo total',
  ].join('\n');

  it('reads the old Ledger export, dropping prayer/AI/PM and empty days', () => {
    const r = parseLedgerCsv(OLD)!;
    expect(r.rows).toBe(4);
    expect(r.days['2026-02-25']).toEqual({ reading: 20, research: 5 });
    expect(r.days['2026-03-30']).toEqual({ writing: 32, editing: 30, reading: 45, research: 5, learning: 20, note: 'Edited at night' });
    expect(r.days['2026-05-10']).toBeUndefined();
    expect(r.minutes).toBe(25 + 132 + 1);
  });

  it('flags rows whose counted total disagrees', () => {
    expect(parseLedgerCsv(OLD)!.badTotals).toEqual(['2026-05-11']);
  });

  it("reads this app's own export and rejects other CSVs", () => {
    const own = 'Date,Writing,Editing,Reading,Research,Craft,Querying,Total,Note\n2026-11-19,0,0,15,0,0,0,15,';
    expect(parseLedgerCsv(own)!.days).toEqual({ '2026-11-19': { reading: 15 } });
    expect(parseLedgerCsv('name,email\nx,y')).toBeNull();
  });
});

describe('compareDays', () => {
  it('describes what a restore would change', () => {
    const now = { '2026-01-01': { writing: 10 }, '2026-01-02': { writing: 20 }, '2026-01-03': { reading: 5 } };
    const snap = { '2026-01-01': { writing: 10 }, '2026-01-02': { writing: 25 }, '2025-12-31': { editing: 30 } };
    expect(compareDays(now, snap)).toEqual({ back: 1, gone: 1, changed: 1, minutes: 30 });
  });
});

describe('describeLedger', () => {
  it('summarises days, time and deadlines, and sizes by days', () => {
    const v = { days: { '2026-01-01': { writing: 90 }, '2026-01-02': { reading: 30 } }, deadlines: [{ n: 'x', d: '2026-12-31' }] };
    expect(describeLedger.detail(v)).toBe('2 days · 2h · 1 deadline');
    expect(describeLedger.size(v)).toBe(2);
    expect(describeLedger.size(undefined)).toBe(0);
  });
});

import { catMix, lampHeat, longestStreak, nextDeadline, nextMark, recentWeeks, weekDays } from './logic';

describe('home dashboard', () => {
  const T = { elite: 180, good: 80, warn: 30 };
  const D = {
    '2026-11-16': { writing: 90 },
    '2026-11-17': { reading: 20, research: 15 },
    '2026-11-18': { writing: 200 },
    '2026-11-10': { editing: 40 },
    '2026-11-03': { writing: 10 },
    '2026-11-04': { writing: 10 },
  };

  it('grades the week and marks future days', () => {
    const w = weekDays(D, '2026-11-16', '2026-11-18', T);
    expect(w.map((d) => d.grade)).toEqual(['good', 'warn', 'elite', 'zero', 'zero', 'zero', 'zero']);
    expect(w.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
  });

  it('totals recent weeks oldest first', () => {
    expect(recentWeeks(D, '2026-11-18', 3)).toEqual([
      { monday: '2026-11-02', mins: 20 },
      { monday: '2026-11-09', mins: 40 },
      { monday: '2026-11-16', mins: 325 },
    ]);
  });

  it('finds the longest run, across month and year edges', () => {
    expect(longestStreak(D)).toBe(3);
    expect(longestStreak({ '2025-12-31': { writing: 5 }, '2026-01-01': { writing: 5 } })).toBe(2);
    expect(longestStreak({})).toBe(0);
  });

  it('mixes categories biggest first and drops empty ones', () => {
    expect(catMix(D, '2026-11-18', 3)).toEqual([
      { k: 'writing', mins: 290 },
      { k: 'reading', mins: 20 },
      { k: 'research', mins: 15 },
    ]);
  });

  it('names the next mark and the lamp heat', () => {
    expect(nextMark(0, T)).toEqual({ grade: 'warn', need: 30 });
    expect(nextMark(50, T)).toEqual({ grade: 'good', need: 30 });
    expect(nextMark(180, T)).toBeNull();
    expect(lampHeat(90, T)).toBe(0.5);
    expect(lampHeat(400, T)).toBe(1);
  });

  it('picks the soonest upcoming deadline', () => {
    const dl = [{ n: 'Old', d: '2026-01-01' }, { n: 'Late', d: '2027-03-01' }, { n: 'Query-ready', d: '2026-12-31' }];
    expect(nextDeadline(dl, '2026-11-19')).toEqual({ n: 'Query-ready', d: '2026-12-31', left: 42 });
    expect(nextDeadline([], '2026-11-19')).toBeNull();
  });
});

import { lampLine } from './logic';

describe('lampLine', () => {
  const T = { elite: 180, good: 80, warn: 30 };
  it('speaks to where today stands', () => {
    expect(lampLine(0, T, 12)).toBe('The lamp is cold. 30m keeps a 12-day streak alive.');
    expect(lampLine(0, T, 0)).toBe('The lamp is cold. 30m lights it.');
    expect(lampLine(10, T, 3)).toBe('20m more to a warning line.');
    expect(lampLine(100, T, 3)).toBe('80m more to a elite day.'.replace('a elite', 'an elite'));
    expect(lampLine(200, T, 3)).toMatch(/^Elite day/);
  });
});

import { galaxyPoint } from './logic';

describe('galaxyPoint', () => {
  it('winds the year outward from the core and stays in bounds', () => {
    const r = (i: number) => Math.hypot(galaxyPoint(i, 365).x, galaxyPoint(i, 365).y);
    expect(r(0)).toBeLessThan(0.15);
    expect(r(364)).toBeGreaterThan(0.9);
    for (let i = 0; i < 365; i += 7) expect(r(i)).toBeLessThanOrEqual(1);
    expect(r(200)).toBeGreaterThan(r(100));
  });
});

import { monthDays } from './logic';

describe('monthDays', () => {
  it('lists every day of the month, future days as null', () => {
    const d = monthDays({ '2026-11-02': { writing: 40 } }, 2026, 10, '2026-11-03');
    expect(d.length).toBe(30);
    expect(d.slice(0, 4)).toEqual([0, 40, 0, null]);
  });
});
