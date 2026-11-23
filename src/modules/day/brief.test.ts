import { describe, expect, it } from 'vitest';
import { morningBrief, type BriefInput } from './brief';

const base: BriefInput = { writingMins: 0, writingGood: 80, deadline: null, jobMoves: 0, jobDaysLeft: 99, prayerMins: 0, openPrayers: 0, walkMins: 0, workoutMins: 0 };

describe('the morning brief', () => {
  it('says what each part of the day still asks for', () => {
    const [w, j, f, b] = morningBrief(base);
    expect(w.line).toBe('Nothing yet: 80m makes it a good day');
    expect(j.line).toBe('0 of 4 moves · 99 days to March 1');
    expect(f.line).toBe('The candle is waiting');
    expect(b.line).toBe('The dogs haven’t been out yet');
    expect([w, j, f, b].some((r) => r.done)).toBe(false);
  });

  it('marks what is done and names a close deadline', () => {
    const [w, j, f, b] = morningBrief({ ...base, writingMins: 95, deadline: { n: 'The contest', left: 3 }, jobMoves: 4, jobDaysLeft: 1, prayerMins: 20, openPrayers: 2, walkMins: 30, steps: 8123 });
    expect(w).toMatchObject({ done: true, line: '95m in. A good day, banked · The contest in 3 days' });
    expect(j).toMatchObject({ done: true, line: 'All four moves made · 1 day to March 1' });
    expect(f.line).toBe('20m of prayer · 2 prayers on the list');
    expect(b.line).toBe('Walked 30m · 8,123 steps');
    expect(morningBrief({ ...base, deadline: { n: 'Far', left: 40 } })[0].line).not.toContain('Far');
    expect(morningBrief({ ...base, jobDaysLeft: 0 })[1].line).toContain('March 1 is here');
  });

  it('puts an interview this week right under the page', () => {
    const rows = morningBrief({ ...base, interview: { text: 'Toast — PM screen', in: 1, prepped: 2, of: 5 } });
    expect(rows[1]).toMatchObject({ title: 'The interview', line: 'Toast — PM screen · tomorrow · 2 of 5 prepped', done: false, path: '/office' });
    expect(morningBrief({ ...base, interview: { text: 'Far', in: 12, prepped: 0, of: 5 } })).toHaveLength(4);
    expect(morningBrief({ ...base, interview: { text: 'Now', in: 0, prepped: 5, of: 5 } })[1]).toMatchObject({ title: 'Interview today', done: true });
  });
});
