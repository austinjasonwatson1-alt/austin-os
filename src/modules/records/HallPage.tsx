import { useEffect, useMemo, type CSSProperties } from 'react';
import { parseISO } from '../../core/dates';
import { rise } from '../../shell/lamp';
import { useChapel } from '../chapel/store';
import { useLedger } from '../ledger/store';
import { useManuscripts } from '../manuscripts/store';
import { usePub } from '../pub/store';
import { useShelf } from '../shelf/store';
import { hallOfRecords, latest, nearest, WINGS, type Trophy, type Wing } from './logic';
import '../../styles/cabin.css';
import '../../styles/hall.css';

const GLYPH: Record<Wing, string> = { writing: '✒', reading: '❧', manuscript: '❡', road: '✉', chapel: '✝' };
const when = (d?: string, month = false) => (d ? parseISO(d).toLocaleDateString(undefined, month ? { month: 'long', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** The Hall of Records: personal bests and trophies from every part of the homestead. */
export default function HallPage() {
  const ledger = useLedger();
  const shelf = useShelf();
  const mss = useManuscripts();
  const pub = usePub();
  const chapel = useChapel();
  useEffect(() => { void ledger.load(); void shelf.load(); void mss.load(); void pub.load(); void chapel.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = ledger.loaded && shelf.loaded && mss.loaded && pub.loaded && chapel.loaded;

  const hall = useMemo(() => hallOfRecords({
    days: ledger.days, thresholds: ledger.thresholds, weekly: ledger.weekly,
    books: shelf.books, goals: shelf.goals ?? {}, manuscripts: mss.manuscripts,
    queries: pub.queries, contests: pub.contests, chapel: chapel.days, prayers: chapel.prayers,
  }), [ledger.days, ledger.thresholds, ledger.weekly, shelf.books, shelf.goals, mss.manuscripts, pub.queries, pub.contests, chapel.days, chapel.prayers]);

  if (!ready) return null;
  const earned = hall.trophies.filter((t) => t.earned).length;
  const front = latest(hall.trophies);
  const close = nearest(hall.trophies);

  return (
    <div className="home hall">
      <section className="hall-hero rise" style={rise(0)}>
        <div className="hall-arch" aria-hidden><i /><i /><i /></div>
        <div className="page-eyebrow">The Homestead · Hall of Records</div>
        <h1 className="hero-title">The Hall of <em>Records.</em></h1>
        <p className="hero-line">Every best, every first, every long road walked. <b>{earned}</b> of {hall.trophies.length} trophies on the wall.</p>
        <div className="hall-meter" role="img" aria-label={`${earned} of ${hall.trophies.length} trophies earned`}><i style={{ width: `${(earned / hall.trophies.length) * 100}%` }} /></div>
      </section>

      {front.length > 0 && (
        <section className="front-case rise" style={rise(1)} aria-label="Newest trophies">
          <p className="case-label mono">Newest in the case</p>
          <div className="front-row">{front.map((t) => <TrophyCard key={t.id} t={t} big />)}</div>
        </section>
      )}

      {close.length > 0 && (
        <section className="near rise" style={rise(2)}>
          <h2 className="section-h">Nearly there</h2>
          <div className="near-row">
            {close.map((t) => (
              <div key={t.id} className="near-card">
                <Medal t={t} />
                <div><b>{t.name}</b><span className="dim">{t.desc}</span><span className="near-bar"><i style={{ width: `${t.progress * 100}%` }} /></span><span className="mono faint">{t.count}</span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {WINGS.map((w, i) => {
        const recs = hall.records.filter((r) => r.wing === w.id);
        const tro = hall.trophies.filter((t) => t.wing === w.id);
        const got = tro.filter((t) => t.earned).length;
        return (
          <section key={w.id} className="wing rise" style={rise(3 + i)} aria-labelledby={`wing-${w.id}`}>
            <div className="wing-h">
              <span className="wing-glyph" aria-hidden>{GLYPH[w.id]}</span>
              <h2 id={`wing-${w.id}`}>{w.name}</h2>
              <i />
              <span className="mono faint">{got} / {tro.length}</span>
            </div>
            {recs.length > 0 && (
              <div className="plaques">
                {recs.map((r) => (
                  <div key={r.name} className="plaque">
                    <span className="mono">{r.name}</span>
                    <b>{r.value}</b>
                    <span className="plaque-d">{r.date ? (r.detail === 'month' ? when(r.date, true) : `${r.detail ? `${r.detail} ` : ''}${when(r.date)}`) : r.detail ?? ''}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="trophies">{tro.map((t) => <TrophyCard key={t.id} t={t} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

function Medal({ t }: { t: Trophy }) {
  return (
    <span className={`medal tier-${t.tier}${t.earned ? ' on' : ''}`} style={{ '--p': t.progress } as CSSProperties} aria-hidden>
      <span className="medal-face">{t.earned ? GLYPH[t.wing] : '?'}</span>
      {t.tier === 3 && <span className="laurel" />}
    </span>
  );
}

function TrophyCard({ t, big = false }: { t: Trophy; big?: boolean }) {
  return (
    <div className={`trophy${t.earned ? ' on' : ''}${big ? ' big' : ''}`} title={t.desc}
      aria-label={`${t.name}: ${t.desc} ${t.earned ? `Earned${t.date ? ` ${when(t.date)}` : ''}.` : `Not yet${t.count ? `, ${t.count}` : ''}.`}`} role="img">
      <Medal t={t} />
      <b>{t.name}</b>
      <span className="trophy-d">{t.earned ? (t.date ? when(t.date) : 'Earned') : t.count ?? 'Locked'}</span>
      {big && <span className="dim trophy-desc">{t.desc}</span>}
    </div>
  );
}
