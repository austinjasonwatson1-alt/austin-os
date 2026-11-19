import { describe, expect, it } from 'vitest';
import { planRestore, type Describer, type RestorePlan } from './restoreLogic';

const ledger: Describer = {
  name: 'The Ledger',
  size: (v) => Object.keys((v as { days: object }).days).length,
  detail: (v) => `${Object.keys((v as { days: object }).days).length} days`,
};
const D = { 'ledger.v3': ledger };
const L = (n: number, extra: object = {}) => ({ days: Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-01-${i + 10}`, { writing: 5 }])), ...extra });
const backup = (data: Record<string, unknown>) => ({ app: 'austin-os', version: 1, exportedAt: '2026-11-19T21:00:00.000Z', data });
const plan = (cur: Record<string, unknown>, file: unknown) => planRestore(cur, file, D) as RestorePlan;

describe('planRestore', () => {
  it('restores everything into an emptied browser', () => {
    const p = plan({}, backup({ 'ledger.v3': L(3), 'os.backupMeta': { lastBackupAt: 'x' } }));
    expect(p.items).toEqual([{ key: 'ledger.v3', name: 'The Ledger', now: null, file: '3 days', change: 'new' }]);
    expect(Object.keys(p.writes)).toEqual(['ledger.v3']);
    expect(p.shrinks).toEqual([]);
    expect(p.exportedAt).toBe('2026-11-19T21:00:00.000Z');
  });

  it('skips identical data and flags anything that would shrink', () => {
    const p = plan({ 'ledger.v3': L(5), 'shelf.v1': { books: [1, 2] } }, backup({ 'ledger.v3': L(2), 'shelf.v1': { books: [1, 2] } }));
    expect(p.items.map((i) => i.change)).toEqual(['less', 'same']);
    expect(Object.keys(p.writes)).toEqual(['ledger.v3']);
    expect(p.shrinks).toEqual(['The Ledger']);
  });

  it('tells "more" from "different" (same size, other contents, e.g. a changed deadline)', () => {
    expect(plan({ 'ledger.v3': L(2) }, backup({ 'ledger.v3': L(4) })).items[0].change).toBe('more');
    expect(plan({ 'ledger.v3': L(2) }, backup({ 'ledger.v3': L(2, { deadlines: [] }) })).items[0].change).toBe('different');
  });

  it('describes unknown keys generically and never restores device settings or snapshots', () => {
    const p = plan({}, backup({ 'future.v1': { a: 1, b: [2, 3] }, 'sys:autoBackup': {}, 'snap:ledger.v3': [] }));
    expect(p.items).toEqual([{ key: 'future.v1', name: 'future.v1', now: null, file: '3 entries', change: 'new' }]);
  });

  it('rejects files that are not Austin OS backups, or are empty', () => {
    expect(planRestore({}, { days: {} }, D)).toHaveProperty('error');
    expect(planRestore({}, null, D)).toHaveProperty('error');
    expect(planRestore({}, backup({ 'os.backupMeta': {} }), D)).toHaveProperty('error');
  });
});
