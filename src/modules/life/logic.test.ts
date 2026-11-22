import { describe, expect, it } from 'vitest';
import { addDays } from '../../core/dates';
import { amount, balanceScore, balanceWeek, DEFAULT_TARGETS, insights, lastTended, migrateTargets, minutesOn, neglectLevel, type LifeInput } from './logic';

const empty: LifeInput = { ledger: {}, chapel: {}, office: {}, observatory: {}, forge: {}, hearth: {} };

describe('balance', () => {
  it('scores each area against its weekly target', () => {
    const x: LifeInput = { ...empty, ledger: { '2026-11-16': { writing: 225 } }, forge: { '2026-11-17': { cardio: 30 } }, walks: { '2026-11-18': 40 } };
    const w = balanceWeek(x, '2026-11-16', DEFAULT_TARGETS);
    expect(w.find((s) => s.area === 'writing')).toMatchObject({ mins: 225, score: 0.5 });
    expect(w.find((s) => s.area === 'body')!.mins).toBe(70);
    expect(w.find((s) => s.area === 'faith')!.score).toBe(0);
    expect(balanceScore(w)).toBeGreaterThan(0);
    expect(balanceScore(w.map((s) => ({ ...s, score: 1 })))).toBe(100);
  });

  it('knows how long since each area was tended', () => {
    const x: LifeInput = { ...empty, chapel: { '2026-11-10': { prayer: 10 } }, ledger: { '2026-11-22': { writing: 5 } } };
    const t = lastTended(x, '2026-11-22');
    expect(t.writing).toBe(0);
    expect(t.faith).toBe(12);
    expect(t.work).toBeNull();
    expect(neglectLevel(t.faith, true)).toBe(2);
    expect(neglectLevel(5, true)).toBe(1);
    expect(neglectLevel(null, false)).toBe(0);
  });
});

describe('insights', () => {
  it('needs enough days before saying anything', () => {
    expect(insights(empty, '2026-11-22')).toEqual([]);
  });

  it('finds that prayer days are writing days', () => {
    const ledger: LifeInput['ledger'] = {}; const chapel: LifeInput['chapel'] = {};
    for (let i = 1; i <= 60; i++) {
      const d = addDays('2026-11-22', -i);
      const prays = i % 2 === 0;
      if (prays) chapel[d] = { prayer: 15 };
      ledger[d] = { writing: prays ? 90 : 40 };
    }
    const found = insights({ ...empty, ledger, chapel }, '2026-11-22');
    const faith = found.find((f) => f.id === 'with-faith')!;
    expect(faith.title).toMatch(/2\.3×|125% more/);
    expect(faith.evidence).toMatch(/1h 30m a day with it \(30 days\) vs 40m without \(30 days\)/);
    expect(minutesOn({ ...empty, ledger, chapel }, 'faith', addDays('2026-11-22', -2))).toBe(15);
  });

  it('spots the strongest day of the week', () => {
    const ledger: LifeInput['ledger'] = {};
    for (let i = 1; i <= 56; i++) { const d = addDays('2026-11-22', -i); ledger[d] = { writing: new Date(`${d}T12:00:00`).getDay() === 2 ? 180 : 40 }; }
    expect(insights({ ...empty, ledger }, '2026-11-22').map((f) => f.id)).toContain('best-day');
  });
});

describe('day-counted areas', () => {
  it('count the days you showed up, not minutes', () => {
    const x: LifeInput = { ...empty, office: { '2026-11-16': { hq: 1 }, '2026-11-17': { hq: 1 }, '2026-11-18': { hq: 1 } }, observatory: { '2026-11-19': { build: 1 } } };
    const w = balanceWeek(x, '2026-11-16', DEFAULT_TARGETS);
    expect(w.find((s) => s.area === 'work')).toMatchObject({ mins: 3, target: 5, score: 0.6 });
    expect(w.find((s) => s.area === 'learning')).toMatchObject({ mins: 1, target: 3 });
    expect(amount('work', 3)).toBe('3 days');
    expect(amount('writing', 150)).toBe('2h 30m');
  });
  it('bring old minute targets back as day targets', () => {
    expect(migrateTargets({ work: 1500, learning: 180, writing: 600 })).toMatchObject({ work: 5, learning: 3, writing: 600 });
    expect(migrateTargets({ work: 4 })).toMatchObject({ work: 4 });
  });
});
