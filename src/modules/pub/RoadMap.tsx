import { useEffect, useMemo, useState } from 'react';
import { todayISO } from '../../core/dates';
import { go } from '../../shell/router';
import { useManuscripts } from '../manuscripts/store';
import { dueSoon, road } from './logic';
import { usePub } from './store';
import '../../styles/pub.css';

/** The road to the debut: a winding trail across the cabin's land, each stop lighting as it's reached. */
export function RoadMap() {
  const p = usePub();
  const mss = useManuscripts();
  useEffect(() => { void p.load(); void mss.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = mss.manuscripts.find((m) => m.id === mss.active) ?? mss.manuscripts[0];
  const stops = useMemo(() => road(p, ms), [p, ms]);
  const [sure, setSure] = useState<string | null>(null);
  const reached = stops.filter((s) => s.done).length;
  const W = 1000, H = 220;
  const pt = (i: number) => ({ x: 50 + (i / (stops.length - 1)) * (W - 100), y: 110 + Math.sin(i * 1.15) * 60 });
  const path = stops.map((_, i) => pt(i)).map((q, i, a) => (i === 0 ? `M${q.x},${q.y}` : `S${(a[i - 1].x + q.x) / 2},${q.y} ${q.x},${q.y}`)).join(' ');
  const lastDone = stops.reduce((n, s, i) => (s.done ? i : n), -1);
  const due = dueSoon(p, todayISO());

  return (
    <section className="panel road">
      <div className="panel-h">
        <p className="panel-t">The road to the debut{ms ? ` · ${ms.title}` : ''}</p>
        <span className="mono faint" style={{ fontSize: 11 }}>{reached} of {stops.length} reached</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="road-svg" role="group" aria-label="The road to the debut">
        <path d={path} className="road-path" />
        <path d={path} className="road-lit" style={{ strokeDasharray: `${lastDone < 0 ? 0 : ((lastDone + 0.02) / (stops.length - 1)) * 1300} 2000` }} />
        {stops.map((s, i) => {
          const q = pt(i);
          const next = !s.done && (i === 0 || stops[i - 1].done);
          return (
            <g key={s.id} transform={`translate(${q.x} ${q.y})`} className={`stop${s.done ? ' done' : ''}${next ? ' next' : ''}${s.manual ? ' manual' : ''}`}
              role={s.manual ? 'button' : undefined} tabIndex={s.manual ? 0 : undefined}
              onClick={() => { if (s.manual) setSure(s.id); }} onKeyDown={(e) => { if (s.manual && e.key === 'Enter') setSure(s.id); }}>
              {next && <circle r="20" className="stop-ring" />}
              <circle r={s.done ? 11 : 8} className="stop-dot" />
              {s.done && <path d="M-4 0 L-1 3 L5 -4" className="stop-check" />}
              <text y={i % 2 ? 34 : -22} textAnchor="middle" className="stop-n">{s.name}</text>
              <text y={i % 2 ? 49 : -37} textAnchor="middle" className="stop-s">{s.sub}</text>
            </g>
          );
        })}
      </svg>
      {sure && (
        <div className="road-ask">
          {(() => {
            const s = stops.find((x) => x.id === sure)!;
            const field = s.manual!;
            return s.done
              ? <>Undo “{s.name}”? <button className="btn ghost sm" onClick={() => setSure(null)}>Keep it</button><button className="btn sm" onClick={() => { p.setRoad({ ...p.road, [field]: undefined }); setSure(null); }}>Undo</button></>
              : <>Has it happened — {s.name.toLowerCase()}? <button className="btn ghost sm" onClick={() => setSure(null)}>Not yet</button><button className="btn primary sm" onClick={() => { p.setRoad({ ...p.road, [field]: todayISO() }); setSure(null); window.dispatchEvent(new Event('austin:celebrate')); }}>Yes — today</button></>;
          })()}
        </div>
      )}
      {due.length > 0 && (
        <ul className="due">
          {due.map((d) => (
            <li key={`${d.kind}${d.title}`} onClick={() => go(d.kind === 'contest' ? '/cabin/contests' : '/cabin/queries')}>
              <span className={`due-k mono ${d.kind}`}>{d.kind === 'contest' ? 'Contest' : 'Follow up'}</span>
              <span className="due-t">{d.title}</span>
              <span className={`due-l mono${d.left <= 3 ? ' soon' : ''}`}>{d.left < 0 ? `${-d.left}d overdue` : d.left === 0 ? 'today' : `${d.left}d`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
