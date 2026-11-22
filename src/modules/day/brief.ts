/** The morning brief: one look at what today asks of each part of life. Pure. */
import type { LifeArea } from '../life/logic';

export interface BriefInput {
  writingMins: number;
  /** The "good day" mark from the Ledger. */
  writingGood: number;
  deadline: { n: string; left: number } | null;
  jobMoves: number;
  jobDaysLeft: number;
  prayerMins: number;
  openPrayers: number;
  walkMins: number;
  workoutMins: number;
  steps?: number;
}

export interface BriefRow { area: LifeArea; title: string; line: string; done: boolean; path: string }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function morningBrief(b: BriefInput): BriefRow[] {
  const due = b.deadline ? (b.deadline.left === 0 ? ` · ${b.deadline.n} is due today` : b.deadline.left <= 14 ? ` · ${b.deadline.n} in ${plural(b.deadline.left, 'day')}` : '') : '';
  const write: BriefRow = {
    area: 'writing', title: 'The page', path: '/cabin', done: b.writingMins >= b.writingGood,
    line: (b.writingMins === 0 ? `Nothing yet: ${b.writingGood}m makes it a good day` : b.writingMins >= b.writingGood ? `${b.writingMins}m in. A good day, banked` : `${b.writingMins}m of ${b.writingGood}m`) + due,
  };
  const left = b.jobDaysLeft > 0 ? `${plural(b.jobDaysLeft, 'day')} to March 1` : 'March 1 is here';
  const job: BriefRow = {
    area: 'work', title: 'The job search', path: '/office', done: b.jobMoves >= 4,
    line: b.jobMoves >= 4 ? `All four moves made · ${left}` : `${b.jobMoves} of 4 moves · ${left}`,
  };
  const faith: BriefRow = {
    area: 'faith', title: 'The chapel', path: '/chapel', done: b.prayerMins > 0,
    line: (b.prayerMins > 0 ? `${b.prayerMins}m of prayer` : 'The candle is waiting') + (b.openPrayers ? ` · ${plural(b.openPrayers, 'prayer')} on the list` : ''),
  };
  const moved = b.walkMins + b.workoutMins;
  const body: BriefRow = {
    area: 'body', title: 'Cooper, Shadow and you', path: '/kennel', done: moved > 0,
    line: (b.walkMins > 0 ? `Walked ${b.walkMins}m` : 'The dogs haven’t been out yet') + (b.workoutMins > 0 ? ` · ${b.workoutMins}m of training` : '') + (b.steps ? ` · ${b.steps.toLocaleString('en-US')} steps` : ''),
  };
  return [write, job, faith, body];
}
