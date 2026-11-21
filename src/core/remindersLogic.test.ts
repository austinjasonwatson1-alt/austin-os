import { describe, expect, it } from 'vitest';
import { dueReminders } from './remindersLogic';

const base = { hour: 12, weekday: 3, writingToday: 0, streak: 5, chapelToday: 0, reviewSealed: false, followUps: 0, contestsIn3Days: [] as string[] };

describe('reminders', () => {
  it('stays quiet in the day', () => {
    expect(dueReminders(base)).toEqual([]);
  });
  it('speaks up in the evening for the streak and the candle', () => {
    const r = dueReminders({ ...base, hour: 21 });
    expect(r.map((x) => x.id)).toEqual(['streak', 'chapel']);
    expect(r[0].title).toBe('Your 5-day streak ends at midnight');
    expect(dueReminders({ ...base, hour: 21, writingToday: 40, chapelToday: 10 })).toEqual([]);
  });
  it('remembers Sundays, follow-ups and deadlines', () => {
    expect(dueReminders({ ...base, weekday: 0, hour: 18, writingToday: 30, chapelToday: 5, followUps: 2, contestsIn3Days: ['Prize'] }).map((x) => x.id)).toEqual(['review', 'followup', 'contest:Prize']);
  });
});
