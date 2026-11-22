import { describe, expect, it } from 'vitest';
import { carryOver, closeable, dayScore, daysLabel, describeDay, habitChain, habitsFor, historyStrip, mergeDayData, nextState, phase, scheduledOn, setIntentions, unusedStarters, withCarried } from './logic';
import { STARTERS, type DayEntry, type Habit } from './types';

const H = (p: Partial<Habit> = {}): Habit => ({ id: 'h1', name: 'Walk', days: [], createdAt: '2026-11-01', ...p });
const E = (p: Partial<DayEntry> = {}): DayEntry => ({ intentions: [], done: [], ...p });

describe('habits', () => {
  it('is scheduled on its weekdays, never before it existed', () => {
    // 2026-11-16 is a Monday
    expect(scheduledOn(H(), '2026-11-16')).toBe(true);
    expect(scheduledOn(H({ days: [1, 3, 5] }), '2026-11-16')).toBe(true);
    expect(scheduledOn(H({ days: [1, 3, 5] }), '2026-11-17')).toBe(false);
    expect(scheduledOn(H({ createdAt: '2026-11-20' }), '2026-11-16')).toBe(false);
    // a full timestamp is read as its local day
    expect(scheduledOn(H({ createdAt: new Date(2026, 10, 18, 23, 30).toISOString() }), '2026-11-18')).toBe(true);
  });

  it('counts the chain of scheduled days, skipping days off', () => {
    const h = H({ days: [1, 3, 5] }); // Mon, Wed, Fri
    const days = { '2026-11-02': E({ done: ['h1'] }), '2026-11-04': E({ done: ['h1'] }), '2026-11-06': E({ done: ['h1'] }),
      // Mon 9 missed
      '2026-11-11': E({ done: ['h1'] }), '2026-11-13': E({ done: ['h1'] }), '2026-11-16': E({ done: ['h1'] }) };
    const c = habitChain(h, days, '2026-11-17'); // Tuesday, a day off
    expect(c.current).toBe(3);
    expect(c.best).toBe(3);
    expect(c.last14).toHaveLength(14);
    expect(c.last14[13]).toBe('off');
    expect(c.last14[12]).toBe('done');
    expect(c.last14.filter((x) => x === 'missed')).toHaveLength(1);
  });

  it("doesn't break the chain for today until the day is over", () => {
    const days = { '2026-11-20': E({ done: ['h1'] }), '2026-11-21': E({ done: ['h1'] }) };
    const c = habitChain(H({ createdAt: '2026-11-20' }), days, '2026-11-22');
    expect(c.current).toBe(2);
    expect(c.last14[13]).toBe('today');
    expect(c.last14.slice(0, 11).every((x) => x === 'off')).toBe(true);
  });

  it('remembers the best run after a miss, and counts checks from before creation', () => {
    const days: Record<string, DayEntry> = {};
    for (const d of ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-02']) days[d] = E({ done: ['h1'] });
    const c = habitChain(H(), days, '2026-11-02');
    expect(c.best).toBe(4);
    expect(c.current).toBe(1);
  });

  it("shows today's habits, keeping archived ones out", () => {
    const hs = [H(), H({ id: 'h2', archived: true }), H({ id: 'h3', days: [2] })];
    expect(habitsFor(hs, E(), '2026-11-16').map((h) => h.id)).toEqual(['h1']);
    expect(habitsFor(hs, E({ done: ['h3'] }), '2026-11-16').map((h) => h.id)).toEqual(['h1', 'h3']);
  });

  it('labels weekdays and hides starters already added', () => {
    expect(daysLabel([])).toBe('Every day');
    expect(daysLabel([5, 1, 2, 3, 4])).toBe('Weekdays');
    expect(daysLabel([1, 3])).toBe('Mon, Wed');
    expect(unusedStarters(STARTERS, [H({ name: 'scripture reading' })]).map((s) => s.name)).not.toContain('Scripture reading');
  });
});

describe('intentions and the close', () => {
  const day = E({ intentions: [
    { area: 'writing', text: 'Finish chapter 7', state: 'kept' },
    { area: 'family', text: 'Call Mom', state: 'partly' },
    { area: 'body', text: 'Gym', state: 'not' },
    { area: 'faith', text: 'Psalm 23' },
  ] });

  it('scores the day: kept 1, partly ½', () => {
    expect(dayScore(day)).toBeCloseTo(1.5 / 4);
    expect(dayScore(E())).toBeNull();
  });

  it('carries what was not kept, unmarked, without overwriting tomorrow', () => {
    const c = carryOver(day);
    expect(c.map((i) => i.area)).toEqual(['family', 'body', 'faith']);
    expect(c.every((i) => i.state === undefined)).toBe(true);
    const { entry, added } = withCarried(E({ intentions: [{ area: 'body', text: 'Run 5k' }] }), c);
    expect(added).toBe(2);
    expect(entry.intentions.find((i) => i.area === 'body')?.text).toBe('Run 5k');
    expect(entry.intentions.map((i) => i.area)).toEqual(['faith', 'body', 'family']);
  });

  it('sets the day from the form, keeping marks on unchanged lines', () => {
    const next = setIntentions(day, { writing: 'Finish chapter 7 ', family: 'Call Dad', body: '' });
    expect(next.intentions).toEqual([{ area: 'writing', text: 'Finish chapter 7', state: 'kept' }, { area: 'family', text: 'Call Dad' }]);
  });

  it('cycles marks and only closes a marked day', () => {
    expect([nextState(), nextState('kept'), nextState('partly'), nextState('not')]).toEqual(['kept', 'partly', 'not', undefined]);
    expect(closeable(day)).toBe(false);
    expect(closeable({ ...day, intentions: day.intentions.slice(0, 3) })).toBe(true);
    expect(closeable(E())).toBe(false);
    expect(closeable(E({ done: ['h1'] }))).toBe(true);
    expect(closeable(E({ done: ['h1'], closedAt: '2026-11-22T21:00:00Z' }))).toBe(false);
  });

  it('knows the phase of the day', () => {
    const at = (h: number) => phase(new Date(2026, 10, 22, h, 30));
    expect([at(4), at(5), at(11), at(12), at(18), at(19), at(23)]).toEqual(['evening', 'morning', 'morning', 'day', 'day', 'evening', 'evening']);
  });
});

describe('history, restore and sync', () => {
  it('draws the last 30 days', () => {
    const s = historyStrip({ habits: [H()], days: { '2026-11-22': E({ done: ['h1', 'gone'], closedAt: 'x' }) } }, '2026-11-22');
    expect(s).toHaveLength(30);
    expect(s[29]).toMatchObject({ day: '2026-11-22', done: 1, due: 1, closed: true, score: null });
    expect(s[0].day).toBe('2026-10-24');
  });

  it('describes itself for a restore', () => {
    const v = { days: { a: E(), b: E() }, habits: [H(), H({ id: 'x', archived: true })] };
    expect(describeDay.detail(v)).toBe('2 days · 1 habit');
    expect(describeDay.size(v)).toBe(2);
    expect(describeDay.detail({})).toBe('0 days · 0 habits');
  });

  it('merges two devices without losing anything', () => {
    const l = { habits: [H()], days: { '2026-11-21': E({ done: ['h1'], intentions: [{ area: 'writing', text: 'Ch 7' }], well: 'Wrote' }) } };
    const r = { habits: [H({ name: 'Other copy' }), H({ id: 'h2' })], days: {
      '2026-11-21': E({ done: ['h2'], intentions: [{ area: 'writing', text: 'Ch 7', state: 'kept' }, { area: 'faith', text: 'Pray' }], closedAt: 'T', carry: 'more' }),
      '2026-11-20': E({ done: ['h1'] }),
    } };
    const m = mergeDayData(l, r);
    expect(m.habits.map((h) => h.name)).toEqual(['Walk', 'Walk']);
    expect(m.habits.map((h) => h.id)).toEqual(['h1', 'h2']);
    const d = m.days['2026-11-21'];
    expect(d.done).toEqual(['h1', 'h2']);
    expect(d.intentions).toEqual([{ area: 'writing', text: 'Ch 7', state: 'kept' }, { area: 'faith', text: 'Pray' }]);
    expect(d).toMatchObject({ well: 'Wrote', carry: 'more', closedAt: 'T' });
    expect(m.days['2026-11-20'].done).toEqual(['h1']);
  });
});
