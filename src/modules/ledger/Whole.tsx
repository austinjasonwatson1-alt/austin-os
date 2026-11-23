import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { mondayOf, parseISO, todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { go } from '../../shell/router';
import { useTimer } from '../timer/store';
import { elapsedMs, fmtClock } from '../timer/logic';
import { fmtMins, GRADE_LABEL, loggedMonths, monthLog, monthTotals, rolling7, weekPace, yearByCat, yearWeeks } from './logic';
import { useLedger } from './store';
import { CATS, type GradeKey } from './types';
import '../../styles/ledgerwhole.css';

const GRADE_VAR: Record<GradeKey, string> = { elite: 'var(--elite)', good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', zero: 'var(--bone-faint)' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The session timer, right on the ledger: pick what you're doing, and the clock logs it when you stop. */
export function SessionBar() {
  const t = useTimer();
  const [now, setNow] = useState(Date.now());
  const [logged, setLogged] = useState<string | null>(null);
  useEffect(() => { void t.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!t.running) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [t.running]);
  const run = t.running;
  if (!run) {
    return (
      <section className="lw-session panel">
        <div>
          <div className="mono lw-k">Session timer</div>
          <h2 className="lw-h">Start a session</h2>
          <p className="dim lw-hint">{logged ?? 'Read the last two sentences you wrote, then pick what you’re doing. The clock logs it when you stop.'}</p>
        </div>
        <div className="lw-cats" role="group" aria-label="Start a session">
          {CATS.map((c) => <button key={c.k} onClick={() => { t.start(c.k, t.lastGoal); setLogged(null); }}><i style={{ background: c.color }} />{c.name}</button>)}
        </div>
      </section>
    );
  }
  const c = CATS.find((x) => x.k === run.cat)!;
  const ms = elapsedMs(run, now);
  return (
    <section className="lw-session panel live">
      <div>
        <div className="mono lw-k">In session · <b style={{ color: c.color }}>{c.name}</b></div>
        <div className="lw-clock">{fmtClock(ms)}</div>
        <div className="mono lw-run"><span className={run.pausedAt ? 'lw-dot paused' : 'lw-dot'} />{run.pausedAt ? 'Paused' : `Started ${new Date(run.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}</div>
      </div>
      <div className="lw-acts">
        <button className="btn primary" disabled={ms < 60_000} onClick={(e) => { const s = t.stop(); if (s) { embers(e.currentTarget, 18); setLogged(`Logged ${fmtMins(s.minutes)} of ${c.name}.`); } }}>Stop and log {fmtMins(Math.floor(ms / 60_000))}</button>
        {run.pausedAt ? <button className="btn" onClick={t.resume}>Resume</button> : <button className="btn" onClick={t.pause}>Pause</button>}
        <button className="btn ghost" onClick={() => go('/cabin/timer')}>Lamp mode ↗</button>
      </div>
    </section>
  );
}

/** The week: the total against the weekly grades with a pace marker, every week of the year, and the week's notes. */
export function WeekWhole({ year, onPick }: { year: number; onPick: (d: string) => void }) {
  const { days, weekly } = useLedger();
  const today = todayISO();
  const monday = mondayOf(today);
  const p = weekPace(days, monday, today, weekly);
  const weeks = useMemo(() => yearWeeks(days, year, today, weekly), [days, year, today, weekly]);
  const max = Math.max(weekly.elite, ...weeks.map((w) => w.mins));
  const notes = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${monday}T12:00:00`); d.setDate(d.getDate() + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { k, note: days[k]?.note }; }).filter((x) => x.note);
  return (
    <section className="panel lw-week">
      <div className="panel-h"><h2 className="panel-t">The week</h2><span className="mono faint">Week grades · elite {fmtMins(weekly.elite)} · good {fmtMins(weekly.good)} · warning {fmtMins(weekly.warn)}</span></div>
      <div className="lw-weekwrap">
        <div className="lw-this">
          <div className="mono lw-k">This week, Mon–Sun</div>
          <div className="lw-big" style={{ color: p.total ? GRADE_VAR[p.grade] : undefined }}><CountUp value={p.total} format={fmtMins} /></div>
          <span className="lw-stamp" style={{ color: GRADE_VAR[p.grade] }}>{p.total ? GRADE_LABEL[p.grade].replace('Zero day', 'Zero') : 'Nothing yet'}</span>
          <div className="lw-pace" aria-label={`${fmtMins(p.total)} of ${fmtMins(weekly.elite)}`}>
            <i style={{ width: `${Math.min(1, p.total / weekly.elite) * 100}%`, background: GRADE_VAR[p.grade] }} />
            <span className="lw-mark" style={{ left: `${p.through * 100}%` }} title="Where the week is" />
          </div>
          <p className="mono lw-note">{p.toElite ? `On pace for ${fmtMins(p.projected)} · ${fmtMins(p.toElite)} to an elite week` : 'An elite week. Anything more is a gift.'}</p>
        </div>
        <div className="lw-weeks-col">
          <div className="mono lw-k">{year} · every week</div>
          <div className="lw-weeks" role="img" aria-label={`Weekly totals for ${year}`}>
            {weeks.map((w) => (
              <button key={w.monday} className={w.now ? 'lw-wk now' : 'lw-wk'} title={`Week of ${parseISO(w.monday).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${fmtMins(w.mins)}`} onClick={() => onPick(w.monday)}>
                <i style={{ height: `${(w.mins / max) * 100}%`, background: GRADE_VAR[w.grade] }} />
              </button>
            ))}
          </div>
          {notes.length > 0 && (
            <div className="lw-notes">
              {notes.map((n) => <p key={n.k}><span className="mono">{parseISO(n.k).toLocaleDateString(undefined, { weekday: 'short' })}</span>{n.note}</p>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Month by month, and the 7-day rolling average under it. */
export function TrendWhole({ year }: { year: number }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const months = useMemo(() => monthTotals(days, year), [days, year]);
  const roll = useMemo(() => rolling7(days, year, today), [days, year, today]);
  const max = Math.max(1, ...months);
  const best = months.indexOf(Math.max(...months));
  const rmax = Math.max(thresholds.elite, ...roll.map((r) => r.avg));
  const W = 1000, H = 170;
  const pts = roll.map((r, i) => `${((i / Math.max(1, roll.length - 1)) * W).toFixed(1)},${(H - (r.avg / rmax) * (H - 10)).toFixed(1)}`);
  const line = pts.length ? `M${pts.join(' L')}` : '';
  const y = (m: number) => (H - (m / rmax) * (H - 10)).toFixed(1);
  return (
    <section className="panel lw-trend">
      <div className="panel-h"><h2 className="panel-t">Month by month · {year}</h2><span className="mono faint">{months.some(Boolean) ? `Best: ${MON[best]} · ${fmtMins(months[best])}` : 'Nothing logged yet'}</span></div>
      <div className="lw-bars">
        {months.map((m, i) => {
          const future = `${year}-${String(i + 1).padStart(2, '0')}` > today.slice(0, 7);
          return (
            <div key={i} className={`lw-bar${i === best && m ? ' best' : ''}${future ? ' future' : ''}`}>
              <span className="mono lw-v">{m ? fmtMins(m) : ''}</span>
              <i style={{ height: `${(m / max) * 100}%` }} />
              <span className="mono lw-l">{MON[i]}</span>
            </div>
          );
        })}
      </div>
      <div className="lw-roll">
        <div className="panel-h"><p className="panel-t">7-day rolling average</p><span className="mono faint">{roll.length ? `${roll.at(-1)!.avg} min a day now` : ''}</span></div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Seven-day rolling average of minutes a day">
          {(['elite', 'good', 'warn'] as const).map((g) => <line key={g} x1="0" x2={W} y1={y(thresholds[g])} y2={y(thresholds[g])} className={`lw-ref ${g}`} />)}
          {line && <path d={`${line} L${W},${H} L0,${H} Z`} className="lw-area" />}
          {line && <path d={line} className="lw-line" />}
        </svg>
        <div className="mono lw-rlabels"><span>Jan</span><span>{MON[Math.min(11, Number(today.slice(5, 7)) - 1)]}{String(year) === today.slice(0, 4) ? ' · today' : ''}</span></div>
      </div>
    </section>
  );
}

/** Where the year went: each category's share. */
export function WhereWhole({ year }: { year: number }) {
  const { days } = useLedger();
  const rows = useMemo(() => yearByCat(days, year), [days, year]);
  const total = rows.reduce((s, r) => s + r.mins, 0);
  const max = Math.max(1, ...rows.map((r) => r.mins));
  return (
    <section className="panel lw-where">
      <div className="panel-h"><h2 className="panel-t">Where the year went</h2><span className="mono faint">{fmtMins(total)} in {year}</span></div>
      <div className="lw-cattot">
        {rows.map((r) => {
          const c = CATS.find((x) => x.k === r.k)!;
          return (
            <div key={r.k} className="lw-cr">
              <span className="lw-cn">{c.name}</span>
              <span className="lw-cb"><i style={{ width: `${(r.mins / max) * 100}%`, background: c.color }} /></span>
              <span className="mono lw-cv">{fmtMins(r.mins)}<small>{total ? ` · ${Math.round((r.mins / total) * 100)}%` : ''}</small></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The log: a month at a time, every day as a row; tap one to open it above. */
export function LogWhole({ onPick, selected }: { onPick: (d: string) => void; selected: string }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const months = useMemo(() => loggedMonths(days, today), [days, today]);
  const [ym, setYm] = useState(today.slice(0, 7));
  const rows = useMemo(() => monthLog(days, ym, today), [days, ym, today]);
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <section className="panel lw-log">
      <div className="panel-h">
        <h2 className="panel-t">The log</h2>
        <select className="lw-month" value={ym} onChange={(e) => setYm(e.target.value)} aria-label="Month">
          {months.map((m) => <option key={m} value={m}>{MON[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</option>)}
        </select>
      </div>
      <div className="lw-tablewrap">
        <table className="lw-table">
          <thead><tr><th>Day</th>{CATS.map((c) => <th key={c.k}>{c.name}</th>)}<th>Total</th><th className="lw-notecol">Note</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const g = r.total >= thresholds.elite ? 'elite' : r.total >= thresholds.good ? 'good' : r.total >= thresholds.warn ? 'warn' : r.total > 0 ? 'bad' : 'zero';
              return (
                <tr key={r.date} className={r.date === selected ? 'on' : ''} onClick={() => { onPick(r.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <td>{parseISO(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                  {CATS.map((c) => <td key={c.k} className={r.e[c.k] ? '' : 'z'}>{r.e[c.k] || '·'}</td>)}
                  <td className="tot" style={{ color: GRADE_VAR[g as GradeKey] } as CSSProperties}>{r.total || 0}</td>
                  <td className="lw-notecol">{r.e.note ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td>Month</td>{CATS.map((c) => <td key={c.k}>{rows.reduce((s, r) => s + (Number(r.e[c.k]) || 0), 0) || '·'}</td>)}<td className="tot">{sum}</td><td className="lw-notecol">{fmtMins(sum)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  );
}
