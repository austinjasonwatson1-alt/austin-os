import { describe, expect, it } from 'vitest';
import { applyCredit, creditDays, describeTimer, elapsedMs, fmtClock } from './logic';

const at = (s: string) => new Date(s).getTime(); // local time

describe('lamp mode timer', () => {
  it('takes pauses out of the elapsed time', () => {
    const r = { cat: 'writing' as const, startedAt: 0, pausedAt: null, pausedMs: 60_000, goal: 25 };
    expect(elapsedMs(r, 600_000)).toBe(540_000);
    expect(elapsedMs({ ...r, pausedAt: 300_000 }, 900_000)).toBe(240_000);
  });

  it('formats the clock', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(25 * 60_000)).toBe('25:00');
    expect(fmtClock(3_909_000)).toBe('1:05:09');
  });

  it('credits a normal session to its day', () => {
    expect(creditDays(at('2026-11-20T09:00:00'), at('2026-11-20T09:50:00'), 50)).toEqual({ '2026-11-20': 50 });
  });

  it('splits a session across midnight and keeps the total', () => {
    const c = creditDays(at('2026-11-20T23:30:00'), at('2026-11-21T00:30:00'), 60);
    expect(c).toEqual({ '2026-11-20': 30, '2026-11-21': 30 });
    const odd = creditDays(at('2026-11-20T23:50:00'), at('2026-11-21T00:31:00'), 37);
    expect(Object.values(odd).reduce((a, b) => a + b, 0)).toBe(37);
  });

  it('adds credit onto existing Ledger minutes', () => {
    const days = { '2026-11-20': { writing: 30, reading: 10, note: 'x' } };
    expect(applyCredit(days, { '2026-11-20': 25, '2026-11-21': 5 }, 'writing')).toEqual({
      '2026-11-20': { writing: 55, reading: 10, note: 'x' },
      '2026-11-21': { writing: 5 },
    });
    expect(days['2026-11-20'].writing).toBe(30);
  });

  it('describes sessions for restore previews', () => {
    expect(describeTimer.detail({ sessions: [{ minutes: 30 }, { minutes: 60 }] })).toBe('2 sessions · 1.5h');
  });
});
