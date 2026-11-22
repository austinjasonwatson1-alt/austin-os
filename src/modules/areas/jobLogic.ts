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
