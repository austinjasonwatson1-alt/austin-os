import { describe, expect, it } from 'vitest';
import { areaHeat, areaMinutes, areaStreak, areaWeek, describeArea } from './logic';

describe('office and observatory', () => {
  const days = { '2026-11-19': { focus: 90, planning: 30 }, '2026-11-20': { focus: 60 } };
  it('keeps their own time', () => {
    expect(areaMinutes(days['2026-11-19'])).toBe(120);
    expect(areaStreak(days, '2026-11-21')).toBe(2);
    expect(areaWeek(days, '2026-11-16').map((d) => d.total)).toEqual([0, 0, 0, 120, 60, 0, 0]);
    expect(areaHeat(120, 240)).toBe(0.5);
    expect(describeArea('The Office').detail({ days, items: [{}] })).toBe('2 days · 3h · 1 items');
  });
});

import { daysTo, money, moneyYear, nextOccurrence } from './logic';

describe('dates and money', () => {
  it('brings birthdays round every year', () => {
    expect(nextOccurrence('1960-12-02', '2026-11-21', true)).toBe('2026-12-02');
    expect(nextOccurrence('1960-03-02', '2026-11-21', true)).toBe('2027-03-02');
    expect(nextOccurrence('2027-04-10', '2026-11-21', false)).toBe('2027-04-10');
    expect(daysTo('2026-12-02', '2026-11-21')).toBe(11);
  });
  it('adds up the writing life money', () => {
    const m = moneyYear([{ list: 'out', amount: 15, date: '2026-03-01' }, { list: 'in', amount: 250, date: '2026-06-01' }, { list: 'out', amount: 800, date: '2025-12-01' }], { out: -1, in: 1 }, 2026);
    expect(m).toEqual({ in: 250, out: 15, net: 235 });
    expect([money(235), money(-12.5)]).toEqual(['$235', '\u2212$12.50']);
  });
});
