import { addDays, mondayOf } from '../../core/dates';
import type { ChapelDay, Prayer } from '../chapel/types';
import { chapelMinutes } from '../chapel/logic';
import { dayTotal, gradeOf, longestStreak } from '../ledger/logic';
import { milestones } from '../ledger/milestones';
import type { DayMap, Thresholds } from '../ledger/types';
import type { Manuscript } from '../manuscripts/types';
import type { Contest, Query } from '../pub/types';
import type { Book } from '../shelf/types';
import type { Sprint } from '../drafts/types';

/** Everything the Hall reads. Each piece is optional so a missing store never breaks it. */
export interface HallInput {
  days: DayMap;
  thresholds: Thresholds;
  weekly: Thresholds;
  books: Book[];
  goals: Record<string, number>;
  manuscripts: Manuscript[];
  queries: Query[];
  contests: Contest[];
  chapel: Record<string, ChapelDay>;
  prayers: Prayer[];
  sprints?: Sprint[];
}

export type Wing = 'writing' | 'reading' | 'manuscript' | 'road' | 'chapel';
export const WINGS: { id: Wing; name: string }[] = [
  { id: 'writing', name: 'The Writing Life' },
  { id: 'reading', name: 'The Reader' },
  { id: 'manuscript', name: 'The Manuscript' },
  { id: 'road', name: 'The Road' },
  { id: 'chapel', name: 'The Chapel' },
];

/** A personal best: one number, what it was, and when. */
export interface Record_ { wing: Wing; name: string; value: string; detail?: string; date?: string }

/** A trophy: earned on a day (or undated), or still locked with how close it is. */
export interface Trophy {
  id: string;
  wing: Wing;
  name: string;
  desc: string;
  earned: boolean;
  date?: string;
  /** 0–1 toward earning it, for locked ones. */
  progress: number;
  /** e.g. "6 / 10". */
  count?: string;
  /** Rarer trophies are drawn bigger and brighter. */
  tier: 1 | 2 | 3;
}

const hrs = (m: number) => (m >= 600 ? `${Math.round(m / 60).toLocaleString('en-US')} h` : `${Math.floor(m / 60)}h ${m % 60}m`);
const words = (n: number) => n.toLocaleString('en-US');

/** The day the running count first reaches n, walking dated events in order. */
function nthDate(dates: (string | undefined)[], n: number): string | undefined {
  const d = dates.filter((x): x is string => Boolean(x)).sort();
  return d.length >= n ? d[n - 1] : undefined;
}

function longestRun(keys: string[]): number {
  let best = 0, run = 0, prev = '';
  for (const k of [...keys].sort()) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; prev = k; best = Math.max(best, run); }
  return best;
}

export function hallOfRecords(h: HallInput): { records: Record_[]; trophies: Trophy[] } {
  const records: Record_[] = [];
  const trophies: Trophy[] = [];
  const add = (t: Omit<Trophy, 'progress' | 'count'> & { have?: number; need?: number }) => {
    const { have, need, ...rest } = t;
    trophies.push({ ...rest, progress: rest.earned ? 1 : need ? Math.min(1, (have ?? 0) / need) : 0, count: need && !rest.earned ? `${Math.min(have ?? 0, need).toLocaleString('en-US')} / ${need.toLocaleString('en-US')}` : undefined });
  };

  /* ---- the writing life ---- */
  const dayKeys = Object.keys(h.days).filter((k) => dayTotal(h.days[k]) > 0);
  if (dayKeys.length) {
    const best = dayKeys.reduce((a, b) => (dayTotal(h.days[b]) > dayTotal(h.days[a]) ? b : a));
    const weeks: Record<string, number> = {};
    const months: Record<string, number> = {};
    for (const k of dayKeys) { weeks[mondayOf(k)] = (weeks[mondayOf(k)] ?? 0) + dayTotal(h.days[k]); months[k.slice(0, 7)] = (months[k.slice(0, 7)] ?? 0) + dayTotal(h.days[k]); }
    const bw = Object.keys(weeks).reduce((a, b) => (weeks[b] > weeks[a] ? b : a));
    const bm = Object.keys(months).reduce((a, b) => (months[b] > months[a] ? b : a));
    const total = dayKeys.reduce((n, k) => n + dayTotal(h.days[k]), 0);
    const elites = dayKeys.filter((k) => gradeOf(dayTotal(h.days[k]), h.thresholds) === 'elite').length;
    records.push(
      { wing: 'writing', name: 'Best day', value: hrs(dayTotal(h.days[best])), date: best },
      { wing: 'writing', name: 'Best week', value: hrs(weeks[bw]), detail: 'week of', date: bw },
      { wing: 'writing', name: 'Best month', value: hrs(months[bm]), date: `${bm}-01`, detail: 'month' },
      { wing: 'writing', name: 'Longest streak', value: `${longestStreak(h.days)} days` },
      { wing: 'writing', name: 'All time', value: hrs(total), detail: `${dayKeys.length} days logged` },
      { wing: 'writing', name: 'Elite days', value: String(elites) },
    );
  }
  const ms = milestones(h.days, h.thresholds, h.weekly);
  const msNeed: Record<string, [number, number]> = (() => {
    const total = dayKeys.reduce((n, k) => n + dayTotal(h.days[k]), 0);
    const streak = longestStreak(h.days);
    const elites = dayKeys.filter((k) => gradeOf(dayTotal(h.days[k]), h.thresholds) === 'elite').length;
    return { lantern: [total, 600], hearth: [total, 3000], hundred: [total, 6000], 'long-road': [total, 30000], seven: [streak, 7], thirty: [streak, 30], unbroken: [streak, 100], 'north-star': [elites, 1], 'ten-fires': [elites, 10] };
  })();
  for (const m of ms) {
    const [have, need] = msNeed[m.id] ?? [0, 0];
    const big = ['long-road', 'unbroken', 'hundred'].includes(m.id);
    add({ id: `ledger-${m.id}`, wing: 'writing', name: m.name, desc: m.desc, earned: Boolean(m.earnedOn), date: m.earnedOn ?? undefined, tier: big ? 3 : m.mag >= 1.4 ? 2 : 1, ...(need ? { have: need >= 600 ? Math.floor(have / 60) : have, need: need >= 600 ? need / 60 : need } : {}) });
  }

  /* ---- the reader ---- */
  const read = h.books.filter((b) => b.status === 'read');
  const finishes = read.map((b) => b.finished);
  const perYear: Record<string, number> = {};
  for (const b of read) if (b.finished) perYear[b.finished.slice(0, 4)] = (perYear[b.finished.slice(0, 4)] ?? 0) + 1;
  const bestYear = Object.keys(perYear).reduce<string | null>((a, b) => (a === null || perYear[b] > perYear[a] ? b : a), null);
  const longest = read.filter((b) => b.pages).sort((a, b) => b.pages! - a.pages!)[0];
  if (read.length) {
    records.push({ wing: 'reading', name: 'Books read', value: String(read.length), detail: `${read.reduce((n, b) => n + (b.pages ?? 0), 0).toLocaleString('en-US')} pages` });
    if (bestYear) records.push({ wing: 'reading', name: 'Best reading year', value: `${perYear[bestYear]} books`, detail: bestYear });
    if (longest) records.push({ wing: 'reading', name: 'Longest book', value: `${longest.pages} pp`, detail: longest.title });
  }
  const yearDate = (n: number) => {
    // The first day any one year reached n books.
    let first: string | undefined;
    for (const y of Object.keys(perYear)) {
      const d = nthDate(read.filter((b) => b.finished?.startsWith(y)).map((b) => b.finished), n);
      if (d && (!first || d < first)) first = d;
    }
    return first;
  };
  const maxYear = bestYear ? perYear[bestYear] : 0;
  const goalMet = Object.entries(h.goals).map(([y, g]) => nthDate(read.filter((b) => b.finished?.startsWith(y)).map((b) => b.finished), g)).filter(Boolean).sort()[0];
  const favs = read.filter((b) => b.rating >= 5);
  add({ id: 'read-first', wing: 'reading', name: 'The First Page', desc: 'The first book on the shelf, read and rated.', earned: read.length >= 1, date: nthDate(finishes, 1), tier: 1, have: read.length, need: 1 });
  add({ id: 'read-10y', wing: 'reading', name: 'Ten in a Year', desc: 'Ten books finished in one year.', earned: maxYear >= 10, date: yearDate(10), tier: 1, have: maxYear, need: 10 });
  add({ id: 'read-25y', wing: 'reading', name: 'The Voracious Year', desc: 'Twenty-five books in one year.', earned: maxYear >= 25, date: yearDate(25), tier: 2, have: maxYear, need: 25 });
  add({ id: 'read-50', wing: 'reading', name: 'Fifty Spines', desc: 'Fifty books read, all time.', earned: read.length >= 50, date: nthDate(finishes, 50), tier: 2, have: read.length, need: 50 });
  add({ id: 'read-100', wing: 'reading', name: 'The Hundred Books', desc: 'One hundred books read.', earned: read.length >= 100, date: nthDate(finishes, 100), tier: 3, have: read.length, need: 100 });
  add({ id: 'read-goal', wing: 'reading', name: 'Promise Kept', desc: 'A yearly reading goal, met.', earned: Boolean(goalMet), date: goalMet, tier: 2 });
  add({ id: 'read-favs', wing: 'reading', name: 'Five Favorites', desc: 'Five books worth five stars.', earned: favs.length >= 5, date: nthDate(favs.map((b) => b.finished), 5), tier: 1, have: favs.length, need: 5 });

  /* ---- the manuscript ---- */
  const totals = h.manuscripts.map((m) => ({ m, words: m.chapters.reduce((n, c) => n + (c.words || 0), 0) }));
  const most = totals.reduce<(typeof totals)[number] | null>((a, b) => (!a || b.words > a.words ? b : a), null);
  const crossing = (n: number) => h.manuscripts.flatMap((m) => Object.entries(m.history).filter(([, w]) => w >= n).map(([d]) => d)).sort()[0];
  let bestWordDay: { date: string; n: number } | null = null;
  for (const m of h.manuscripts) {
    const ks = Object.keys(m.history).sort();
    ks.forEach((k, i) => { const gain = m.history[k] - (i ? m.history[ks[i - 1]] : 0); if (i && (!bestWordDay || gain > bestWordDay.n)) bestWordDay = { date: k, n: gain }; });
  }
  const top = most?.words ?? 0;
  if (top) records.push({ wing: 'manuscript', name: 'Words on the page', value: words(top), detail: most!.m.title });
  if (bestWordDay) { const b = bestWordDay as { date: string; n: number }; if (b.n > 0) records.push({ wing: 'manuscript', name: 'Best word day', value: `+${words(b.n)}`, date: b.date }); }
  const drafted = totals.find((t) => t.m.target > 0 && t.words >= t.m.target);
  const allDone = h.manuscripts.find((m) => m.chapters.length >= 3 && m.chapters.every((c) => c.status === 'done'));
  const sprints = (h.sprints ?? []).filter((x) => x.completed && x.words > 0);
  const bestSp = sprints.reduce<Sprint | null>((a, b) => (!a || b.words > a.words ? b : a), null);
  const fastest = sprints.reduce<Sprint | null>((a, b) => (!a || b.words / b.minutes > a.words / a.minutes ? b : a), null);
  if (bestSp) records.push({ wing: 'manuscript', name: 'Best sprint', value: `${words(bestSp.words)} words`, detail: `${bestSp.minutes} min ·`, date: bestSp.day });
  if (fastest) records.push({ wing: 'manuscript', name: 'Fastest sprint', value: `${Math.round(fastest.words / fastest.minutes)} wpm`, date: fastest.day });
  const firstAt = (pred: (x: Sprint) => boolean) => sprints.filter(pred).map((x) => x.day).sort()[0];
  add({ id: 'sprint-first', wing: 'manuscript', name: 'Off the Blocks', desc: 'A first word sprint, run to the bell.', earned: sprints.length > 0, date: firstAt(() => true), tier: 1 });
  add({ id: 'sprint-1000', wing: 'manuscript', name: 'The Thousand', desc: '1,000 words in a single sprint.', earned: sprints.some((x) => x.words >= 1000), date: firstAt((x) => x.words >= 1000), tier: 2, have: bestSp?.words ?? 0, need: 1000 });
  add({ id: 'sprint-25', wing: 'manuscript', name: 'Twenty-Five Bells', desc: 'Twenty-five sprints finished.', earned: sprints.length >= 25, date: nthDate(sprints.map((x) => x.day), 25), tier: 2, have: sprints.length, need: 25 });
  add({ id: 'ms-10k', wing: 'manuscript', name: 'Ten Thousand', desc: '10,000 words in one manuscript.', earned: top >= 10000, date: crossing(10000), tier: 1, have: top, need: 10000 });
  add({ id: 'ms-50k', wing: 'manuscript', name: 'The Middle', desc: '50,000 words: past the sagging middle.', earned: top >= 50000, date: crossing(50000), tier: 2, have: top, need: 50000 });
  add({ id: 'ms-draft', wing: 'manuscript', name: 'The End', desc: 'A full draft, at its target length.', earned: Boolean(drafted), date: drafted ? crossing(drafted.m.target) : undefined, tier: 3, have: top, need: most?.m.target || 85000 });
  add({ id: 'ms-clean', wing: 'manuscript', name: 'Every Chapter Done', desc: 'Every chapter of a manuscript marked done.', earned: Boolean(allDone), tier: 3 });

  /* ---- the road ---- */
  const sent = h.queries.filter((q) => q.status !== 'researching');
  const reqs = h.queries.filter((q) => q.status === 'partial' || q.status === 'full' || q.status === 'offer');
  const fulls = h.queries.filter((q) => q.status === 'full' || q.status === 'offer');
  const offers = h.queries.filter((q) => q.status === 'offer');
  if (sent.length) records.push({ wing: 'road', name: 'Queries sent', value: String(sent.length), detail: reqs.length ? `${reqs.length} request${reqs.length === 1 ? '' : 's'}` : undefined });
  const entered = h.contests.filter((c) => c.status !== 'considering');
  add({ id: 'road-query', wing: 'road', name: 'The First Letter', desc: 'The first query sent to an agent.', earned: sent.length > 0, date: nthDate(sent.map((q) => q.sentOn), 1), tier: 1 });
  add({ id: 'road-25', wing: 'road', name: 'Thick Skin', desc: 'Twenty-five queries out in the world.', earned: sent.length >= 25, date: nthDate(sent.map((q) => q.sentOn), 25), tier: 2, have: sent.length, need: 25 });
  add({ id: 'road-partial', wing: 'road', name: 'They Want Pages', desc: 'A partial or full request.', earned: reqs.length > 0, date: nthDate(reqs.map((q) => q.respondedOn), 1), tier: 2 });
  add({ id: 'road-full', wing: 'road', name: 'The Full', desc: 'An agent asked for the whole manuscript.', earned: fulls.length > 0, date: nthDate(fulls.map((q) => q.respondedOn), 1), tier: 3 });
  add({ id: 'road-offer', wing: 'road', name: 'The Call', desc: 'An offer of representation.', earned: offers.length > 0, date: nthDate(offers.map((q) => q.respondedOn), 1), tier: 3 });
  add({ id: 'road-contest', wing: 'road', name: 'In the Ring', desc: 'A first contest entered.', earned: entered.length > 0, date: nthDate(entered.map((c) => c.deadline), 1), tier: 1 });
  add({ id: 'road-listed', wing: 'road', name: 'On the List', desc: 'Longlisted, shortlisted or winning a contest.', earned: h.contests.some((c) => ['longlist', 'shortlist', 'won'].includes(c.status)), tier: 2 });

  /* ---- the chapel ---- */
  const chapelDays = Object.keys(h.chapel).filter((k) => chapelMinutes(h.chapel[k]) > 0);
  const candle = longestRun(chapelDays);
  const answered = h.prayers.filter((p) => p.answeredOn);
  if (chapelDays.length) {
    records.push({ wing: 'chapel', name: 'Longest candle', value: `${candle} days` });
    records.push({ wing: 'chapel', name: 'Time in the Chapel', value: hrs(chapelDays.reduce((n, k) => n + chapelMinutes(h.chapel[k]), 0)) });
  }
  if (answered.length) records.push({ wing: 'chapel', name: 'Answered prayers', value: String(answered.length) });
  const runDate = (n: number) => { let run = 0, prev = ''; for (const k of [...chapelDays].sort()) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; prev = k; if (run >= n) return k; } return undefined; };
  add({ id: 'chapel-7', wing: 'chapel', name: 'A Week of Candles', desc: 'Seven days in a row in the Chapel.', earned: candle >= 7, date: runDate(7), tier: 1, have: candle, need: 7 });
  add({ id: 'chapel-40', wing: 'chapel', name: 'Forty Days', desc: 'Forty days in a row in the Chapel.', earned: candle >= 40, date: runDate(40), tier: 3, have: candle, need: 40 });
  add({ id: 'chapel-answer', wing: 'chapel', name: 'Answered', desc: 'The first prayer marked answered.', earned: answered.length > 0, date: nthDate(answered.map((p) => p.answeredOn), 1), tier: 2 });
  add({ id: 'chapel-10', wing: 'chapel', name: 'A Book of Answers', desc: 'Ten prayers answered.', earned: answered.length >= 10, date: nthDate(answered.map((p) => p.answeredOn), 10), tier: 3, have: answered.length, need: 10 });

  return { records, trophies };
}

/** The newest trophies earned, for the hall's front case. */
export const latest = (ts: Trophy[], n = 3): Trophy[] =>
  ts.filter((t) => t.earned && t.date).sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, n);

/** The locked trophies closest to being earned. */
export const nearest = (ts: Trophy[], n = 3): Trophy[] =>
  ts.filter((t) => !t.earned && t.progress > 0).sort((a, b) => b.progress - a.progress).slice(0, n);
