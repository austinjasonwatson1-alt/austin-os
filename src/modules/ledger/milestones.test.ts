import { describe, expect, it } from 'vitest';
import { earned, milestones } from './milestones';
import type { DayMap } from './types';

const T = { elite: 180, good: 80, warn: 30 };
const W = { elite: 700, good: 450, warn: 250 };

describe('milestones', () => {
  it('earns nothing from an empty ledger', () => {
    expect(milestones({}, T, W).every((m) => m.earnedOn === null)).toBe(true);
  });

  it('notes the day each one was reached', () => {
    // 8 straight days of 100 min from Mon Nov 2 (800 min in the first week → elite week on Sun)
    const days: DayMap = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`2026-11-${String(i + 2).padStart(2, '0')}`, { writing: 100 }]));
    days['2026-11-04'] = { writing: 200, querying: 10 };
    const m = milestones(days, T, W);
    const on = (id: string) => m.find((x) => x.id === id)?.earnedOn;
    expect(on('first-light')).toBe('2026-11-02');
    expect(on('north-star')).toBe('2026-11-04');
    expect(on('letter')).toBe('2026-11-04');
    expect(on('lantern')).toBe('2026-11-06');
    expect(on('seven')).toBe('2026-11-08');
    expect(on('long-week')).toBe('2026-11-07');
    expect(on('hearth')).toBeNull();
    expect(earned(m, 'seven')).toBe(true);
    expect(earned(m, 'thirty')).toBe(false);
  });
});
