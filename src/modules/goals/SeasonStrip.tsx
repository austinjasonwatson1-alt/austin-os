import { useEffect } from 'react';
import { todayISO } from '../../core/dates';
import { go } from '../../shell/router';
import { milestonesIn, quarterOf, seasonProgress } from './logic';
import { useGoals } from './store';
import '../../styles/goals.css';

/** One line for Home: "Q4 · 3 of 7 milestones · 39 days left", with a tiny row of lanterns. Nothing when the season is unplanned. */
export function SeasonStrip({ onOpen = () => go('/goals') }: { onOpen?: () => void }) {
  const loaded = useGoals((s) => s.loaded);
  const milestones = useGoals((s) => s.milestones);
  useEffect(() => { void useGoals.getState().load(); }, []);
  const today = todayISO();
  const s = seasonProgress(milestones, today);
  if (!loaded || s.total === 0) return null;
  const ms = milestonesIn(milestones, quarterOf(today));
  const lit = [...ms.filter((m) => m.done), ...ms.filter((m) => !m.done)];
  return (
    <button className="season-strip" onClick={onOpen} aria-label={`This season: ${s.done} of ${s.total} milestones, ${s.daysLeft} days left`}>
      <span className="ss-q">{s.quarter.slice(5)}</span>
      <span className="ss-t mono">
        <b>{s.done}</b> of {s.total} milestones <i>·</i> {s.daysLeft === 0 ? 'last day' : `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`}
      </span>
      <span className="ss-lanterns" aria-hidden>
        {lit.slice(0, 14).map((m) => <span key={m.id} className={m.done ? 'ss-l lit' : 'ss-l'} />)}
        {lit.length > 14 && <span className="ss-more mono">+{lit.length - 14}</span>}
      </span>
    </button>
  );
}
