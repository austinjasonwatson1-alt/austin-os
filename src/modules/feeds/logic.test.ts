import { describe, expect, it } from 'vitest';
import { avgSleep, freeWindows, looseNumber, parseHealth, parseIcs, parseShortcutEvents } from './logic';

describe('Apple Health links', () => {
  it('reads numbers the way Shortcuts sends them', () => {
    expect(looseNumber('8,412')).toBe(8412);
    expect(looseNumber('7 hr 24 min')).toBeCloseTo(7.4);
    expect(looseNumber('45 min')).toBe(45);
    expect(looseNumber('')).toBeUndefined();
    expect(looseNumber('abc')).toBeUndefined();
  });
  it('parses a nightly health link', () => {
    expect(parseHealth('steps=8,412&sleep=7.38&workout=35&kind=strength', '2026-11-22')).toEqual({ day: '2026-11-22', steps: 8412, sleep: 7.4, workout: 35, wkind: 'strength' });
    expect(parseHealth('sleep=444&date=2026-11-20', '2026-11-22')).toMatchObject({ day: '2026-11-20', sleep: 7.4 });
    expect(parseHealth('kind=cardio', '2026-11-22')).toBeNull();
  });
  it('averages sleep over the days that have it', () => {
    expect(avgSleep({ a: { sleep: 7 }, b: { sleep: 8 }, c: { steps: 1 } }, ['a', 'b', 'c', 'd'])).toBe(7.5);
    expect(avgSleep({}, ['a'])).toBeNull();
  });
});

describe('calendar', () => {
  it('reads events from a Shortcut', () => {
    const es = parseShortcutEvents('09:00-10:00 Standup\n1:30 pm-2:00 pm Dentist\nall-day Mom’s birthday\nLunch with Dana', '2026-11-23');
    expect(es).toEqual([
      { day: '2026-11-23', start: '09:00', end: '10:00', title: 'Standup' },
      { day: '2026-11-23', start: '13:30', end: '14:00', title: 'Dentist' },
      { day: '2026-11-23', title: 'Mom’s birthday', allDay: true },
      { day: '2026-11-23', title: 'Lunch with Dana', allDay: true },
    ]);
  });
  it('reads an .ics export within a range', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:20261123T090000', 'DTEND:20261123T100000', 'SUMMARY:Standup\\, team', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261125', 'SUMMARY:Thanksgiving prep', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20250101T090000', 'SUMMARY:Old', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(parseIcs(ics, '2026-11-22', '2026-12-31')).toEqual([
      { day: '2026-11-23', start: '09:00', end: '10:00', title: 'Standup, team' },
      { day: '2026-11-25', title: 'Thanksgiving prep', allDay: true },
    ]);
  });
  it('finds the free windows in a day', () => {
    const es = parseShortcutEvents('09:00-12:00 Work\n13:00-17:30 Work\n18:00-19:00 Dinner', '2026-11-23');
    expect(freeWindows(es, '2026-11-23')).toEqual([
      { start: '07:00', end: '09:00', mins: 120 },
      { start: '12:00', end: '13:00', mins: 60 },
      { start: '19:00', end: '22:00', mins: 180 },
    ]);
    expect(freeWindows(es, '2026-11-23', { now: '19:30' })).toEqual([{ start: '19:30', end: '22:00', mins: 150 }]);
  });
});
