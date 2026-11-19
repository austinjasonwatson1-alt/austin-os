/** Local-time date helpers. Everything is a 'YYYY-MM-DD' string in the user's own timezone. */

export const pad = (n: number) => String(n).padStart(2, '0');

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => iso(new Date());

/** Parse at noon so DST shifts can never roll the date. */
export function parseISO(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function mondayOf(s: string): string {
  const d = parseISO(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

export function daysOfYear(y: number): string[] {
  const out: string[] = [];
  const d = new Date(y, 0, 1, 12);
  while (d.getFullYear() === y) {
    out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function daysUntil(target: string, from: string = todayISO()): number {
  return Math.round((parseISO(target).getTime() - parseISO(from).getTime()) / 86_400_000);
}

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function prettyDate(s: string): string {
  return parseISO(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
