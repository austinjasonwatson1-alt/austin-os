import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, daysOfYear, daysUntil, mondayOf, MONTHS_LONG, parseISO, prettyDate, todayISO } from '../../core/dates';
import { useBackup } from '../../core/backup';
import { Page } from '../../shell/Page';
import {
  currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, monthLabel, monthStats, weekTotal, yearSummary,
} from './logic';
import { extractDays, useLedger } from './store';
import { CATS, type GradeKey } from './types';

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

  return (
    <Page
      eyebrow="Writer's Cabin · The Ledger"
      title="Hours toward the book"
      lede="Every minute you give the dream, counted honestly. No zero days."
    >
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Stat label="Current streak" value={String(streak)} unit={streak === 1 ? 'day' : 'days'} />
        <Stat label={`Days logged · ${new Date().getFullYear()}`} value={String(ys.logged)} unit="days" />
        <Stat label={`Hours · ${new Date().getFullYear()}`} value={fmtMins(ys.minutes)} unit="" />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16, alignItems: 'start' }}>
        <TodayPanel date={cursor} setDate={setCursor} />
        <WeekPanel date={cursor} />
      </div>

      <YearWall year={year} setYear={setYear} selected={cursor} onPick={setCursor} />

      <div className="grid cols-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <MonthsPanel year={year} />
        <div className="grid" style={{ gap: 16 }}>
          <DeadlinesPanel />
          <DataPanel />
        </div>
      </div>
      <p className="faint mono" style={{ fontSize: 11, marginTop: 18, letterSpacing: '.08em' }}>
        Day grades · elite {thresholds.elite}m · good {thresholds.good}m · warning {thresholds.warn}m &nbsp;|&nbsp; Week · elite{' '}
        {weekly.elite}m · good {weekly.good}m · warning {weekly.warn}m
      </p>
    </Page>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="panel">
      <p className="panel-t">{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
        <span className="big" style={{ fontSize: 46 }}>{value}</span>
        <span className="dim mono" style={{ fontSize: 12 }}>{unit}</span>
      </div>
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

  return (
    <section className="panel">
      <div className="panel-h">
        <h2 className="panel-t">{isToday ? 'Today' : 'Editing'} · {prettyDate(date)}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>◀</button>
          <button className="btn ghost" onClick={() => setDate(todayISO())} disabled={isToday}>Today</button>
          <button className="btn ghost" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayISO()}>▶</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="big" style={{ fontSize: 56 }}>{fmtMins(total)}</span>
        <span className={`mono g-${g}`} style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {GRADE_LABEL[g]}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {CATS.map((c) => {
          const v = Number(entry?.[c.k]) || 0;
          return (
            <div key={c.k} style={{ display: 'grid', gridTemplateColumns: '12px 84px 74px 1fr', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, boxShadow: `0 0 10px ${c.color}80` }} />
              <span className="dim">{c.name}</span>
              <input
                type="number" min={0} inputMode="numeric" value={v || ''} placeholder="0" aria-label={`${c.name} minutes`}
                onChange={(e) => setMinutes(date, c.k, Number(e.target.value))}
                style={{ background: 'rgba(233,228,216,.05)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px', width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 5 }}>
                {[5, 15, 30].map((n) => (
                  <button key={n} className="btn" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setMinutes(date, c.k, v + n)}>
                    +{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => setNote(date, note)}
        placeholder="A line about the day…"
        rows={2}
        style={{ marginTop: 16, width: '100%', resize: 'vertical', background: 'rgba(233,228,216,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}
      />
    </section>
  );
}

/* ---------------- week ---------------- */

function WeekPanel({ date }: { date: string }) {
  const { days, thresholds, weekly } = useLedger();
  const monday = mondayOf(date);
  const total = weekTotal(days, monday);
  const g = gradeOf(total, { elite: weekly.elite, good: weekly.good, warn: weekly.warn });
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const week = labels.map((l, i) => {
    const k = addDays(monday, i);
    return { l, k, m: dayTotal(days[k]) };
  });
  const max = Math.max(thresholds.elite, ...week.map((d) => d.m));

  return (
    <section className="panel">
      <div className="panel-h">
        <h2 className="panel-t">Week of {parseISO(monday).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2>
        <span className={`mono g-${g}`} style={{ fontSize: 12, letterSpacing: '.12em' }}>
          {total === 0 ? 'NOTHING YET' : GRADE_LABEL[g].toUpperCase()}
        </span>
      </div>
      <div className="big" style={{ fontSize: 44, marginBottom: 18 }}>{fmtMins(total)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, alignItems: 'end', height: 150 }}>
        {week.map((d) => {
          const gg = gradeOf(d.m, thresholds);
          return (
            <div key={d.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <span className="mono faint" style={{ fontSize: 10 }}>{d.m ? fmtMins(d.m) : ''}</span>
              <div
                title={`${d.k}: ${d.m}m`}
                style={{
                  width: '100%', height: `${Math.max(4, (d.m / max) * 100)}%`, borderRadius: 6,
                  background: gradeVar[gg], opacity: d.m ? 0.95 : 0.5,
                  outline: d.k === date ? '1.5px solid var(--lamp)' : 'none', outlineOffset: 2,
                }}
              />
              <span className="mono faint" style={{ fontSize: 10 }}>{d.l}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- year wall ---------------- */

function YearWall({ year, setYear, selected, onPick }: { year: number; setYear: (y: number) => void; selected: string; onPick: (d: string) => void }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const keys = useMemo(() => daysOfYear(year), [year]);
  const lead = (parseISO(keys[0]).getDay() + 6) % 7;

  return (
    <section className="panel">
      <div className="panel-h">
        <h2 className="panel-t">The year wall · {year}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn ghost" aria-label="Previous year" onClick={() => setYear(year - 1)}>◀</button>
          <button className="btn ghost" aria-label="Next year" onClick={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()}>▶</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
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

function MonthsPanel({ year }: { year: number }) {
  const { days, thresholds } = useLedger();
  const today = todayISO();
  const rows = MONTHS_LONG.map((name, m) => ({ name, m, st: monthStats(days, year, m, today, thresholds) })).filter((r) => r.st.elapsed > 0);

  return (
    <section className="panel">
      <div className="panel-h"><h2 className="panel-t">Months · {year}</h2></div>
      {rows.length === 0 && <p className="dim">Nothing logged for {year} yet.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(({ name, m, st }) => {
          const lab = monthLabel(st, thresholds);
          return (
            <div key={m} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 64px 84px', gap: 12, alignItems: 'center' }}>
              <span>{name}</span>
              <div style={{ height: 8, background: 'rgba(233,228,216,.06)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (st.avg / thresholds.elite) * 100)}%`, height: '100%', background: gradeVar[lab.key] }} />
              </div>
              <span className="mono dim" style={{ fontSize: 12, textAlign: 'right' }}>{fmtMins(st.total)}</span>
              <span className={`mono g-${lab.key}`} style={{ fontSize: 11, letterSpacing: '.08em', textAlign: 'right' }}>{lab.label}</span>
            </div>
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
  const field = { background: 'rgba(233,228,216,.05)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px' } as const;

  return (
    <section className="panel">
      <div className="panel-h"><h2 className="panel-t">Deadlines</h2></div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {deadlines.length === 0 && <p className="dim" style={{ margin: 0 }}>No deadlines set.</p>}
        {deadlines.map((x, i) => {
          const left = daysUntil(x.d);
          return (
            <div key={`${x.n}${x.d}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ flex: 1 }}>{x.n}</span>
              <span className={`mono ${left < 0 ? 'g-bad' : left < 30 ? 'g-warn' : 'dim'}`} style={{ fontSize: 12 }}>
                {left < 0 ? `${-left}d ago` : left === 0 ? 'today' : `${left}d`}
              </span>
              <button className="btn ghost" aria-label={`Remove ${x.n}`} onClick={() => removeDeadline(i)}>✕</button>
            </div>
          );
        })}
      </div>
      <form
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onSubmit={(e) => { e.preventDefault(); if (n.trim() && d) { addDeadline({ n: n.trim(), d }); setN(''); setD(''); } }}
      >
        <input style={{ ...field, flex: 1, minWidth: 120 }} placeholder="Deadline name" value={n} onChange={(e) => setN(e.target.value)} />
        <input style={field} type="date" value={d} onChange={(e) => setD(e.target.value)} />
        <button className="btn" type="submit">Add</button>
      </form>
    </section>
  );
}

/* ---------------- data ---------------- */

function DataPanel() {
  const { days, previewDays, applyDays, loadSeed } = useLedger();
  const { exportAll } = useBackup();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const empty = Object.keys(days).length === 0;

  const importFile = async (file: File) => {
    try {
      const incoming = extractDays(JSON.parse(await file.text()));
      if (!incoming) return setMsg('No ledger entries found in that file.');
      const p = previewDays(incoming);
      if (!window.confirm(`Load this backup?\n\n${p.add} new days\n${p.update} days upgraded (bigger total)\n${p.keep} days kept as they are`)) return;
      applyDays(incoming);
      setMsg(`Loaded: ${p.add} added, ${p.update} upgraded.`);
    } catch {
      setMsg('That file could not be read.');
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
          The books are empty. Load your Jan–Aug history, or import a backup exported from the old Ledger to bring September onward.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {empty && <button className="btn primary" onClick={() => { const p = loadSeed(); setMsg(`Loaded ${p.add} days of history.`); }}>Load Jan–Aug history</button>}
        <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
        <button className="btn" onClick={() => void exportAll()}>Back up everything</button>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </div>
      {msg && <p className="mono" style={{ fontSize: 12, color: 'var(--lamp)', marginBottom: 0 }}>{msg}</p>}
    </section>
  );
}
