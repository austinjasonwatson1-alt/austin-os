import { create } from 'zustand';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { DEFAULT_REVIEW, type Review, type ReviewData } from './types';

export const KEY = 'review.v1';

interface ReviewState extends ReviewData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  patch: (monday: string, p: Partial<Review>) => void;
  seal: (monday: string) => void;
  unseal: (monday: string) => void;
}

export const useReview = create<ReviewState>((set, get) => {
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { reviews: get().reviews } satisfies ReviewData); };
  const patch = (monday: string, p: Partial<Review>) => {
    set({ reviews: { ...get().reviews, [monday]: { ...get().reviews[monday], ...p } } });
    persist();
  };
  return {
    ...DEFAULT_REVIEW,
    loaded: false,
    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<ReviewData>(KEY);
      set({ ...DEFAULT_REVIEW, ...(saved ?? {}), loaded: true });
    },
    patch,
    seal: (monday) => patch(monday, { sealedAt: new Date().toISOString() }),
    unseal: (monday) => patch(monday, { sealedAt: undefined }),
  };
});
