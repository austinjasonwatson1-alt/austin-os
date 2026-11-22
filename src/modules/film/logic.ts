import { addDays, daysOfYear } from '../../core/dates';
import { chapelMinutes } from '../chapel/logic';
import { dayTotal } from '../ledger/logic';
import { hallOfRecords, type HallInput } from '../records/logic';

/** One scene of the year-end film, with only the numbers it needs to draw itself. */
export type Scene =
  | { kind: 'title'; year: number }
  | { kind: 'hours'; hours: number; days: number; ofDays: number }
  | { kind: 'months'; hours: number[]; best: number }
  | { kind: 'streak'; days: number; from: string; to: string }
  | { kind: 'words'; words: number; sprints: number; bestSprint: number }
  | { kind: 'books'; count: number; pages: number; covers: { title: string; cover?: string }[]; favorite: string | null }
  | { kind: 'trophies'; names: string[]; total: number }
  | { kind: 'chapel'; hours: number; days: number; answered: number }
  | { kind: 'road'; sent: number; requests: number; offers: number }
  | { kind: 'end'; next: number };

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Seconds each scene holds the screen. */
export const SCENE_SECONDS: Record<Scene['kind'], number> = { title: 3.2, hours: 4, months: 4.6, streak: 4.2, words: 4, books: 5, trophies: 4.6, chapel: 4, road: 4, end: 4.4 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The year as a short film: only the scenes the year actually has something to say in. */
export function yearFilm(h: HallInput, year: number, opts: { chapel: boolean } = { chapel: true }): Scene[] {
  const y = String(year);
  const scenes: Scene[] = [{ kind: 'title', year }];

  const keys = daysOfYear(year);
  const logged = keys.filter((k) => dayTotal(h.days[k]) > 0);
  const mins = logged.reduce((n, k) => n + dayTotal(h.days[k]), 0);
  if (mins > 0) {
    const today = new Date();
    const ofDays = year === today.getFullYear() ? keys.filter((k) => k <= `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`).length : keys.length;
    scenes.push({ kind: 'hours', hours: Math.round(mins / 60), days: logged.length, ofDays });
    const months = Array.from({ length: 12 }, (_, m) => r1(logged.filter((k) => Number(k.slice(5, 7)) === m + 1).reduce((n, k) => n + dayTotal(h.days[k]), 0) / 60));
    scenes.push({ kind: 'months', hours: months, best: months.indexOf(Math.max(...months)) });
    // The longest run of days inside the year.
    let best = { days: 0, from: '', to: '' }, run = 0, start = '', prev = '';
    for (const k of logged) {
      if (prev && addDays(prev, 1) === k) run++; else { run = 1; start = k; }
      prev = k;
      if (run > best.days) best = { days: run, from: start, to: k };
    }
    if (best.days >= 3) scenes.push({ kind: 'streak', ...best });
  }

  // Words added to the manuscripts this year, and the year's sprints.
  let words = 0;
  for (const m of h.manuscripts) {
    const ks = Object.keys(m.history).sort();
    const end = ks.filter((k) => k.startsWith(y)).pop();
    if (!end) continue;
    const before = ks.filter((k) => k < `${y}-01-01`).pop();
    words += Math.max(0, m.history[end] - (before ? m.history[before] : 0));
  }
  const sprints = (h.sprints ?? []).filter((s) => s.completed && s.day.startsWith(y));
  if (words > 0 || sprints.length) scenes.push({ kind: 'words', words, sprints: sprints.length, bestSprint: Math.max(0, ...sprints.map((s) => s.words)) });

  const read = h.books.filter((b) => b.status === 'read' && b.finished?.startsWith(y)).sort((a, b) => (a.finished ?? '').localeCompare(b.finished ?? ''));
  if (read.length) {
    const fav = [...read].sort((a, b) => b.rating - a.rating || (b.finished ?? '').localeCompare(a.finished ?? ''))[0];
    scenes.push({ kind: 'books', count: read.length, pages: read.reduce((n, b) => n + (b.pages ?? 0), 0), covers: read.slice(-9).map((b) => ({ title: b.title, cover: b.cover })), favorite: fav.rating >= 4.5 ? fav.title : null });
  }

  const won = hallOfRecords(h).trophies.filter((t) => t.earned && t.date?.startsWith(y) && (opts.chapel || t.wing !== 'chapel'));
  if (won.length) scenes.push({ kind: 'trophies', names: won.sort((a, b) => b.tier - a.tier || a.date!.localeCompare(b.date!)).slice(0, 6).map((t) => t.name), total: won.length });

  if (opts.chapel) {
    const cdays = keys.filter((k) => chapelMinutes(h.chapel[k]) > 0);
    const cmins = cdays.reduce((n, k) => n + chapelMinutes(h.chapel[k]), 0);
    const answered = h.prayers.filter((p) => p.answeredOn?.startsWith(y)).length;
    if (cmins > 0 || answered) scenes.push({ kind: 'chapel', hours: r1(cmins / 60), days: cdays.length, answered });
  }

  const sent = h.queries.filter((q) => q.sentOn?.startsWith(y));
  if (sent.length) {
    scenes.push({ kind: 'road', sent: sent.length, requests: sent.filter((q) => ['partial', 'full', 'offer'].includes(q.status)).length, offers: sent.filter((q) => q.status === 'offer').length });
  }

  scenes.push({ kind: 'end', next: year + 1 });
  return scenes;
}

/** Where in the film a moment falls: which scene, and how far through it (0–1). */
export function timeline(scenes: Scene[]): { total: number; at: (t: number) => { i: number; p: number; local: number } } {
  const lens = scenes.map((s) => SCENE_SECONDS[s.kind]);
  const total = lens.reduce((a, b) => a + b, 0);
  return {
    total,
    at(t: number) {
      let acc = 0;
      for (let i = 0; i < lens.length; i++) {
        if (t < acc + lens[i] || i === lens.length - 1) { const local = Math.max(0, t - acc); return { i, p: Math.min(1, local / lens[i]), local }; }
        acc += lens[i];
      }
      return { i: 0, p: 0, local: 0 };
    },
  };
}
