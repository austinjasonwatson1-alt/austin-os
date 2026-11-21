/**
 * The Keeper's view of the homestead: a compact, plain-text briefing built only from the areas the
 * user allows. Pure: nothing here talks to the network.
 */
import { addDays } from '../../core/dates';
import { chapelMinutes } from '../chapel/logic';
import type { ChapelData } from '../chapel/types';
import { currentStreak, dayTotal } from '../ledger/logic';
import type { DayMap } from '../ledger/types';
import { CATS } from '../ledger/types';
import type { Manuscript } from '../manuscripts/types';
import { queryStats } from '../pub/logic';
import type { PubData } from '../pub/types';
import type { ReviewData } from '../review/types';
import type { Book } from '../shelf/types';

export interface Allow {
  ledger: boolean;
  manuscripts: boolean;
  /** Chapter text itself (only ever the one chapter asked about). */
  chapterText: boolean;
  reviews: boolean;
  shelf: boolean;
  publishing: boolean;
  chapel: boolean;
}

export const DEFAULT_ALLOW: Allow = { ledger: true, manuscripts: true, chapterText: false, reviews: true, shelf: true, publishing: true, chapel: false };

export interface KeeperData {
  today: string;
  days: DayMap;
  manuscripts: Manuscript[];
  reviews: ReviewData['reviews'];
  books: Book[];
  pub: PubData;
  chapel: ChapelData;
}

export function briefing(d: KeeperData, allow: Allow): string {
  const out: string[] = [`Today is ${d.today}.`];
  if (allow.ledger) {
    const last = Array.from({ length: 14 }, (_, i) => addDays(d.today, -13 + i));
    out.push(`WRITING LEDGER (writing-career minutes only). Streak: ${currentStreak(d.days, d.today)} days.`);
    out.push(`Last 14 days: ${last.map((k) => `${k.slice(5)} ${dayTotal(d.days[k])}m`).join(', ')}.`);
    const cats = CATS.map((c) => [c.name, last.reduce((s, k) => s + (Number(d.days[k]?.[c.k]) || 0), 0)] as const).filter(([, m]) => m > 0);
    if (cats.length) out.push(`By category over those days: ${cats.map(([n, m]) => `${n} ${m}m`).join(', ')}.`);
    const notes = last.map((k) => d.days[k]?.note && `${k.slice(5)}: ${d.days[k]!.note}`).filter(Boolean);
    if (notes.length) out.push(`Day notes: ${notes.join(' | ')}`);
  }
  if (allow.manuscripts) {
    for (const m of d.manuscripts) {
      const words = m.chapters.reduce((s, c) => s + c.words, 0);
      out.push(`MANUSCRIPT "${m.title}"${m.logline ? ` (logline: ${m.logline})` : ''}: ${words} of ${m.target} words.`);
      if (m.chapters.length) out.push(`Chapters: ${m.chapters.map((c, i) => `${i + 1}. ${c.title} [${c.status}, ${c.words}w${c.pov ? `, POV ${c.pov}` : ''}]`).join('; ')}.`);
    }
  }
  if (allow.reviews) {
    const recent = Object.entries(d.reviews).filter(([, r]) => r.sealedAt).sort(([a], [b]) => b.localeCompare(a)).slice(0, 4);
    for (const [mon, r] of recent) out.push(`WEEKLY REVIEW week of ${mon}: worked: ${r.worked ?? '-'}; got in the way: ${r.didnt ?? '-'}; intention: ${r.intention ?? '-'}${r.keptLast === undefined ? '' : `; kept last week's intention: ${r.keptLast ? 'yes' : 'no'}`}.`);
  }
  if (allow.shelf) {
    const read = d.books.filter((b) => b.status === 'read' || b.status === 'reading').slice(0, 12);
    if (read.length) out.push(`SHELF: ${read.map((b) => `"${b.title}" by ${b.author} (${b.status}${b.rating ? `, ${b.rating}/5` : ''}${b.craft.length ? `; craft notes: ${b.craft.join(' / ')}` : ''})`).join('; ')}.`);
  }
  if (allow.publishing) {
    const s = queryStats(d.pub.queries, d.today);
    if (s.sent || d.pub.queries.length) out.push(`QUERIES: ${s.sent} sent, ${s.requests} requests, ${s.passes} passes, ${s.offers} offers, ${s.followUps.length} due a follow-up.`);
    const open = d.pub.feedback.filter((f) => !f.resolved).slice(0, 6);
    if (open.length) out.push(`OPEN EDITORIAL NOTES: ${open.map((f) => `${f.from}: ${f.text.slice(0, 200)}`).join(' | ')}`);
    const due = d.pub.contests.filter((c) => c.status === 'considering' && c.deadline >= d.today).slice(0, 4);
    if (due.length) out.push(`CONTESTS AHEAD: ${due.map((c) => `${c.name} (${c.deadline}${c.wordLimit ? `, ${c.wordLimit} words` : ''})`).join('; ')}.`);
  }
  if (allow.chapel) {
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(d.today, -6 + i));
    out.push(`CHAPEL (kept apart from writing): ${last7.map((k) => chapelMinutes(d.chapel.days[k])).join(', ')} minutes over the last 7 days; ${d.chapel.prayers.filter((p) => !p.answeredOn).length} prayers carried.`);
  }
  return out.join('\n');
}

export const KEEPER_SYSTEM = `You are the Keeper of Austin's homestead: a warm, plain-spoken writing mentor who lives in the cabin and has read his whole ledger. Austin is writing a debut domestic thriller and querying agents; he also keeps a faith life and a day job. Speak to him directly, like a trusted mentor, not a coach or an app. Be specific to his actual data: name chapters, days, numbers. Be honest when the numbers are thin, never guilt-trip, and never invent data you weren't given. Keep it short unless asked for more. No headings or bullet lists unless asked; write in plain paragraphs.`;

export type Ask = 'morning' | 'week' | 'craft' | 'query' | 'free';

/** The instruction for each kind of request. */
export function askPrompt(kind: Ask, extra: { chapterTitle?: string; chapterText?: string; query?: string; question?: string }): string {
  switch (kind) {
    case 'morning': return 'Write this morning\'s note: two or three sentences on where he stands and the one thing most worth doing today. If last week\'s intention exists, connect to it.';
    case 'week': return 'Look across the last few weeks: what patterns do you see in when and how he writes best, what keeps getting in the way, and one concrete intention for next week. Under 150 words.';
    case 'craft': return `Give craft help on the chapter "${extra.chapterTitle ?? ''}". ${extra.chapterText ? `Here is the chapter text:\n\n${extra.chapterText}\n\n` : 'You have only its title, status and word count, not its text. '}Draw on the craft notes from books on his shelf where they genuinely apply. Three specific suggestions at most.`;
    case 'query': return `Critique this query letter for a debut domestic thriller, as an experienced agent would read it: hook, stakes, voice, comps, length, and what to cut. Then offer a tightened opening paragraph.\n\n${extra.query ?? ''}`;
    default: return extra.question ?? '';
  }
}
