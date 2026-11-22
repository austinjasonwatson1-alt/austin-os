import { useState, type CSSProperties } from 'react';
import { addDays, mondayOf, todayISO } from '../../core/dates';
import { embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { AREA_STORES } from './store';
import { jobClock, MOVES, weekMoves } from './jobLogic';

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
            <li key={m.k}>
              <button className={day[m.k] ? 'jq-move on' : 'jq-move'} aria-pressed={Boolean(day[m.k])} onClick={(e) => toggle(m.k, e.currentTarget)}>
                <span className="jq-tick" aria-hidden>{day[m.k] ? '✓' : ''}</span>
                <span><b>{m.label}</b><span className="dim">{m.hint}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <div className="jq-week">
          {week.days.map((d) => (
            <span key={d.date} className={`jq-d${d.date === today ? ' today' : ''}${d.date > today ? ' future' : ''}`} title={`${d.date}: ${d.n} of 4`}>
              <i style={{ height: `${(d.n / 4) * 100}%` }} /><span className="mono">{'MTWTFSS'[week.days.indexOf(d)]}</span>
            </span>
          ))}
          <span className="jq-ref mono">Referral asks this week <b>{week.referrals}</b> of 5</span>
        </div>
      </div>
    </section>
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
