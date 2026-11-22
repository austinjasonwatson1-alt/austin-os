import { create } from 'zustand';
import { addDays } from '../../core/dates';
import { kvGet, markDeleted, saveWithSnapshot } from '../../core/storage';
import { carryOver, entryOf, isEmptyEntry, setIntentions, withCarried } from './logic';
import { DEFAULT_DAY, type DayData, type DayEntry, type Habit, type IntentionState, type LifeArea } from './types';

export const KEY = 'day.v1';

interface DayState extends DayData {
  loaded: boolean;
  /** Read from storage once; `force` re-reads after a restore. */
  load: (force?: boolean) => Promise<void>;
  /** The morning: one line per area (blank clears that area). */
  setDay: (day: string, lines: Partial<Record<LifeArea, string>>) => void;
  /** Mark (or unmark, with undefined) one intention. */
  mark: (day: string, area: LifeArea, state: IntentionState | undefined) => void;
  /** Check or uncheck a habit on a day. Returns whether it is now done. */
  toggleHabit: (day: string, id: string) => boolean;
  reflect: (day: string, r: { well?: string; carry?: string }) => void;
  /** Seal the day. */
  closeDay: (day: string) => void;
  reopenDay: (day: string) => void;
  /** Copy what wasn't kept into the next day (what's already there wins). Returns how many moved. */
  carryToTomorrow: (day: string) => number;
  saveHabit: (h: Omit<Habit, 'id' | 'createdAt'> & { id?: string }) => Habit;
  setArchived: (id: string, archived: boolean) => void;
  /** Remove a habit for good. Past days keep their record of it. */
  removeHabit: (id: string) => void;
}

const newId = () => `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useDay = create<DayState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { days: get().days, habits: get().habits } satisfies DayData); };

  /** Change one day's entry and persist. An entry left with nothing in it is dropped. */
  const edit = (day: string, fn: (e: DayEntry) => DayEntry) => {
    const next = fn(entryOf(get().days, day));
    const days = { ...get().days };
    if (isEmptyEntry(next)) delete days[day]; else days[day] = next;
    set({ days });
    persist();
  };

  return {
    ...DEFAULT_DAY,
    loaded: false,

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<Partial<DayData>>(KEY);
      set({
        days: saved?.days && typeof saved.days === 'object' ? saved.days : {},
        habits: Array.isArray(saved?.habits) ? saved.habits : [],
        loaded: true,
      });
    },

    setDay(day, lines) { edit(day, (e) => setIntentions(e, lines)); },

    mark(day, area, state) {
      edit(day, (e) => ({ ...e, intentions: e.intentions.map((i) => (i.area === area ? withState(i, state) : i)) }));
    },

    toggleHabit(day, id) {
      const on = !entryOf(get().days, day).done.includes(id);
      edit(day, (e) => ({ ...e, done: on ? [...e.done, id] : e.done.filter((x) => x !== id) }));
      return on;
    },

    reflect(day, r) {
      edit(day, (e) => {
        const out = { ...e, ...r };
        if (!out.well) delete out.well;
        if (!out.carry) delete out.carry;
        return out;
      });
    },

    closeDay(day) { edit(day, (e) => ({ ...e, closedAt: new Date().toISOString() })); },

    reopenDay(day) { edit(day, (e) => { const { closedAt: _, ...rest } = e; return rest; }); },

    carryToTomorrow(day) {
      const carried = carryOver(entryOf(get().days, day));
      let n = 0;
      edit(addDays(day, 1), (t) => { const r = withCarried(t, carried); n = r.added; return r.entry; });
      return n;
    },

    saveHabit(h) {
      const habits = get().habits;
      const existing = h.id ? habits.find((x) => x.id === h.id) : undefined;
      const habit: Habit = { ...h, name: h.name.trim(), id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? new Date().toISOString() };
      if (!habit.area) delete habit.area;
      if (!habit.archived) delete habit.archived;
      set({ habits: existing ? habits.map((x) => (x.id === habit.id ? habit : x)) : [...habits, habit] });
      persist();
      return habit;
    },

    setArchived(id, archived) {
      set({ habits: get().habits.map((h) => {
        if (h.id !== id) return h;
        const { archived: _, ...rest } = h;
        return archived ? { ...rest, archived: true } : rest;
      }) });
      persist();
    },

    removeHabit(id) {
      void markDeleted(KEY, id);
      set({ habits: get().habits.filter((h) => h.id !== id) });
      persist();
    },
  };
});

function withState<T extends { state?: IntentionState }>(i: T, state: IntentionState | undefined): T {
  const { state: _, ...rest } = i;
  return (state ? { ...rest, state } : rest) as T;
}
