import { describe, expect, it } from 'vitest';
import { logLink, moveLink, parseDeepLink, togetherLink, walkLink } from './deepLink';

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

describe('idea links', () => {
  it('carry the idea text', () => {
    expect(parseDeepLink('/idea?t=' + encodeURIComponent('short: The Lighthouse Wife'), '2026-11-22')).toEqual({ kind: 'idea', text: 'short: The Lighthouse Wife' });
    expect(parseDeepLink('/idea?t=', '2026-11-22')!.kind).toBe('bad');
  });
});

describe('job moves, dog walks and time together', () => {
  it('reads the new one-tap links', () => {
    expect(parseDeepLink('/move?k=apply')).toEqual({ kind: 'move', move: 'apply', n: 1 });
    expect(parseDeepLink('/move?k=Follow-up&n=3')).toEqual({ kind: 'move', move: 'followup', n: 3 });
    expect(parseDeepLink('/move?k=dance')?.kind).toBe('bad');
    expect(parseDeepLink('/move?k=referral&n=900')).toEqual({ kind: 'move', move: 'referral', n: 1 });
    expect(parseDeepLink('/walk?m=30')).toEqual({ kind: 'walk', mins: 30, who: 'both' });
    expect(parseDeepLink('/walk?m=20&who=Cooper')).toEqual({ kind: 'walk', mins: 20, who: 'cooper' });
    expect(parseDeepLink('/walk')?.kind).toBe('bad');
    expect(parseDeepLink('/together?m=60')).toEqual({ kind: 'together', mins: 60 });
    expect(parseDeepLink('/scene?t=interrogation%3A%20Gone%20Girl%20p.%20212')).toEqual({ kind: 'scene', text: 'interrogation: Gone Girl p. 212' });
    expect(parseDeepLink('/scene')?.kind).toBe('bad');
    expect(moveLink('https://x.io/app/#/settings', 'apply')).toBe('https://x.io/app/#/move?k=apply');
    expect(walkLink('https://x.io/', 30)).toBe('https://x.io/#/walk?m=30&who=both');
    expect(togetherLink('https://x.io/', 60)).toBe('https://x.io/#/together?m=60');
  });
});
