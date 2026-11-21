import { addDays } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import type { Manuscript } from '../manuscripts/types';
import { FOLLOW_UP_WEEKS, type Contest, type PubData, type Query } from './types';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);

export interface QueryStats { sent: number; requests: number; rate: number | null; passes: number; offers: number; waiting: number; followUps: Query[] }

/** How the querying is going: request rate counts partials and fulls against everything sent. */
export function queryStats(qs: Query[], today: string): QueryStats {
  const sent = qs.filter((q) => q.sentOn && q.status !== 'researching');
  const requests = sent.filter((q) => q.status === 'partial' || q.status === 'full' || q.status === 'offer').length;
  const waiting = sent.filter((q) => q.status === 'queried');
  return {
    sent: sent.length,
    requests,
    rate: sent.length ? Math.round((requests / sent.length) * 100) : null,
    passes: sent.filter((q) => q.status === 'pass').length,
    offers: sent.filter((q) => q.status === 'offer').length,
    waiting: waiting.length,
    followUps: waiting.filter((q) => daysBetween(q.sentOn!, today) >= FOLLOW_UP_WEEKS * 7),
  };
}

/** Days a query has been out, for the "out 23 days" badge. */
export const daysOut = (q: Query, today: string) => (q.sentOn ? daysBetween(q.sentOn, today) : 0);

/** Contests still open, soonest first, with days left. */
export function upcomingContests(cs: Contest[], today: string): (Contest & { left: number })[] {
  return cs.filter((c) => c.deadline >= today && c.status === 'considering').map((c) => ({ ...c, left: daysBetween(today, c.deadline) })).sort((a, b) => a.left - b.left);
}

/** Everything due in the next `days` days: contest deadlines and query follow-ups. */
export function dueSoon(p: PubData, today: string, days = 14): { kind: 'contest' | 'follow-up'; title: string; date: string; left: number }[] {
  const out: { kind: 'contest' | 'follow-up'; title: string; date: string; left: number }[] = [];
  for (const c of upcomingContests(p.contests, today)) if (c.left <= days) out.push({ kind: 'contest', title: c.name, date: c.deadline, left: c.left });
  for (const q of p.queries) {
    if (q.status !== 'queried' || !q.sentOn) continue;
    const due = addDays(q.sentOn, FOLLOW_UP_WEEKS * 7);
    const left = daysBetween(today, due);
    if (left <= days) out.push({ kind: 'follow-up', title: `${q.agent}${q.agency ? `, ${q.agency}` : ''}`, date: due, left });
  }
  return out.sort((a, b) => a.left - b.left);
}

export interface RoadStop { id: string; name: string; sub: string; done: boolean; manual?: 'signed' | 'published' }

/** The road from first words to the book on a shelf, read from everything else in the cabin. */
export function road(p: PubData, ms: Manuscript | undefined): RoadStop[] {
  const words = ms ? ms.chapters.reduce((s, c) => s + c.words, 0) : 0;
  const chapters = ms?.chapters ?? [];
  const sent = p.queries.filter((q) => q.sentOn && q.status !== 'researching');
  return [
    { id: 'words', name: 'First words', sub: 'the story begins', done: words > 0 },
    { id: 'draft', name: 'A full draft', sub: ms ? `${Math.round((words / Math.max(1, ms.target)) * 100)}% of ${ms.target.toLocaleString('en-US')}` : 'reach the target', done: Boolean(ms && words >= ms.target * 0.9) },
    { id: 'feedback', name: 'Readers weigh in', sub: 'beta readers, an editor', done: p.feedback.length > 0 },
    { id: 'revised', name: 'Revised', sub: 'every chapter done', done: chapters.length > 0 && chapters.every((c) => c.status === 'done') },
    { id: 'queries', name: 'Queries out', sub: `${sent.length} sent`, done: sent.length > 0 },
    { id: 'request', name: 'A request', sub: 'an agent wants pages', done: sent.some((q) => q.status === 'partial' || q.status === 'full' || q.status === 'offer') },
    { id: 'offer', name: 'An offer', sub: 'representation', done: sent.some((q) => q.status === 'offer') },
    { id: 'deal', name: 'The deal', sub: p.road.signed ? `signed ${p.road.signed}` : 'mark it when it happens', done: Boolean(p.road.signed), manual: 'signed' },
    { id: 'shelf', name: 'On a shelf', sub: p.road.published ? `out ${p.road.published}` : 'the debut, in the world', done: Boolean(p.road.published), manual: 'published' },
  ];
}

export const describePub: Describer = {
  name: 'Queries, contests & outreach',
  size: (v) => { const d = v as Partial<PubData>; return (d.queries?.length ?? 0) + (d.contests?.length ?? 0) + (d.feedback?.length ?? 0) + (d.outreach?.length ?? 0); },
  detail: (v) => { const d = v as Partial<PubData>; return `${d.queries?.length ?? 0} queries · ${d.contests?.length ?? 0} contests · ${d.feedback?.length ?? 0} notes · ${d.outreach?.length ?? 0} contacts`; },
};
