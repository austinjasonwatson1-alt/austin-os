import { describe, expect, it } from 'vitest';
import { blocksFor, carryable, describeSchedule, labelOf, liveTasks, mergeSchedule, nowIn, setLabel, toggleBlock, weekGrid } from './logic';
import { DEFAULT_SCHEDULE, DEFAULT_SETTINGS } from './types';

const at = (h: number, m = 0) => h * 60 + m;

describe('the schedule', () => {
  it('lays out 9 to 5 as eight 50-minute blocks with 10-minute breaks', () => {
    const b = blocksFor(DEFAULT_SETTINGS);
    expect(b).toHaveLength(8);
    expect(b.map((x) => `${x.start}-${x.end}`)).toEqual(['09:00-09:50', '10:00-10:50', '11:00-11:50', '12:00-12:50', '13:00-13:50', '14:00-14:50', '15:00-15:50', '16:00-16:50']);
    expect(blocksFor({ ...DEFAULT_SETTINGS, work: 25, brk: 5, end: '10:00' }).map((x) => x.start)).toEqual(['09:00', '09:30']);
  });

  it('knows where the day stands', () => {
    const b = blocksFor(DEFAULT_SETTINGS);
    expect(nowIn(b, at(8, 30))).toMatchObject({ phase: 'before', minsLeft: 30 });
    expect(nowIn(b, at(11, 20))).toMatchObject({ phase: 'work', block: { i: 2 }, minsLeft: 30 });
    expect(nowIn(b, at(11, 55))).toMatchObject({ phase: 'break', next: { i: 3 }, minsLeft: 5 });
    expect(nowIn(b, at(16, 55))).toMatchObject({ phase: 'after' });
    expect(nowIn(b, at(10), false).phase).toBe('off');
  });

  it('labels blocks from the day, else the weekly repeat, and checks them off', () => {
    const data = { ...DEFAULT_SCHEDULE, repeat: { '1': { '0': 'Plan the week' } }, days: { '2026-11-23': { labels: { '1': 'Recruiter brief' }, done: [] } } };
    expect(labelOf(data, '2026-11-23', 0)).toEqual({ text: 'Plan the week', repeats: true }); // a Monday
    expect(labelOf(data, '2026-11-23', 1)).toEqual({ text: 'Recruiter brief', repeats: false });
    expect(labelOf(data, '2026-11-24', 0).text).toBe('');
    const p = toggleBlock(toggleBlock({ labels: {}, done: [] }, 3, 't1'), 1, 't2');
    expect(p.done).toEqual([1, 3]);
    expect(toggleBlock(p, 3, 't3').done).toEqual([1]);
    expect(setLabel(p, 1, '  ', 't4').labels).toEqual({});
  });

  it('draws the week Monday to Friday and carries last week’s unfinished tasks', () => {
    const data = { ...DEFAULT_SCHEDULE, days: { '2026-11-24': { labels: {}, done: [0, 1, 2] } },
      weeks: { '2026-11-16': [{ id: 'a', text: 'Send the synopsis' }, { id: 'b', text: 'Done thing', done: true }, { id: 'c', text: 'Call Mom' }, { id: 'e', text: 'Removed', gone: true }], '2026-11-23': [{ id: 'd', text: 'call mom' }] } };
    const g = weekGrid(data, '2026-11-23');
    expect(g.map((d) => d.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(g[1]).toEqual({ date: '2026-11-24', done: [0, 1, 2], total: 8 });
    expect(carryable(data, '2026-11-23').map((t) => t.text)).toEqual(['Send the synopsis']);
  });

  it('syncs: the newest version of a day, tasks by id, repeats from both', () => {
    const l = { days: { d1: { labels: {}, done: [1], edited: '2' } }, weeks: { w: [{ id: 'a', text: 'A', done: true, edited: '5' }] }, repeat: { '1': { '0': 'Plan' } } };
    const r = { days: { d1: { labels: {}, done: [1, 2], edited: '3' }, d2: { labels: {}, done: [0] } }, weeks: { w: [{ id: 'a', text: 'A', edited: '4' }, { id: 'b', text: 'B' }] }, repeat: { '2': { '1': 'Brief' } } };
    const m = mergeSchedule(l, r);
    expect(m.days!.d1.done).toEqual([1, 2]);
    expect(m.days!.d2.done).toEqual([0]);
    expect(m.weeks!.w.find((t) => t.id === 'a')!.done).toBe(true);
    expect(m.weeks!.w).toHaveLength(2);
    const gone = mergeSchedule({ weeks: { w: [{ id: 'a', text: 'A', gone: true, edited: '9' }] } }, r);
    expect(liveTasks(gone.weeks!.w).map((t) => t.id)).toEqual(['b']);
    expect(m.repeat).toEqual({ '1': { '0': 'Plan' }, '2': { '1': 'Brief' } });
    expect(describeSchedule.detail({ days: { a: { done: [1, 2] } }, weeks: { w: [{}] } })).toBe('2 blocks done · 1 weekly tasks');
  });
});
