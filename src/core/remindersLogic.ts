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
}

export interface Reminder { id: string; title: string; body: string; path: string }

export function dueReminders(i: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  if (i.hour >= 20 && i.writingToday === 0) {
    out.push({
      id: 'streak', path: '/cabin/timer',
      title: i.streak > 0 ? `Your ${i.streak}-day streak ends at midnight` : 'No minutes yet today',
      body: 'Thirty minutes keeps the rule: no zero days. The lamp is waiting.',
    });
  }
  if (i.hour >= 20 && i.chapelToday === 0) out.push({ id: 'chapel', path: '/chapel', title: 'The candle’s still unlit', body: 'A few minutes with God before the day ends?' });
  if (i.weekday === 0 && i.hour >= 17 && !i.reviewSealed) out.push({ id: 'review', path: '/review', title: 'Sunday review', body: 'Look back at the week and set one intention for the next.' });
  if (i.hour >= 9 && i.followUps > 0) out.push({ id: 'followup', path: '/cabin/queries', title: `${i.followUps} quer${i.followUps === 1 ? 'y' : 'ies'} due a follow-up`, body: 'Out eight weeks or more with no reply.' });
  for (const c of i.contestsIn3Days) out.push({ id: `contest:${c}`, path: '/cabin/contests', title: `Deadline soon: ${c}`, body: 'Three days or less to enter.' });
  return out;
}
