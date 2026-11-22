/**
 * Real life flowing in: Apple Health (steps, sleep, workouts) and the calendar, through Siri
 * Shortcuts links or an .ics file. Pure parsing and arithmetic only.
 */
import type { Describer } from '../../core/restoreLogic';

/* ---------------- the body: steps and sleep ---------------- */

export interface BodyDay { steps?: number; sleep?: number }
export interface BodyData { days: Record<string, BodyDay> }
export const DEFAULT_BODY: BodyData = { days: {} };

export interface HealthLink { day: string; steps?: number; sleep?: number; workout?: number; wkind: 'strength' | 'cardio' | 'walk' }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Numbers as Shortcuts sends them: "8,412", "7.4", "7 hr 24 min" (sleep), "45 min". */
export function looseNumber(s: string | null): number | undefined {
  if (s === null || s.trim() === '') return undefined;
  const t = s.trim().toLowerCase();
  const hm = t.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?|r)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/);
  if (hm) return Number(hm[1]) + (hm[2] ? Number(hm[2]) / 60 : 0);
  const n = Number(t.replace(/,/g, '').replace(/\s*(min(utes?)?|m|steps?)$/, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** `#/health?steps=8412&sleep=7.4&workout=35&kind=cardio&date=2026-11-22` (all optional but one). */
export function parseHealth(query: string, today: string): HealthLink | null {
  const q = new URLSearchParams(query);
  const day = q.get('date') && DAY.test(q.get('date')!) ? q.get('date')! : today;
  const steps = looseNumber(q.get('steps'));
  let sleep = looseNumber(q.get('sleep'));
  if (sleep !== undefined && sleep > 24) sleep = sleep / 60; // sent in minutes
  const workout = looseNumber(q.get('workout') ?? q.get('w'));
  const k = (q.get('kind') ?? 'cardio').toLowerCase();
  const wkind = k.startsWith('str') ? 'strength' : k.startsWith('walk') ? 'walk' : 'cardio';
  if (steps === undefined && sleep === undefined && !workout) return null;
  return { day, steps: steps === undefined ? undefined : Math.round(steps), sleep: sleep === undefined ? undefined : Math.round(sleep * 10) / 10, workout: workout ? Math.round(workout) : undefined, wkind };
}

export function stepsWeek(days: Record<string, BodyDay>, dates: string[]): { date: string; steps: number }[] {
  return dates.map((d) => ({ date: d, steps: days[d]?.steps ?? 0 }));
}
export function avgSleep(days: Record<string, BodyDay>, dates: string[]): number | null {
  const s = dates.map((d) => days[d]?.sleep).filter((x): x is number => typeof x === 'number' && x > 0);
  return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
}

export const describeBody: Describer = {
  name: 'Health (steps & sleep)',
  size: (v) => Object.keys((v as Partial<BodyData>)?.days ?? {}).length,
  detail: (v) => { const n = Object.keys((v as Partial<BodyData>)?.days ?? {}).length; return `${n} day${n === 1 ? '' : 's'} from Apple Health`; },
};

/* ---------------- the calendar ---------------- */

export interface CalEvent { day: string; start?: string; end?: string; title: string; allDay?: boolean }

/**
 * Today's events from a Shortcut: one per line, "09:00-10:00 Standup", "13:30 Dentist" or
 * "all-day Mom's birthday". `#/cal?d=2026-11-22&e=<url-encoded lines>`.
 */
export function parseShortcutEvents(text: string, day: string): CalEvent[] {
  return text.split(/\r?\n|\|/).map((l) => l.trim()).filter(Boolean).map((l): CalEvent | null => {
    const all = l.match(/^all[- ]?day\s+(.+)$/i);
    if (all) return { day, title: all[1].trim(), allDay: true };
    const m = l.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?(?:\s*[-–]\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?\s+(.+)$/i);
    if (!m) return { day, title: l, allDay: true };
    const hh = (h: string, ap?: string) => { let n = Number(h) % 24; if (ap) { n = n % 12; if (ap.toLowerCase() === 'pm') n += 12; } return String(n).padStart(2, '0'); };
    return { day, start: `${hh(m[1], m[3])}:${m[2]}`, end: m[4] ? `${hh(m[4], m[6] ?? m[3])}:${m[5]}` : undefined, title: m[7].trim() };
  }).filter((e): e is CalEvent => e !== null);
}

/** Events from an .ics file (exported from Google Calendar or iCloud), within [from, to]. */
export function parseIcs(text: string, from: string, to: string): CalEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const out: CalEvent[] = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const field = (name: string) => body.match(new RegExp(`^${name}(;[^:\\n]*)?:(.*)$`, 'm'));
    const s = field('DTSTART'); const e = field('DTEND'); const sum = field('SUMMARY');
    if (!s) continue;
    const when = (f: RegExpMatchArray) => {
      const v = f[2].trim();
      const dm = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?(Z)?/);
      if (!dm) return null;
      if (!dm[4]) return { day: `${dm[1]}-${dm[2]}-${dm[3]}`, time: undefined };
      if (dm[6]) { // UTC: show in local time
        const d = new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +dm[4], +dm[5]));
        return { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
      }
      return { day: `${dm[1]}-${dm[2]}-${dm[3]}`, time: `${dm[4]}:${dm[5]}` };
    };
    const st = when(s); if (!st || st.day < from || st.day > to) continue;
    const en = e ? when(e) : null;
    const title = (sum?.[2] ?? 'Busy').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').trim();
    out.push(st.time ? { day: st.day, start: st.time, end: en?.day === st.day ? en.time : undefined, title } : { day: st.day, title, allDay: true });
  }
  return sortEvents(out);
}

export const sortEvents = (es: CalEvent[]) => [...es].sort((a, b) => a.day.localeCompare(b.day) || Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || (a.start ?? '').localeCompare(b.start ?? ''));

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Free stretches of a day between events (default 7am–10pm, at least an hour), after `now` if given. */
export function freeWindows(events: CalEvent[], day: string, opts: { from?: string; to?: string; min?: number; now?: string } = {}): { start: string; end: string; mins: number }[] {
  const lo = Math.max(toMin(opts.from ?? '07:00'), opts.now ? toMin(opts.now) : 0), hi = toMin(opts.to ?? '22:00'), min = opts.min ?? 60;
  const busy = events.filter((e) => e.day === day && e.start).map((e) => [toMin(e.start!), e.end ? toMin(e.end) : toMin(e.start!) + 60] as const).sort((a, b) => a[0] - b[0]);
  const out: { start: string; end: string; mins: number }[] = [];
  let cur = lo;
  for (const [s, e] of busy) { if (s - cur >= min) out.push({ start: toTime(cur), end: toTime(s), mins: s - cur }); cur = Math.max(cur, e); }
  if (hi - cur >= min) out.push({ start: toTime(cur), end: toTime(hi), mins: hi - cur });
  return out;
}

/** "7:00 pm" style for showing a time. */
export const clock = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
