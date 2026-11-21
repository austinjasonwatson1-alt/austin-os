import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { MONTHS_LONG, MONTHS_SHORT, parseISO, todayISO } from '../../core/dates';
import { CountUp, tilt } from '../../shell/fx';
import { CAT, rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { useChapel } from '../chapel/store';
import { fmtMins } from '../ledger/logic';
import { useLedger } from '../ledger/store';
import { useManuscripts } from '../manuscripts/store';
import { useShelf } from '../shelf/store';
import { yearReview } from './logic';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/review.css';

const long = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

/** The year, in the lamplight: every month, the records, and the rest of the homestead's year. */
export default function YearPage() {
  const ledger = useLedger();
  const chapel = useChapel();
  const mss = useManuscripts();
  const shelf = useShelf();
  useEffect(() => { void ledger.load(); void chapel.load(); void mss.load(); void shelf.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const y = useMemo(() => yearReview({
    days: ledger.days, thresholds: ledger.thresholds, weekly: ledger.weekly, chapel: chapel.days, manuscripts: mss.manuscripts, books: shelf.books,
    answeredOn: chapel.prayers.map((p) => p.answeredOn).filter((d): d is string => Boolean(d)),
  }, year, today), [ledger, chapel, mss.manuscripts, shelf.books, year, today]);
  const top = Math.max(1, ...y.months);
  const nowMonth = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) - 1 : 11;

  if (!ledger.loaded) return null;
  return (
    <div className="home year">
      <section className="hero year-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">Year in review</div>
          <h1 className="hero-title">{year},<br /><em>in the lamplight.</em></h1>
          <p className="hero-line">
            {y.minutes ? `${Math.round(y.minutes / 60)} hours toward the book, on ${y.logged} of ${y.elapsed} days.` : 'Nothing logged this year yet.'}
          </p>
          <div className="wk-nav">
            <button className="brass" aria-label="Previous year" onClick={() => setYear(year - 1)}>‹</button>
            <span className="mono">{year}</span>
            <button className="brass" aria-label="Next year" disabled={year >= Number(today.slice(0, 4))} onClick={() => setYear(year + 1)}>›</button>
          </div>
        </div>
        <div className="wk-grade" style={{ '--g': 'var(--lamp)' } as CSSProperties}>
          <span className="big"><CountUp value={Math.round(y.minutes / 60)} /></span>
          <span className="wk-grade-l mono">hours</span>
          <span className="wk-vs mono">{y.logged ? `${Math.round((y.logged / y.elapsed) * 100)}% of days logged` : '—'}</span>
        </div>
      </section>

      <section className="panel year-months rise" style={rise(1)}>
        <div className="panel-h"><p className="panel-t">Month by month</p>{y.bestMonth && <span className="mono faint" style={{ fontSize: 11 }}>best · {MONTHS_LONG[y.bestMonth.m]}</span>}</div>
        <div className="ym">
          {y.months.map((mins, m) => (
            <button key={m} className={`ym-m${y.bestMonth?.m === m ? ' best' : ''}${m > nowMonth ? ' future' : ''}`} onClick={() => go('/cabin/ledger')} title={`${MONTHS_LONG[m]}: ${fmtMins(mins)}`}>
              <span className="ym-v mono">{mins ? `${Math.round(mins / 60)}h` : ''}</span>
              <span className="ym-bar"><span style={{ height: `${(mins / top) * 100}%`, animationDelay: `${m * 50}ms` }} /></span>
              <span className="ym-n mono">{MONTHS_SHORT[m]}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="wk-tiles rise" style={rise(2)}>
        <Stat glyph="✦" label="Longest streak" value={y.longest ? `${y.longest.days}` : '—'} unit="days" sub={y.longest ? `${long(y.longest.from)} – ${long(y.longest.to)}` : ''} />
        <Stat glyph="◉" label="Best day" value={y.bestDay ? fmtMins(y.bestDay.mins) : '—'} sub={y.bestDay ? long(y.bestDay.date) : ''} />
        <Stat glyph="★" label="Elite days" value={String(y.elite)} unit="days" sub={`${y.zero} zero day${y.zero === 1 ? '' : 's'}`} />
        <Stat glyph="▤" label="Best month" value={y.bestMonth ? fmtMins(y.bestMonth.mins) : '—'} sub={y.bestMonth ? MONTHS_LONG[y.bestMonth.m] : ''} />
      </div>

      <div className="wk-grid rise" style={{ ...rise(3), marginTop: 16 }}>
        <section className="panel">
          <div className="panel-h"><p className="panel-t">Where the hours went</p></div>
          <ul className="mix-list">
            {y.byCat.map((x) => (
              <li key={x.k}>
                <span className="mix-name">{CAT[x.k].name}</span>
                <span className="mix-v mono">{fmtMins(x.mins)} <i>{Math.round((x.mins / y.minutes) * 100)}%</i></span>
                <span className="mix-bar"><span style={{ width: `${(x.mins / y.byCat[0].mins) * 100}%`, background: CAT[x.k].color }} /></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel year-else">
          <div className="panel-h"><p className="panel-t">Around the homestead</p></div>
          <ul>
            <li><span aria-hidden>✝</span><p><b>{fmtMins(y.chapel.minutes)}</b> with God, on {y.chapel.days} days{y.answered ? ` · ${y.answered} answered prayer${y.answered === 1 ? '' : 's'}` : ''}</p></li>
            <li><span aria-hidden>▥</span><p><b>{y.books.length}</b> book{y.books.length === 1 ? '' : 's'} read{y.pages ? ` · ${y.pages.toLocaleString('en-US')} pages` : ''}{y.books.length ? ` · ${y.books.slice(0, 3).map((b) => b.title).join(', ')}${y.books.length > 3 ? '…' : ''}` : ''}</p></li>
            <li><span aria-hidden>❡</span><p>{y.words === null ? 'Manuscript word counts start building as you write' : <><b>{y.words.toLocaleString('en-US')}</b> words added to the manuscripts</>}</p></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ glyph, label, value, unit, sub }: { glyph: string; label: string; value: string; unit?: string; sub: string }) {
  return (
    <div className="panel tile tilt" {...tilt(4)}>
      <span className="tile-glyph" aria-hidden>{glyph}</span>
      <p className="panel-t">{label}</p>
      <div className="tile-v"><span className="big">{value}</span>{unit && <span className="mono dim">{unit}</span>}</div>
      <div className="tile-foot mono">{sub}</div>
    </div>
  );
}
