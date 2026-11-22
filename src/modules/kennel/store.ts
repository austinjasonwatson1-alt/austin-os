import { create } from 'zustand';
import { kvGet, markDeleted, saveWithSnapshot } from '../../core/storage';
import { cleanCare, cleanNote, cleanWalk, cleanWeight, replaceById } from './logic';
import { DEFAULT_KENNEL, type Care, type KennelData, type Note, type Walk, type Weight } from './types';

export const KEY = 'kennel.v1';

type List = keyof KennelData;
type Item<L extends List> = KennelData[L][number];

interface KennelState extends KennelData {
  loaded: boolean;
  /** Read from storage once; `force` re-reads after a restore. */
  load: (force?: boolean) => Promise<void>;
  addWalk: (w: Omit<Walk, 'id'>) => Walk;
  addCare: (c: Omit<Care, 'id'>) => Care;
  addWeight: (w: Omit<Weight, 'id'>) => Weight;
  addNote: (n: Omit<Note, 'id'>) => Note;
  /** Save an edited record in place (same id). A record deleted meanwhile is not brought back. */
  update: <L extends List>(list: L, item: Item<L>) => void;
  /** Remove one item from a list (recorded as deleted so sync drops it everywhere). */
  remove: (list: List, id: string) => void;
}

const newId = () => `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useKennel = create<KennelState>((set, get) => {
  const data = (): KennelData => { const s = get(); return { walks: s.walks, care: s.care, weights: s.weights, notes: s.notes }; };
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, data() satisfies KennelData); };
  const add = <L extends List>(list: L, item: Omit<Item<L>, 'id'>): Item<L> => {
    const full = { ...item, id: newId() } as Item<L>;
    set({ [list]: [...(get()[list] as Item<L>[]), full] } as Partial<KennelState>);
    persist();
    return full;
  };

  return {
    ...DEFAULT_KENNEL,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<Partial<KennelData>>(KEY);
      set({ ...DEFAULT_KENNEL, ...(saved ?? {}), loaded: true });
    },

    addWalk: (w) => add('walks', cleanWalk(w)),
    addCare: (c) => add('care', cleanCare(c)),
    addWeight: (w) => add('weights', cleanWeight(w)),
    addNote: (n) => add('notes', cleanNote(n)),

    update(list, item) {
      const tidy = list === 'walks' ? cleanWalk(item as Walk) : list === 'care' ? cleanCare(item as Care) : list === 'weights' ? cleanWeight(item as Weight) : cleanNote(item as Note);
      const cur = get()[list] as Item<typeof list>[];
      const next = replaceById(cur as { id: string }[], tidy as { id: string });
      if (next === cur) return;
      set({ [list]: next } as Partial<KennelState>);
      persist();
    },

    remove(list, id) {
      void markDeleted(KEY, id);
      set({ [list]: (get()[list] as { id: string }[]).filter((x) => x.id !== id) } as Partial<KennelState>);
      persist();
    },
  };
});
