/** Pure sky math: the light of the day, the moon, the season, the weather. No browser APIs. */

export type Phase = 'night' | 'dawn' | 'day' | 'golden' | 'dusk';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type Weather = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

const dayOfYear = (d: Date) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000);

/**
 * Rough local sunrise/sunset in hours, without needing a location: about 5:20/20:00 at midsummer,
 * 7:40/17:00 at midwinter (northern mid-latitudes, where Austin lives).
 */
export function sunTimes(d: Date): { rise: number; set: number } {
  const k = Math.cos((2 * Math.PI * (dayOfYear(d) - 172)) / 365);
  return { rise: 6.5 - 1.2 * k, set: 18.5 + 1.5 * k };
}

export function skyPhase(d: Date): Phase {
  const h = d.getHours() + d.getMinutes() / 60;
  const { rise, set } = sunTimes(d);
  if (h < rise - 1 || h >= set + 1) return 'night';
  if (h < rise + 0.75) return 'dawn';
  if (h < set - 1.25) return 'day';
  if (h < set) return 'golden';
  return 'dusk';
}

const SYNODIC = 29.530588853;
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14);

/** Moon age as a fraction of the cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(d: Date): number {
  const days = (d.getTime() - KNOWN_NEW) / 86_400_000;
  return (((days / SYNODIC) % 1) + 1) % 1;
}

export function moonName(p: number): string {
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return names[Math.round(p * 8) % 8];
}

/**
 * SVG path for the lit part of a moon of radius r centred at 0,0. The terminator is an ellipse
 * whose width follows the phase; waxing is lit on the right.
 */
export function moonPath(p: number, r: number): string {
  const waxing = p <= 0.5;
  const lit = 1 - Math.abs(1 - 2 * p); // 0 new → 1 full
  const tx = Math.abs(1 - 2 * lit) * r; // terminator half-width
  const outer = waxing ? 1 : 0; // which side the bright limb is on
  const inner = lit > 0.5 ? outer : 1 - outer;
  return `M0 ${-r} A${r} ${r} 0 0 ${outer} 0 ${r} A${tx.toFixed(2)} ${r} 0 0 ${inner} 0 ${-r} Z`;
}

export function season(d: Date): Season {
  const m = d.getMonth();
  return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn';
}

/** WMO weather code (Open-Meteo) → what the sky should show. */
export function weatherKind(code: number): Weather {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 2) return 'cloudy';
  return 'clear';
}

/** Coordinates rounded to ~10 km, so the weather service never gets a precise location. */
export const roughly = (n: number) => Math.round(n * 10) / 10;
