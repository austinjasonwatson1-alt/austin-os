import { create } from 'zustand';
import { kvGet, markDeleted, saveWithSnapshot } from '../../core/storage';
import { todayISO } from '../../core/dates';
import { cleanScene } from './logic';
import { DEFAULT_REFS, type RefsData, type SceneRef } from './types';

export const KEY = 'refs.v1';

interface RefsState extends RefsData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Add a new scene, or save an edit (same id). */
  save: (s: Omit<SceneRef, 'id' | 'added'> & { id?: string; added?: string }) => SceneRef;
  remove: (id: string) => void;
  /** A book to start the next new scene from (set by the Shelf, read by the library). Not saved. */
  startFrom: string | null;
  setStartFrom: (bookId: string | null) => void;
}

const newId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useRefs = create<RefsState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { scenes: get().scenes } satisfies RefsData); };
  return {
    ...DEFAULT_REFS,
    loaded: false,
    startFrom: null,
    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<RefsData>(KEY);
      set({ ...DEFAULT_REFS, ...(saved ?? {}), loaded: true });
    },
    save(s) {
      const cur = get().scenes;
      const old = s.id ? cur.find((x) => x.id === s.id) : undefined;
      const scene: SceneRef = { ...cleanScene(s), id: old?.id ?? newId(), added: old?.added ?? s.added ?? todayISO(), edited: new Date().toISOString() };
      set({ scenes: old ? cur.map((x) => (x.id === scene.id ? scene : x)) : [scene, ...cur] });
      persist();
      return scene;
    },
    remove(id) {
      void markDeleted(KEY, id);
      set({ scenes: get().scenes.filter((x) => x.id !== id) });
      persist();
    },
    setStartFrom: (bookId) => set({ startFrom: bookId }),
  };
});
