import { describe, expect, it } from 'vitest';
import { anniversary, bedtime, daylight, greyness, growth, tricks } from './worldLogic';

describe('the living homestead', () => {
  it('grows with the hours and the streak', () => {
    expect(growth(21740, 7, false)).toEqual({ flowers: 2, saplings: 7, lighthouse: false, hoursToLighthouse: 638, publishingHouse: false });
    expect(growth(60_000, 100, true)).toMatchObject({ flowers: 12, saplings: 10, lighthouse: true, publishingHouse: true });
  });
  it('remembers the anniversary', () => {
    expect(anniversary('2025-11-21', '2026-11-21')).toBe(1);
    expect(anniversary('2026-11-21', '2026-11-21')).toBeNull();
    expect(anniversary('2025-11-20', '2026-11-21')).toBeNull();
    expect(anniversary(null, '2026-11-21')).toBeNull();
  });
  it('lets the dogs age and learn', () => {
    expect(greyness('2026-01-01', '2026-01-01')).toBe(0);
    expect(greyness('2018-01-01', '2026-06-01')).toBe(1);
    expect(tricks((id) => ['hundred', 'thirty'].includes(id))).toEqual(['shake', 'roll']);
  });
  it('knows bedtime and daylight', () => {
    expect([bedtime(new Date('2026-11-21T23:30:00')), bedtime(new Date('2026-11-21T21:00:00'))]).toEqual([true, false]);
    expect(daylight('day').wall).toBeGreaterThan(daylight('night').wall);
  });
});
