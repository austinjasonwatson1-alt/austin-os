import { create } from 'zustand';
import { todayISO } from '../../core/dates';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { moveChapter, recordHistory, totalWords } from './logic';
import { DEFAULT_MANUSCRIPTS, type Chapter, type ChapterStatus, type Manuscript, type ManuscriptsData } from './types';

export const KEY = 'manuscripts.v1';

interface MsState extends ManuscriptsData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  setActive: (id: string) => void;
  updateManuscript: (id: string, patch: Partial<Pick<Manuscript, 'title' | 'logline' | 'target'>>) => void;
  addManuscript: (title: string) => string;
  removeManuscript: (id: string) => void;
  saveChapter: (msId: string, c: Omit<Chapter, 'id'> & { id?: string }) => void;
  removeChapter: (msId: string, id: string) => void;
  move: (msId: string, id: string, status: ChapterStatus, beforeId?: string) => void;
}

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useManuscripts = create<MsState>((set, get) => {
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { manuscripts: get().manuscripts, active: get().active } satisfies ManuscriptsData); };
  /** Change one manuscript's chapters and note the day's word total. */
  const patchChapters = (msId: string, f: (c: Chapter[]) => Chapter[]) => {
    set({
      manuscripts: get().manuscripts.map((m) => {
        if (m.id !== msId) return m;
        const chapters = f(m.chapters);
        return { ...m, chapters, history: recordHistory(m.history, todayISO(), totalWords({ chapters })) };
      }),
    });
    persist();
  };

  return {
    ...DEFAULT_MANUSCRIPTS,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<ManuscriptsData>(KEY);
      set({ ...DEFAULT_MANUSCRIPTS, ...(saved ?? {}), loaded: true });
    },

    setActive(active) { set({ active }); persist(); },

    updateManuscript(id, patch) {
      set({ manuscripts: get().manuscripts.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
      persist();
    },

    addManuscript(title) {
      const m: Manuscript = { id: newId('m'), title: title.trim() || 'Untitled', logline: '', target: 85000, chapters: [], history: {} };
      set({ manuscripts: [...get().manuscripts, m], active: m.id });
      persist();
      return m.id;
    },

    removeManuscript(id) {
      const manuscripts = get().manuscripts.filter((m) => m.id !== id);
      set({ manuscripts, active: manuscripts[0]?.id ?? null });
      persist();
    },

    saveChapter(msId, c) {
      const clean: Chapter = { ...c, id: c.id ?? newId('c'), title: c.title.trim() || 'Untitled chapter', words: Math.max(0, Math.round(c.words || 0)) };
      patchChapters(msId, (chs) => (chs.some((x) => x.id === clean.id) ? chs.map((x) => (x.id === clean.id ? clean : x)) : [...chs, clean]));
    },

    removeChapter: (msId, id) => patchChapters(msId, (chs) => chs.filter((c) => c.id !== id)),
    move: (msId, id, status, beforeId) => patchChapters(msId, (chs) => moveChapter(chs, id, status, beforeId)),
  };
});
