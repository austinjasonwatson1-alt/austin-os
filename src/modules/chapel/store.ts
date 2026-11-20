import { create } from 'zustand';
import { todayISO } from '../../core/dates';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { DEFAULT_CHAPEL, type ChapelData, type ChapelDay, type Prayer, type Verse } from './types';

export const KEY = 'chapel.v1';

interface ChapelState extends ChapelData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  setMinutes: (date: string, kind: 'prayer' | 'scripture', mins: number) => void;
  setNote: (date: string, note: string) => void;
  addPrayer: (text: string, forWhom?: string) => void;
  answer: (id: string, answer: string, on?: string) => void;
  unanswer: (id: string) => void;
  removePrayer: (id: string) => void;
  addVerse: (ref: string, text: string) => void;
  removeVerse: (id: string) => void;
}

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useChapel = create<ChapelState>((set, get) => {
  const persist = () => {
    if (get().loaded) void saveWithSnapshot(KEY, { days: get().days, prayers: get().prayers, verses: get().verses } satisfies ChapelData);
  };
  const patchDay = (date: string, f: (d: ChapelDay) => ChapelDay) => {
    const next = f({ ...get().days[date] });
    const days = { ...get().days };
    if (!next.prayer && !next.scripture && !next.note) delete days[date];
    else days[date] = next;
    set({ days });
    persist();
  };
  const patchPrayer = (id: string, f: (p: Prayer) => Prayer) => {
    set({ prayers: get().prayers.map((p) => (p.id === id ? f(p) : p)) });
    persist();
  };

  return {
    ...DEFAULT_CHAPEL,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<ChapelData>(KEY);
      set({ ...DEFAULT_CHAPEL, ...(saved ?? {}), loaded: true });
    },

    setMinutes: (date, kind, mins) => patchDay(date, (d) => {
      const v = Math.max(0, Math.round(mins));
      const n = { ...d };
      if (v) n[kind] = v;
      else delete n[kind];
      return n;
    }),
    setNote: (date, note) => patchDay(date, (d) => ({ ...d, note: note.trim() || undefined })),

    addPrayer(text, forWhom) {
      if (!text.trim()) return;
      set({ prayers: [...get().prayers, { id: newId('p'), text: text.trim(), for: forWhom?.trim() || undefined, added: todayISO() }] });
      persist();
    },
    answer: (id, answer, on = todayISO()) => patchPrayer(id, (p) => ({ ...p, answeredOn: on, answer: answer.trim() || undefined })),
    unanswer: (id) => patchPrayer(id, ({ answeredOn: _a, answer: _b, ...p }) => p),
    removePrayer(id) {
      set({ prayers: get().prayers.filter((p) => p.id !== id) });
      persist();
    },

    addVerse(ref, text) {
      if (!ref.trim() && !text.trim()) return;
      set({ verses: [{ id: newId('v'), ref: ref.trim(), text: text.trim() } satisfies Verse, ...get().verses] });
      persist();
    },
    removeVerse(id) {
      set({ verses: get().verses.filter((v) => v.id !== id) });
      persist();
    },
  };
});
