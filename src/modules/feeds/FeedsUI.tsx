import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, todayISO } from '../../core/dates';
import { go } from '../../shell/router';
import { avgSleep, clock, freeWindows, parseIcs, stepsWeek } from './logic';
import { useFeeds } from './store';
import '../../styles/feeds.css';

const fmH = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/** Today on Home: the calendar's events and the free stretches between them. Nothing shows until a calendar is connected. */
export function TodayCal() {
  const f = useFeeds();
  useEffect(() => { void f.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const now = new Date();
  const nowT = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const events = f.events.filter((e) => e.day === today);
  const free = useMemo(() => freeWindows(events, today, { now: nowT }), [events, today, nowT]);
  if (!f.loaded || !f.calAt) return null;
  const best = [...free].sort((a, b) => b.mins - a.mins)[0];
  return (
    <section className="panel today-cal">
      <div className="panel-h"><p className="panel-t">Today</p><span className="mono faint" style={{ fontSize: 10.5 }}>from your calendar</span></div>
      {events.length === 0 ? <p className="dim tc-empty">Nothing on the calendar today. The whole day is yours.</p> : (
        <ol className="tc-list">
          {events.map((e, i) => (
            <li key={i} className={e.end && e.end <= nowT ? 'past' : e.start && e.start <= nowT && (!e.end || e.end > nowT) ? 'now' : ''}>
              <span className="mono">{e.allDay ? 'all day' : clock(e.start!)}</span><span>{e.title}</span>
            </li>
          ))}
        </ol>
      )}
      {best && (
        <button className="tc-window" onClick={() => go('/cabin/timer')}>
          <span className="tc-lamp" aria-hidden />
          <span><b>{fmH(best.mins)} free from {clock(best.start)}</b><span className="dim"> · a writing window. Light the lamp →</span></span>
        </button>
      )}
    </section>
  );
}

/** Steps and sleep from Apple Health, on the Forge. */
export function HealthPanel() {
  const f = useFeeds();
  useEffect(() => { void f.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const week = stepsWeek(f.days, dates);
  const max = Math.max(8000, ...week.map((d) => d.steps));
  const sleep = avgSleep(f.days, dates);
  if (!f.loaded) return null;
  const any = week.some((d) => d.steps) || sleep !== null;
  return (
    <section className="panel health-panel">
      <div className="panel-h"><p className="panel-t">From Apple Health</p>{!any && <button className="linkish" onClick={() => go('/settings')}>Set it up →</button>}</div>
      {!any ? <p className="dim" style={{ margin: 0, fontSize: 13.5 }}>Steps, sleep and workouts can come in by themselves each night from your iPhone. One Shortcut, set up once in Settings.</p> : (
        <div className="hp-body">
          <div className="hp-steps">
            <span className="mono hp-l">Steps · 7 days</span>
            <div className="hp-bars">{week.map((d) => <div key={d.date} title={`${d.steps.toLocaleString('en-US')} steps`}><i style={{ height: `${(d.steps / max) * 100}%` }} className={d.steps >= 8000 ? 'met' : ''} /><span className="mono">{'SMTWTFS'[new Date(`${d.date}T12:00:00`).getDay()]}</span></div>)}</div>
          </div>
          <div className="hp-nums">
            <div><b>{(f.days[today]?.steps ?? 0).toLocaleString('en-US')}</b><span className="mono">steps today</span></div>
            <div><b>{sleep ?? '—'}{sleep ? 'h' : ''}</b><span className="mono">sleep, 7-day avg</span></div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Settings: the two Shortcuts, written out step by step, and the .ics import. */
export function FeedsSettings() {
  const f = useFeeds();
  useEffect(() => { void f.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const base = `${location.origin}${location.pathname}`;
  const [copied, setCopied] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const [icsMsg, setIcsMsg] = useState('');
  const copy = (k: string, t: string) => { void navigator.clipboard?.writeText(t).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1600); }); };
  const healthUrl = `${base}#/health?steps=`;
  const calUrl = `${base}#/cal?e=`;
  return (
    <section className="panel cloud feeds-set">
      <div className="panel-h"><p className="panel-t">Apple Health & your calendar</p><span className={`mono ${f.calAt ? 'g-good' : 'faint'}`} style={{ fontSize: 11 }}>{f.calAt ? 'calendar connected' : 'not set up'}</span></div>
      <p className="set-note" style={{ marginTop: 0 }}>Both come in through the Shortcuts app on your iPhone, set to run by themselves. Nothing is shared with anyone; the numbers land in Austin OS on your device.</p>
      <div className="fs-grid">
        <div>
          <p className="fs-h">⚒ Health into the Forge, every night</p>
          <ol className="set-steps">
            <li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Time of Day</b>, 9:30 pm, daily, <b>Run Immediately</b>.</li>
            <li>Add <b>Find Health Samples</b>: Steps, today; then <b>Calculate Statistics</b> → Sum. Name it <b>Steps</b>.</li>
            <li>Add <b>Find Health Samples</b>: Sleep, last night → Sum (in hours). Name it <b>Sleep</b>.</li>
            <li>Optional: <b>Find Workouts</b> today → total Duration in minutes. Name it <b>Workout</b>.</li>
            <li>Add <b>Text</b> with the link below, putting each variable after its <b>=</b>, then <b>Open URLs</b>.</li>
          </ol>
          <code className="fs-code">{healthUrl}<i>Steps</i>&amp;sleep=<i>Sleep</i>&amp;workout=<i>Workout</i></code>
          <button className="btn sm" onClick={() => copy('h', `${healthUrl}&sleep=&workout=`)}>{copied === 'h' ? 'Copied ✓' : 'Copy the link'}</button>
        </div>
        <div>
          <p className="fs-h">◷ Today’s calendar on Home, every morning</p>
          <ol className="set-steps">
            <li>Automation → <b>Time of Day</b>, 6:30 am, daily, <b>Run Immediately</b>.</li>
            <li><b>Find Calendar Events</b> where Start Date is <b>today</b>.</li>
            <li><b>Repeat with Each</b>: a <b>Text</b> of <i>Start Date</i> (format HH:mm) <b>-</b> <i>End Date</i> (HH:mm), a space, then <i>Title</i>.</li>
            <li><b>Combine Text</b> with New Lines → <b>URL Encode</b> → append to the link below → <b>Open URLs</b>.</li>
          </ol>
          <code className="fs-code">{calUrl}<i>Encoded events</i></code>
          <button className="btn sm" onClick={() => copy('c', calUrl)}>{copied === 'c' ? 'Copied ✓' : 'Copy the link'}</button>
          <p className="set-note">Or bring in a file: export your calendar as <b>.ics</b> (Google Calendar → Settings → Import & export; iCloud → share → export) and choose it here. Kept on this device only.</p>
          <div className="fs-row">
            <button className="btn sm" onClick={() => file.current?.click()}>Import an .ics file</button>
            {f.calAt && <button className="btn ghost sm" onClick={() => f.clearCalendar()}>Forget the calendar</button>}
            <input ref={file} type="file" hidden accept=".ics,text/calendar" onChange={async (e) => {
              const fl = e.target.files?.[0]; e.target.value = ''; if (!fl) return;
              const today = todayISO(); const to = addDays(today, 60);
              const evs = parseIcs(await fl.text(), today, to);
              const days = Array.from({ length: 61 }, (_, i) => addDays(today, i));
              f.setEvents(evs, days);
              setIcsMsg(`${evs.length} events in the next 60 days brought in.`);
            }} />
          </div>
          {icsMsg && <p className="mono g-good" style={{ fontSize: 11 }}>{icsMsg}</p>}
        </div>
      </div>
    </section>
  );
}
