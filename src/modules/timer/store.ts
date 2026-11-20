import { create } from 'zustand';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { useLedger } from '../ledger/store';
import type { CatKey } from '../ledger/types';
import { creditDays, elapsedMs } from './logic';
import { DEFAULT_TIMER, KEEP_SESSIONS, type Ambient, type Session, type TimerData } from './types';

export const KEY = 'timer.v1';

interface TimerState extends TimerData {
  loaded: boolean;
  load: () => Promise<void>;
  start: (cat: CatKey, goal: number) => void;
  pause: () => void;
  resume: () => void;
  setCat: (cat: CatKey) => void;
  setGoal: (goal: number) => void;
  /** Stop and log the minutes into the Ledger. Returns the session (null if under a minute). */
  stop: () => Session | null;
  /** Throw the running session away without logging it. */
  discard: () => void;
  /** Take a logged session back out of the Ledger. */
  undoSession: (id: string) => void;
  setAmbient: (a: Ambient) => void;
}

const pick = (s: TimerState): TimerData => ({ running: s.running, sessions: s.sessions, ambient: s.ambient, lastCat: s.lastCat, lastGoal: s.lastGoal });

export const useTimer = create<TimerState>((set, get) => {
  const persist = () => void saveWithSnapshot(KEY, pick(get()));
  const patchRun = (p: Partial<NonNullable<TimerData['running']>>) => {
    const r = get().running;
    if (!r) return;
    set({ running: { ...r, ...p } });
    persist();
  };

  return {
    ...DEFAULT_TIMER,
    loaded: false,

    async load() {
      const saved = await kvGet<TimerData>(KEY);
      set({ ...DEFAULT_TIMER, ...(saved ?? {}), loaded: true });
    },

    start(cat, goal) {
      if (get().running) return;
      set({ running: { cat, goal, startedAt: Date.now(), pausedAt: null, pausedMs: 0 }, lastCat: cat, lastGoal: goal });
      persist();
    },

    pause() {
      const r = get().running;
      if (r && r.pausedAt === null) patchRun({ pausedAt: Date.now() });
    },

    resume() {
      const r = get().running;
      if (r && r.pausedAt !== null) patchRun({ pausedAt: null, pausedMs: r.pausedMs + (Date.now() - r.pausedAt) });
    },

    setCat(cat) {
      set({ lastCat: cat });
      if (get().running) patchRun({ cat });
      else persist();
    },

    setGoal(goal) {
      set({ lastGoal: goal });
      if (get().running) patchRun({ goal });
      else persist();
    },

    stop() {
      const r = get().running;
      if (!r) return null;
      const end = r.pausedAt ?? Date.now();
      const minutes = Math.round(elapsedMs(r, end) / 60_000);
      set({ running: null });
      if (minutes < 1) {
        persist();
        return null;
      }
      const credit = creditDays(r.startedAt, end, minutes);
      const ledger = useLedger.getState();
      for (const [day, n] of Object.entries(credit)) ledger.setMinutes(day, r.cat, (Number(ledger.days[day]?.[r.cat]) || 0) + n);
      const s: Session = { id: `s-${r.startedAt.toString(36)}`, cat: r.cat, startedAt: r.startedAt, endedAt: end, minutes, credit };
      set({ sessions: [s, ...get().sessions].slice(0, KEEP_SESSIONS) });
      persist();
      return s;
    },

    discard() {
      set({ running: null });
      persist();
    },

    undoSession(id) {
      const s = get().sessions.find((x) => x.id === id);
      if (!s) return;
      const ledger = useLedger.getState();
      for (const [day, n] of Object.entries(s.credit)) {
        ledger.setMinutes(day, s.cat, Math.max(0, (Number(useLedger.getState().days[day]?.[s.cat]) || 0) - n));
      }
      set({ sessions: get().sessions.filter((x) => x.id !== id) });
      persist();
    },

    setAmbient(ambient) {
      set({ ambient });
      persist();
    },
  };
});
