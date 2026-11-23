import { LogWhole, SessionBar, TrendWhole, WeekWhole, WhereWhole } from './Whole';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CountUp, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { WeekSky } from '../../shell/WeekSky';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import { addDays, daysOfYear, daysUntil, MONTHS_LONG, parseISO, todayISO } from '../../core/dates';
import { useBackup } from '../../core/backup';
import { Page } from '../../shell/Page';
import {
  currentStreak, dayTotal, fmtMins, galaxyPoint, gradeOf, GRADE_LABEL, monthDays, monthLabel, monthStats, parseLedgerCsv, compareDays, yearSummary,
} from './logic';
import { extractDays, useLedger } from './store';
import { CATS, type DayMap, type GradeKey, type LedgerData } from './types';
import type { Snapshot } from '../../core/storage';
import { timeAgo } from '../../core/autoBackupLogic';

const gradeVar: Record<GradeKey, string> = {
  zero: 'var(--zero)', bad: 'var(--bad)', warn: 'var(--warn)', good: 'var(--good)', elite: 'var(--elite)',
};

export default function LedgerPage() {
  const { loaded, load, days, thresholds, weekly } = useLedger();
  const [cursor, setCursor] = useState(todayISO());
  const [year, setYear] = useState(new Date().getFullYear());
  const today = todayISO();

  useEffect(() => { void load(); }, [load]);
  if (!loaded) return <Page eyebrow="Writer's Cabin" title="The Ledger" lede="Opening the books…" />;

  const streak = currentStreak(days, today);
  const ys = yearSummary(days, new Date().getFullYear());

  const ld = new Date().getFullYear();

  return (
    <div className="home ledger">
      <section className="hero ledger-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">Writer's Cabin · The Ledger</div>
          <h1 className="hero-title">Hours toward<br /><em>the book.</em></h1>
          <p className="hero-line">Every minute you give the dream, counted honestly. No zero days.</p>
        </div>
        <div className="ledger-stats">
          <Stat label="Current streak" value={streak} unit={streak === 1 ? 'day' : 'days'} />
          <Stat label={`Days logged · ${ld}`} value={ys.logged} unit="days" />
          <Stat label={`Hours · ${ld}`} value={Math.round(ys.minutes / 60)} unit="hours" />
        </div>
      </section>

      <div className="rise" style={rise(1)}><SessionBar /></div>

      <div className="ledger-top">
        <div className="rise" style={rise(1)}><TodayPanel date={cursor} setDate={setCursor} /></div>
        <WeekSky date={cursor} selected={cursor} onPick={setCursor} />
      </div>

      <div className="rise" style={rise(2)}><WeekWhole year={year} onPick={setCursor} /></div>

      <div className="rise" style={{ ...rise(3), marginTop: 16 }}>
        <YearWall year={year} setYear={setYear} selected={cursor} onPick={setCursor} />
      </div>

      <div className="rise" style={rise(4)}><TrendWhole year={year} /></div>
      <div className="rise" style={{ ...rise(4), marginTop: 16 }}><MonthsPanel year={year} onPick={setCursor} /></div>
      <div className="rise" style={rise(5)}><WhereWhole year={year} /></div>
      <div className="rise" style={rise(5)}><LogWhole onPick={setCursor} selected={cursor} /></div>

      <div className="ledger-lower rise" style={rise(5)}>
        <DeadlinesPanel />
        <DataPanel />
        <RestorePanel />
      </div>
      <p className="home-foot mono faint">
        Day grades · elite {thresholds.elite}m · good {thresholds.good}m · warning {thresholds.warn}m &nbsp;·&nbsp; Week · elite{' '}
        {weekly.elite}m · good {weekly.good}m · warning {weekly.warn}m
      </p>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="lstat">
      <span className="lstat-v"><CountUp value={value} /></span>
      <span className="lstat-u mono">{unit}</span>
      <span className="lstat-l mono">{label}</span>
    </div>
  );
}

/* ---------------- today ---------------- */

function TodayPanel({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { days, thresholds, setMinutes, setNote } = useLedger();
  const entry = days[date];
  const total = dayTotal(entry);
  const g = gradeOf(total, thresholds);
  const isToday = date === todayISO();
  const [note, setNoteDraft] = useState(entry?.note ?? '');
  useEffect(() => setNoteDraft(entry?.note ?? ''), [date, entry?.note]);
  const d = parseISO(date);

  return (
    <section className="desk" data-grade={g}>
      <header className="desk-h">
        <button className="brass" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div className="desk-date">
          <span className="mono">{isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long' })}</span>
          <b>{d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</b>
        </div>
        <button className="brass" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayISO()}>›</button>
        {!isToday && <button className="desk-today mono" onClick={() => setDate(todayISO())}>back to today</button>}
      </header>

      <div className="desk-total">
        <span className="big"><CountUp value={total} format={fmtMins} /></span>
        <span className={`desk-grade mono g-${g}`}>{GRADE_LABEL[g]}</span>
      </div>
      <div className="desk-bar" aria-hidden>
        <div className="desk-fill" style={{ width: `${Math.min(100, (total / Math.max(total, thresholds.elite)) * 100)}%` }}>
          {CATS.map((c) => {
            const v = Number(entry?.[c.k]) || 0;
            return v ? <span key={c.k} style={{ flexGrow: v, background: c.color }} /> : null;
          })}
        </div>
        {(['warn', 'good', 'elite'] as const).map((k) => (
          <i key={k} style={{ left: `${Math.min(100, (thresholds[k] / Math.max(total, thresholds.elite)) * 100)}%` }} />
        ))}
      </div>

      <div className="desk-rows">
        {CATS.map((c) => {
          const v = Number(entry?.[c.k]) || 0;
          return (
            <div key={c.k} className={v ? 'drow on' : 'drow'} style={{ '--c': c.color } as CSSProperties}>
              <span className="drow-dot" />
              <span className="drow-n">{c.name}</span>
              <div className="drow-step">
                <button aria-label={`${c.name} minus 5`} onClick={() => setMinutes(date, c.k, Math.max(0, v - 5))} disabled={!v}>−</button>
                <input
                  type="number" min={0} inputMode="numeric" value={v || ''} placeholder="0" aria-label={`${c.name} minutes`}
                  onChange={(e) => setMinutes(date, c.k, Number(e.target.value))}
                />
                <button aria-label={`${c.name} plus 5`} onClick={() => setMinutes(date, c.k, v + 5)}>+</button>
              </div>
              <div className="drow-quick">
                {[15, 30].map((n) => <button key={n} onClick={() => setMinutes(date, c.k, v + n)}>+{n}</button>)}
              </div>
            </div>
          );
        })}
      </div>

      <label className="desk-note">
        <span className="mono">A line about the day</span>
        <textarea value={note} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => setNote(date, note)} placeholder="What moved today…" rows={2} />
      </label>
    </section>
  );
}

/* ---------------- year wall ---------------- */

function YearWall({ year, setYear, selected, onPick }: { year: number; setYear: (y: number) => void; selected: string; onPick: (d: string) => void }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const keys = useMemo(() => daysOfYear(year), [year]);
  const lead = (parseISO(keys[0]).getDay() + 6) % 7;
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'wall' | 'sky'>(() => {
    try { return localStorage.getItem('ledger.yearView') === 'sky' ? 'sky' : 'wall'; } catch { return 'wall'; }
  });
  useEffect(() => { try { localStorage.setItem('ledger.yearView', view); } catch { /* per-device nicety only */ } }, [view]);
  // On narrow screens the wall scrolls sideways; open it on the current month, not January.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const idx = year === new Date().getFullYear() ? keys.indexOf(today) : keys.length - 1;
    const col = Math.floor((idx + lead) / 7);
    el.scrollLeft = Math.max(0, col * 16 - el.clientWidth + 48);
  }, [year, view]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel">
      <div className="panel-h">
        <h2 className="panel-t">The year {view === 'sky' ? 'sky' : 'wall'} · {year}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="seg" role="radiogroup" aria-label="View">
            <button role="radio" aria-checked={view === 'wall'} onClick={() => setView('wall')}>Wall</button>
            <button role="radio" aria-checked={view === 'sky'} onClick={() => setView('sky')}>Galaxy</button>
          </div>
          <button className="btn ghost" aria-label="Previous year" onClick={() => setYear(year - 1)}>◀</button>
          <button className="btn ghost" aria-label="Next year" onClick={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()}>▶</button>
        </div>
      </div>
      {view === 'sky' ? <YearGalaxy keys={keys} selected={selected} onPick={onPick} /> : (
      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 13px)', gridAutoColumns: '13px', gap: 3, width: 'max-content' }}>
          {Array.from({ length: lead }, (_, i) => <span key={`pad${i}`} />)}
          {keys.map((k) => {
            const future = k > today;
            const g = gradeOf(dayTotal(days[k]), thresholds);
            return (
              <button
                key={k}
                title={`${k} · ${fmtMins(dayTotal(days[k]))}`}
                aria-label={`${k}, ${fmtMins(dayTotal(days[k]))}`}
                disabled={future}
                onClick={() => onPick(k)}
                style={{
                  width: 13, height: 13, padding: 0, borderRadius: 3, border: 'none',
                  background: future ? 'rgba(233,228,216,.035)' : gradeVar[g],
                  opacity: g === 'zero' ? 0.9 : 1,
                  outline: k === selected ? '1.5px solid var(--lamp)' : k === today ? '1px solid var(--bone-dim)' : 'none',
                  outlineOffset: 1,
                }}
              />
            );
          })}
        </div>
      </div>
      )}
      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }} className="mono faint">
        {(['zero', 'bad', 'warn', 'good', 'elite'] as GradeKey[]).map((g) => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: gradeVar[g], display: 'inline-block' }} />
            {GRADE_LABEL[g]}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---------------- months ---------------- */

function MonthsPanel({ year, onPick }: { year: number; onPick: (d: string) => void }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const rows = MONTHS_LONG.map((name, m) => ({ name, m, st: monthStats(days, year, m, today, thresholds) })).filter((r) => r.st.elapsed > 0).reverse();

  return (
    <section>
      <div className="lounge-h"><h2 className="section-h">Months · {year}</h2></div>
      {rows.length === 0 && <p className="dim">Nothing logged for {year} yet.</p>}
      <div className="months">
        {rows.map(({ name, m, st }) => {
          const lab = monthLabel(st, thresholds);
          const md = monthDays(days, year, m, today);
          const top = Math.max(thresholds.elite, ...md.map((x) => x ?? 0));
          return (
            <article key={m} className="month tilt" style={{ '--g': gradeVar[lab.key] } as CSSProperties} {...tilt(4)}>
              <header>
                <h3>{name}</h3>
                <span className={`chip-g mono g-${lab.key}`}>{lab.label}</span>
              </header>
              <div className="month-n"><span className="big">{fmtMins(st.total)}</span><span className="mono dim">avg {fmtMins(st.avg)}/day</span></div>
              <svg className="month-spark" viewBox={`0 0 ${md.length * 6} 40`} preserveAspectRatio="none" aria-hidden>
                <line x1="0" x2={md.length * 6} y1={40 - (thresholds.good / top) * 38} y2={40 - (thresholds.good / top) * 38} className="spark-ref" />
                {md.map((v, i) => v === null ? null : (
                  <rect key={i} x={i * 6 + 1} y={40 - Math.max(1.5, (v / top) * 38)} width="4" height={Math.max(1.5, (v / top) * 38)} rx="1"
                    fill={v ? gradeVar[gradeOf(v, thresholds)] : 'rgba(233,228,216,.12)'} onClick={() => onPick(`${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)} />
                ))}
              </svg>
              <footer className="mono">
                <span><b>{st.logged}</b> days logged</span>
                <span><b>{st.elite}</b> elite</span>
                <span>{st.zero ? <><b>{st.zero}</b> zero</> : <b className="g-good">no zero days</b>}</span>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- deadlines ---------------- */

function DeadlinesPanel() {
  const { deadlines, addDeadline, removeDeadline } = useLedger();
  const [n, setN] = useState('');
  const [d, setD] = useState('');

  return (
    <section className="panel">
      <div className="panel-h"><h2 className="panel-t">Deadlines</h2></div>
      <ul className="dls">
        {deadlines.length === 0 && <li className="dim" style={{ fontSize: 13.5 }}>No deadlines set.</li>}
        {deadlines.map((x, i) => {
          const left = daysUntil(x.d);
          const f = Math.max(0, Math.min(1, 1 - left / 120));
          return (
            <li key={`${x.n}${x.d}`} className="dl">
              <svg viewBox="0 0 40 40" className="dl-ring" aria-hidden>
                <circle cx="20" cy="20" r="16" className="dl-track" />
                <circle cx="20" cy="20" r="16" className={left < 0 ? 'dl-arc past' : left < 30 ? 'dl-arc near' : 'dl-arc'} strokeDasharray={`${100.5 * f} 101`} transform="rotate(-90 20 20)" />
              </svg>
              <span className="dl-b">
                <span className="dl-n">{x.n}</span>
                <span className="dl-d mono">{parseISO(x.d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </span>
              <span className={`dl-left mono ${left < 0 ? 'g-bad' : left < 30 ? 'g-warn' : ''}`}>{left < 0 ? `${-left}d ago` : left === 0 ? 'today' : <><b>{left}</b> days</>}</span>
              <button className="btn ghost sm" aria-label={`Remove ${x.n}`} onClick={() => removeDeadline(i)}>✕</button>
            </li>
          );
        })}
      </ul>
      <form className="dl-form" onSubmit={(e) => { e.preventDefault(); if (n.trim() && d) { addDeadline({ n: n.trim(), d }); setN(''); setD(''); } }}>
        <label className="field grow"><span>New deadline</span><input placeholder="Query-ready" value={n} onChange={(e) => setN(e.target.value)} /></label>
        <label className="field"><span>Date</span><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></label>
        <button className="btn primary sm" type="submit" disabled={!n.trim() || !d}>Add</button>
      </form>
    </section>
  );
}

/* ---------------- data ---------------- */

function DataPanel() {
  const { days, previewDays, applyDays, restore, snapshots } = useLedger();
  const [undo, setUndo] = useState<Snapshot<LedgerData> | null>(null);
  const done = async (text: string) => {
    setMsg(text);
    setUndo((await snapshots()).find((s) => s.label) ?? null);
  };
  const undoLast = () => {
    if (!undo || !window.confirm(`Undo that? The Ledger goes back to how it was just before.`)) return;
    restore(undo);
    setUndo(null);
    setMsg('Undone. (That undo can itself be undone under Restore points.)');
  };
  const { exportAll } = useBackup();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const empty = Object.keys(days).length === 0;

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const isCsv = /\.csv$/i.test(file.name) || /^\uFEFF?date,/i.test(text.trimStart());
      let incoming: DayMap | null;
      let check = '';
      if (isCsv) {
        const csv = parseLedgerCsv(text);
        incoming = csv && Object.keys(csv.days).length ? csv.days : null;
        if (csv && incoming) {
          check = `\n\nThe file: ${Object.keys(incoming).length} days, ${csv.minutes.toLocaleString()} counted minutes.\n` +
            (csv.badTotals.length
              ? `⚠ ${csv.badTotals.length} row(s) whose total doesn't match their categories: ${csv.badTotals.slice(0, 5).join(', ')}${csv.badTotals.length > 5 ? '…' : ''}`
              : 'Every row’s total matches its categories.');
        }
      } else {
        incoming = extractDays(JSON.parse(text));
      }
      if (!incoming) return setMsg(isCsv ? 'That CSV has no Ledger columns (Date, Writing, Reading…).' : 'No ledger entries found in that file.');
      const p = previewDays(incoming);
      if (p.add + p.update === 0) return setMsg(`Nothing new — all ${p.keep} days are already here.`);
      if (!window.confirm(`Load this backup?${check}\n\n${p.add} new days\n${p.update} days upgraded (bigger total)\n${p.keep} days kept as they are`)) return;
      applyDays(incoming, `Before import of ${file.name}`);
      void done(`Loaded: ${p.add} added, ${p.update} upgraded, ${p.keep} unchanged.`);
    } catch {
      setMsg('That file could not be read.');
      setUndo(null);
    }
  };

  const exportCsv = () => {
    const rows = [['Date', ...CATS.map((c) => c.name), 'Total', 'Note']];
    for (const k of Object.keys(days).sort()) {
      rows.push([k, ...CATS.map((c) => String(days[k][c.k] ?? 0)), String(dayTotal(days[k])), (days[k].note ?? '').replace(/[",\n]/g, ' ')]);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `ledger-${todayISO()}.csv`;
    a.click();
  };

  return (
    <section className="panel">
      <div className="panel-h"><h2 className="panel-t">Your data</h2></div>
      {empty && (
        <p className="dim" style={{ marginTop: 0 }}>
          The books are empty. Import a Ledger CSV, a backup, or an export from the old Ledger to bring your history in.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
        <button className="btn" onClick={() => void exportAll()}>Back up everything</button>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
        <input ref={fileRef} type="file" accept="application/json,.json,text/csv,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </div>
      {msg && (
        <p className="mono" style={{ fontSize: 12, color: 'var(--lamp)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {msg}
          {undo && <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={undoLast}>↶ Undo</button>}
        </p>
      )}
    </section>
  );
}

/* ---------------- restore points ---------------- */

function RestorePanel() {
  const { days, restore, snapshots } = useLedger();
  const [list, setList] = useState<Snapshot<LedgerData>[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { void snapshots().then(setList); }, [days, snapshots]);

  const shown = open ? list : list.slice(0, 3);
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const doRestore = (s: Snapshot<LedgerData>, effect: ReturnType<typeof compareDays>) => {
    const parts = [
      effect.gone && `${effect.gone} day${effect.gone === 1 ? '' : 's'} removed`,
      effect.back && `${effect.back} day${effect.back === 1 ? '' : 's'} brought back`,
      effect.changed && `${effect.changed} day${effect.changed === 1 ? '' : 's'} changed`,
    ].filter(Boolean);
    if (!window.confirm(`Restore the Ledger to ${when(s.at)}${s.label ? ` (“${s.label}”)` : ''}?\n\n${parts.join('\n')}\n\nYour current state is saved as a restore point first, so this can be undone.`)) return;
    restore(s);
  };

  return (
    <section className="panel">
      <div className="panel-h">
        <h2 className="panel-t">Restore points</h2>
        <span className="mono faint" style={{ fontSize: 11 }}>{list.length ? `${list.length} kept` : ''}</span>
      </div>
      {list.length === 0 ? (
        <p className="dim" style={{ margin: 0, fontSize: 13.5 }}>
          Nothing yet. Before every import, load or restore — and every few minutes while you edit — the Ledger keeps a copy here you can go back to.
        </p>
      ) : (
        <ol className="snaps">
          {shown.map((s) => {
            const fx = compareDays(days, s.value.days);
            const same = fx.back + fx.gone + fx.changed === 0;
            const n = Object.keys(s.value.days).length;
            return (
              <li key={s.at + (s.label ?? '')} className={s.label ? 'snap labelled' : 'snap'}>
                <span className="snap-mark" aria-hidden>{s.label ? '◆' : '·'}</span>
                <div className="snap-body">
                  <div className="snap-name">{s.label ?? 'Autosave'}</div>
                  <div className="snap-meta">{when(s.at)} · {timeAgo(s.at, Date.now())} · {n} days · {fmtMins(Object.values(s.value.days).reduce((t, e) => t + dayTotal(e), 0))}</div>
                  {!same && (
                    <div className="snap-fx">
                      {fx.gone > 0 && <span className="fx gone">−{fx.gone} days</span>}
                      {fx.back > 0 && <span className="fx back">+{fx.back} days</span>}
                      {fx.changed > 0 && <span className="fx">~{fx.changed} changed</span>}
                      {fx.minutes !== 0 && <span className="fx">{fx.minutes > 0 ? '+' : '−'}{fmtMins(Math.abs(fx.minutes))}</span>}
                    </div>
                  )}
                </div>
                {same
                  ? <span className="mono faint" style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>Current</span>
                  : <button className="btn" onClick={() => doRestore(s, fx)}>Restore</button>}
              </li>
            );
          })}
        </ol>
      )}
      {list.length > 3 && (
        <button className="btn ghost" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </section>
  );
}

/** The year as a spiral galaxy: every day a star, January at the core, brighter for bigger days. */
function YearGalaxy({ keys, selected, onPick }: { keys: string[]; selected: string; onPick: (d: string) => void }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const [hover, setHover] = useState<string | null>(null);
  const S = 300;
  const pts = useMemo(() => keys.map((k, i) => ({ k, ...galaxyPoint(i, keys.length) })), [keys]);
  const h = hover ? pts.find((p) => p.k === hover) : null;
  return (
    <div className="galaxy">
      <svg viewBox={`${-S} ${-S} ${S * 2} ${S * 2}`} role="group" aria-label="The year as a galaxy of days">
        <defs>
          <radialGradient id="gcore"><stop offset="0" stopColor="#f6dca0" stopOpacity=".55" /><stop offset=".35" stopColor="#8a6fd0" stopOpacity=".18" /><stop offset="1" stopColor="#05070c" stopOpacity="0" /></radialGradient>
        </defs>
        <circle r={S} fill="url(#gcore)" />
        <g className="g-spin">
          {pts.map(({ k, x, y }) => {
            if (k > today) return null;
            const m = dayTotal(days[k]);
            const g = gradeOf(m, thresholds);
            const r = m ? 1.6 + Math.min(1, m / thresholds.elite) * 4.4 : 1;
            return (
              <g key={k} transform={`translate(${(x * S * 0.94).toFixed(1)} ${(y * S * 0.94).toFixed(1)})`} className="g-day"
                onClick={() => onPick(k)} onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)}>
                <circle r="9" fill="transparent" />
                {m > 0 && <circle r={r * 2.4} fill={gradeVar[g]} opacity=".18" />}
                <circle r={r} fill={m ? gradeVar[g] : 'rgba(233,228,216,.18)'} />
                {k === selected && <circle r={r + 4} className="g-sel" />}
                {k === today && <circle r={r + 7} className="g-today" />}
              </g>
            );
          })}
        </g>
      </svg>
      {h && (
        <div className="tip" style={{ left: `${50 + h.x * 47}%`, top: `${50 + h.y * 47}%` }}>
          <b>{parseISO(h.k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
          <span>{fmtMins(dayTotal(days[h.k]))} · {GRADE_LABEL[gradeOf(dayTotal(days[h.k]), thresholds)]}</span>
        </div>
      )}
      <p className="galaxy-note mono faint">January at the core, December at the rim. Click a star to open that day.</p>
    </div>
  );
}
