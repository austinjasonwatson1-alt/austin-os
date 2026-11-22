import { create } from 'zustand';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { DEFAULT_LIFE, DEFAULT_TARGETS, type LifeArea, type LifeData } from './logic';

export const KEY = 'life.v1';

interface LifeState extends LifeData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  setTarget: (a: LifeArea, mins: number) => void;
}

export const useLife = create<LifeState>((set, get) => ({
  ...DEFAULT_LIFE,
  loaded: false,
  async load(force = false) {
    if (get().loaded && !force) return;
    const saved = await kvGet<LifeData>(KEY);
    set({ targets: { ...DEFAULT_TARGETS, ...(saved?.targets ?? {}) }, loaded: true });
  },
  setTarget(a, mins) {
    const targets = { ...get().targets, [a]: Math.max(0, Math.round(mins)) };
    set({ targets });
    if (get().loaded) void saveWithSnapshot(KEY, { targets } satisfies LifeData);
  },
}));
