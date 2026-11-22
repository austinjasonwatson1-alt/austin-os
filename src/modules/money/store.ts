import { create } from 'zustand';
import { kvGet, saveWithSnapshot, snapshotNow, markDeleted } from '../../core/storage';
import { applyRules, editTxn, handTxn, previewImport, upsertRule, type HandDraft } from './logic';
import { DEFAULT_MONEY, type CatKey, type MoneyData, type Txn } from './types';

export const KEY = 'money.v1';

interface MoneyState extends MoneyData {
  loaded: boolean;
  /** Read from storage once; `force` re-reads after a restore. */
  load: (force?: boolean) => Promise<void>;
  /** Ids deleted before (from sync tombstones), so a re-import doesn't bring them back. */
  deletedIds: () => Promise<string[]>;
  /** Add previewed transactions (only ones not already here), after a named restore point. */
  importTxns: (previewed: Txn[], why: string) => Promise<number>;
  /** Write one transaction in by hand (its own random id; never matched by a statement import). */
  addHand: (d: HandDraft) => Txn;
  /** Edit a line: category on any line; date/description/amount only on hand-entered ones. */
  editTxn: (id: string, patch: Partial<Pick<Txn, 'date' | 'desc' | 'cents' | 'category'>>) => void;
  remove: (id: string) => void;
  /** Recategorize one transaction; with `always`, also save a rule for that merchant phrase and apply it everywhere. */
  setCategory: (id: string, category: CatKey, always?: string) => void;
  removeRule: (id: string) => void;
}

const newId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useMoney = create<MoneyState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { txns: get().txns, rules: get().rules } satisfies MoneyData); };

  return {
    ...DEFAULT_MONEY,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<MoneyData>(KEY);
      set({ ...DEFAULT_MONEY, ...(saved ?? {}), loaded: true });
    },

    async deletedIds() {
      const dead = await kvGet<Record<string, Record<string, string>>>('sync.deleted');
      return Object.keys(dead?.[KEY] ?? {});
    },

    async importTxns(previewed, why) {
      if (!get().loaded) await get().load();
      const { add } = previewImport(get().txns, previewed);
      if (!add.length) return 0;
      await snapshotNow(KEY, { txns: get().txns, rules: get().rules }, why);
      set({ txns: [...get().txns, ...add] });
      persist();
      return add.length;
    },

    addHand(d) {
      const t = handTxn(d, `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`, new Date().toISOString());
      set({ txns: [...get().txns, t] });
      persist();
      return t;
    },

    editTxn(id, patch) {
      let changed = false;
      const txns = get().txns.map((t) => {
        if (t.id !== id) return t;
        const n = editTxn(t, patch);
        changed = JSON.stringify(n) !== JSON.stringify(t);
        return changed ? n : t;
      });
      if (!changed) return;
      set({ txns });
      persist();
    },

    remove(id) {
      void markDeleted(KEY, id);
      set({ txns: get().txns.filter((t) => t.id !== id) });
      persist();
    },

    setCategory(id, category, always) {
      if (always?.trim()) {
        const rules = upsertRule(get().rules, always, category, newId(), new Date().toISOString());
        // The chosen line follows the rule too (not pinned by hand), so removing the rule can undo it.
        const txns = applyRules(get().txns.map((t) => (t.id === id ? { ...t, manual: false } : t)), rules);
        set({ rules, txns: txns.map((t) => (t.id === id && t.category !== category ? { ...t, category, manual: true } : t)) });
      } else {
        set({ txns: get().txns.map((t) => (t.id === id ? { ...t, category, manual: true } : t)) });
      }
      persist();
    },

    removeRule(id) {
      void markDeleted(KEY, id);
      const rules = get().rules.filter((r) => r.id !== id);
      set({ rules, txns: applyRules(get().txns, rules) });
      persist();
    },
  };
});
