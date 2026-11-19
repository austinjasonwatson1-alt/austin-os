/** Pure rules for the snapshot ring kept beside every saved key. */

export interface Snapshot<T = unknown> {
  at: string;
  value: T;
  /** Set on restore points taken on purpose ("Before import of x.csv"); absent on autosaves. */
  label?: string;
}

export const AUTO_KEEP = 8;
export const LABELLED_KEEP = 6;
export const AUTO_MIN_GAP_MS = 5 * 60 * 1000;

/**
 * Add `snap` to the ring (newest first). Autosaves are throttled and capped separately from
 * labelled restore points, so an evening of edits can't push "before import" out of the ring.
 */
export function pushSnapshot<T>(ring: Snapshot<T>[], snap: Snapshot<T>): Snapshot<T>[] {
  if (!snap.label) {
    const lastAuto = ring.find((s) => !s.label);
    if (lastAuto && new Date(snap.at).getTime() - new Date(lastAuto.at).getTime() < AUTO_MIN_GAP_MS) return ring;
  }
  let auto = 0;
  let labelled = 0;
  return [snap, ...ring].filter((s) => (s.label ? ++labelled <= LABELLED_KEEP : ++auto <= AUTO_KEEP));
}
