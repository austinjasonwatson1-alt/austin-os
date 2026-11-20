import { useEffect } from 'react';
import { OWNER } from '../config';
import { parseISO, todayISO } from '../core/dates';
import { AREAS } from '../modules/registry';
import { candleHeat, chapelMinutes, chapelStreak } from '../modules/chapel/logic';
import { useChapel } from '../modules/chapel/store';
import { Candle } from '../modules/chapel/Candle';
import { currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, lampHeat, lampLine, mondayOf, weekTotal } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { dogPose, fmtPts } from '../modules/lounge/logic';
import { useWallet } from '../modules/lounge/useWallet';
import { CountUp, tilt } from './fx';
import { AutoBackupPanel } from './AutoBackup';
import { Homestead } from './Homestead';
import { SkyPanel } from './SkyPanel';
import { GRADE_VAR, greeting, Lamp, QuickLog, rise, useMinuteClock } from './lamp';
import { go } from './router';
import '../styles/cabin.css';
import '../styles/homestead.css';

/** Home: the whole homestead. Every part of life is a building; the cabin is lit today. */
export default function Home() {
  const { loaded, load, days, thresholds } = useLedger();
  useEffect(() => { void load(); }, [load]);
  const now = useMinuteClock();
  const today = todayISO();
  const mins = dayTotal(days[today]);
  const g = gradeOf(mins, thresholds);
  const streak = currentStreak(days, today);
  const date = parseISO(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const building = AREAS.filter((a) => !a.live);
  const wallet = useWallet();
  const chapelDays = useChapel((st) => st.days);
  const prayers = useChapel((st) => st.prayers);
  const chapelToday = chapelMinutes(chapelDays[today]);
  const openPrayers = prayers.filter((p) => !p.answeredOn).length;

  return (
    <div className="home homestead">
      <section className="hs-hero rise" style={rise(0)}>
        <div className="hs-copy">
          <div className="page-eyebrow">{date} <span className="hero-time">· {time}</span></div>
          <h1 className="hero-title">{greeting(now.getHours())},<br /><em>{OWNER}.</em></h1>
          <p className="hero-line">
            {loaded ? (mins > 0 ? `The cabin lamp is burning: ${fmtMins(mins)} today.` : 'The cabin is dark so far today.') : 'Walking up the trail…'}{' '}
            {building.length} more buildings are going up on the homestead.
          </p>
        </div>
        <Homestead heat={lampHeat(mins, thresholds)} chapelHeat={candleHeat(chapelToday)} pose={dogPose(g)} />
      </section>

      <div className="hs-areas">
        <article className="panel area-card area-cabin rise" style={rise(1)}>
          <header className="area-h">
            <span className="area-glyph" aria-hidden>⌂</span>
            <div>
              <p className="panel-t">The Writer's Cabin</p>
              <p className="area-line">{loaded ? lampLine(mins, thresholds, streak) : ''}</p>
            </div>
            <button className="btn ghost area-enter" onClick={() => go('/cabin')}>Enter →</button>
          </header>
          <div className="area-cabin-body">
            <div className="lamp-sm"><Lamp mins={mins} grade={g} loaded={loaded} /></div>
            <div className="area-cabin-side">
              <dl className="area-stats">
                <div><dt>Today</dt><dd style={{ color: GRADE_VAR[g] }}>{loaded ? GRADE_LABEL[g] : '—'}</dd></div>
                <div><dt>Streak</dt><dd>{loaded ? `${streak} ${streak === 1 ? 'day' : 'days'}` : '—'}</dd></div>
                <div><dt>This week</dt><dd>{loaded ? fmtMins(weekTotal(days, mondayOf(today))) : '—'}</dd></div>
              </dl>
              <QuickLog today={today} />
              <button className="area-wallet" onClick={() => go('/cabin/lounge')}>
                <span className="area-coin" aria-hidden>✦</span>
                <span><b>{wallet.loaded ? <CountUp value={wallet.balance} /> : '—'}</b> points in the Lounge{wallet.today ? ` · +${fmtPts(wallet.today)} today` : ''}</span>
                <span className="area-wallet-go" aria-hidden>→</span>
              </button>
            </div>
          </div>
        </article>

        <div className="area-stack">
          <button className="area-plan area-live rise tilt" style={rise(2)} onClick={() => go('/chapel')} {...tilt(4)}>
            <span className="area-glyph chapel-g" aria-hidden><Candle heat={candleHeat(chapelToday)} size={0.36} /></span>
            <span className="area-plan-body">
              <span className="area-plan-name">The Chapel</span>
              <span className="area-plan-blurb">
                {chapelToday ? `${fmtMins(chapelToday)} with God today` : 'The candle is waiting today'}
                {chapelStreak(chapelDays, today) > 1 ? ` · ${chapelStreak(chapelDays, today)}-day streak` : ''}
                {openPrayers ? ` · ${openPrayers} prayer${openPrayers === 1 ? '' : 's'} carried` : ''}
              </span>
            </span>
            <span className="chip live">Open</span>
          </button>
          {building.map((a, i) => (
            <button key={a.id} className="area-plan rise tilt" style={rise(3 + i)} onClick={() => go(a.path)} {...tilt(4)}>
              <span className="area-glyph plan" aria-hidden>{a.glyph}</span>
              <span className="area-plan-body">
                <span className="area-plan-name">{a.name}</span>
                <span className="area-plan-blurb">{a.blurb}</span>
              </span>
              <span className="chip">Being built</span>
            </button>
          ))}
        </div>
      </div>

      <div className="home-lower rise" style={rise(6)}>
        <AutoBackupPanel />
        <SkyPanel />
      </div>
    </div>
  );
}
