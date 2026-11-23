import { create } from 'zustand';
import { parseISO } from '../../core/dates';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { planOf, setLabel, toggleBlock } from './logic';
import { DEFAULT_SCHEDULE, DEFAULT_SETTINGS, type ScheduleData, type ScheduleSettings, type WeekTask } from './types';

export const KEY = 'schedule.v1';

interface ScheduleState extends ScheduleData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Check or uncheck a block. Returns whether it is now done. */
  toggle: (date: string, i: number) => boolean;
  /** Name a block for one day, or (repeat) for that weekday every week. */
  label: (date: string, i: number, text: string, repeat?: boolean) => void;
  /** Stop a weekly repeat for this weekday and block. */
  unrepeat: (date: string, i: number) => void;
  addTask: (monday: string, text: string, day?: number) => void;
  patchTask: (monday: string, id: string, p: Partial<WeekTask>) => void;
  removeTask: (monday: string, id: string) => void;
  setSettings: (s: Partial<ScheduleSettings>) => void;
}

const newId = () => `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const stamp = () => new Date().toISOString();

export const useSchedule = create<ScheduleState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with defaults.
  const persist = () => { if (get().loaded) { const { settings, days, weeks, repeat } = get(); void saveWithSnapshot(KEY, { settings, days, weeks, repeat } satisfies ScheduleData); } };
  const week = (monday: string, fn: (ts: WeekTask[]) => WeekTask[]) => { set({ weeks: { ...get().weeks, [monday]: fn(get().weeks[monday] ?? []) } }); persist(); };
  return {
    ...DEFAULT_SCHEDULE,
    loaded: false,
    async load(force = false) {
      if (get().loaded && !force) return;
      const s = await kvGet<Partial<ScheduleData>>(KEY);
      set({ settings: { ...DEFAULT_SETTINGS, ...(s?.settings ?? {}) }, days: s?.days ?? {}, weeks: s?.weeks ?? {}, repeat: s?.repeat ?? {}, loaded: true });
    },
    toggle(date, i) {
      const p = toggleBlock(planOf(get(), date), i, stamp());
      set({ days: { ...get().days, [date]: p } });
      persist();
      return p.done.includes(i);
    },
    label(date, i, text, repeat) {
      if (repeat) {
        const wd = String(parseISO(date).getDay());
        const m = { ...(get().repeat[wd] ?? {}) };
        if (text.trim()) m[String(i)] = text.trim(); else delete m[String(i)];
        // The day itself follows the repeat now, so clear its own label.
        set({ repeat: { ...get().repeat, [wd]: m }, days: { ...get().days, [date]: setLabel(planOf(get(), date), i, '', stamp()) } });
      } else {
        set({ days: { ...get().days, [date]: setLabel(planOf(get(), date), i, text, stamp()) } });
      }
      persist();
    },
    unrepeat(date, i) {
      const wd = String(parseISO(date).getDay());
      const m = { ...(get().repeat[wd] ?? {}) }; delete m[String(i)];
      set({ repeat: { ...get().repeat, [wd]: m } });
      persist();
    },
    addTask(monday, text, day) { if (text.trim()) week(monday, (ts) => [...ts, { id: newId(), text: text.trim(), day, edited: stamp() }]); },
    patchTask(monday, id, p) { week(monday, (ts) => ts.map((t) => (t.id === id ? { ...t, ...p, edited: stamp() } : t))); },
    // Kept as a marker, so the removal wins on other devices too (newest edit wins).
    removeTask(monday, id) { week(monday, (ts) => ts.map((t) => (t.id === id ? { id: t.id, text: t.text, gone: true, edited: stamp() } : t))); },
    setSettings(s) { set({ settings: { ...get().settings, ...s } }); persist(); },
  };
});
