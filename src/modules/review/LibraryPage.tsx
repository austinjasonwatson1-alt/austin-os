import { LookBackTabs } from '../../shell/LookBackTabs';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MONTHS_LONG, parseISO } from '../../core/dates';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { AREA_STORES } from '../areas/store';
import { useChapel } from '../chapel/store';
import { fmtMins } from '../ledger/logic';
import { milestones } from '../ledger/milestones';
import { useLedger } from '../ledger/store';
import { useShelf } from '../shelf/store';
import { archive } from './logic';
import { useReview } from './store';
import '../../styles/cabin.css';
import '../../styles/review.css';

/** The Library of You: every month as a page in a bound journal, read back. */
export default function LibraryPage() {
  const ledger = useLedger();
  const chapel = useChapel();
  const shelf = useShelf();
  const rv = useReview();
  const hearth = AREA_STORES.hearth();
  const office = AREA_STORES.office();
  useEffect(() => { void ledger.load(); void chapel.load(); void shelf.load(); void rv.load(); void hearth.load(); void office.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => archive({
    days: ledger.days, chapel: chapel.days, books: shelf.books, prayers: chapel.prayers,
    milestones: milestones(ledger.days, ledger.thresholds, ledger.weekly), reviews: rv.reviews,
    moments: hearth.items.filter((i) => i.list === 'moments'), wins: office.items.filter((i) => i.list === 'wins'),
  }), [ledger.days, ledger.thresholds, ledger.weekly, chapel.days, chapel.prayers, shelf.books, rv.reviews, hearth.items, office.items]);
  const years = [...new Set(months.map((m) => m.key.slice(0, 4)))];
  const [year, setYear] = useState<string | null>(null);
  const shown = months.filter((m) => !year || m.key.startsWith(year));

  if (!ledger.loaded) return null;
  return (
    <div className="home library">
      <LookBackTabs />
      <section className="lib-hero rise" style={rise(0)}>
        <div className="page-eyebrow">The Library of You</div>
        <h1 className="hero-title">Every month,<br /><em>kept.</em></h1>
        <p className="hero-line">The hours, the books, the answered prayers, the milestones, the things you said you'd do and the small moments, gathered month by month. Nothing here is written by hand; it's what your days left behind.</p>
        {years.length > 1 && (
          <div className="seg" role="radiogroup" aria-label="Year">
            <button role="radio" aria-checked={!year} onClick={() => setYear(null)}>All</button>
            {years.map((y) => <button key={y} role="radio" aria-checked={year === y} onClick={() => setYear(y)}>{y}</button>)}
          </div>
        )}
      </section>

      <div className="spine-list">
        {shown.map((m, i) => {
          const [y, mo] = m.key.split('-').map(Number);
          return (
            <article key={m.key} className="page rise" style={rise(Math.min(8, i + 1))}>
              <header>
                <span className="page-month">{MONTHS_LONG[mo - 1]}</span>
                <span className="page-year mono">{y}</span>
                <button className="page-hours" onClick={() => go('/year')}>{fmtMins(m.minutes)}<small className="mono">{m.logged} days at the desk</small></button>
              </header>
              <div className="page-body">
                {m.milestones.length > 0 && <p className="pg pg-star"><b>Stars earned</b> {m.milestones.join(' · ')}</p>}
                {m.books.length > 0 && <p className="pg pg-book"><b>Finished</b> {m.books.map((b) => <i key={b}>{b}</i>).reduce<ReactNode[]>((acc, el, k) => (k ? [...acc, ', ', el] : [el]), [])}</p>}
                {m.answered.map((p) => <p key={p.text} className="pg pg-prayer"><b>Answered</b> {p.text}{p.answer ? <span> — {p.answer}</span> : null}</p>)}
                {m.wins.length > 0 && <p className="pg pg-win"><b>Wins at work</b> {m.wins.join(' · ')}</p>}
                {m.reviews.map((r) => (
                  <p key={r.monday} className="pg pg-review">
                    <b>Week of {parseISO(r.monday).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</b>
                    {r.worked && <span> What worked: “{r.worked}”.</span>}{r.intention && <span> You set out to: “{r.intention}”.</span>}
                  </p>
                ))}
                {m.moments.map((x) => <p key={x} className="pg pg-moment">{x}</p>)}
                {!m.milestones.length && !m.books.length && !m.answered.length && !m.reviews.length && !m.moments.length && !m.wins.length && (
                  <p className="pg faint">A month of showing up.</p>
                )}
              </div>
            </article>
          );
        })}
        {shown.length === 0 && <p className="dim">The library fills itself as the days go by.</p>}
      </div>
    </div>
  );
}
