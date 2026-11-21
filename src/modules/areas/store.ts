import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { todayISO } from '../../core/dates';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { AREA_CONFIGS, DEFAULT_AREA, type AreaData, type AreaItem, type AreaKey } from './types';

export interface AreaState extends AreaData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  setMinutes: (date: string, kind: string, mins: number) => void;
  addItem: (list: string, text: string, extra?: Partial<AreaItem>) => void;
  patchItem: (id: string, p: Partial<AreaItem>) => void;
  removeItem: (id: string) => void;
}

const newId = () => `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function makeStore(key: string): UseBoundStore<StoreApi<AreaState>> {
  return create<AreaState>((set, get) => {
    const persist = () => { if (get().loaded) void saveWithSnapshot(key, { days: get().days, items: get().items } satisfies AreaData); };
    return {
      ...DEFAULT_AREA,
      loaded: false,
      async load(force = false) {
        if (get().loaded && !force) return;
        const saved = await kvGet<AreaData>(key);
        set({ ...DEFAULT_AREA, ...(saved ?? {}), loaded: true });
      },
      setMinutes(date, kind, mins) {
        const d = { ...get().days[date] };
        const v = Math.max(0, Math.round(mins));
        if (v) d[kind] = v; else delete d[kind];
        const days = { ...get().days };
        if (Object.keys(d).length) days[date] = d; else delete days[date];
        set({ days });
        persist();
      },
      addItem(list, text, extra = {}) {
        if (!text.trim()) return;
        set({ items: [{ id: newId(), list, text: text.trim(), date: todayISO(), ...extra, body: extra.body?.trim() || undefined }, ...get().items] });
        persist();
      },
      patchItem(id, p) {
        set({ items: get().items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
        persist();
      },
      removeItem(id) {
        set({ items: get().items.filter((i) => i.id !== id) });
        persist();
      },
    };
  });
}

export const AREA_STORES: Record<AreaKey, UseBoundStore<StoreApi<AreaState>>> = {
  office: makeStore(AREA_CONFIGS.office.key),
  observatory: makeStore(AREA_CONFIGS.observatory.key),
  forge: makeStore(AREA_CONFIGS.forge.key),
  bank: makeStore(AREA_CONFIGS.bank.key),
  hearth: makeStore(AREA_CONFIGS.hearth.key),
};
