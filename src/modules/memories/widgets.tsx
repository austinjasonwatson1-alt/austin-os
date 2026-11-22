import { useEffect, useMemo, type CSSProperties } from 'react';
import { prettyDate, todayISO } from '../../core/dates';
import { go } from '../../shell/router';
import { agoLabel, leanFor, onThisDay, readyCapsules } from './logic';
import { useMemories } from './store';
import '../../styles/memories.css';

/** Where the Memories page lives. Home can pass its own route. */
const DEFAULT_ROUTE = '/memories';

/**
 * "1 year ago today…": up to three polaroids from this day in earlier years (or this week
 * a year ago). Renders nothing when there's nothing to remember.
 */
export function OnThisDay({ to = DEFAULT_ROUTE, today = todayISO() }: { to?: string; today?: string }) {
  const { items, loaded, load } = useMemories();
  useEffect(() => { void load(); }, [load]);
  const hit = useMemo(() => (loaded ? onThisDay(items, today) : null), [items, loaded, today]);
  if (!hit) return null;
  const first = hit.items[0];
  const shown = hit.items.slice(0, 3);
  return (
    <button className="otd" onClick={() => { useMemories.getState().setView('memories'); go(to); }}
      aria-label={`${agoLabel(first.day, today, hit.kind)}: ${hit.items.length} ${hit.items.length === 1 ? 'memory' : 'memories'}. Open Memories.`}>
      <span className="otd-stack" aria-hidden>
        {shown.map((m, i) => (
          <span key={m.id} className="otd-snap" style={{ '--lean': `${leanFor(m.id) * 2.4}deg`, '--i': i } as CSSProperties}>
            <img src={m.thumb} alt="" />
          </span>
        ))}
      </span>
      <span className="otd-copy">
        <span className="otd-eyebrow mono">On this day</span>
        <span className="otd-title">{agoLabel(first.day, today, hit.kind)}…</span>
        <span className="otd-cap">{first.caption || prettyDate(first.day)}</span>
        {hit.items.length > 1 && <span className="otd-more mono">+ {hit.items.length - 1} more {hit.items.length === 2 ? 'memory' : 'memories'}</span>}
      </span>
    </button>
  );
}

/** A glowing envelope when a time-capsule letter's day has come. Renders nothing otherwise. */
export function CapsuleReady({ to = DEFAULT_ROUTE, today = todayISO() }: { to?: string; today?: string }) {
  const { capsules, loaded, load } = useMemories();
  useEffect(() => { void load(); }, [load]);
  const ready = useMemo(() => (loaded ? readyCapsules(capsules, today) : []), [capsules, loaded, today]);
  if (!ready.length) return null;
  const c = ready[0];
  return (
    <button className="cready" onClick={() => { useMemories.getState().setView('capsule'); go(to); }}>
      <span className="cready-env" aria-hidden><i className="cready-flap" /><i className="wax sm">A</i></span>
      <span className="otd-copy">
        <span className="otd-eyebrow mono">Time capsule · ready</span>
        <span className="otd-title">{ready.length === 1 ? 'A letter is waiting for you.' : `${ready.length} letters are waiting for you.`}</span>
        <span className="otd-cap">“{c.title}” — sealed {prettyDate(c.written)}, {c.written.slice(0, 4)}.</span>
        <span className="otd-more mono">Break the seal →</span>
      </span>
    </button>
  );
}
