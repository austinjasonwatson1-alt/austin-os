/** The schedule: the working day in blocks (50 on, 10 off), checked off as they're done, and the week's tasks. */

export interface ScheduleSettings {
  /** 'HH:MM', local time. */
  start: string;
  end: string;
  /** Minutes of work, then minutes of break. */
  work: number;
  brk: number;
  /** Working weekdays, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** A soft chime when a block ends and when a break ends (while the app is open). */
  chime?: boolean;
}

/** One day's blocks: what each is for, and which are done. Keyed by block number (0 = the first). */
export interface DayPlan {
  labels: Record<string, string>;
  done: number[];
  /** Last changed (ISO time), so sync keeps the newest version of a day. */
  edited?: string;
}

export interface WeekTask {
  id: string;
  text: string;
  /** The weekday it's pinned to (1 = Monday … 5 = Friday), or none for "this week". */
  day?: number;
  done?: boolean;
  /** Removed (kept as a marker so the removal reaches other devices). */
  gone?: boolean;
  edited?: string;
}

export interface ScheduleData {
  settings: ScheduleSettings;
  /** By local 'YYYY-MM-DD'. */
  days: Record<string, DayPlan>;
  /** By the week's Monday. */
  weeks: Record<string, WeekTask[]>;
  /** Labels that repeat every week: weekday → block number → label. */
  repeat: Record<string, Record<string, string>>;
}

export const DEFAULT_SETTINGS: ScheduleSettings = { start: '09:00', end: '17:00', work: 50, brk: 10, days: [1, 2, 3, 4, 5], chime: true };
export const DEFAULT_SCHEDULE: ScheduleData = { settings: DEFAULT_SETTINGS, days: {}, weeks: {}, repeat: {} };
