import { describe, expect, it } from 'vitest';
import { logLink, parseDeepLink } from './deepLink';

describe('deep links', () => {
  it('logs minutes from a link', () => {
    expect(parseDeepLink('/log?m=30&c=writing')).toEqual({ kind: 'log', mins: 30, cat: 'writing' });
    expect(parseDeepLink('/log?m=20&c=craft')).toEqual({ kind: 'log', mins: 20, cat: 'learning' });
    expect(parseDeepLink('/log?m=45')).toEqual({ kind: 'log', mins: 45, cat: 'writing' });
    expect(parseDeepLink('/log?m=15&c=prayer')).toEqual({ kind: 'chapel', mins: 15, what: 'prayer' });
    expect(parseDeepLink('/lamp')).toEqual({ kind: 'lamp' });
  });
  it('refuses bad links and ignores normal routes', () => {
    expect(parseDeepLink('/log?c=writing')).toMatchObject({ kind: 'bad' });
    expect(parseDeepLink('/log?m=30&c=golf')).toMatchObject({ kind: 'bad' });
    expect(parseDeepLink('/cabin')).toBeNull();
    expect(logLink('https://x.io/austin-os/#/home', 30, 'writing')).toBe('https://x.io/austin-os/#/log?m=30&c=writing');
  });
});

describe('health and calendar links', () => {
  it('parses them', () => {
    expect(parseDeepLink('/health?steps=9000&workout=30', '2026-11-22')).toEqual({ kind: 'health', h: { day: '2026-11-22', steps: 9000, sleep: undefined, workout: 30, wkind: 'cardio' } });
    expect(parseDeepLink('/health', '2026-11-22')!.kind).toBe('bad');
    expect(parseDeepLink('/cal?e=' + encodeURIComponent('09:00-10:00 Standup\nall-day Trip'), '2026-11-22')).toEqual({ kind: 'cal', day: '2026-11-22', events: [{ day: '2026-11-22', start: '09:00', end: '10:00', title: 'Standup' }, { day: '2026-11-22', title: 'Trip', allDay: true }] });
  });
});
