import { create } from 'zustand';
import { kvGet, kvSet, saveWithSnapshot, SYS_PREFIX } from '../../core/storage';
import { AREA_STORES } from '../areas/store';
import { DEFAULT_BODY, sortEvents, type BodyData, type CalEvent, type HealthLink } from './logic';

export const BODY_KEY = 'body.v1';
/** The calendar is a copy of something that lives elsewhere: kept on this device only. */
const CAL_KEY = SYS_PREFIX + 'calendar';

interface FeedsState extends BodyData {
  loaded: boolean;
  events: CalEvent[];
  calAt: string | null;
  load: (force?: boolean) => Promise<void>;
  /** Apple Health, via a Shortcut. Safe to run more than once a day: nothing is ever counted twice. */
  applyHealth: (h: HealthLink) => void;
  /** Replace the events for the given days (a Shortcut sends one day; an .ics file a range). */
  setEvents: (events: CalEvent[], days: string[]) => void;
  clearCalendar: () => void;
}

export const useFeeds = create<FeedsState>((set, get) => {
  const persist = () => { if (get().loaded) void saveWithSnapshot(BODY_KEY, { days: get().days } satisfies BodyData); };
  const saveCal = () => void kvSet(CAL_KEY, { events: get().events, at: get().calAt });
  return {
    ...DEFAULT_BODY,
    loaded: false,
    events: [],
    calAt: null,
    async load(force = false) {
      if (get().loaded && !force) return;
      const [body, cal] = await Promise.all([kvGet<BodyData>(BODY_KEY), kvGet<{ events: CalEvent[]; at: string | null }>(CAL_KEY)]);
      set({ days: body?.days ?? {}, events: cal?.events ?? [], calAt: cal?.at ?? null, loaded: true });
    },
    applyHealth(h) {
      const cur = get().days[h.day] ?? {};
      set({ days: { ...get().days, [h.day]: { ...cur, ...(h.steps !== undefined ? { steps: h.steps } : {}), ...(h.sleep !== undefined ? { sleep: h.sleep } : {}) } } });
      persist();
      if (h.workout) {
        const forge = AREA_STORES.forge.getState();
        const have = Number(forge.days[h.day]?.[h.wkind]) || 0;
        if (h.workout > have) forge.setMinutes(h.day, h.wkind, h.workout);
      }
    },
    setEvents(events, days) {
      const keep = get().events.filter((e) => !days.includes(e.day));
      set({ events: sortEvents([...keep, ...events]).slice(-400), calAt: new Date().toISOString() });
      saveCal();
    },
    clearCalendar() { set({ events: [], calAt: null }); saveCal(); },
  };
});
