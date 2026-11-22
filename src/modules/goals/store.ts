import { create } from 'zustand';
import { kvGet, markDeleted, saveWithSnapshot } from '../../core/storage';
import { carried } from './logic';
import { DEFAULT_GOALS, type Goal, type GoalsData, type Milestone } from './types';

export const KEY = 'goals.v1';

interface GoalsState extends GoalsData {
  loaded: boolean;
  /** Read from storage once; `force` re-reads after a restore. */
  load: (force?: boolean) => Promise<void>;
  saveGoal: (g: Omit<Goal, 'id'> & { id?: string }) => Goal;
  /** Removes the goal and its milestones; goals that laddered up to it are kept, unparented. */
  removeGoal: (id: string) => void;
  saveMilestone: (m: Omit<Milestone, 'id'> & { id?: string }) => Milestone;
  removeMilestone: (id: string) => void;
  /** Mark done on `day`, or open again. */
  toggleMilestone: (id: string, day: string) => void;
  toggleGoal: (id: string, day: string) => void;
  /** Move an open milestone on: to `to`, or the quarter after its own. */
  carry: (id: string, to?: string) => void;
  /** Let a milestone go: kept on record, no longer open. */
  letGo: (id: string, day: string) => void;
}

const rnd = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useGoals = create<GoalsState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { goals: get().goals, milestones: get().milestones } satisfies GoalsData); };
  const patchM = (id: string, f: (m: Milestone) => Milestone) => { set({ milestones: get().milestones.map((m) => (m.id === id ? f(m) : m)) }); persist(); };

  return {
    ...DEFAULT_GOALS,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<GoalsData>(KEY);
      set({ ...DEFAULT_GOALS, ...(saved ?? {}), loaded: true });
    },

    saveGoal(g) {
      const goals = get().goals;
      const existing = g.id ? goals.find((x) => x.id === g.id) : undefined;
      const goal: Goal = { ...g, title: g.title.trim(), why: g.why?.trim() || undefined, id: existing?.id ?? `g-${rnd()}` };
      if (goal.parent === goal.id) delete goal.parent;
      set({ goals: existing ? goals.map((x) => (x.id === goal.id ? goal : x)) : [...goals, goal] });
      persist();
      return goal;
    },

    removeGoal(id) {
      void markDeleted(KEY, id);
      const gone = get().milestones.filter((m) => m.goal === id);
      for (const m of gone) void markDeleted(KEY, m.id);
      set({
        goals: get().goals.filter((g) => g.id !== id).map((g) => (g.parent === id ? { ...g, parent: undefined } : g)),
        milestones: get().milestones.filter((m) => m.goal !== id),
      });
      persist();
    },

    saveMilestone(m) {
      const ms = get().milestones;
      const existing = m.id ? ms.find((x) => x.id === m.id) : undefined;
      const item: Milestone = { ...m, title: m.title.trim(), id: existing?.id ?? `ms-${rnd()}` };
      set({ milestones: existing ? ms.map((x) => (x.id === item.id ? item : x)) : [...ms, item] });
      persist();
      return item;
    },

    removeMilestone(id) {
      void markDeleted(KEY, id);
      set({ milestones: get().milestones.filter((m) => m.id !== id) });
      persist();
    },

    toggleMilestone(id, day) { patchM(id, (m) => ({ ...m, done: m.done ? undefined : day, dropped: undefined })); },

    toggleGoal(id, day) {
      set({ goals: get().goals.map((g) => (g.id === id ? { ...g, done: g.done ? undefined : day } : g)) });
      persist();
    },

    carry(id, to) { patchM(id, (m) => carried(m, to)); },

    letGo(id, day) { patchM(id, (m) => ({ ...m, dropped: day })); },
  };
});
