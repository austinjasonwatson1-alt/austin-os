import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { anniversary, bedtime, greyness, growth } from './worldLogic';
import { skyPhase, type Phase } from '../core/skyLogic';
import { usePub } from '../modules/pub/store';
import { areaHeat, areaMinutes, money, moneyYear } from '../modules/areas/logic';
import { AREA_STORES } from '../modules/areas/store';
import { AREA_CONFIGS, OBSERVATORY, OFFICE } from '../modules/areas/types';
import { OWNER } from '../config';
import { parseISO, todayISO } from '../core/dates';
import { AREAS } from '../modules/registry';
import { candleHeat, chapelMinutes, chapelNudge, chapelStreak } from '../modules/chapel/logic';
import { useChapel } from '../modules/chapel/store';
import { reviewTime, reviewWeek } from '../modules/review/logic';
import { useReview } from '../modules/review/store';
import '../styles/review.css';
import { Candle } from '../modules/chapel/Candle';
import { currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, lampHeat, lampLine, mondayOf, weekTotal } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { dogPose, fmtPts } from '../modules/lounge/logic';
import { useWallet } from '../modules/lounge/useWallet';
import { CountUp, tilt } from './fx';
import { AutoBackupPanel } from './AutoBackup';
import { Homestead, type World } from './Homestead';
import { KeeperNote } from '../modules/keeper/KeeperNote';
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
  const firstDay = useMemo(() => Object.keys(days).filter((k) => dayTotal(days[k]) > 0).sort()[0] ?? null, [days]);
  const totalMins = useMemo(() => Object.values(days).reduce((t, e) => t + dayTotal(e), 0), [days]);
  const hasOffer = usePub((st) => st.queries.some((q) => q.status === 'offer'));
  const world: World = { growth: growth(totalMins, streak, hasOffer), phase: (new URLSearchParams(window.location.search).get('sky') as Phase | null) ?? skyPhase(now), sleeping: bedtime(now), grey: greyness(firstDay, today) };
  const years = anniversary(firstDay, today);
  // On the anniversary, the sky replays its best: a shooting star once per day.
  useEffect(() => {
    if (!years) return;
    try { if (localStorage.getItem('anniv.seen') === today) return; localStorage.setItem('anniv.seen', today); } catch { /* fine */ }
    const t = setTimeout(() => window.dispatchEvent(new Event('austin:celebrate')), 1800);
    return () => clearTimeout(t);
  }, [years, today]);
  const wallet = useWallet();
  const reviews = useReview((st) => st.reviews);
  const reviewSealed = Boolean(reviews[reviewWeek(now, mondayOf(today))]?.sealedAt);
  const chapelDays = useChapel((st) => st.days);
  const prayers = useChapel((st) => st.prayers);
  const chapelToday = chapelMinutes(chapelDays[today]);
  const openPrayers = prayers.filter((p) => !p.answeredOn).length;
  const areaStates = {
    office: AREA_STORES.office(), observatory: AREA_STORES.observatory(), forge: AREA_STORES.forge(), bank: AREA_STORES.bank(), hearth: AREA_STORES.hearth(),
  };
  const office = areaStates.office;
  const obs = areaStates.observatory;
  const officeToday = areaMinutes(office.days[today]);
  const obsToday = areaMinutes(obs.days[today]);
  const forgeToday = areaMinutes(areaStates.forge.days[today]);
  const hearthToday = areaMinutes(areaStates.hearth.days[today]);
  const lit = [mins > 0, chapelToday > 0, officeToday > 0, obsToday > 0, forgeToday > 0, hearthToday > 0].filter(Boolean).length;
  const lineAround = lit === 0 ? 'Every window on the homestead is dark so far.' : lit === 6 ? 'Every building on the homestead is lit tonight.' : `${lit} of 6 buildings lit today.`;
  // "Not tonight" only lasts for today, and only on this device.
  const [hushed, setHushed] = useState(() => { try { return localStorage.getItem('chapel.hushed'); } catch { return null; } });
  const hush = (d: string) => { setHushed(d); try { localStorage.setItem('chapel.hushed', d); } catch { /* fine */ } };

  return (
    <div className="home homestead">
      <section className="hs-hero rise" style={rise(0)}>
        <div className="hs-copy">
          <div className="page-eyebrow">{date} <span className="hero-time">· {time}</span></div>
          <h1 className="hero-title">{greeting(now.getHours())},<br /><em>{OWNER}.</em></h1>
          <p className="hero-line">
            {loaded ? (mins > 0 ? `The cabin lamp is burning: ${fmtMins(mins)} today.` : 'The cabin is dark so far today.') : 'Walking up the trail…'}{' '}
            {building.length ? `${building.length} more building${building.length === 1 ? ' is' : 's are'} going up on the homestead.` : lineAround}
          </p>
        </div>
        <Homestead heat={lampHeat(mins, thresholds)} chapelHeat={candleHeat(chapelToday)} officeHeat={areaHeat(officeToday, OFFICE.fullDay)} obsHeat={areaHeat(obsToday, OBSERVATORY.fullDay)} forgeHeat={areaHeat(forgeToday, AREA_CONFIGS.forge.fullDay)} hearthHeat={areaHeat(hearthToday, AREA_CONFIGS.hearth.fullDay)} world={world} pose={dogPose(g)} />
      </section>

      {reviewTime(now) && !reviewSealed && (
        <button className="review-nudge rise" style={rise(1)} onClick={() => go('/review')}>
          <span aria-hidden style={{ fontSize: 24, color: 'var(--lamp)' }}>◷</span>
          <span><b>{now.getDay() === 0 ? 'It’s Sunday.' : 'A new week.'}</b><br /><span>Time to look back at the week and set one intention for the next.</span></span>
          <span className="go" aria-hidden>→</span>
        </button>
      )}

      <KeeperNote />

      {years && (
        <div className="review-nudge anniv rise" style={rise(1)}>
          <span aria-hidden style={{ fontSize: 24, color: 'var(--lamp)' }}>✦</span>
          <span><b>{years === 1 ? 'A year ago today' : `${years} years ago today`}, you logged your first minutes.</b><br /><span>{Math.round(totalMins / 60).toLocaleString('en-US')} hours since. The homestead remembers.</span></span>
          <button className="btn ghost sm" onClick={() => go('/library')}>Open the Library</button>
        </div>
      )}

      {chapelNudge(now, chapelToday) && hushed !== today && (
        <div className="review-nudge chapel-nudge rise" style={rise(1)}>
          <span className="chapel-nudge-c" aria-hidden><Candle heat={0} size={0.34} /></span>
          <button className="chapel-nudge-b" onClick={() => go('/chapel')}>
            <b>The candle's still unlit.</b><br /><span>A few minutes with God before the day ends?</span>
          </button>
          <button className="btn ghost sm" onClick={() => hush(today)}>Not tonight</button>
        </div>
      )}

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
          {(['office', 'observatory', 'forge', 'hearth', 'bank'] as const).map((id, i) => {
            const cfg = AREA_CONFIGS[id];
            const st = areaStates[id];
            const today2 = areaMinutes(st.days[today]);
            const open = st.items.filter((x) => !x.done && x.list !== 'out' && x.list !== 'in')[0];
            return (
              <button key={cfg.id} className="area-plan area-live rise tilt" style={{ ...rise(3 + i), '--ac': cfg.accent } as CSSProperties} onClick={() => go(`/${cfg.id}`)} {...tilt(4)}>
                <span className="area-glyph" aria-hidden style={{ color: cfg.accent, borderColor: `${cfg.accent}66` }}>{cfg.glyph}</span>
                <span className="area-plan-body">
                  <span className="area-plan-name">{cfg.name}</span>
                  <span className="area-plan-blurb">{cfg.kinds.length ? (today2 ? `${fmtMins(today2)} today` : 'Quiet today') : `${money(moneyYear(st.items, { out: -1, in: 1 }, Number(today.slice(0, 4))).net)} net this year`}{open ? ` · ${open.text}` : ''}</span>
                </span>
                <span className="chip live">Open</span>
              </button>
            );
          })}
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
