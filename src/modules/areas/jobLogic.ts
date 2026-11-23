/** Job Search HQ: the March 1 clock and the day's four moves. Pure. */
import { addDays } from '../../core/dates';

export const JOB_START = '2026-10-12';
export const JOB_GOAL = '2027-03-01';

export const MOVES = [
  { k: 'brief', label: 'Read the recruiter’s brief', hint: 'The shortlist and what’s due, on the Recruiter Desk' },
  { k: 'apply', label: 'Apply to the best pick', hint: 'Then mark it applied on the Desk' },
  { k: 'followup', label: 'Send the follow-ups that are due', hint: 'Log them in the Application Ledger' },
  { k: 'referral', label: 'Ask one person for a referral', hint: 'Five asks a week keeps them coming' },
] as const;

const day = (s: string) => Date.parse(`${s}T12:00:00`) / 86_400_000;

/** Days left to the goal, and how much of the runway since the start is used (0–1). */
export function jobClock(today: string, start = JOB_START, goal = JOB_GOAL): { left: number; used: number } {
  const left = Math.round(day(goal) - day(today));
  const total = day(goal) - day(start);
  return { left, used: Math.min(1, Math.max(0, (day(today) - day(start)) / total)) };
}

/** The week's moves, day by day, and how many referral asks it holds. */
export function weekMoves(days: Record<string, Record<string, number>>, monday: string, today: string): { days: { date: string; n: number }[]; referrals: number } {
  const ds = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return {
    days: ds.map((d) => ({ date: d, n: d > today ? 0 : MOVES.filter((m) => (days[d]?.[m.k] ?? 0) > 0).length })),
    referrals: ds.filter((d) => d <= today && (days[d]?.referral ?? 0) > 0).length,
  };
}

/** How many of the four moves were made on `day` (other keys, like old logged minutes, don't count). */
export function movesOn(days: Record<string, Record<string, number>>, day: string): number {
  return MOVES.filter((m) => (days[day]?.[m.k] ?? 0) > 0).length;
}

/* ---------------- the week's scoreboard ---------------- */

/** Weekly targets for the counted moves. */
export const WEEK_TARGETS = { apply: 10, followup: 5, referral: 5 } as const;
export type Counted = keyof typeof WEEK_TARGETS;
export const COUNTED_LABEL: Record<Counted, string> = { apply: 'Applications', followup: 'Follow-ups', referral: 'Referral asks' };

/** This week's counts against the targets, and whether each is ahead of, on or behind the pace for today. */
export function weekScore(days: Record<string, Record<string, number>>, monday: string, today: string): { k: Counted; n: number; target: number; pace: 'ahead' | 'on' | 'behind' }[] {
  const elapsed = Math.min(7, Math.max(1, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${monday}T12:00:00`)) / 86_400_000) + 1));
  return (Object.keys(WEEK_TARGETS) as Counted[]).map((k) => {
    let n = 0;
    for (let i = 0; i < elapsed; i++) n += days[addDays(monday, i)]?.[k] ?? 0;
    const target = WEEK_TARGETS[k];
    const due = (target * elapsed) / 7;
    return { k, n, target, pace: n >= target || n >= Math.ceil(due) + 1 ? 'ahead' : n >= Math.round(due) - 1 ? 'on' : 'behind' };
  });
}

/* ---------------- interviews ---------------- */

export const PREP = [
  { k: 'research', label: 'Research the company and the role' },
  { k: 'stories', label: 'Three STAR stories ready' },
  { k: 'questions', label: 'Questions to ask them' },
  { k: 'check', label: 'Tech, outfit and route checked' },
  { k: 'thanks', label: 'Thank-you note sent after' },
] as const;

/** Interviews from today on, soonest first, with days to go and prep done. */
export function upcomingInterviews(items: { id: string; list: string; text: string; when?: string; checks?: string[] }[], today: string): { id: string; text: string; when: string; in: number; prepped: number }[] {
  return items.filter((i) => i.list === 'interviews' && i.when && i.when >= today)
    .map((i) => ({ id: i.id, text: i.text, when: i.when!, in: Math.round((Date.parse(`${i.when}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000), prepped: PREP.filter((p) => i.checks?.includes(p.k)).length }))
    .sort((a, b) => a.when.localeCompare(b.when));
}
