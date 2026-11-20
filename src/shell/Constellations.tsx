import { useMemo, useState, type KeyboardEvent } from 'react';
import { parseISO } from '../core/dates';
import { milestones, type Milestone } from '../modules/ledger/milestones';
import { useLedger } from '../modules/ledger/store';

const X = (m: Milestone) => m.x * 10;
const Y = (m: Milestone) => 30 + m.y * 2.4;
/** A four-point star of radius r. */
const starPath = (r: number) => `M0 ${-r} Q${r * 0.18} ${-r * 0.18} ${r} 0 Q${r * 0.18} ${r * 0.18} 0 ${r} Q${-r * 0.18} ${r * 0.18} ${-r} 0 Q${-r * 0.18} ${-r * 0.18} 0 ${-r} Z`;

/** Your sky: every milestone of the writing life is a star; earned ones burn and join up. */
export function Constellations() {
  const { days, thresholds, weekly } = useLedger();
  const list = useMemo(() => milestones(days, thresholds, weekly), [days, thresholds, weekly]);
  const lit = list.filter((m) => m.earnedOn);
  const [sel, setSel] = useState<string | null>(null);
  const focus = list.find((m) => m.id === sel) ?? [...lit].sort((a, b) => (b.earnedOn ?? '').localeCompare(a.earnedOn ?? ''))[0] ?? list[0];
  const line = lit.map((m, i) => `${i ? 'L' : 'M'}${X(m)},${Y(m)}`).join(' ');
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(id); } };

  return (
    <section className="panel stars-panel">
      <div className="panel-h">
        <p className="panel-t">Your constellations</p>
        <span className="mono faint" style={{ fontSize: 11 }}>{lit.length} of {list.length} stars</span>
      </div>
      <div className="stars-field">
        <svg viewBox="0 0 1000 300" role="group" aria-label="Milestones as stars">
          <defs>
            <filter id="cglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {line && <path d={line} className="c-line" />}
          {list.map((m) => {
            const on = Boolean(m.earnedOn);
            const r = 7 + m.mag * 5;
            return (
              <g key={m.id} transform={`translate(${X(m)} ${Y(m)})`} className={`c-star${on ? ' on' : ''}${focus?.id === m.id ? ' sel' : ''}`}
                role="button" tabIndex={0} aria-label={`${m.name}: ${on ? `earned ${m.earnedOn}` : 'not yet'}`}
                onClick={() => setSel(m.id)} onKeyDown={key(m.id)} onPointerEnter={() => setSel(m.id)}>
                <circle r="26" fill="transparent" />
                {on ? (
                  <>
                    <circle r={r * 1.4} className="c-glow" filter="url(#cglow)" />
                    <path d={starPath(r)} className="c-body" />
                    <circle r={r * 0.22} fill="#fffaf0" />
                  </>
                ) : (
                  <>
                    <circle r="9" className="c-ring" />
                    <circle r="2" className="c-dim" />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {focus && (
        <div className={`c-info${focus.earnedOn ? ' on' : ''}`} aria-live="polite">
          <span className="c-info-name">{focus.name}</span>
          <span className="c-info-desc">{focus.desc}</span>
          <span className="c-info-when mono">
            {focus.earnedOn ? `earned ${parseISO(focus.earnedOn).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` : 'not yet in your sky'}
          </span>
        </div>
      )}
    </section>
  );
}
