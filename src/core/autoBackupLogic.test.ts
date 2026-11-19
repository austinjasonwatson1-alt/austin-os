import { describe, expect, it } from 'vitest';
import { autoBackupStatus, buildBackupPayload, countEntries, overwriteRisk, timeAgo, type AbInput } from './autoBackupLogic';

const NOW = new Date('2026-11-19T12:00:00Z');
const payload = (data: Record<string, unknown>) => buildBackupPayload(data, NOW);
const days = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-01-${String(i + 1).padStart(2, '0')}`, { writing: 30 }]));

describe('countEntries', () => {
  it('counts primitive leaves, ignoring empties', () => {
    expect(countEntries({ a: { writing: 30, reading: 15, note: 'x' }, b: {} })).toBe(3);
    expect(countEntries([{ d: '2026-01-01', t: 'x' }, 4])).toBe(3);
    expect(countEntries(null)).toBe(0);
  });
});

describe('overwriteRisk', () => {
  const ours = (n: number) => JSON.stringify(payload({ 'ledger.v3': { days: days(n) } }));

  it('allows writing to a new, empty file', () => {
    expect(overwriteRisk('', payload({}))).toBeNull();
    expect(overwriteRisk(null, payload({}))).toBeNull();
  });

  it('allows normal growth and small edits', () => {
    expect(overwriteRisk(ours(20), payload({ 'ledger.v3': { days: days(21) } }))).toBeNull();
    expect(overwriteRisk(ours(20), payload({ 'ledger.v3': { days: days(18) } }))).toBeNull();
  });

  it('blocks an emptied browser from wiping a full backup', () => {
    expect(overwriteRisk(ours(200), payload({}))).toEqual({ kind: 'shrink', fileEntries: 200, nextEntries: 0 });
    expect(overwriteRisk(ours(200), payload({ 'ledger.v3': { days: days(150) } }))?.kind).toBe('shrink');
  });

  it('refuses to overwrite files that are not Austin OS backups', () => {
    expect(overwriteRisk('not json at all', payload({}))?.kind).toBe('foreign');
    expect(overwriteRisk(JSON.stringify({ days: days(3) }), payload({}))?.kind).toBe('foreign');
  });
});

describe('timeAgo', () => {
  const now = NOW.getTime();
  it('rounds to the coarsest useful unit', () => {
    expect(timeAgo('2026-11-19T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-19T11:55:00Z', now)).toBe('5m ago');
    expect(timeAgo('2026-11-19T09:00:00Z', now)).toBe('3h ago');
    expect(timeAgo('2026-11-16T12:00:00Z', now)).toBe('3d ago');
  });
});

describe('autoBackupStatus', () => {
  const base: AbInput = {
    supported: true, fileName: 'austin-os-autobackup.json', permission: 'granted',
    lastWriteAt: '2026-11-19T11:58:00Z', error: null, risk: null, now: NOW.getTime(),
  };

  it('reports a healthy backup', () => {
    expect(autoBackupStatus(base)).toEqual({ tone: 'ok', label: 'Saved 2m ago', action: null });
  });

  it('asks to choose a file when off, and does nothing when unsupported', () => {
    expect(autoBackupStatus({ ...base, fileName: null }).action).toBe('choose');
    expect(autoBackupStatus({ ...base, supported: false }).action).toBeNull();
  });

  it('puts a blocked overwrite ahead of everything else', () => {
    const risk = { kind: 'shrink' as const, fileEntries: 200, nextEntries: 0 };
    expect(autoBackupStatus({ ...base, risk, permission: 'prompt', error: 'x' })).toMatchObject({ tone: 'bad', action: 'review' });
  });

  it('asks to reconnect after a restart, then shows errors', () => {
    expect(autoBackupStatus({ ...base, permission: 'prompt' })).toMatchObject({ tone: 'warn', action: 'reconnect' });
    expect(autoBackupStatus({ ...base, error: 'disk full' })).toMatchObject({ tone: 'bad', action: 'retry' });
  });
});
