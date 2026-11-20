import { describe, expect, it } from 'vitest';
import { candleHeat, carried, chapelMinutes, chapelStreak, chapelWeek, describeChapel, sortPrayers } from './logic';

describe('the chapel', () => {
  const days = { '2026-11-17': { prayer: 10 }, '2026-11-18': { scripture: 15 }, '2026-11-19': { prayer: 5, scripture: 10 } };

  it('counts its own minutes and streak, separate from writing', () => {
    expect(chapelMinutes(days['2026-11-19'])).toBe(15);
    expect(chapelStreak(days, '2026-11-20')).toBe(3);
    expect(chapelStreak(days, '2026-11-22')).toBe(0);
    expect(chapelWeek(days, '2026-11-16').map((d) => d.mins)).toEqual([0, 10, 15, 15, 0, 0, 0]);
    expect([candleHeat(0), candleHeat(15), candleHeat(60)]).toEqual([0, 0.5, 1]);
  });

  it('keeps open and answered prayers apart, and how long each was carried', () => {
    const ps = [
      { id: 'a', text: 'Job', added: '2026-09-01', answeredOn: '2026-10-13', answer: 'The offer came' },
      { id: 'b', text: 'Mom', added: '2026-11-01' },
      { id: 'c', text: 'Book', added: '2026-11-10' },
    ];
    const s = sortPrayers(ps);
    expect(s.open.map((p) => p.id)).toEqual(['c', 'b']);
    expect(s.answered.map((p) => p.id)).toEqual(['a']);
    expect(carried(ps[0])).toBe('6 weeks');
    expect(carried({ id: 'x', text: '', added: '2026-11-01', answeredOn: '2026-11-04' })).toBe('3 days');
    expect(carried(ps[1])).toBeNull();
  });

  it('describes itself for restore previews', () => {
    expect(describeChapel.detail({ days, prayers: [{ answeredOn: 'x' }, {}], verses: [{}] })).toBe('3 days · 2 prayers (1 answered) · 1 verses');
  });
});
