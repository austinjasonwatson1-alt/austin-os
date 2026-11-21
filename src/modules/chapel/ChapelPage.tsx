import { useEffect, useRef, useState } from 'react';
import { mondayOf, parseISO, todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { RoomSound } from '../../shell/RoomSound';
import { fmtMins } from '../ledger/logic';
import { candleHeat, carried, chapelMinutes, chapelStreak, chapelWeek, sortPrayers } from './logic';
import { useChapel } from './store';
import type { Prayer } from './types';
import { Candle } from './Candle';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/chapel.css';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const when = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function ChapelPage() {
  const c = useChapel();
  useEffect(() => { void c.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const day = c.days[today] ?? {};
  const mins = chapelMinutes(day);
  const streak = chapelStreak(c.days, today);
  const week = chapelWeek(c.days, mondayOf(today));
  const { open, answered } = sortPrayers(c.prayers);
  const candleRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState(day.note ?? '');
  useEffect(() => setNote(c.days[today]?.note ?? ''), [c.loaded, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c.loaded) return null;

  const add = (kind: 'prayer' | 'scripture', n: number) => {
    const was = mins;
    c.setMinutes(today, kind, (day[kind] ?? 0) + n);
    if (!was) embers(candleRef.current, 10);
  };

  return (
    <div className="home chapel">
      <section className="chapel-hero rise" style={rise(0)}>
        <div className="glass" aria-hidden><i /><i /><i /><i /><i /><i /></div>
        <div className="chapel-copy">
          <div className="page-eyebrow">The Homestead · The Chapel</div>
          <h1 className="hero-title">The<br /><em>Chapel.</em></h1>
          <p className="hero-line">“Be still, and know that I am God.” Time here is kept on its own, apart from the writing.</p>
          <div style={{ marginBottom: 14 }}><RoomSound kind="organ" label="an organ hum" /></div>
          <div className="chapel-log">
            {(['prayer', 'scripture'] as const).map((k) => (
              <div key={k} className="clog">
                <span className="clog-n">{k === 'prayer' ? 'Prayer' : 'Scripture'}</span>
                <span className="clog-v"><b>{day[k] ?? 0}</b><small className="mono">min</small></span>
                <span className="clog-b">
                  {[5, 10, 15].map((n) => <button key={n} onClick={() => add(k, n)}>+{n}</button>)}
                  {(day[k] ?? 0) > 0 && <button className="clog-undo" aria-label={`Clear ${k} for today`} onClick={() => c.setMinutes(today, k, 0)}>↺</button>}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="altar" ref={candleRef}>
          <Candle heat={candleHeat(mins)} size={1.6} />
          <div className="altar-n"><span className="big">{mins ? <CountUp value={mins} format={fmtMins} /> : '—'}</span><span className="mono">{mins ? 'with God today' : 'the candle is waiting'}</span></div>
        </div>
      </section>

      <div className="chapel-grid">
        <section className="panel rise" style={rise(1)}>
          <div className="panel-h"><p className="panel-t">This week</p><span className="mono faint" style={{ fontSize: 11 }}>{streak ? `${streak}-day streak` : ''}</span></div>
          <div className="candles">
            {week.map((d, i) => (
              <div key={d.date} className={d.date === today ? 'cday today' : d.date > today ? 'cday future' : 'cday'} title={`${d.date}: ${d.mins}m`}>
                <Candle heat={d.date > today ? 0 : candleHeat(d.mins)} size={0.7} />
                <span className="mono">{DOW[i]}</span>
                <span className="mono faint">{d.mins ? fmtMins(d.mins) : ''}</span>
              </div>
            ))}
          </div>
          <label className="desk-note chapel-note">
            <span className="mono">Today's reflection</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => c.setNote(today, note)} placeholder="What He's showing you…" rows={2} />
          </label>
        </section>

        <Verses />
      </div>

      <section className="rise" style={rise(2)}>
        <div className="lounge-h"><h2 className="section-h">Prayer list</h2><span className="mono faint" style={{ fontSize: 11 }}>{open.length} carried · {answered.length} answered</span></div>
        <AddPrayer />
        <div className="prayers">
          {open.map((p) => <PrayerCard key={p.id} p={p} />)}
          {open.length === 0 && <p className="dim" style={{ fontSize: 14 }}>Nothing on the list right now. Add what you're carrying, and come back to mark it when it's answered.</p>}
        </div>
      </section>

      {answered.length > 0 && (
        <section className="rise" style={rise(3)}>
          <h2 className="section-h">Answered prayers</h2>
          <div className="answered">
            {answered.map((p) => (
              <article key={p.id} className="ans">
                <span className="ans-mark" aria-hidden>✦</span>
                <div className="ans-b">
                  <span className="ans-t">{p.text}{p.for ? <span className="mono faint"> · for {p.for}</span> : null}</span>
                  {p.answer && <span className="ans-a">{p.answer}</span>}
                  <span className="ans-m mono">answered {when(p.answeredOn!)} · carried {carried(p)}</span>
                </div>
                <button className="btn ghost sm" onClick={() => c.unanswer(p.id)}>Not yet</button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AddPrayer() {
  const [t, setT] = useState('');
  const [f, setF] = useState('');
  return (
    <form className="add-prayer" onSubmit={(e) => { e.preventDefault(); useChapel.getState().addPrayer(t, f); setT(''); setF(''); }}>
      <label className="field grow"><span>A prayer</span><input value={t} onChange={(e) => setT(e.target.value)} placeholder="Wisdom for the next draft" /></label>
      <label className="field"><span>For</span><input value={f} onChange={(e) => setF(e.target.value)} placeholder="optional" /></label>
      <button className="btn primary sm" disabled={!t.trim()}>Add</button>
    </form>
  );
}

function PrayerCard({ p }: { p: Prayer }) {
  const [mode, setMode] = useState<'idle' | 'answer' | 'remove'>('idle');
  const [a, setA] = useState('');
  const ref = useRef<HTMLElement>(null);
  const c = useChapel.getState();
  return (
    <article ref={ref} className="prayer">
      <span className="prayer-t">{p.text}</span>
      <span className="prayer-m mono">{p.for ? `for ${p.for} · ` : ''}since {when(p.added)}</span>
      {mode === 'answer' ? (
        <form className="prayer-ans" onSubmit={(e) => { e.preventDefault(); embers(ref.current, 22); c.answer(p.id, a); }}>
          <textarea className="ruled" rows={2} value={a} onChange={(e) => setA(e.target.value)} placeholder="How was it answered?" autoFocus />
          <span className="reward-confirm"><button type="button" className="btn ghost sm" onClick={() => setMode('idle')}>Cancel</button><button className="btn primary sm">Mark answered</button></span>
        </form>
      ) : mode === 'remove' ? (
        <span className="reward-confirm"><button className="btn ghost sm" onClick={() => setMode('idle')}>Keep</button><button className="btn danger sm" onClick={() => c.removePrayer(p.id)}>Remove it</button></span>
      ) : (
        <span className="prayer-act">
          <button className="btn ghost sm" onClick={() => setMode('remove')} aria-label="Remove this prayer">✕</button>
          <button className="btn sm" onClick={() => setMode('answer')}>Answered ✦</button>
        </span>
      )}
    </article>
  );
}

function Verses() {
  const { verses, addVerse, removeVerse } = useChapel();
  const [ref, setRef] = useState('');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <section className="panel verses rise" style={rise(1)}>
      <div className="panel-h">
        <p className="panel-t">Verses worth keeping</p>
        <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? 'Close' : '+ Verse'}</button>
      </div>
      {open && (
        <form className="verse-form" onSubmit={(e) => { e.preventDefault(); addVerse(ref, text); setRef(''); setText(''); setOpen(false); }}>
          <label className="field"><span>Reference</span><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Psalm 46:10" autoFocus /></label>
          <label className="field"><span>Verse</span><textarea className="ruled" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <button className="btn primary sm" disabled={!ref.trim() && !text.trim()}>Keep it</button>
        </form>
      )}
      {verses.length === 0 && !open && <p className="dim" style={{ fontSize: 13.5, margin: 0 }}>The verses that stay with you, kept in one place.</p>}
      <ul className="verse-list">
        {verses.map((v) => (
          <li key={v.id}>
            <blockquote>{v.text}</blockquote>
            <span className="mono">{v.ref}</span>
            <button className="btn ghost sm" aria-label={`Remove ${v.ref}`} onClick={() => removeVerse(v.id)}>✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
