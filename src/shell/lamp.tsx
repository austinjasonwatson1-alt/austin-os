import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fmtMins, GRADE_LABEL, lampHeat } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { CATS, type CatKey, type GradeKey } from '../modules/ledger/types';
import { go } from './router';

/** Shared pieces of the lamp: the dial, quick logging, clock, entrance stagger. */

export const GRADE_VAR: Record<GradeKey, string> = {
  zero: 'var(--bone-faint)', bad: 'var(--bad)', warn: 'var(--warn)', good: 'var(--good)', elite: 'var(--elite)',
};
export const CAT = Object.fromEntries(CATS.map((c) => [c.k, c])) as Record<CatKey, (typeof CATS)[number]>;

export const greeting = (h: number) => (h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

/** Re-render once a minute so the clock, greeting and "today" stay true past midnight. */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Staggered rise-in for the dashboard's pieces. */
export const rise = (i: number): CSSProperties => ({ '--i': i } as CSSProperties);
export function Lamp({ mins, grade, loaded }: { mins: number; grade: GradeKey; loaded: boolean }) {
  const { thresholds: t } = useLedger();
  const ref = useRef<HTMLDivElement>(null);
  const heat = lampHeat(mins, t);
  const R = 118;
  const C = 2 * Math.PI * R;
  const ticks = (['warn', 'good', 'elite'] as const).map((k) => ({ k, f: t[k] / t.elite }));

  // A gentle tilt toward the pointer. Skipped entirely for reduced motion.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      el.style.setProperty('--tx', `${(x * 14).toFixed(1)}px`);
      el.style.setProperty('--ty', `${(y * 14).toFixed(1)}px`);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <div ref={ref} className="lamp" style={{ '--heat': heat, '--gc': GRADE_VAR[grade] } as CSSProperties}
      role="img" aria-label={`Today: ${fmtMins(mins)}, ${GRADE_LABEL[grade]}`}>
      <div className="lamp-halo" />
      <svg viewBox="0 0 300 300" className="lamp-ring" aria-hidden>
        <defs>
          <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6d08c" />
            <stop offset="1" stopColor="var(--gc)" />
          </linearGradient>
        </defs>
        <circle cx="150" cy="150" r={R} className="lamp-track" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const long = i % 5 === 0;
          return <line key={i} x1={150 + Math.cos(a) * 134} y1={150 + Math.sin(a) * 134} x2={150 + Math.cos(a) * (long ? 141 : 138)} y2={150 + Math.sin(a) * (long ? 141 : 138)} className="lamp-minute" />;
        })}
        <circle cx="150" cy="150" r={R} className="lamp-arc" stroke="url(#arc)"
          strokeDasharray={`${C * heat} ${C}`} transform="rotate(-90 150 150)" />
        {ticks.map(({ k, f }) => {
          const a = f * Math.PI * 2 - Math.PI / 2;
          const lit = mins >= t[k];
          return (
            <g key={k} className={lit ? 'lamp-tick lit' : 'lamp-tick'}>
              <circle cx={150 + Math.cos(a) * R} cy={150 + Math.sin(a) * R} r="5" fill={lit ? GRADE_VAR[k] : 'var(--ink)'} stroke={GRADE_VAR[k]} />
            </g>
          );
        })}
      </svg>
      <div className="lamp-flame" />
      <div className="lamp-core">
        <div className="lamp-mins">{loaded ? fmtMins(mins) : '—'}</div>
        <div className="lamp-grade mono" style={{ color: GRADE_VAR[grade] }}>{loaded ? GRADE_LABEL[grade] : ''}</div>
        <div className="lamp-sub mono">today</div>
      </div>
    </div>
  );
}

const QUICK = [15, 30, 60];

export function QuickLog({ today }: { today: string }) {
  const { days, setMinutes, loaded } = useLedger();
  const [cat, setCat] = useState<CatKey>('writing');
  const [last, setLast] = useState<{ cat: CatKey; before: number; add: number } | null>(null);
  useEffect(() => {
    if (!last) return;
    const id = setTimeout(() => setLast(null), 8000);
    return () => clearTimeout(id);
  }, [last]);

  const add = (n: number) => {
    const before = Number(days[today]?.[cat]) || 0;
    setMinutes(today, cat, before + n);
    setLast({ cat, before, add: n });
  };

  return (
    <div className="qlog" aria-label="Log minutes for today">
      <div className="qlog-cats" role="radiogroup" aria-label="Category">
        {CATS.map((c) => (
          <button key={c.k} role="radio" aria-checked={cat === c.k} className="qcat" style={{ '--c': c.color } as CSSProperties} onClick={() => setCat(c.k)}>
            <span className="qcat-dot" />{c.name}
          </button>
        ))}
      </div>
      <div className="qlog-add">
        {QUICK.map((n) => (
          <button key={n} className="qadd" disabled={!loaded} onClick={() => add(n)} aria-label={`Add ${n} minutes`}>
            <em>+</em><span>{n}</span><small>min</small>
          </button>
        ))}
        <button className="qmore" onClick={() => go('/cabin/ledger')}>Open the Ledger →</button>
      </div>
      <div className="qlog-toast mono" aria-live="polite">
        {last && (
          <>
            Added {last.add}m {CAT[last.cat].name}.{' '}
            <button className="qundo" onClick={() => { setMinutes(today, last.cat, last.before); setLast(null); }}>Undo</button>
          </>
        )}
      </div>
    </div>
  );
}
