import { useState, type CSSProperties } from 'react';
import { addDays, mondayOf, todayISO } from '../../core/dates';
import { embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { AREA_STORES } from './store';
import { COUNTED_LABEL, jobClock, MOVES, PREP, upcomingInterviews, weekMoves, weekScore, WEEK_TARGETS, type Counted } from './jobLogic';
import type { AreaItem } from './types';

/** Job Search HQ, the Office's hero side: how many days are left to the March 1 goal. */
export function JobCountdown() {
  const c = jobClock(todayISO());
  return (
    <div className={c.left <= 30 ? 'jq-clock urgent' : 'jq-clock'} style={{ '--used': c.used } as CSSProperties}>
      <span className="big">{Math.max(0, c.left)}</span>
      <span className="mono">{c.left > 0 ? 'days to March 1' : c.left === 0 ? 'goal day' : 'past the goal'}</span>
      <span className="jq-bar" aria-hidden><i /></span>
      <span className="mono faint">{Math.round(c.used * 100)}% of the runway used · since Oct 12</span>
    </div>
  );
}

/** The doors into the Application Ledger and the Recruiter Desk, and the day's four moves. */
export function JobHQ() {
  const a = AREA_STORES.office();
  const today = todayISO();
  const day = a.days[today] ?? {};
  const doors = a.items.filter((i) => i.list === 'doors');
  const ledger = doors.find((d) => d.kind === 'ledger');
  const desk = doors.find((d) => d.kind === 'desk');
  const week = weekMoves(a.days, mondayOf(today), today);
  const toggle = (k: string, el: HTMLElement) => { const on = !day[k]; if (on) embers(el, 10); a.setMinutes(today, k, on ? 1 : 0); };
  const bump = (k: string, by: number) => a.setMinutes(today, k, Math.max(0, (day[k] ?? 0) + by));
  const score = weekScore(a.days, mondayOf(today), today);

  return (
    <section className="panel jq rise" style={rise(1)}>
      <div className="jq-doors">
        <Door kind="ledger" label="Application Ledger" sub="Every application, follow-up and referral" glyph="▤" door={ledger} />
        <Door kind="desk" label="Recruiter Desk" sub="Today's shortlist, follow-ups and interview prep, from your recruiter at 6:47 each weekday" glyph="✉" door={desk} />
      </div>
      <div className="jq-moves">
        <div className="panel-h"><p className="panel-t">Today's four moves</p><span className="mono faint">{MOVES.filter((m) => day[m.k]).length} of 4</span></div>
        <ul>
          {MOVES.map((m) => (
            <li key={m.k} className="jq-moverow">
              <button className={day[m.k] ? 'jq-move on' : 'jq-move'} aria-pressed={Boolean(day[m.k])} onClick={(e) => toggle(m.k, e.currentTarget)}>
                <span className="jq-tick" aria-hidden>{day[m.k] ? '✓' : ''}</span>
                <span><b>{m.label}</b><span className="dim">{m.hint}</span></span>
              </button>
              {m.k in WEEK_TARGETS && (day[m.k] ?? 0) > 0 && (
                <span className="jq-count" aria-label={`${day[m.k]} today`}>
                  <button aria-label={`One fewer ${m.k}`} onClick={() => bump(m.k, -1)}>−</button>
                  <b className="mono">×{day[m.k]}</b>
                  <button aria-label={`One more ${m.k}`} onClick={(e) => { embers(e.currentTarget, 6); bump(m.k, 1); }}>+</button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="jq-week">
          {week.days.map((d) => (
            <span key={d.date} className={`jq-d${d.date === today ? ' today' : ''}${d.date > today ? ' future' : ''}`} title={`${d.date}: ${d.n} of 4`}>
              <i style={{ height: `${(d.n / 4) * 100}%` }} /><span className="mono">{'MTWTFSS'[week.days.indexOf(d)]}</span>
            </span>
          ))}
        </div>
        <div className="jq-score" aria-label="This week's scoreboard">
          {score.map((x) => (
            <div key={x.k} className={`jq-sc p-${x.pace}`}>
              <span className="mono jq-sc-k">{COUNTED_LABEL[x.k as Counted]}</span>
              <span className="jq-sc-n"><b>{x.n}</b><span className="mono faint">/ {x.target}</span></span>
              <span className="jq-sc-bar" aria-hidden><i style={{ width: `${Math.min(1, x.n / x.target) * 100}%` }} /></span>
              <span className="mono jq-sc-p">{x.pace === 'ahead' ? 'Ahead' : x.pace === 'on' ? 'On pace' : 'Behind'}</span>
            </div>
          ))}
        </div>
      </div>
      <Interviews items={a.items} today={today} />
    </section>
  );
}

/** Interviews ahead: the next one counts down with its prep checklist; the rest wait in line. */
function Interviews({ items, today }: { items: AreaItem[]; today: string }) {
  const a = AREA_STORES.office();
  const ahead = upcomingInterviews(items, today);
  const [adding, setAdding] = useState(false);
  const [what, setWhat] = useState('');
  const [when, setWhen] = useState(addDays(today, 3));
  const next = ahead[0] ? items.find((i) => i.id === ahead[0].id)! : null;
  const toggle = (it: AreaItem, k: string) => { const has = it.checks?.includes(k); a.patchItem(it.id, { checks: has ? (it.checks ?? []).filter((x) => x !== k) : [...(it.checks ?? []), k] }); };
  const add = () => { if (!what.trim() || !when) return; a.addItem('interviews', what.trim(), { when, date: today, checks: [] }); setWhat(''); setAdding(false); };
  return (
    <div className="jq-iv">
      <div className="panel-h"><p className="panel-t">Interviews</p><button className="btn sm" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ An interview'}</button></div>
      {adding && (
        <form className="jq-iv-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Toast — PM recruiter screen" aria-label="Who and what" autoFocus />
          <input type="date" value={when} min={today} onChange={(e) => setWhen(e.target.value)} aria-label="Date" />
          <button className="btn primary sm" disabled={!what.trim()}>Add</button>
        </form>
      )}
      {!next ? (
        !adding && <p className="dim jq-iv-empty">None booked yet. When a screen lands, add it here: it counts down on the Office and The Day, with a prep list.</p>
      ) : (
        <div className="jq-iv-next">
          <div className="jq-iv-when">
            <b>{ahead[0].in === 0 ? 'Today' : ahead[0].in}</b>
            <span className="mono">{ahead[0].in === 0 ? '' : ahead[0].in === 1 ? 'day to go' : 'days to go'}</span>
          </div>
          <div className="jq-iv-body">
            <p className="jq-iv-t">{next.text}<button className="linkish" onClick={() => a.removeItem(next.id)} aria-label={`Remove ${next.text}`}>remove</button></p>
            <ul className="jq-prep">
              {PREP.map((p) => {
                const on = Boolean(next.checks?.includes(p.k));
                return <li key={p.k}><button className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(next, p.k)}><span aria-hidden>{on ? '✓' : ''}</span>{p.label}</button></li>;
              })}
            </ul>
          </div>
        </div>
      )}
      {ahead.length > 1 && (
        <ul className="jq-iv-later">
          {ahead.slice(1).map((x) => <li key={x.id}><span>{x.text}</span><span className="mono faint">in {x.in} days · {x.prepped}/{PREP.length} prepped</span></li>)}
        </ul>
      )}
    </div>
  );
}

function Door({ kind, label, sub, glyph, door }: { kind: 'ledger' | 'desk'; label: string; sub: string; glyph: string; door?: { id: string; link?: string } }) {
  const a = AREA_STORES.office();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(door?.link ?? '');
  const ok = /^https:\/\/\S+$/.test(v.trim());
  const save = () => {
    if (!ok) return;
    if (door) a.patchItem(door.id, { link: v.trim() }); else a.addItem('doors', label, { link: v.trim(), kind, date: addDays(todayISO(), 0) });
    setEdit(false);
  };
  if (!door?.link || edit) {
    return (
      <form className="jq-door setup" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <span className="jq-glyph" aria-hidden>{glyph}</span>
        <span className="jq-dt"><b>{label}</b><span className="dim">Paste its link once (open it in Claude, copy the address). It stays in your data, nowhere else.</span></span>
        <span className="jq-paste"><input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://claude.ai/artifact/…" aria-label={`${label} link`} /><button className="btn primary sm" disabled={!ok}>Save</button></span>
      </form>
    );
  }
  return (
    <div className="jq-door">
      <a className="jq-open" href={door.link} target="_blank" rel="noopener noreferrer">
        <span className="jq-glyph" aria-hidden>{glyph}</span>
        <span className="jq-dt"><b>{label}</b><span className="dim">{sub}</span></span>
        <span className="jq-go" aria-hidden>↗</span>
      </a>
      <button className="linkish jq-change" onClick={() => setEdit(true)}>Change link</button>
    </div>
  );
}
