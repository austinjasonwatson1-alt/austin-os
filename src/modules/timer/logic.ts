import { iso } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { CatKey, DayMap } from '../ledger/types';
import type { Running, TimerData } from './types';

/** Time actually spent writing (pauses taken out). */
export function elapsedMs(r: Running, now: number): number {
  return Math.max(0, (r.pausedAt ?? now) - r.startedAt - r.pausedMs);
}

/** 25:00, or 1:05:09 once past the hour. */
export function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Split a session's minutes across the local days its wall-clock span covers, in proportion,
 * so a 11:30pm–12:30am session counts on both days. Rounded so the parts add up to `minutes`.
 */
export function creditDays(startedAt: number, endedAt: number, minutes: number): Record<string, number> {
  if (minutes <= 0) return {};
  const span = Math.max(1, endedAt - startedAt);
  const parts: [string, number][] = [];
  let cursor = startedAt;
  while (cursor < endedAt) {
    const d = new Date(cursor);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const end = Math.min(next, endedAt);
    parts.push([iso(d), ((end - cursor) / span) * minutes]);
    cursor = end;
  }
  if (parts.length === 0) return { [iso(new Date(startedAt))]: minutes };
  const out: Record<string, number> = {};
  let given = 0;
  parts.forEach(([day, share], i) => {
    const n = i === parts.length - 1 ? minutes - given : Math.round(share);
    given += n;
    if (n > 0) out[day] = (out[day] ?? 0) + n;
  });
  return out;
}

/** The Ledger's days with a session's credit added to category `cat`. */
export function applyCredit(days: DayMap, credit: Record<string, number>, cat: CatKey): DayMap {
  const out = { ...days };
  for (const [day, n] of Object.entries(credit)) {
    const e = { ...out[day] };
    e[cat] = (Number(e[cat]) || 0) + n;
    out[day] = e;
  }
  return out;
}

export const describeTimer: Describer = {
  name: 'Lamp mode sessions',
  size: (v) => (v as Partial<TimerData>).sessions?.length ?? 0,
  detail: (v) => {
    const s = (v as Partial<TimerData>).sessions ?? [];
    const mins = s.reduce((a, x) => a + x.minutes, 0);
    return `${s.length} session${s.length === 1 ? '' : 's'} · ${Math.round(mins / 6) / 10}h`;
  },
};
