import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MONTHS_SHORT, parseISO, todayISO } from '../core/dates';
import {
  catMix, currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, lampLine, longestStreak, mondayOf,
  nextDeadline, recentWeeks, weekTotal,
} from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { CAT, GRADE_VAR, Lamp, QuickLog, rise, useMinuteClock } from './lamp';
import { cabinRooms, Room } from './Rooms';
import { Constellations } from './Constellations';
import { RoadMap } from '../modules/pub/RoadMap';
import { WeekSky } from './WeekSky';
import { CountUp, tilt } from './fx';
import '../styles/cabin.css';


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
        <WeekSky date={today} />
        <div className="home-stack rise" style={rise(3)}>
          <Tile label="Streak" value={loaded ? String(streak) : '—'} unit={streak === 1 ? 'day' : 'days'}
            foot={loaded ? `Best ever · ${longestStreak(days)} days` : ''} glyph="✦" />
          <DeadlineTile deadline={nextDeadline(deadlines, today)} />
        </div>
        <Tide today={today} />
        <Mix today={today} />
      </div>

      <div className="rise" style={rise(6)}><RoadMap /></div>
      <div className="rise" style={rise(6)}><Constellations /></div>

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

/* ---------------- tiles ---------------- */

function Tile({ label, value, unit, foot, glyph, children }: { label: string; value: string; unit: string; foot: string; glyph: string; children?: ReactNode }) {
  return (
    <div className="panel tile tilt" {...tilt(4)}>
      <span className="tile-glyph" aria-hidden>{glyph}</span>
      <p className="panel-t">{label}</p>
      <div className="tile-v"><span className="big">{/^\d+$/.test(value) ? <CountUp value={Number(value)} /> : value}</span><span className="mono dim">{unit}</span></div>
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
