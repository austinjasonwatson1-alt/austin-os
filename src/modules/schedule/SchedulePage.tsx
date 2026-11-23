import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addDays, mondayOf, parseISO } from '../../core/dates';
import { chime } from '../../core/ambient';
import { CountUp, embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { Lantern, useNow } from '../day/parts';
import { blocksFor, carryable, clock12, isWorkday, labelOf, liveTasks, nowIn, planOf, weekGrid, type Block } from './logic';
import { useSchedule } from './store';
import type { WeekTask } from './types';
import '../../styles/cabin.css';
import '../../styles/day.css';
import '../../styles/schedule.css';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
  const s = useSchedule();
  useEffect(() => { void s.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { now, today } = useNow();
  const blocks = useMemo(() => blocksFor(s.settings), [s.settings]);
  const workToday = isWorkday(s.settings, today);
  // The day on show: today on a working day, otherwise the next working day.
  const [day, setDay] = useState<string | null>(null);
  const shown = day ?? (workToday ? today : nextWorkday(s.settings, today));
  const monday = mondayOf(shown);
  const minute = now.getHours() * 60 + now.getMinutes();
  const where = nowIn(blocks, minute, workToday);
  useChimes(where, Boolean(s.settings.chime && s.loaded));

  const plan = planOf(s, shown);
  const doneN = plan.done.filter((i) => i < blocks.length).length;

  return (
    <div className="home sched">
      <section className="hero sch-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · The schedule</div>
          <h1 className="hero-title">The working<br /><em>day.</em></h1>
          <p className="hero-line">{blocks.length} blocks of {s.settings.work} minutes, a {s.settings.brk}-minute breath between, from {clock12(blocks[0]?.from ?? 540)} to {clock12(toMin(s.settings.end))}. Name each block, then tick it off.</p>
        </div>
        <NowDial where={where} label={where.block ? labelOf(s, today, where.block.i).text : ''} nextLabel={where.next ? labelOf(s, today, where.next.i).text : ''} doneToday={planOf(s, today).done.length} total={blocks.length} />
      </section>

      <nav className="sch-days rise" style={rise(1)} aria-label="Choose a day">
        <button className="sch-wk" onClick={() => setDay(addDays(monday, -7))} aria-label="Previous week">‹</button>
        {weekGrid(s, monday).map((d) => (
          <button key={d.date} className={`sch-day${d.date === shown ? ' on' : ''}${d.date === today ? ' today' : ''}`} onClick={() => setDay(d.date)} aria-pressed={d.date === shown}>
            <span className="mono">{WD[parseISO(d.date).getDay()]}</span>
            <b>{parseISO(d.date).getDate()}</b>
            <span className="sch-pips" aria-label={`${d.done.length} of ${d.total} done`}>{Array.from({ length: d.total }, (_, i) => <i key={i} className={d.done.includes(i) ? 'on' : ''} />)}</span>
          </button>
        ))}
        <button className="sch-wk" onClick={() => setDay(addDays(monday, 7))} aria-label="Next week">›</button>
      </nav>

      <div className="sch-grid">
        <section className="panel sch-blocks rise" style={rise(2)}>
          <div className="panel-h">
            <p className="panel-t">{shown === today ? 'Today' : WD_LONG[parseISO(shown).getDay()]} · {parseISO(shown).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
            <span className="mono faint"><CountUp value={doneN} /> of {blocks.length} done</span>
          </div>
          <div className="sch-meter" aria-hidden><span style={{ width: `${(doneN / Math.max(1, blocks.length)) * 100}%` }} /></div>
          {!isWorkday(s.settings, shown) ? <p className="dim">Not a working day. Rest.</p> : (
            <ol className="sch-list">
              {blocks.map((b, k) => (
                <BlockRow key={b.i} b={b} date={shown} live={shown === today && where.phase === 'work' && where.block?.i === b.i ? where.through : null}
                  breakAfter={k < blocks.length - 1 ? blocks[k + 1].from - b.to : 0} breakLive={shown === today && where.phase === 'break' && where.block?.i === b.i} />
              ))}
            </ol>
          )}
        </section>
        <WeekTasks monday={monday} />
      </div>
      <Settings />
    </div>
  );
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
function nextWorkday(settings: { days: number[] }, from: string) {
  for (let k = 1; k <= 7; k++) { const d = addDays(from, k); if (settings.days.includes(parseISO(d).getDay())) return d; }
  return from;
}

/** A soft chime when a block ends and when a break ends, while the page is open. */
function useChimes(where: ReturnType<typeof nowIn>, on: boolean) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const key = `${where.phase}:${where.block?.i ?? ''}`;
    if (last.current && last.current !== key && on && (where.phase === 'break' || where.phase === 'work' || where.phase === 'after')) chime();
    last.current = key;
  }, [where.phase, where.block?.i, on]);
}

function NowDial({ where, label, nextLabel, doneToday, total }: { where: ReturnType<typeof nowIn>; label: string; nextLabel: string; doneToday: number; total: number }) {
  const R = 52, C = 2 * Math.PI * R;
  const big = where.phase === 'work' ? `${where.minsLeft}` : where.phase === 'break' ? `${where.minsLeft}` : where.phase === 'before' ? clock12(where.next!.from).replace(/ (am|pm)/, '') : where.phase === 'after' ? `${doneToday}/${total}` : '—';
  const unit = where.phase === 'work' || where.phase === 'break' ? 'min left' : where.phase === 'before' ? 'first block' : where.phase === 'after' ? 'blocks done' : 'day off';
  const line = where.phase === 'work' ? `Block ${where.block!.i + 1} · ${where.block!.start}–${where.block!.end}${label ? ` · ${label}` : ''}`
    : where.phase === 'break' ? `Break. Stand up, look far away. Next: ${where.next!.start}${nextLabel ? ` · ${nextLabel}` : ''}`
      : where.phase === 'before' ? `Starts at ${clock12(where.next!.from)}${nextLabel ? ` · ${nextLabel}` : ''}`
        : where.phase === 'after' ? 'The working day is done.' : 'Not a working day.';
  return (
    <div className={`sch-now ph-${where.phase}`} aria-live="polite">
      <div className="sch-ring">
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={R} className="sch-ring-t" />
          <circle cx="60" cy="60" r={R} className="sch-ring-f" strokeDasharray={`${C * (where.phase === 'after' ? doneToday / Math.max(1, total) : where.through)} ${C}`} transform="rotate(-90 60 60)" />
        </svg>
        <span className="sch-ring-v"><b>{big}</b><i className="mono">{unit}</i></span>
      </div>
      <p className="sch-now-line">{line}</p>
    </div>
  );
}

function BlockRow({ b, date, live, breakAfter, breakLive }: { b: Block; date: string; live: number | null; breakAfter: number; breakLive: boolean }) {
  const s = useSchedule();
  const l = labelOf(s, date, b.i);
  const done = planOf(s, date).done.includes(b.i);
  const [v, setV] = useState(l.text);
  useEffect(() => setV(l.text), [l.text, date]);
  // Grow to fit a long name, so it wraps instead of being cut off.
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = box.current; if (t) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; } }, [v]);
  // Editing a repeating block changes just this day; the repeat stays for other weeks.
  const save = () => { if (v.trim() !== l.text) s.label(date, b.i, v); };
  return (
    <>
      <li className={`sch-b${done ? ' done' : ''}${live !== null ? ' live' : ''}`} style={{ '--through': live ?? 0 } as CSSProperties}>
        <span className="sch-time mono"><b>{b.start}</b><i>{b.end}</i></span>
        <button className="sch-check" aria-pressed={done} aria-label={done ? `Block ${b.i + 1} done; tap to undo` : `Mark block ${b.i + 1} done`}
          onClick={(e) => { const on = s.toggle(date, b.i); if (on) embers(e.currentTarget, 12); }}>
          <Lantern lit={done} size={22} />
        </button>
        <span className="sch-what">
          <textarea ref={box} rows={1} value={v} onChange={(e) => setV(e.target.value.replace(/\n/g, ' '))} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
            placeholder={`Block ${b.i + 1}: what is it for?`} aria-label={`What block ${b.i + 1} is for`} />
          <button className={l.repeats ? 'sch-rep on' : 'sch-rep'} title={l.repeats ? `Repeats every ${WD_LONG[parseISO(date).getDay()]}: tap to stop` : `Repeat every ${WD_LONG[parseISO(date).getDay()]}`}
            aria-pressed={l.repeats} disabled={!v.trim()} onClick={() => (l.repeats ? s.unrepeat(date, b.i) : s.label(date, b.i, v, true))}>↻</button>
        </span>
        {live !== null && <span className="sch-live" aria-hidden><i /></span>}
      </li>
      {breakAfter > 0 && <li className={breakLive ? 'sch-break live' : 'sch-break'} aria-label={`${breakAfter}-minute break`}><span className="mono">{breakAfter} min break</span></li>}
    </>
  );
}

function WeekTasks({ monday }: { monday: string }) {
  const s = useSchedule();
  const tasks = liveTasks(s.weeks[monday]);
  const carry = carryable(s, monday);
  const [t, setT] = useState('');
  const [pin, setPin] = useState<number | undefined>(undefined);
  const days = s.settings.days.filter((d) => d >= 1 && d <= 5).concat(s.settings.days.filter((d) => d === 0 || d === 6));
  const done = tasks.filter((x) => x.done).length;
  const order = (a: WeekTask, b: WeekTask) => Number(Boolean(a.done)) - Number(Boolean(b.done)) || (a.day ?? 9) - (b.day ?? 9);
  return (
    <section className="panel sch-week rise" style={rise(3)}>
      <div className="panel-h"><p className="panel-t">This week · {parseISO(monday).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p><span className="mono faint">{done} of {tasks.length} done</span></div>
      <form className="sch-add" onSubmit={(e) => { e.preventDefault(); s.addTask(monday, t, pin); setT(''); }}>
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Something for this week" aria-label="A task for this week" />
        <button className="btn primary sm" disabled={!t.trim()}>Add</button>
        <span className="sch-pin" role="radiogroup" aria-label="Pin to a day">
          <button type="button" role="radio" aria-checked={pin === undefined} className={pin === undefined ? 'on' : ''} onClick={() => setPin(undefined)}>Week</button>
          {days.map((d) => <button key={d} type="button" role="radio" aria-checked={pin === d} className={pin === d ? 'on' : ''} onClick={() => setPin(d)}>{WD[d].slice(0, 2)}</button>)}
        </span>
      </form>
      {carry.length > 0 && (
        <button className="linkish sch-carry" onClick={() => carry.forEach((c) => s.addTask(monday, c.text, c.day))}>Bring {carry.length} unfinished from last week →</button>
      )}
      {tasks.length === 0 ? <p className="dim sch-empty">Nothing on the week yet. The few things that would make it a good one.</p> : (
        <ul className="sch-tasks">
          {[...tasks].sort(order).map((x) => (
            <li key={x.id} className={x.done ? 'done' : ''}>
              <button className="sch-tick" aria-pressed={Boolean(x.done)} aria-label={x.done ? `Undo: ${x.text}` : `Done: ${x.text}`}
                onClick={(e) => { if (!x.done) embers(e.currentTarget, 8); s.patchTask(monday, x.id, { done: !x.done }); }}>{x.done ? '✓' : ''}</button>
              <span className="sch-tt">{x.text}</span>
              {x.day !== undefined && <span className="mono sch-tday">{WD[x.day]}</span>}
              <button className="sch-x" aria-label={`Remove ${x.text}`} onClick={() => s.removeTask(monday, x.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Settings() {
  const s = useSchedule();
  const [open, setOpen] = useState(false);
  const st = s.settings;
  return (
    <section className="sch-settings rise" style={rise(4)}>
      <button className="linkish" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide the shape of the day' : 'Change the shape of the day'}</button>
      {open && (
        <div className="sch-set panel">
          <label className="field"><span>Starts</span><input type="time" value={st.start} onChange={(e) => e.target.value && s.setSettings({ start: e.target.value })} /></label>
          <label className="field"><span>Ends</span><input type="time" value={st.end} onChange={(e) => e.target.value && s.setSettings({ end: e.target.value })} /></label>
          <label className="field"><span>Work (min)</span><input type="number" min={10} max={180} value={st.work} onChange={(e) => s.setSettings({ work: Math.max(10, Math.min(180, Number(e.target.value) || 50)) })} /></label>
          <label className="field"><span>Break (min)</span><input type="number" min={0} max={60} value={st.brk} onChange={(e) => s.setSettings({ brk: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} /></label>
          <div className="sch-wds" role="group" aria-label="Working days">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} className={st.days.includes(d) ? 'gchip on' : 'gchip'} aria-pressed={st.days.includes(d)} onClick={() => s.setSettings({ days: st.days.includes(d) ? st.days.filter((x) => x !== d) : [...st.days, d] })}>{WD[d]}</button>)}
          </div>
          <label className="switch"><input type="checkbox" checked={Boolean(st.chime)} onChange={(e) => s.setSettings({ chime: e.target.checked })} /><span className="switch-ui" aria-hidden /><span><b>A soft chime</b><small>When a block ends and when a break ends, while Austin OS is open.</small></span></label>
        </div>
      )}
    </section>
  );
}
