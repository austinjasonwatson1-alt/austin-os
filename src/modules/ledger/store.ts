import { create } from 'zustand';
import { useAutoBackup } from '../../core/autoBackup';
import { kvGet, listSnapshots, saveWithSnapshot, snapshotNow, snapshotsSettled, type Snapshot } from '../../core/storage';
import { mergeDays, type MergePreview } from './logic';
import { CATS, DEFAULT_DATA, type CatKey, type Deadline, type DayMap, type LedgerData } from './types';

export const KEY = 'ledger.v3';

interface LedgerState extends LedgerData {
  loaded: boolean;
  /** Read from storage once. `force` re-reads (after a restore); otherwise later calls are no-ops,
   *  so a page mounting mid-save can never roll the in-memory state back to a stale copy. */
  load: (force?: boolean) => Promise<void>;
  setMinutes: (date: string, cat: CatKey, minutes: number) => void;
  setNote: (date: string, note: string) => void;
  addDeadline: (d: Deadline) => void;
  removeDeadline: (index: number) => void;
  /** Merge days in, after taking a restore point named `why` ("Before import of x.csv"). */
  applyDays: (incoming: DayMap, why: string) => MergePreview;
  previewDays: (incoming: DayMap) => MergePreview;
  /** Put the ledger back to a snapshot. Takes a restore point of the current state first. */
  restore: (snap: Snapshot<LedgerData>) => void;
  /** Restore points and autosaves, newest first, once pending writes have landed. */
  snapshots: () => Promise<Snapshot<LedgerData>[]>;
}

const pick = (s: LedgerState): LedgerData => ({
  days: s.days,
  thresholds: s.thresholds,
  weekly: s.weekly,
  deadlines: s.deadlines,
});

export const useLedger = create<LedgerState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, pick(get())); };

  return {
    ...DEFAULT_DATA,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<LedgerData>(KEY);
      set({ ...DEFAULT_DATA, ...(saved ?? {}), loaded: true });
    },

    setMinutes(date, cat, minutes) {
      const entry = { ...get().days[date] };
      const v = Math.max(0, Math.round(minutes));
      if (v > 0) entry[cat] = v;
      else delete entry[cat];
      set({ days: { ...get().days, [date]: entry } });
      persist();
    },

    setNote(date, note) {
      const entry = { ...get().days[date] };
      if (note.trim()) entry.note = note;
      else delete entry.note;
      set({ days: { ...get().days, [date]: entry } });
      persist();
    },

    addDeadline(d) {
      set({ deadlines: [...get().deadlines, d].sort((a, b) => a.d.localeCompare(b.d)) });
      persist();
    },

    removeDeadline(index) {
      set({ deadlines: get().deadlines.filter((_, i) => i !== index) });
      persist();
    },

    previewDays: (incoming) => mergeDays(get().days, incoming).preview,

    applyDays(incoming, why) {
      const { merged, preview } = mergeDays(get().days, incoming);
      if (preview.add + preview.update === 0) return preview;
      void snapshotNow(KEY, pick(get()), why);
      set({ days: merged });
      persist();
      return preview;
    },

    restore(snap) {
      const from = Object.keys(get().days).length;
      const to = Object.keys(snap.value.days ?? {}).length;
      void snapshotNow(KEY, pick(get()), `Before restore · ${from} → ${to} days`);
      useAutoBackup.getState().expectShrink();
      set({ ...DEFAULT_DATA, ...snap.value });
      persist();
    },

    snapshots: () => snapshotsSettled().then(() => listSnapshots<LedgerData>(KEY)),
  };
});

/** Pull a day map out of either a new backup, an old Ledger export, or a bare `{date: entry}` object. */
export function extractDays(parsed: unknown): DayMap | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  const data = (p.data as Record<string, unknown> | undefined)?.['ledger.v3'] as Partial<LedgerData> | undefined;
  const raw = (data?.days ?? p.days ?? p) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') return null;
  const keep = new Set<string>([...CATS.map((c) => c.k), 'note']);
  const out: DayMap = {};
  for (const [date, entry] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry || typeof entry !== 'object') continue;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry as Record<string, unknown>)) if (keep.has(k)) clean[k] = v;
    if (Object.keys(clean).length) out[date] = clean as DayMap[string];
  }
  return Object.keys(out).length ? out : null;
}
