import type { CSSProperties } from 'react';
import { addDays, iso, parseISO } from '../../core/dates';
import { useMinuteClock } from '../../shell/lamp';
import { AREA, type Link } from './logic';
import { STATE_LABEL, type IntentionState, type LifeArea } from './types';
import '../../styles/day.css';

/** Today's date and the clock, kept true past midnight. */
export function useNow() {
  const now = useMinuteClock();
  return { now, today: iso(now) };
}

export const areaColor = (a?: LifeArea) => (a ? AREA[a]?.color : undefined) ?? 'var(--bone-dim)';

/** A hanging lantern. Lit = done; the flame fades in when it's checked. */
export function Lantern({ lit, color, size = 28 }: { lit: boolean; color?: string; size?: number }) {
  return (
    <svg className={lit ? 'lantern lit' : 'lantern'} viewBox="0 0 24 34" width={size} height={size * 34 / 24} aria-hidden
      style={{ '--lc': color ?? 'var(--lamp)' } as CSSProperties}>
      <path className="lantern-ring" d="M9.5 4.2a2.5 2.5 0 1 1 5 0" />
      <path className="lantern-cap" d="M6 9.5 8.5 5.5h7L18 9.5Z" />
      <rect className="lantern-glass" x="5.5" y="9.5" width="13" height="17" rx="3" />
      <path className="lantern-bars" d="M9.8 10v16M14.2 10v16" />
      <g className="lantern-flame">
        <ellipse cx="12" cy="19" rx="6" ry="7" className="lantern-glow" />
        <path d="M12 13.2c2 2.4 2.9 3.9 2.9 5.6a2.9 2.9 0 0 1-5.8 0c0-1.7.9-3.2 2.9-5.6Z" className="lantern-fire" />
      </g>
      <rect className="lantern-base" x="7" y="26.5" width="10" height="2.6" rx="1" />
    </svg>
  );
}

const LINK_LABEL: Record<Link, string> = { done: 'done', missed: 'missed', off: 'not scheduled', today: 'due today' };

/** The last 14 days of a habit as small linked lanterns. */
export function Chain({ links, today, color }: { links: Link[]; today: string; color?: string }) {
  const at = (i: number) => parseISO(addDays(today, i - links.length + 1)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const done = links.filter((l) => l === 'done').length;
  return (
    <span className="chain" style={{ '--lc': color ?? 'var(--lamp)' } as CSSProperties} role="img" aria-label={`Last 14 days: ${done} done`}>
      {links.map((l, i) => <i key={i} className={`ln ln-${l}`} title={`${at(i)}: ${LINK_LABEL[l]}`} />)}
    </span>
  );
}

/** An area's glyph in its colour (a soft dot for "no area"). */
export function AreaMark({ area, size = 'md' }: { area?: LifeArea; size?: 'sm' | 'md' | 'lg' }) {
  const a = area ? AREA[area] : undefined;
  return (
    <span className={`amark amark-${size}`} style={{ '--ac': areaColor(area) } as CSSProperties} title={a ? a.place : 'No area'} aria-hidden>
      {a ? a.glyph : '·'}
    </span>
  );
}

export const STATE_GLYPH: Record<IntentionState, string> = { kept: '●', partly: '◐', not: '○' };
export const stateTitle = (s?: IntentionState) => (s ? STATE_LABEL[s] : 'Not marked yet');
