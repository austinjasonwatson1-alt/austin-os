import { describe, expect, it } from 'vitest';
import { AUTO_KEEP, LABELLED_KEEP, pushSnapshot, type Snapshot } from './snapshots';

const at = (min: number) => new Date(Date.UTC(2026, 10, 19, 12, min)).toISOString();

describe('pushSnapshot', () => {
  it('throttles autosaves to one per five minutes', () => {
    const ring = pushSnapshot<number>([], { at: at(0), value: 1 });
    expect(pushSnapshot(ring, { at: at(3), value: 2 })).toBe(ring);
    expect(pushSnapshot(ring, { at: at(6), value: 2 })).toHaveLength(2);
  });

  it('always records labelled restore points, even right after an autosave', () => {
    const ring = pushSnapshot<number>([], { at: at(0), value: 1 });
    expect(pushSnapshot(ring, { at: at(0), value: 0, label: 'Before import' })[0].label).toBe('Before import');
  });

  it('a restore point does not reset the autosave throttle', () => {
    let ring = pushSnapshot<number>([], { at: at(0), value: 1 });
    ring = pushSnapshot(ring, { at: at(1), value: 2, label: 'Before import' });
    expect(pushSnapshot(ring, { at: at(4), value: 3 })).toBe(ring);
  });

  it('caps autosaves and restore points separately, so edits never evict an import undo', () => {
    let ring: Snapshot<number>[] = [{ at: at(0), value: 0, label: 'Before import' }];
    for (let i = 1; i <= 30; i++) ring = pushSnapshot(ring, { at: at(i * 6), value: i });
    expect(ring.filter((s) => !s.label)).toHaveLength(AUTO_KEEP);
    expect(ring.filter((s) => s.label)).toHaveLength(1);
    for (let i = 0; i < 10; i++) ring = pushSnapshot(ring, { at: at(300 + i), value: i, label: `L${i}` });
    expect(ring.filter((s) => s.label)).toHaveLength(LABELLED_KEEP);
    expect(ring[0].label).toBe('L9');
  });
});
