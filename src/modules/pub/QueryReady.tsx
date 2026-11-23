import { useEffect, type CSSProperties } from 'react';
import { go } from '../../shell/router';
import { useManuscripts } from '../manuscripts/store';
import { queryReadiness } from './logic';
import { usePub } from './store';
import '../../styles/pub.css';

const WHERE: Record<string, string> = { draft: '/cabin/manuscripts', revised: '/cabin/manuscripts', readers: '/cabin/editorial', addressed: '/cabin/editorial', agents: '/cabin/queries' };

/** How close the book is to querying: a ring and eight steps, three of them ticked by hand. */
export function QueryReady() {
  const p = usePub();
  const mss = useManuscripts();
  useEffect(() => { void p.load(); void mss.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = mss.manuscripts.find((m) => m.id === mss.active) ?? mss.manuscripts[0];
  const { steps, score } = queryReadiness(p, ms);
  const pct = Math.round(score * 100);
  const R = 46, C = 2 * Math.PI * R;
  const next = steps.find((s) => s.got < 1);
  return (
    <section className="panel qr" style={{ '--qr': score } as CSSProperties}>
      <div className="qr-ring" role="img" aria-label={`${pct}% ready to query`}>
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} className="qr-track" />
          <circle cx="60" cy="60" r={R} className="qr-fill" strokeDasharray={`${C * score} ${C}`} transform="rotate(-90 60 60)" />
        </svg>
        <span className="qr-pct"><b>{pct}</b><i>%</i></span>
      </div>
      <div className="qr-body">
        <div className="panel-h"><p className="panel-t">Ready to query{ms ? ` · ${ms.title}` : ''}</p></div>
        <p className="qr-next">{pct >= 100 ? 'Ready. Send the first five.' : next ? <>Next: <b>{next.label.toLowerCase()}</b> <span className="dim">· {next.sub}</span></> : ''}</p>
        <ul className="qr-steps">
          {steps.map((s) => (
            <li key={s.k}>
              <button className={`qr-step${s.got >= 1 ? ' done' : ''}${s.manual ? ' manual' : ''}`} aria-pressed={s.manual ? s.got >= 1 : undefined}
                onClick={() => (s.manual ? ms && p.toggleReady(ms.id, s.k) : WHERE[s.k] && go(WHERE[s.k]))} disabled={s.manual && !ms}>
                <span className="qr-mark" aria-hidden>{s.got >= 1 ? '✓' : ''}</span>
                <span className="qr-t"><b>{s.label}</b><span className="dim">{s.sub}</span></span>
                {!s.manual && s.got < 1 && <span className="qr-bar" aria-hidden><i style={{ width: `${s.got * 100}%` }} /></span>}
                {s.manual && s.got < 1 && <span className="mono qr-tick">tick when done</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
