import { create } from 'zustand';
import { kvGet, saveWithSnapshot, markDeleted } from '../../core/storage';
import { DEFAULT_PUB, type PubData } from './types';

export const KEY = 'pub.v1';

type ListKey = 'queries' | 'contests' | 'feedback' | 'outreach';
type Item<K extends ListKey> = PubData[K][number];

interface PubState extends PubData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Add or replace an item (by id) on one of the lists. */
  put: <K extends ListKey>(list: K, item: Omit<Item<K>, 'id'> & { id?: string }) => void;
  remove: (list: ListKey, id: string) => void;
  setRoad: (r: PubData['road']) => void;
  toggleReady: (msId: string, k: string) => void;
}

const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const usePub = create<PubState>((set, get) => {
  const persist = () => {
    if (get().loaded) void saveWithSnapshot(KEY, { queries: get().queries, contests: get().contests, feedback: get().feedback, outreach: get().outreach, road: get().road, ready: get().ready } satisfies PubData);
  };
  return {
    ...DEFAULT_PUB,
    loaded: false,
    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<PubData>(KEY);
      set({ ...DEFAULT_PUB, ...(saved ?? {}), loaded: true });
    },
    put(list, item) {
      const cur = get()[list] as { id: string }[];
      const full = { ...item, id: item.id ?? newId() } as { id: string };
      set({ [list]: cur.some((x) => x.id === full.id) ? cur.map((x) => (x.id === full.id ? full : x)) : [full, ...cur] } as Partial<PubState>);
      persist();
    },
    remove(list, id) {
      void markDeleted(KEY, id);
      set({ [list]: (get()[list] as { id: string }[]).filter((x) => x.id !== id) } as Partial<PubState>);
      persist();
    },
    setRoad(road) { set({ road }); persist(); },
    toggleReady(msId, k) {
      const cur = get().ready?.[msId] ?? [];
      set({ ready: { ...(get().ready ?? {}), [msId]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } });
      persist();
    },
  };
});
