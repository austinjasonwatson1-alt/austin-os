import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addDays, mondayOf, parseISO, todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { CAT, GRADE_VAR, rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { useChapel } from '../chapel/store';
import { fmtMins, GRADE_LABEL } from '../ledger/logic';
import { useLedger } from '../ledger/store';
import { useManuscripts } from '../manuscripts/store';
import { useShelf } from '../shelf/store';
import { letterDue, reviewWeek, vsLast, weekSummary } from './logic';
import { useReview } from './store';
import { useKeeper } from '../keeper/store';
import { useLifeInput } from '../life/useLifeInput';
import { useLife } from '../life/store';
import { amount, balanceScore, balanceWeek, insights, LIFE_AREAS } from '../life/logic';
import { BalanceWheel } from '../life/Wheel';
import { useDrafts } from '../drafts/store';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/review.css';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const short = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const dayName = (d: string) => parseISO(d).toLocaleDateString(undefined, { weekday: 'long' });

/** The Sunday review: a look back at the week across the homestead, three questions, and a seal. */
export default function ReviewPage() {
  const ledger = useLedger();
  const chapel = useChapel();
  const mss = useManuscripts();
  const shelf = useShelf();
  const rv = useReview();
  useEffect(() => { void ledger.load(); void chapel.load(); void mss.load(); void shelf.load(); void rv.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayISO();
  const [monday, setMonday] = useState(() => reviewWeek(new Date(), mondayOf(today)));
  const s = useMemo(
    () => weekSummary({ days: ledger.days, thresholds: ledger.thresholds, weekly: ledger.weekly, chapel: chapel.days, manuscripts: mss.manuscripts, books: shelf.books }, monday, today),
    [ledger.days, ledger.thresholds, ledger.weekly, chapel.days, mss.manuscripts, shelf.books, monday, today],
  );
  const r = rv.reviews[monday] ?? {};
  const last = rv.reviews[addDays(monday, -7)];
  const pct = vsLast(s.minutes, s.prevMinutes);
  const sealRef = useRef<HTMLDivElement>(null);
  const max = Math.max(ledger.thresholds.elite, ...s.days.map((d) => d.mins));
  const past = Object.entries(rv.reviews).filter(([m, x]) => m !== monday && x.sealedAt).sort(([a], [b]) => b.localeCompare(a));

  if (!rv.loaded || !ledger.loaded) return null;

  const seal = () => {
    rv.seal(monday);
    embers(sealRef.current, 30);
    window.dispatchEvent(new Event('austin:celebrate'));
  };

  return (
    <div className="home review">
      <section className="hero review-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The weekly review · {short(s.monday)} – {short(s.sunday)}</div>
          <h1 className="hero-title">The week,<br /><em>looked back on.</em></h1>
          <p className="hero-line">
            {s.minutes === 0 ? 'A quiet week at the desk. That happens. What will next week look like?' : `${fmtMins(s.minutes)} toward the book across ${s.logged} day${s.logged === 1 ? '' : 's'}${s.best ? `, best on ${dayName(s.best.date)}` : ''}.`}
          </p>
          <div className="wk-nav">
            <button className="brass" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>‹</button>
            <span className="mono">{monday === mondayOf(today) ? 'this week' : monday === addDays(mondayOf(today), -7) ? 'last week' : `week of ${short(monday)}`}</span>
            <button className="brass" aria-label="Next week" disabled={monday >= mondayOf(today)} onClick={() => setMonday(addDays(monday, 7))}>›</button>
          </div>
        </div>
        <div className="wk-grade" style={{ '--g': GRADE_VAR[s.grade] } as CSSProperties}>
          <span className="big"><CountUp value={s.minutes} format={fmtMins} /></span>
          <span className="wk-grade-l mono">{s.minutes ? `${GRADE_LABEL[s.grade]} week` : 'no minutes'}</span>
          {pct !== null && <span className={pct >= 0 ? 'wk-vs up mono' : 'wk-vs down mono'}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}% vs last week</span>}
        </div>
      </section>

      <div className="wk-grid rise" style={rise(1)}>
        <section className="panel wk-days">
          <div className="panel-h"><p className="panel-t">Day by day</p><span className="mono faint" style={{ fontSize: 11 }}>{s.zeroDays.length ? `${s.zeroDays.length} zero day${s.zeroDays.length === 1 ? '' : 's'}` : 'no zero days ✦'}</span></div>
          <div className="wk-bars">
            {s.days.map((d, i) => (
              <button key={d.date} className={`wk-bar${d.future ? ' future' : ''}${s.best?.date === d.date ? ' best' : ''}`} onClick={() => go('/cabin/ledger')} title={`${d.date}: ${fmtMins(d.mins)}`}>
                <span className="wk-bar-v mono">{d.future ? '' : d.mins ? fmtMins(d.mins) : '0'}</span>
                <span className="wk-bar-track"><span style={{ height: `${d.future ? 0 : Math.max(3, (d.mins / max) * 100)}%`, background: d.mins ? GRADE_VAR[d.grade] : 'var(--bad)', opacity: d.mins ? 1 : .35 }} /></span>
                <span className="wk-bar-d mono">{DOW[i]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><p className="panel-t">Where the minutes went</p></div>
          {s.byCat.length === 0 ? <p className="dim" style={{ fontSize: 13.5, margin: 0 }}>Nothing logged this week.</p> : (
            <ul className="mix-list">
              {s.byCat.map((x) => (
                <li key={x.k}>
                  <span className="mix-name">{CAT[x.k].name}</span>
                  <span className="mix-v mono">{fmtMins(x.mins)} <i>{Math.round((x.mins / s.minutes) * 100)}%</i></span>
                  <span className="mix-bar"><span style={{ width: `${(x.mins / s.byCat[0].mins) * 100}%`, background: CAT[x.k].color }} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="wk-tiles rise" style={rise(2)}>
        <Tile glyph="✝" label="The Chapel" value={s.chapel.minutes ? fmtMins(s.chapel.minutes) : '—'} sub={s.chapel.days ? `on ${s.chapel.days} day${s.chapel.days === 1 ? '' : 's'}` : 'no time logged'} to="/chapel" />
        <Tile glyph="❡" label="Manuscripts" value={s.words === null ? '—' : `${s.words >= 0 ? '+' : ''}${s.words.toLocaleString('en-US')}`} sub={s.words === null ? 'word history starts building this week' : 'words this week'} to="/cabin/manuscripts" />
        <Tile glyph="▥" label="The Shelf" value={String(s.booksFinished.length)} sub={s.booksFinished.length ? s.booksFinished.map((b) => b.title).join(', ') : 'books finished'} to="/cabin/shelf" />
        <Tile glyph="◉" label="Best day" value={s.best ? fmtMins(s.best.mins) : '—'} sub={s.best ? dayName(s.best.date) : 'nothing yet'} to="/cabin/ledger" />
      </div>

      <WholeLife monday={monday} today={today} />

      <section className="journal rise" style={rise(3)} ref={sealRef}>
        {last?.intention && (
          <div className="last-int">
            <span className="mono">Last week you said</span>
            <blockquote>{last.intention}</blockquote>
            <div className="seg" role="radiogroup" aria-label="Did it happen?">
              <button role="radio" aria-checked={r.keptLast === true} onClick={() => rv.patch(monday, { keptLast: true })}>It happened</button>
              <button role="radio" aria-checked={r.keptLast === false} onClick={() => rv.patch(monday, { keptLast: false })}>Not this time</button>
            </div>
          </div>
        )}
        <Prompt label="What worked this week?" value={r.worked} onSave={(v) => rv.patch(monday, { worked: v })} placeholder="The 6am sessions. Writing before checking the phone…" disabled={Boolean(r.sealedAt)} />
        <Prompt label="What got in the way?" value={r.didnt} onSave={(v) => rv.patch(monday, { didnt: v })} placeholder="Late nights. Saying yes to too much…" disabled={Boolean(r.sealedAt)} />
        <Prompt label="One intention for next week" value={r.intention} onSave={(v) => rv.patch(monday, { intention: v })} placeholder="Finish chapter 7 by Thursday." disabled={Boolean(r.sealedAt)} />
        <KeeperLetter monday={monday} today={today} />
        <div className="seal-row">
          {r.sealedAt ? (
            <>
              <span className="seal mono"><span aria-hidden>✦</span> Sealed {new Date(r.sealedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              <button className="btn ghost sm" onClick={() => rv.unseal(monday)}>Reopen</button>
            </>
          ) : (
            <button className="btn primary" onClick={seal}>Seal the week</button>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="rise" style={rise(4)}>
          <h2 className="section-h">Past weeks</h2>
          <div className="past-weeks">
            {past.map(([m, x]) => (
              <button key={m} className="past" onClick={() => { setMonday(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span className="mono">{short(m)} – {short(addDays(m, 6))}</span>
                {x.intention && <span className="past-i">“{x.intention}”</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ glyph, label, value, sub, to }: { glyph: string; label: string; value: string; sub: string; to: string }) {
  return (
    <button className="panel tile wk-tile" onClick={() => go(to)}>
      <span className="tile-glyph" aria-hidden>{glyph}</span>
      <p className="panel-t">{label}</p>
      <div className="tile-v"><span className="big">{value}</span></div>
      <div className="tile-foot mono">{sub}</div>
    </button>
  );
}

function Prompt({ label, value, onSave, placeholder, disabled }: { label: string; value?: string; onSave: (v: string) => void; placeholder: string; disabled: boolean }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  return (
    <label className="desk-note prompt">
      <span className="mono">{label}</span>
      <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if ((value ?? '') !== v) onSave(v); }} placeholder={placeholder} rows={2} readOnly={disabled} />
    </label>
  );
}

/**
 * The Keeper's letter about the week, kept with the review. Written by itself once from Saturday
 * evening (if the Keeper is on), or on request; without a key, a note on how to turn it on.
 */
function KeeperLetter({ monday, today }: { monday: string; today: string }) {
  const k = useKeeper();
  const rv = useReview();
  useEffect(() => { void k.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const letter = rv.reviews[monday]?.letter;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tried = useRef('');
  const write = async () => {
    setBusy(true); setErr('');
    try { const text = await k.ask('letter'); if (text) rv.patch(monday, { letter: { text, at: new Date().toISOString() } }); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (!k.loaded || !rv.loaded || tried.current === monday) return;
    if (letterDue(new Date(), monday, mondayOf(today), Boolean(letter), k.enabled)) { tried.current = monday; void write(); }
  }, [k.loaded, k.enabled, rv.loaded, monday, letter]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!k.loaded) return null;
  if (letter) return (
    <article className="kl">
      <span className="mono">A letter from the Keeper · {new Date(letter.at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      <div className="kl-text">{letter.text.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
      {k.enabled && <button className="linkish kl-again" disabled={busy} onClick={() => void write()}>{busy ? 'Writing it again…' : 'Write it again'}</button>}
      {err && <p className="dim">{err}</p>}
    </article>
  );
  if (!k.enabled) {
    return (
      <div className="kl kl-off">
        <span className="mono">A letter from the Keeper</span>
        <p>Each Sunday the Keeper can write you a letter about the week: the book, the job search, faith, the dogs and the people you love, from your real numbers. It needs an Anthropic API key.</p>
        <button className="linkish" onClick={() => go('/settings')}>Turn the Keeper on in Settings →</button>
      </div>
    );
  }
  return (
    <div className="kl kl-off">
      <span className="mono">A letter from the Keeper</span>
      {err ? <p className="dim">{err}</p> : <p>{busy ? 'The Keeper is writing…' : 'It writes itself on Sunday. Or ask for it now.'}</p>}
      <button className="btn sm" disabled={busy} onClick={() => void write()}>{busy ? 'Writing…' : 'Write this week’s letter'}</button>
    </div>
  );
}

/** The week across the whole homestead, not just the book. */
function WholeLife({ monday, today }: { monday: string; today: string }) {
  const { ready, input } = useLifeInput();
  const targets = useLife((st) => st.targets);
  const sprints = useDrafts((st) => st.sprints);
  const now = useMemo(() => balanceWeek(input, monday, targets, today), [input, monday, targets, today]);
  const prev = useMemo(() => balanceWeek(input, addDays(monday, -7), targets), [input, monday, targets]);
  const top = useMemo(() => insights(input, today, 120, sprints ?? [])[0], [input, today, sprints]);
  if (!ready) return null;
  return (
    <section className="panel wl rise" style={rise(3)}>
      <div className="panel-h"><p className="panel-t">Across the homestead</p><button className="linkish" onClick={() => go('/life')}>Open the Compass →</button></div>
      <div className="wl-body">
        <BalanceWheel now={now} prev={prev} size={210} />
        <div className="wl-list">
          <p className="wl-score"><b>{balanceScore(now)}</b> balance this week</p>
          <ul>
            {now.map((sp) => { const a = LIFE_AREAS.find((l) => l.id === sp.area)!; return <li key={sp.area}><span style={{ color: a.color }}>{a.glyph}</span> {a.name}<span className="mono faint">{amount(sp.area, sp.mins)}</span></li>; })}
          </ul>
          {top && <p className="wl-ins"><span className="mono">The Compass noticed</span>{top.title}</p>}
        </div>
      </div>
    </section>
  );
}
