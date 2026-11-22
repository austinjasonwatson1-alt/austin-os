import { describe, expect, it } from 'vitest';
import { setupProgress, setupSteps, type SetupState } from './setupLogic';

const now = Date.parse('2026-11-22T12:00:00Z');
const base: SetupState = { backupFile: false, cloud: false, keeper: false, weather: false, sound: false, reminders: false, healthAt: null, calendarAt: null, ideaLinkAt: null, installed: false, now };

describe('setup checklist', () => {
  it('starts with everything to do, essentials first', () => {
    const s = setupSteps(base);
    expect(setupProgress(s)).toEqual({ done: 0, total: 10, essentialsLeft: 3 });
    expect(s.slice(0, 3).every((x) => x.essential)).toBe(true);
  });
  it('counts a Shortcut only while it keeps delivering', () => {
    const s = setupSteps({ ...base, backupFile: true, healthAt: '2026-11-21T22:00:00Z', calendarAt: '2026-11-10T06:30:00Z', ideaLinkAt: '2026-10-01T00:00:00Z' });
    const by = Object.fromEntries(s.map((x) => [x.id, x.done]));
    expect(by).toMatchObject({ backup: true, health: true, calendar: false, idea: true });
    expect(setupProgress(s).essentialsLeft).toBe(2);
  });
});
