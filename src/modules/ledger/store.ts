import { create } from 'zustand';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { mergeDays, type MergePreview } from './logic';
import { SEED_DAYS } from './seed';
import { CATS, DEFAULT_DATA, type CatKey, type Deadline, type DayMap, type LedgerData } from './types';

const KEY = 'ledger.v3';

interface LedgerState extends LedgerData {
  loaded: boolean;
  load: () => Promise<void>;
  setMinutes: (date: string, cat: CatKey, minutes: number) => void;
  setNote: (date: string, note: string) => void;
  addDeadline: (d: Deadline) => void;
  removeDeadline: (index: number) => void;
  applyDays: (incoming: DayMap) => MergePreview;
  previewDays: (incoming: DayMap) => MergePreview;
  loadSeed: () => MergePreview;
}

const pick = (s: LedgerState): LedgerData => ({
  days: s.days,
  thresholds: s.thresholds,
  weekly: s.weekly,
  deadlines: s.deadlines,
});

export const useLedger = create<LedgerState>((set, get) => {
  const persist = () => void saveWithSnapshot(KEY, pick(get()));

  return {
    ...DEFAULT_DATA,
    loaded: false,

    async load() {
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

    applyDays(incoming) {
      const { merged, preview } = mergeDays(get().days, incoming);
      set({ days: merged });
      persist();
      return preview;
    },

    loadSeed() {
      return get().applyDays(SEED_DAYS);
    },
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
