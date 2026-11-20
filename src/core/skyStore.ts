/**
 * The sky's live state: the time of day, the user's sky preferences, and (only if turned on) the
 * local weather. Weather needs the browser's location; it is rounded to ~10 km before it leaves
 * the device and stored only on this device (a `sys:` key, never in backups).
 */
import { create } from 'zustand';
import { roughly, weatherKind, type Weather } from './skyLogic';
import { kvDel, kvGet, kvSet, saveWithSnapshot, SYS_PREFIX } from './storage';

const PREFS = 'os.prefs';
const WX = SYS_PREFIX + 'weather';
const WX_EVERY_MS = 30 * 60_000;

export interface Prefs {
  /** A soft bell on an elite day and at the end of a lamp-mode goal. */
  chime: boolean;
}
interface WxSaved { lat: number; lon: number; kind: Weather | null; temp: number | null; at: number }

interface SkyState {
  prefs: Prefs;
  weatherOn: boolean;
  weather: Weather | null;
  temp: number | null;
  weatherErr: string | null;
  load: () => Promise<void>;
  setChime: (on: boolean) => void;
  /** Ask for location (must run from a click), then fetch the weather. */
  enableWeather: () => Promise<void>;
  disableWeather: () => Promise<void>;
  refreshWeather: (force?: boolean) => Promise<void>;
}

let timer: ReturnType<typeof setInterval> | undefined;

export const useSky = create<SkyState>((set, get) => ({
  prefs: { chime: false },
  weatherOn: false,
  weather: null,
  temp: null,
  weatherErr: null,

  async load() {
    const p = await kvGet<Prefs>(PREFS);
    if (p) set({ prefs: { ...get().prefs, ...p } });
    const w = await kvGet<WxSaved>(WX);
    if (w) {
      set({ weatherOn: true, weather: w.kind, temp: w.temp });
      void get().refreshWeather();
      clearInterval(timer);
      timer = setInterval(() => void get().refreshWeather(), WX_EVERY_MS);
    }
  },

  setChime(chime) {
    const prefs = { ...get().prefs, chime };
    set({ prefs });
    void saveWithSnapshot(PREFS, prefs);
  },

  async enableWeather() {
    set({ weatherErr: null });
    if (!('geolocation' in navigator)) return void set({ weatherErr: 'This browser cannot share a location.' });
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { maximumAge: 3_600_000, timeout: 15_000, enableHighAccuracy: false }));
      await kvSet(WX, { lat: roughly(pos.coords.latitude), lon: roughly(pos.coords.longitude), kind: null, temp: null, at: 0 } satisfies WxSaved);
      set({ weatherOn: true });
      await get().refreshWeather(true);
      clearInterval(timer);
      timer = setInterval(() => void get().refreshWeather(), WX_EVERY_MS);
    } catch {
      set({ weatherErr: 'Location was not shared, so the weather stays off.' });
    }
  },

  async disableWeather() {
    clearInterval(timer);
    await kvDel(WX);
    set({ weatherOn: false, weather: null, temp: null, weatherErr: null });
  },

  async refreshWeather(force = false) {
    const w = await kvGet<WxSaved>(WX);
    if (!w) return;
    if (!force && Date.now() - w.at < WX_EVERY_MS) return;
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&current=weather_code,temperature_2m&temperature_unit=fahrenheit`);
      const j = (await r.json()) as { current?: { weather_code?: number; temperature_2m?: number } };
      const code = j.current?.weather_code;
      const next: WxSaved = { ...w, kind: typeof code === 'number' ? weatherKind(code) : null, temp: j.current?.temperature_2m ?? null, at: Date.now() };
      await kvSet(WX, next);
      set({ weather: next.kind, temp: next.temp === null ? null : Math.round(next.temp), weatherErr: null });
    } catch {
      set({ weatherErr: 'Could not reach the weather service just now.' });
    }
  },
}));
