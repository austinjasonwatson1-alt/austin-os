import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { setAmbient } from '../../core/ambient';
import { todayISO } from '../../core/dates';
import { moonPath, moonPhase, skyPhase } from '../../core/skyLogic';
import { useSky } from '../../core/skyStore';
import { Dog } from '../../shell/Dogs';
import { go } from '../../shell/router';
import { currentStreak, dayTotal, gradeOf, lampHeat } from '../ledger/logic';
import { earned, milestones } from '../ledger/milestones';
import { useLedger } from '../ledger/store';
import { dogLine, dogPose, type DogName } from './logic';

const WINDOW_SKY: Record<string, [string, string]> = {
  night: ['#0a0f22', '#141a33'], dawn: ['#1d1a35', '#b5707a'], day: ['#3a5a8a', '#8fb0d6'], golden: ['#2a2a4a', '#e09a50'], dusk: ['#1a1433', '#8a4a74'],
};

/**
 * The Writing Lounge, drawn as a room you can click around: the desk lamp opens Lamp Mode, the
 * shelf and corkboard lead to their rooms, and the fireplace, record player and reading chair
 * arrive as milestones are earned. Cooper and Shadow react to how the day is going.
 */
export function LoungeScene() {
  const { days, thresholds, weekly } = useLedger();
  const weather = useSky((s) => s.weather);
  const today = todayISO();
  const mins = dayTotal(days[today]);
  const heat = lampHeat(mins, thresholds);
  const forced = new URLSearchParams(window.location.search).get('dogs');
  const pose = forced === 'sleep' || forced === 'rest' || forced === 'proud' ? forced : dogPose(gradeOf(mins, thresholds));
  const streak = currentStreak(days, today);
  const ms = useMemo(() => milestones(days, thresholds, weekly), [days, thresholds, weekly]);
  const fire = earned(ms, 'seven');
  const record = earned(ms, 'long-week');
  const chair = earned(ms, 'hundred');
  const fullShelf = earned(ms, 'hearth');
  const [say, setSay] = useState<{ text: string; x: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const now = new Date();
  const phase = skyPhase(now);
  const [top, bottom] = WINDOW_SKY[phase];

  useEffect(() => () => setAmbient(null), []);
  useEffect(() => {
    if (!say) return;
    const id = setTimeout(() => setSay(null), 6000);
    return () => clearTimeout(id);
  }, [say]);

  const bark = (who: DogName, x: number) => setSay({ text: dogLine(who, pose), x });
  const toggleRecord = () => {
    const on = !playing;
    setPlaying(on);
    setAmbient(on ? 'rain' : null);
  };

  // Where the dogs settle: on the rug asleep, by a lit fire resting, beside the desk when proud.
  const spot = pose === 'proud' ? { c: [480, 404], s: [580, 404] } : pose === 'rest' && fire ? { c: [790, 412], s: [915, 414] } : { c: [440, 410], s: [575, 414] };

  return (
    <section className="lscene" style={{ '--heat': heat } as CSSProperties}>
      <svg viewBox="0 0 1000 440" role="group" aria-label="The Writing Lounge">
        <defs>
          <linearGradient id="ls-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1410" /><stop offset="1" stopColor="#120e0b" /></linearGradient>
          <linearGradient id="ls-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#140f0c" /><stop offset="1" stopColor="#0a0807" /></linearGradient>
          <linearGradient id="ls-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient>
          <radialGradient id="ls-lamp"><stop offset="0" stopColor="#ffd88a" stopOpacity=".95" /><stop offset=".4" stopColor="#e8a84b" stopOpacity=".35" /><stop offset="1" stopColor="#e8a84b" stopOpacity="0" /></radialGradient>
          <radialGradient id="ls-fire"><stop offset="0" stopColor="#ffb347" stopOpacity=".7" /><stop offset="1" stopColor="#ff7a1a" stopOpacity="0" /></radialGradient>
          <pattern id="ls-planks" width="1000" height="34" patternUnits="userSpaceOnUse"><path d="M0 33.5H1000" stroke="rgba(0,0,0,.35)" /></pattern>
          <clipPath id="ls-wclip"><rect x="300" y="70" width="170" height="150" rx="4" /></clipPath>
        </defs>

        {/* room */}
        <rect width="1000" height="330" fill="url(#ls-wall)" />
        <rect width="1000" height="330" fill="url(#ls-planks)" />
        <rect y="330" width="1000" height="110" fill="url(#ls-floor)" />
        <path d="M0 330H1000" stroke="rgba(232,168,75,.18)" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${352 + i * 24}H1000`} stroke="rgba(0,0,0,.4)" />)}
        <ellipse cx="500" cy="402" rx="300" ry="30" className="ls-rug" />
        <ellipse cx="500" cy="402" rx="270" ry="24" className="ls-rug-in" />

        {/* window onto the real sky */}
        <g className="ls-window">
          <rect x="300" y="70" width="170" height="150" rx="4" fill="url(#ls-win)" />
          <g clipPath="url(#ls-wclip)">
            {phase !== 'day' && [[320, 90], [350, 120], [420, 84], [445, 140], [390, 104], [330, 160]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.1" fill="#e9e4d8" opacity=".7" />)}
            <path d={moonPath(moonPhase(now), 11)} transform="translate(430 104)" fill="#f4ecd8" opacity={phase === 'day' ? 0.5 : 0.95} />
            <path d="M300 200 L330 176 L350 190 L380 168 L410 186 L440 172 L470 192 L470 220 L300 220 Z" fill="#070a12" />
            {(weather === 'rain' || weather === 'storm') && <g className="ls-rain">{Array.from({ length: 14 }, (_, i) => <line key={i} x1={305 + i * 12} y1="60" x2={299 + i * 12} y2="80" />)}</g>}
            {weather === 'snow' && <g className="ls-snow">{Array.from({ length: 12 }, (_, i) => <circle key={i} cx={308 + i * 14} cy={70 + (i % 4) * 30} r="1.6" />)}</g>}
          </g>
          <path d="M385 70V220M300 145H470" stroke="#2a1f17" strokeWidth="6" />
          <rect x="300" y="70" width="170" height="150" rx="4" fill="none" stroke="#2a1f17" strokeWidth="10" />
          <rect x="290" y="222" width="190" height="10" rx="2" fill="#2a1f17" />
          <path d="M282 58 C300 120 296 190 282 240 L270 240 L270 58 Z M488 58 C470 120 474 190 488 240 L500 240 L500 58 Z" className="ls-curtain" />
          <rect x="262" y="52" width="246" height="7" rx="3" fill="#3a2c20" />
        </g>

        {/* bookshelf → The Shelf */}
        <Thing label="The Shelf" sub="coming soon" onOpen={() => go('/cabin/shelf')} x={40} y={60}>
          <rect width="170" height="270" rx="3" className="ls-wood" />
          {[0, 1, 2, 3].map((r) => (
            <g key={r} transform={`translate(10 ${14 + r * 64})`}>
              <rect y="52" width="150" height="6" className="ls-wood-d" />
              {Array.from({ length: fullShelf ? 13 : 4 + r * 2 }, (_, i) => (
                <rect key={i} x={i * 11 + (i > 9 ? 4 : 0)} y={52 - (32 + ((i * 7 + r * 3) % 14))} width="9" height={32 + ((i * 7 + r * 3) % 14)} rx="1"
                  fill={['#5a2a22', '#2e3f5a', '#3d4a2e', '#6a4a22', '#4a2e4a', '#2a4a4a'][(i + r) % 6]} opacity=".9" />
              ))}
            </g>
          ))}
        </Thing>

        {/* corkboard → Contests */}
        <Thing label="Contests" sub="coming soon" onOpen={() => go('/cabin/contests')} x={540} y={70}>
          <rect width="120" height="86" rx="3" className="ls-cork" />
          <rect x="12" y="12" width="40" height="30" fill="#e9e4d8" opacity=".75" transform="rotate(-4 32 27)" />
          <rect x="62" y="16" width="44" height="26" fill="#f0d9a0" opacity=".7" transform="rotate(3 84 29)" />
          <rect x="30" y="50" width="52" height="26" fill="#cfe0f0" opacity=".6" transform="rotate(-2 56 63)" />
          <circle cx="32" cy="14" r="2.5" fill="#d1503f" /><circle cx="84" cy="18" r="2.5" fill="#4fbf87" /><circle cx="56" cy="52" r="2.5" fill="#6fb3f2" />
        </Thing>

        {/* desk, typewriter, lamp → Lamp Mode */}
        <Thing label="Lamp mode" sub="start a session" onOpen={() => go('/cabin/timer')} x={520} y={230}>
          <circle cx="40" cy="-10" r={110} fill="url(#ls-lamp)" className="ls-lampglow" />
          <rect x="0" y="40" width="200" height="12" rx="2" className="ls-wood" />
          <rect x="10" y="52" width="10" height="70" className="ls-wood-d" />
          <rect x="180" y="52" width="10" height="70" className="ls-wood-d" />
          <path d="M28 40 L34 -20 M34 -20 L62 -32" stroke="#3a2c20" strokeWidth="4" fill="none" />
          <path d="M50 -44 L80 -30 L66 -16 Z" fill="#2a2018" stroke="rgba(232,168,75,.5)" />
          <circle cx="68" cy="-24" r="5" className="ls-bulb" />
          <rect x="18" y="36" width="24" height="5" rx="2" fill="#2a2018" />
          <g transform="translate(90 6)">
            <rect x="0" y="16" width="80" height="20" rx="4" fill="#1e1a17" stroke="rgba(233,228,216,.2)" />
            <rect x="8" y="-6" width="64" height="24" rx="2" fill="#e9e4d8" opacity=".85" />
            <path d="M16 2H62M16 8H56M16 14H48" stroke="#3a3a3a" strokeWidth="1" />
            <rect x="-4" y="12" width="88" height="6" rx="3" fill="#2b2622" />
          </g>
          <g transform="translate(150 22)"><rect width="30" height="18" fill="#e9e4d8" opacity=".55" transform="rotate(-8)" /><rect x="4" y="2" width="30" height="18" fill="#f0e6c8" opacity=".6" transform="rotate(6)" /></g>
        </Thing>

        {/* fireplace — lit by a 7-day streak */}
        <Thing label={fire ? `Streak · ${streak} days` : 'The fireplace'} sub={fire ? 'kept burning by the streak' : 'lights at a 7-day streak'} locked={!fire} x={760} y={150}>
          <rect x="0" y="0" width="200" height="180" className={fire ? 'ls-stone' : 'ls-blue'} />
          <rect x="-12" y="-6" width="224" height="16" rx="2" className={fire ? 'ls-wood' : 'ls-blue'} />
          <path d="M40 180 V96 A60 50 0 0 1 160 96 V180 Z" className={fire ? 'ls-hearth' : 'ls-blue'} />
          {fire && (
            <>
              <circle cx="100" cy="150" r="90" fill="url(#ls-fire)" className="ls-fireglow" />
              <g className="ls-flames">
                <path d="M70 176 C64 150 84 140 80 116 C96 132 104 150 98 176 Z" />
                <path d="M96 176 C90 140 112 128 106 98 C126 122 132 150 124 176 Z" />
                <path d="M118 176 C114 156 130 146 128 128 C140 142 142 160 136 176 Z" />
              </g>
              <rect x="56" y="172" width="90" height="8" rx="3" fill="#3a2414" />
              <g transform="translate(100 -26)"><rect x="-24" y="-13" width="48" height="22" rx="4" className="ls-plaque" /><text y="4" textAnchor="middle" className="ls-mantel">{streak}</text></g>
            </>
          )}
        </Thing>

        {/* reading chair — 100 hours */}
        <Thing label="Reading chair" sub={chair ? 'earned at 100 hours' : 'arrives at 100 hours'} locked={!chair} x={120} y={300}>
          <path d="M0 100 V30 C0 6 20 0 40 0 H80 C100 0 120 6 120 30 V100 Z" className={chair ? 'ls-chair' : 'ls-blue'} transform="scale(.8)" />
          <rect x="-8" y="50" width="22" height="34" rx="8" className={chair ? 'ls-chair' : 'ls-blue'} />
          <rect x="82" y="50" width="22" height="34" rx="8" className={chair ? 'ls-chair' : 'ls-blue'} />
        </Thing>

        {/* record player — first elite week */}
        <Thing label={record ? (playing ? 'Record player · playing' : 'Record player') : 'Record player'} sub={record ? (playing ? 'click to stop' : 'click for rain on the roof') : 'arrives with the first elite week'}
          locked={!record} onOpen={record ? toggleRecord : undefined} x={226} y={262}>
          <rect x="0" y="30" width="64" height="40" className={record ? 'ls-wood' : 'ls-blue'} />
          <rect x="4" y="70" width="6" height="40" className={record ? 'ls-wood-d' : 'ls-blue'} />
          <rect x="54" y="70" width="6" height="40" className={record ? 'ls-wood-d' : 'ls-blue'} />
          <rect x="-2" y="20" width="68" height="12" rx="2" className={record ? 'ls-wood-d' : 'ls-blue'} />
          {record && <ellipse cx="30" cy="22" rx="24" ry="5" className={playing ? 'ls-vinyl spin' : 'ls-vinyl'} />}
          {record && playing && <g className="ls-notes"><text x="44" y="0">♪</text><text x="58" y="-14">♫</text></g>}
        </Thing>

        {/* Cooper and Shadow */}
        <g transform={`translate(${spot.c[0]} ${spot.c[1]}) scale(1.3)`}><Dog who="cooper" pose={pose} onClick={() => bark('cooper', spot.c[0])} /></g>
        <g transform={`translate(${spot.s[0]} ${spot.s[1]}) scale(1.3)`}><Dog who="shadow" pose={pose} onClick={() => bark('shadow', spot.s[0])} /></g>
      </svg>
      {say && <div className="ls-say" style={{ left: `${Math.min(80, Math.max(20, say.x / 10))}%` }} role="status">{say.text}</div>}
    </section>
  );
}

function Thing({ label, sub, x, y, onOpen, locked = false, children }: { label: string; sub: string; x: number; y: number; onOpen?: () => void; locked?: boolean; children: ReactNode }) {
  const key = (e: KeyboardEvent) => { if (onOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } };
  return (
    <g className={`ls-thing${locked ? ' locked' : ''}${onOpen ? ' clickable' : ''}`} transform={`translate(${x} ${y})`}
      role={onOpen ? 'button' : 'img'} tabIndex={0} aria-label={`${label}, ${sub}`} onClick={onOpen} onKeyDown={key}>
      {children}
      <g className="ls-tag" transform="translate(0 -18)">
        <rect x="-4" y="-17" width={Math.max(label.length, sub.length) * 7.2 + 20} height="40" rx="8" />
        <text x="6" y="-1" className="ls-tag-n">{label}</text>
        <text x="6" y="14" className="ls-tag-s">{sub}</text>
      </g>
    </g>
  );
}
