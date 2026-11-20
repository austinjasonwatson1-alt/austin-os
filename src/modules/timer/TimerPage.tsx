import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { chime, setAmbient } from '../../core/ambient';
import { todayISO } from '../../core/dates';
import { embers } from '../../shell/fx';
import { CAT } from '../../shell/lamp';
import { go } from '../../shell/router';
import { dayTotal, fmtMins, gradeOf, GRADE_LABEL, lampHeat } from '../ledger/logic';
import { useLedger } from '../ledger/store';
import { CATS } from '../ledger/types';
import { earnings, fmtPts } from '../lounge/logic';
import { useLounge } from '../lounge/store';
import { applyCredit, elapsedMs, fmtClock } from './logic';
import { useTimer } from './store';
import { GOALS, type Ambient, type Session } from './types';
import '../../styles/timer.css';

const AMBIENTS: { k: Ambient; label: string }[] = [
  { k: 'off', label: 'Silence' }, { k: 'rain', label: 'Rain' }, { k: 'fire', label: 'Fire' }, { k: 'wind', label: 'Wind' },
];

/** Re-render every second while something is running. */
function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return on ? now : Date.now();
}

/** Lamp mode: everything else goes dark; just the lamp, the clock, and the work. */
export default function TimerPage() {
  const t = useTimer();
  const ledger = useLedger();
  const lounge = useLounge();
  useEffect(() => { void t.load(); void ledger.load(); void lounge.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = t.running;
  const live = Boolean(run && run.pausedAt === null);
  const now = useTick(Boolean(run));
  const ms = run ? elapsedMs(run, now) : 0;
  const today = todayISO();
  const before = dayTotal(ledger.days[today]);
  const runMins = Math.floor(ms / 60_000);
  const heat = lampHeat(before + (run ? runMins : 0), ledger.thresholds);
  const goalMs = run && run.goal ? run.goal * 60_000 : 0;
  const goalP = goalMs ? Math.min(1, ms / goalMs) : (ms % 3_600_000) / 3_600_000;
  const [done, setDone] = useState<{ s: Session; pts: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // Ambient sound follows the setting, only while a session is going.
  useEffect(() => {
    setAmbient(live && t.ambient !== 'off' ? t.ambient : null);
    return () => setAmbient(null);
  }, [live, t.ambient]);

  // A bell when the goal is reached (once per session).
  const rang = useRef<number | null>(null);
  useEffect(() => {
    if (run && goalMs && ms >= goalMs && rang.current !== run.startedAt) {
      rang.current = run.startedAt;
      if (t.ambient !== 'off') chime();
    }
  }, [run, goalMs, ms, t.ambient]);

  // The tab title shows the clock while a session runs.
  useEffect(() => {
    const prev = document.title;
    if (run) document.title = `${run.pausedAt ? '❚❚' : '●'} ${fmtClock(ms)} · Lamp mode`;
    return () => { document.title = prev; };
  }, [run, ms]);

  const stop = () => {
    const s = t.stop();
    if (!s) return;
    const after = useLedger.getState().days;
    const undo = Object.fromEntries(Object.entries(s.credit).map(([d, n]) => [d, -n]));
    const L = useLedger.getState();
    const e = (days: typeof after) => earnings(days, L.thresholds, L.weekly, lounge.rates, lounge.countFrom).total;
    setDone({ s, pts: e(after) - e(applyCredit(after, undo, s.cat)) });
    requestAnimationFrame(() => embers(card.current, 24));
  };

  // Keyboard: space starts/pauses, Escape leaves (the session keeps running).
  const keys = useRef({ run, live, stop });
  keys.current = { run, live, stop };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, button')) return;
      if (e.key === 'Escape') go('/cabin');
      if (e.key === ' ') {
        e.preventDefault();
        const { run: r, live: l } = keys.current;
        const s = useTimer.getState();
        if (!r) { setDone(null); s.start(s.lastCat, s.lastGoal); } else if (l) s.pause(); else s.resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cat = run?.cat ?? t.lastCat;
  const goal = run?.goal ?? t.lastGoal;
  const R = 150;
  const C = 2 * Math.PI * R;
  const shownToday = dayTotal(ledger.days[today]) + (run ? runMins : 0);
  const g = gradeOf(shownToday, ledger.thresholds);

  return (
    <div className={`lampmode${live ? ' is-live' : ''}`} style={{ '--heat': heat, '--c': CAT[cat].color } as CSSProperties}>
      <div className="lm-vignette" aria-hidden />
      <header className="lm-top">
        <div>
          <div className="page-eyebrow">Lamp mode</div>
          <div className="lm-today mono">today {fmtMins(shownToday)} · <span className={`g-${g}`}>{GRADE_LABEL[g]}</span></div>
        </div>
        <button className="lm-exit" onClick={() => go('/cabin')} aria-label="Leave lamp mode">
          {run ? 'Leave (keeps running)' : 'Leave'} <span aria-hidden>✕</span>
        </button>
      </header>

      <main className="lm-center">
        <div className="lm-lamp">
          <div className="lm-halo" aria-hidden />
          <svg viewBox="0 0 340 340" className="lm-ring" aria-hidden>
            <circle cx="170" cy="170" r={R} className="lm-track" />
            {goalP > 0 && <circle cx="170" cy="170" r={R} className="lm-arc" strokeDasharray={`${C * goalP} ${C}`} transform="rotate(-90 170 170)" />}
          </svg>
          <div className="lm-flame" aria-hidden><i /><i /><i /></div>
          <div className="lm-clock" role="timer" aria-live="off">
            <div className="lm-time">{fmtClock(ms)}</div>
            <div className="lm-goal mono">
              {!run ? (goal ? `${goal} minute session` : 'open session') : run.pausedAt ? 'paused' : goal ? (ms >= goalMs ? 'goal reached · keep going' : `of ${goal} min`) : 'open session'}
            </div>
          </div>
        </div>

        {done && !run ? (
          <div ref={card} className="lm-done" role="status">
            <div className="lm-done-big">Logged <b>{fmtMins(done.s.minutes)}</b> of {CAT[done.s.cat].name}</div>
            <div className="lm-done-pts"><span className="area-coin" aria-hidden>✦</span> +{fmtPts(done.pts)} points</div>
            <div className="lm-actions">
              <button className="btn ghost" onClick={() => { t.undoSession(done.s.id); setDone(null); }}>Undo</button>
              <button className="btn" onClick={() => go('/cabin/lounge')}>The Lounge</button>
              <button className="btn primary" onClick={() => { setDone(null); t.start(t.lastCat, t.lastGoal); }}>Another session</button>
            </div>
          </div>
        ) : (
          <>
            <div className="lm-pick" role="radiogroup" aria-label="Category">
              {CATS.map((c) => (
                <button key={c.k} role="radio" aria-checked={cat === c.k} className="qcat" style={{ '--c': c.color } as CSSProperties} onClick={() => t.setCat(c.k)}>
                  <span className="qcat-dot" />{c.name}
                </button>
              ))}
            </div>
            <div className="lm-pick" role="radiogroup" aria-label="Session length">
              {GOALS.map((m) => (
                <button key={m} role="radio" aria-checked={goal === m} className="lm-chip" onClick={() => t.setGoal(m)}>{m ? `${m} min` : 'Open'}</button>
              ))}
            </div>
            <div className="lm-actions">
              {!run && <button className="lm-go" onClick={() => { setDone(null); t.start(cat, goal); }}>Light the lamp</button>}
              {run && (
                <>
                  {live
                    ? <button className="btn lm-btn" onClick={t.pause}>Pause</button>
                    : <button className="btn lm-btn" onClick={t.resume}>Resume</button>}
                  <button className="btn primary lm-btn" onClick={stop} disabled={ms < 60_000} title={ms < 60_000 ? 'Sessions under a minute are not logged' : undefined}>
                    Stop &amp; log {runMins ? fmtMins(runMins) : ''}
                  </button>
                  <DiscardButton />
                </>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="lm-foot">
        <div className="lm-pick" role="radiogroup" aria-label="Ambient sound">
          {AMBIENTS.map((a) => (
            <button key={a.k} role="radio" aria-checked={t.ambient === a.k} className="lm-chip sm" onClick={() => t.setAmbient(a.k)}>{a.label}</button>
          ))}
        </div>
        <TodaySessions />
        <p className="lm-keys mono faint">space · start / pause &nbsp;&nbsp; esc · leave</p>
      </footer>
    </div>
  );
}

function DiscardButton() {
  const [sure, setSure] = useState(false);
  return sure
    ? <button className="btn danger" onClick={() => useTimer.getState().discard()}>Throw it away</button>
    : <button className="btn ghost" onClick={() => setSure(true)}>Discard…</button>;
}

function TodaySessions() {
  const sessions = useTimer((s) => s.sessions);
  const today = todayISO();
  const list = useMemo(() => sessions.filter((s) => s.credit[today]), [sessions, today]);
  if (!list.length) return null;
  const total = list.reduce((a, s) => a + (s.credit[today] ?? 0), 0);
  return <p className="lm-sessions mono">{list.length} session{list.length === 1 ? '' : 's'} today · {fmtMins(total)} in lamp mode</p>;
}
