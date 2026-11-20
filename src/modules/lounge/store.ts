import { create } from 'zustand';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { DEFAULT_LOUNGE, type Claim, type LoungeData, type Rates, type Reward } from './types';

export const KEY = 'lounge.v1';

interface LoungeState extends LoungeData {
  loaded: boolean;
  /** Read from storage once. `force` re-reads (after a restore); otherwise later calls are no-ops,
   *  so a page mounting mid-save can never roll the in-memory state back to a stale copy. */
  load: (force?: boolean) => Promise<void>;
  saveReward: (r: Omit<Reward, 'id'> & { id?: string }) => void;
  removeReward: (id: string) => void;
  /** Spend points on a reward. Returns the new claim so the UI can offer undo. */
  claim: (rewardId: string) => Claim | null;
  /** Give the points back (undo a claim, or cancel something not bought after all). */
  cancelClaim: (claimId: string) => void;
  markBought: (claimId: string) => void;
  unmarkBought: (claimId: string) => void;
  setRates: (r: Rates) => void;
  setCountFrom: (d: string | null) => void;
}

const pick = (s: LoungeState): LoungeData => ({ rewards: s.rewards, claims: s.claims, rates: s.rates, countFrom: s.countFrom });
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useLounge = create<LoungeState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, pick(get())); };
  const patchClaim = (id: string, f: (c: Claim) => Claim) => {
    set({ claims: get().claims.map((c) => (c.id === id ? f(c) : c)) });
    persist();
  };

  return {
    ...DEFAULT_LOUNGE,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<LoungeData>(KEY);
      set({ ...DEFAULT_LOUNGE, ...(saved ?? {}), rates: { ...DEFAULT_LOUNGE.rates, ...(saved?.rates ?? {}) }, loaded: true });
    },

    saveReward(r) {
      const rewards = get().rewards;
      const clean = { ...r, name: r.name.trim(), cost: Math.max(1, Math.round(r.cost)), note: r.note?.trim() || undefined };
      set({
        rewards: r.id && rewards.some((x) => x.id === r.id)
          ? rewards.map((x) => (x.id === r.id ? { ...x, ...clean, id: x.id } : x))
          : [...rewards, { ...clean, id: newId('r') }],
      });
      persist();
    },

    removeReward(id) {
      set({ rewards: get().rewards.filter((r) => r.id !== id) });
      persist();
    },

    claim(rewardId) {
      const r = get().rewards.find((x) => x.id === rewardId);
      if (!r) return null;
      const c: Claim = { id: newId('c'), rewardId, name: r.name, glyph: r.glyph, cost: r.cost, claimedAt: new Date().toISOString() };
      set({ claims: [...get().claims, c] });
      persist();
      return c;
    },

    cancelClaim(id) {
      set({ claims: get().claims.filter((c) => c.id !== id) });
      persist();
    },

    markBought: (id) => patchClaim(id, (c) => ({ ...c, boughtAt: new Date().toISOString() })),
    unmarkBought: (id) => patchClaim(id, ({ boughtAt: _, ...c }) => c),

    setRates(rates) {
      set({ rates });
      persist();
    },

    setCountFrom(countFrom) {
      set({ countFrom });
      persist();
    },
  };
});
