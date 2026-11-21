import { Dog } from './Dogs';

/** After 45 minutes of a session, Cooper and Shadow come and fall asleep at your feet. */
export function DogsAtFeet({ minutes }: { minutes: number }) {
  if (minutes < 45) return null;
  return (
    <svg className="at-feet" viewBox="-80 -60 300 70" aria-label="Cooper and Shadow, asleep at your feet">
      <g transform="translate(0 0) scale(.8)"><Dog who="cooper" pose="sleep" /></g>
      <g transform="translate(130 0) scale(.8)"><Dog who="shadow" pose="sleep" /></g>
    </svg>
  );
}
