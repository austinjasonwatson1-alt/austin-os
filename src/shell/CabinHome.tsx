import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MONTHS_SHORT, parseISO, todayISO } from '../core/dates';
import {
  catMix, currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, lampLine, longestStreak, mondayOf,
  nextDeadline, recentWeeks, weekDays, weekTotal,
} from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { CAT, GRADE_VAR, Lamp, QuickLog, rise, useMinuteClock } from './lamp';
import { cabinRooms, Room } from './Rooms';
import '../styles/cabin.css';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Writer's Cabin: the writing dashboard (the lamp, the week, the tide) and its rooms. */
export default function CabinHome() {
  const { loaded, load, days, thresholds, weekly, deadlines } = useLedger();
  useEffect(() => { void load(); }, [load]);
  const now = useMinuteClock();
  const today = todayISO();

  const mins = dayTotal(days[today]);
  const streak = currentStreak(days, today);
  const g = gradeOf(mins, thresholds);
  const date = parseISO(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="home">
      <section className="hero rise" style={rise(0)} data-grade={g}>
        <div className="hero-copy">
          <div className="page-eyebrow">Writer's Cabin · {date} <span className="hero-time">· {time}</span></div>
          <h1 className="hero-title">The Writer's<br /><em>Cabin.</em></h1>
          <p className="hero-line">{loaded ? lampLine(mins, thresholds, streak) : 'Lighting the lamp…'}</p>
          <QuickLog today={today} />
        </div>
        <Lamp mins={mins} grade={g} loaded={loaded} />
      </section>

      <div className="home-grid">
        <WeekSky today={today} />
        <div className="home-stack rise" style={rise(3)}>
          <Tile label="Streak" value={loaded ? String(streak) : '—'} unit={streak === 1 ? 'day' : 'days'}
            foot={loaded ? `Best ever · ${longestStreak(days)} days` : ''} glyph="✦" />
          <DeadlineTile deadline={nextDeadline(deadlines, today)} />
        </div>
        <Tide today={today} />
        <Mix today={today} />
      </div>

      <h2 className="section-h rise" style={rise(6)}>Rooms in the cabin</h2>
      <div className="grid cols-3 rise" style={rise(6)}>
        {cabinRooms().map((m) => <Room key={m.id} m={m} />)}
      </div>

      <p className="home-foot mono faint">
        Day · elite {thresholds.elite}m · good {thresholds.good}m · warning {thresholds.warn}m &nbsp;·&nbsp; Week · elite {weekly.elite}m · good {weekly.good}m · warning {weekly.warn}m
        {loaded && <> &nbsp;·&nbsp; this week {fmtMins(weekTotal(days, mondayOf(today)))}</>}
      </p>
    </div>
  );
}

/* ---------------- this week as a constellation ---------------- */

function WeekSky({ today }: { today: string }) {
  const { days, thresholds: t, weekly, loaded } = useLedger();
  const [hover, setHover] = useState<number | null>(null);
  const week = useMemo(() => weekDays(days, mondayOf(today), today, t), [days, today, t]);
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
        <p className="panel-t">This week's sky</p>
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
            return (
              <g key={d.date} className={d.future ? 'star future' : 'star'}>
                {!d.future && d.mins > 0 && <circle cx={X(i)} cy={Y(d.mins)} r={r * 2.2} fill={GRADE_VAR[d.grade]} filter="url(#starglow)" opacity=".55" />}
                {isToday && <circle cx={X(i)} cy={Y(d.mins)} r={r + 7} className="star-today" />}
                <circle cx={X(i)} cy={Y(d.mins)} r={r} fill={d.future ? 'none' : d.mins ? GRADE_VAR[d.grade] : 'var(--zero)'}
                  stroke={d.future ? 'var(--line-strong)' : 'var(--panel-solid)'} strokeWidth="2" />
                <text x={X(i)} y={214} textAnchor="middle" className={isToday ? 'week-day today' : 'week-day'}>{DOW[i]}</text>
                <rect x={X(i) - 48} y={0} width={96} height={H} fill="transparent"
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

/* ---------------- tiles ---------------- */

function Tile({ label, value, unit, foot, glyph, children }: { label: string; value: string; unit: string; foot: string; glyph: string; children?: ReactNode }) {
  return (
    <div className="panel tile">
      <span className="tile-glyph" aria-hidden>{glyph}</span>
      <p className="panel-t">{label}</p>
      <div className="tile-v"><span className="big">{value}</span><span className="mono dim">{unit}</span></div>
      {children}
      <div className="tile-foot mono">{foot}</div>
    </div>
  );
}

function DeadlineTile({ deadline }: { deadline: ReturnType<typeof nextDeadline> }) {
  if (!deadline) {
    return <Tile label="Next deadline" value="—" unit="" glyph="◷" foot="Add one in The Ledger" />;
  }
  const when = parseISO(deadline.d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <Tile label={deadline.n} value={String(deadline.left)} unit={deadline.left === 1 ? 'day left' : 'days left'} glyph="◷" foot={when}>
      <div className="tile-weeks" aria-hidden>
        {Array.from({ length: Math.min(12, Math.ceil(deadline.left / 7)) }, (_, i) => <i key={i} />)}
      </div>
    </Tile>
  );
}

/* ---------------- the tide: weekly totals ---------------- */

function Tide({ today }: { today: string }) {
  const { days, weekly, loaded } = useLedger();
  const [hover, setHover] = useState<number | null>(null);
  const weeks = useMemo(() => recentWeeks(days, today, 16), [days, today]);
  const W = 640, H = 200, L = 8, Rt = 70, T = 14, B = 172;
  const top = Math.max(weekly.elite * 1.12, ...weeks.map((w) => w.mins));
  const X = (i: number) => L + (i / (weeks.length - 1)) * (W - L - Rt);
  const Y = (m: number) => B - (m / top) * (B - T);
  const line = weeks.map((w, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(w.mins).toFixed(1)}`).join(' ');
  const area = `${line} L${X(weeks.length - 1)},${B} L${X(0)},${B} Z`;
  const avg = Math.round(weeks.slice(0, -1).reduce((s, w) => s + w.mins, 0) / Math.max(1, weeks.length - 1));

  return (
    <section className="panel tide rise" style={rise(4)}>
      <div className="panel-h">
        <p className="panel-t">The tide · 16 weeks</p>
        <span className="mono faint" style={{ fontSize: 11 }}>{loaded ? `avg ${fmtMins(avg)} / week` : ''}</span>
      </div>
      <div className="tide-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="tide-svg" role="img" aria-label={`Weekly minutes, last 16 weeks. Average ${fmtMins(avg)}.`}>
          <defs>
            <linearGradient id="tidefill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--lamp)" stopOpacity=".38" />
              <stop offset="1" stopColor="var(--lamp)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {(['warn', 'good', 'elite'] as const).map((k) => (
            <g key={k}>
              <line x1={L} x2={W - Rt + 6} y1={Y(weekly[k])} y2={Y(weekly[k])} className="week-ref" />
              <text x={W - Rt + 12} y={Y(weekly[k]) + 4} className="tide-ref-t" fill={GRADE_VAR[k]}>{GRADE_LABEL[k].toLowerCase()}</text>
            </g>
          ))}
          <path d={area} fill="url(#tidefill)" />
          <path d={line} className="tide-line" />
          {weeks.map((w, i) => {
            const d = parseISO(w.monday);
            const first = i === 0 || d.getMonth() !== parseISO(weeks[i - 1].monday).getMonth();
            return first ? <text key={w.monday} x={X(i)} y={H - 6} className="tide-month">{MONTHS_SHORT[d.getMonth()]}</text> : null;
          })}
          {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={T} y2={B} className="tide-cross" />}
          <circle cx={X(weeks.length - 1)} cy={Y(weeks[weeks.length - 1].mins)} r="5" className="tide-now" />
          {hover !== null && <circle cx={X(hover)} cy={Y(weeks[hover].mins)} r="4.5" className="tide-hov" />}
          {weeks.map((w, i) => (
            <rect key={w.monday} x={X(i) - (W - L - Rt) / 30} y={0} width={(W - L - Rt) / 15} height={H} fill="transparent"
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="tip" style={{ left: `${(X(hover) / W) * 100}%`, top: `${(Y(weeks[hover].mins) / H) * 100}%` }}>
            <b>Week of {parseISO(weeks[hover].monday).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</b>
            <span>{fmtMins(weeks[hover].mins)}{hover === weeks.length - 1 ? ' · so far' : ''}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- where the minutes went ---------------- */

function Mix({ today }: { today: string }) {
  const { days } = useLedger();
  const mix = useMemo(() => catMix(days, today, 30), [days, today]);
  const total = mix.reduce((s, x) => s + x.mins, 0);
  const max = mix[0]?.mins ?? 1;
  return (
    <section className="panel mix rise" style={rise(5)}>
      <div className="panel-h">
        <p className="panel-t">Last 30 days</p>
        <span className="mono faint" style={{ fontSize: 11 }}>{fmtMins(total)}</span>
      </div>
      {mix.length === 0 ? (
        <p className="dim" style={{ fontSize: 13.5, margin: 0 }}>Nothing logged in the last month yet. The first minutes will show up here.</p>
      ) : (
        <ul className="mix-list">
          {mix.map((x) => (
            <li key={x.k}>
              <span className="mix-name">{CAT[x.k].name}</span>
              <span className="mix-v mono">{fmtMins(x.mins)} <i>{Math.round((x.mins / total) * 100)}%</i></span>
              <span className="mix-bar"><span style={{ width: `${(x.mins / max) * 100}%`, background: CAT[x.k].color }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
