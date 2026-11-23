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

describe('the morning brief and the evening close', () => {
  const b = { hour: 8, weekday: 2, writingToday: 0, streak: 3, chapelToday: 0, reviewSealed: false, followUps: 0, contestsIn3Days: [] as string[] };
  it('sends one morning note with the day ahead', () => {
    const [m] = dueReminders({ ...b, jobDaysLeft: 98, movesToday: 1, nextDate: { text: 'Mom’s birthday', in: 11 } });
    expect(m).toEqual({ id: 'morning', path: '/day', title: '98 days to March 1', body: 'The page is waiting · 1 of 4 moves · Mom’s birthday in 11 days' });
    expect(dueReminders({ ...b, jobDaysLeft: 98, interview: { text: 'Toast screen', in: 1 } })[0].body).toBe('The page is waiting · Toast screen in 1 day · 0 of 4 moves');
    expect(dueReminders({ ...b, hour: 12, jobDaysLeft: 98 }).some((r) => r.id === 'morning')).toBe(false);
    expect(dueReminders({ ...b, jobDaysLeft: 98, nextDate: { text: 'Far off', in: 40 } })[0].body).not.toContain('Far off');
  });
  it('guards the whole-life streak at night, then asks to close the day', () => {
    expect(dueReminders({ ...b, hour: 20, writingToday: 30, chapelToday: 5, tendedToday: 0, lifeStreak: 12 }).find((r) => r.id === 'zero')?.title).toBe('Keep the 12-day run alive');
    expect(dueReminders({ ...b, hour: 21, writingToday: 30, chapelToday: 5, tendedToday: 2, dayClosed: false }).map((r) => r.id)).toEqual(['close']);
    expect(dueReminders({ ...b, hour: 21, writingToday: 30, chapelToday: 5, tendedToday: 2, dayClosed: true })).toEqual([]);
    expect(dueReminders({ ...b, hour: 20, tendedToday: 0 }).map((r) => r.id)).toEqual(['zero']);
  });
});
