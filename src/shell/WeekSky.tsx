import { useMemo, useState } from 'react';
import { parseISO, todayISO } from '../core/dates';
import { fmtMins, GRADE_LABEL, mondayOf, weekDays } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { GRADE_VAR, rise } from './lamp';
import '../styles/cabin.css';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---------------- this week as a constellation ---------------- */

export function WeekSky({ date, selected, onPick }: { date: string; selected?: string; onPick?: (d: string) => void }) {
  const today = todayISO();
  const { days, thresholds: t, weekly, loaded } = useLedger();
  const [hover, setHover] = useState<number | null>(null);
  const week = useMemo(() => weekDays(days, mondayOf(date), today, t), [days, date, today, t]);
  const total = week.reduce((s, d) => s + d.mins, 0);
  const top = Math.max(t.elite * 1.15, ...week.map((d) => d.mins));
  const W = 700, H = 230, X = (i: number) => 60 + i * 96.6, Y = (m: number) => 180 - (m / top) * 140;
  const past = week.filter((d) => !d.future);
  const path = past.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(d.mins).toFixed(1)}`).join(' ');
  const wg = total >= weekly.elite ? 'elite' : total >= weekly.good ? 'good' : total >= weekly.warn ? 'warn' : total ? 'bad' : 'zero';
  const barMax = weekly.elite * 1.1;

  return (
    <section className="panel week rise" style={rise(2)}>
      <div className="panel-h">
        <p className="panel-t">{mondayOf(date) === mondayOf(today) ? "This week's sky" : `Week of ${parseISO(mondayOf(date)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</p>
        <span className="mono faint hint" style={{ fontSize: 11 }}>higher star · more minutes</span>
      </div>
      <div className="week-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="week-svg" role="img" aria-label={`This week: ${week.map((d, i) => `${DOW[i]} ${fmtMins(d.mins)}`).join(', ')}`}>
          <defs>
            <filter id="starglow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="5" /></filter>
          </defs>
          {(['warn', 'good', 'elite'] as const).map((k) => (
            <g key={k}>
              <line x1="30" x2={W - 30} y1={Y(t[k])} y2={Y(t[k])} className="week-ref" />
              <text x={W - 30} y={Y(t[k]) - 5} textAnchor="end" className="week-ref-t">{GRADE_LABEL[k].toLowerCase()} {t[k]}m</text>
            </g>
          ))}
          <path d={path} className="week-line" />
          {week.map((d, i) => {
            const r = d.future ? 3 : 3.5 + Math.min(1, d.mins / t.elite) * 6;
            const isToday = d.date === today;
            const isSel = selected === d.date && !isToday;
            return (
              <g key={d.date} className={d.future ? 'star future' : 'star'}>
                {!d.future && d.mins > 0 && <circle cx={X(i)} cy={Y(d.mins)} r={r * 2.2} fill={GRADE_VAR[d.grade]} filter="url(#starglow)" opacity=".55" />}
                {isToday && <circle cx={X(i)} cy={Y(d.mins)} r={r + 7} className="star-today" />}
                {isSel && <circle cx={X(i)} cy={Y(d.mins)} r={r + 6} className="star-sel" />}
                <circle cx={X(i)} cy={Y(d.mins)} r={r} fill={d.future ? 'none' : d.mins ? GRADE_VAR[d.grade] : 'var(--zero)'}
                  stroke={d.future ? 'var(--line-strong)' : 'var(--panel-solid)'} strokeWidth="2" />
                <text x={X(i)} y={214} textAnchor="middle" className={isToday ? 'week-day today' : isSel ? 'week-day sel' : 'week-day'}>{DOW[i]}</text>
                <rect x={X(i) - 48} y={0} width={96} height={H} fill="transparent" style={onPick && !d.future ? { cursor: 'pointer' } : undefined}
                  onClick={() => { if (onPick && !d.future) onPick(d.date); }}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="tip" style={{ left: `${(X(hover) / W) * 100}%`, top: `${(Y(week[hover].mins) / H) * 100}%` }}>
            <b>{parseISO(week[hover].date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
            <span>{week[hover].future ? 'Still ahead' : `${fmtMins(week[hover].mins)} · ${GRADE_LABEL[week[hover].grade]}`}</span>
          </div>
        )}
      </div>
      <div className="week-bar">
        <div className="week-bar-head">
          <span className="big" style={{ fontSize: 30 }}>{loaded ? fmtMins(total) : '—'}</span>
          <span className="mono" style={{ fontSize: 11, color: GRADE_VAR[wg], letterSpacing: '.14em', textTransform: 'uppercase' }}>
            {total >= weekly.good ? `${GRADE_LABEL[wg]} week` : `${fmtMins(weekly.good - total)} to a good week`}
          </span>
        </div>
        <div className="week-track">
          <div className="week-fill" style={{ width: `${Math.min(100, (total / barMax) * 100)}%`, background: GRADE_VAR[wg] }} />
          {(['warn', 'good', 'elite'] as const).map((k) => (
            <span key={k} className="week-mark" style={{ left: `${(weekly[k] / barMax) * 100}%` }} title={`${GRADE_LABEL[k]} · ${weekly[k]}m`}>
              <i>{fmtMins(weekly[k])}</i>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
