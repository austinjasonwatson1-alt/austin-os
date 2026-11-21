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
