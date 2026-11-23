/** Which gentle reminders are due right now. Pure: the app decides when to show them. */

export interface ReminderInput {
  hour: number;
  weekday: number;
  writingToday: number;
  streak: number;
  chapelToday: number;
  reviewSealed: boolean;
  followUps: number;
  contestsIn3Days: string[];
  /** The morning brief: days to March 1, moves made, and the next date that matters. */
  jobDaysLeft?: number;
  movesToday?: number;
  nextDate?: { text: string; in: number } | null;
  interview?: { text: string; in: number } | null;
  /** How many parts of life were tended today (the whole-life streak), and whether the day is sealed. */
  tendedToday?: number;
  lifeStreak?: number;
  dayClosed?: boolean;
}

export interface Reminder { id: string; title: string; body: string; path: string }

export function dueReminders(i: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  // Nothing tended at all by evening: one note, not three.
  const nothing = i.hour >= 20 && i.tendedToday === 0;
  if (i.hour >= 7 && i.hour < 11 && i.jobDaysLeft !== undefined) {
    const bits = [
      i.writingToday ? `${i.writingToday}m written` : 'The page is waiting',
      i.interview && i.interview.in <= 3 ? (i.interview.in === 0 ? `Interview today: ${i.interview.text}` : `${i.interview.text} in ${i.interview.in} day${i.interview.in === 1 ? '' : 's'}`) : '',
      `${i.movesToday ?? 0} of 4 moves`,
      i.nextDate && i.nextDate.in <= 14 ? (i.nextDate.in === 0 ? `${i.nextDate.text} is today` : `${i.nextDate.text} in ${i.nextDate.in} day${i.nextDate.in === 1 ? '' : 's'}`) : '',
    ].filter(Boolean);
    out.push({ id: 'morning', path: '/day', title: i.jobDaysLeft > 0 ? `${i.jobDaysLeft} days to March 1` : 'Good morning', body: bits.join(' · ') });
  }
  if (nothing) {
    out.push({ id: 'zero', path: '/day', title: i.lifeStreak ? `Keep the ${i.lifeStreak}-day run alive` : 'Nothing tended yet today', body: 'Any part of life counts: a page, a prayer, a walk, a move. No zero days.' });
  } else if (i.hour >= 21 && i.dayClosed === false) {
    out.push({ id: 'close', path: '/day', title: 'Close the day', body: 'Mark what was kept, write two lines, seal it.' });
  }
  if (i.hour >= 20 && i.writingToday === 0 && !nothing) {
    out.push({
      id: 'streak', path: '/cabin/timer',
      title: i.streak > 0 ? `Your ${i.streak}-day streak ends at midnight` : 'No minutes yet today',
      body: 'Thirty minutes keeps the rule: no zero days. The lamp is waiting.',
    });
  }
  if (i.hour >= 20 && i.chapelToday === 0 && !nothing) out.push({ id: 'chapel', path: '/chapel', title: 'The candle’s still unlit', body: 'A few minutes with God before the day ends?' });
  if (i.weekday === 0 && i.hour >= 17 && !i.reviewSealed) out.push({ id: 'review', path: '/review', title: 'Sunday review', body: 'Look back at the week and set one intention for the next.' });
  if (i.hour >= 9 && i.followUps > 0) out.push({ id: 'followup', path: '/cabin/queries', title: `${i.followUps} quer${i.followUps === 1 ? 'y' : 'ies'} due a follow-up`, body: 'Out eight weeks or more with no reply.' });
  for (const c of i.contestsIn3Days) out.push({ id: `contest:${c}`, path: '/cabin/contests', title: `Deadline soon: ${c}`, body: 'Three days or less to enter.' });
  return out;
}
