import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AREAS, type AreaId } from '../modules/registry';
import { go } from './router';
import { daylight, type Growth, type Holiday, type LifeGrowth } from './worldLogic';
import type { Phase, Season } from '../core/skyLogic';
import { Dog, Patrol } from './Dogs';
import type { DogPose } from '../modules/lounge/logic';

/**
 * The homestead at night: four buildings along a ridge under the sky. Built buildings are solid with
 * lit windows; buildings still on the list are drawn as glowing blueprints. Each one is a door.
 * `heat` (0–1) is how much of today's writing is done; the cabin windows burn with it.
 */
/** What the scene needs to know about the life around it. */
export interface World { growth: Growth; phase: Phase; sleeping: boolean; grey: number; season?: Season; holiday?: Holiday; /** Buildings left alone gather dust (1) and cobwebs (2). */ dust?: Partial<Record<AreaId, 0 | 1 | 2>>; life?: LifeGrowth; /** A book just finished: the dogs make a fuss about it. */ newBook?: string | null }

export function Homestead({ heat, chapelHeat = 0, officeHeat = 0, obsHeat = 0, forgeHeat = 0, hearthHeat = 0, world, pose, children }: { heat: number; chapelHeat?: number; officeHeat?: number; obsHeat?: number; forgeHeat?: number; hearthHeat?: number; world?: World; pose: DogPose; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Layers drift at different speeds with the pointer. Off for reduced motion.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      el.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      el.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  // On a phone the scene scrolls sideways: start with the cabin in view.
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth * 470) / 1200 - el.clientWidth / 2;
  }, []);

  const area = (id: AreaId) => AREAS.find((a) => a.id === id)!;

  return (
    <div ref={ref} className={`hs-scene${world?.sleeping ? ' sleeping' : ''}`} data-phase={world?.phase ?? 'night'} data-season={world?.season}
      style={{ '--heat': heat, '--wall': world ? daylight(world.phase).wall : 0, '--glow': world ? daylight(world.phase).glow : 1 } as CSSProperties}>
      <svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" className="hs-svg" role="group" aria-label="The homestead">
        <defs>
          <linearGradient id="hs-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#18213a" />
            <stop offset="1" stopColor="#0b1020" />
          </linearGradient>
          <linearGradient id="hs-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e1526" />
            <stop offset="1" stopColor="#070a12" />
          </linearGradient>
          <radialGradient id="hs-glow">
            <stop offset="0" stopColor="#f7c66e" stopOpacity=".9" />
            <stop offset="1" stopColor="#e8a84b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hs-room" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd88a" />
            <stop offset="1" stopColor="#d9862c" />
          </linearGradient>
          <linearGradient id="hs-pond" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2540" />
            <stop offset="1" stopColor="#0a0f1c" />
          </linearGradient>
          <linearGradient id="hs-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fb0d0" stopOpacity="0" />
            <stop offset=".6" stopColor="#9fb0d0" stopOpacity=".10" />
            <stop offset="1" stopColor="#9fb0d0" stopOpacity="0" />
          </linearGradient>
          <pattern id="hs-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="rgba(111,179,242,.12)" strokeWidth=".6" />
          </pattern>
        </defs>

        {/* far range */}
        <g className="hs-layer" data-depth="1">
          <path d="M-60 250 L60 170 L130 205 L230 120 L330 200 L420 160 L520 215 L640 140 L760 210 L860 150 L980 220 L1080 165 L1260 240 L1260 360 L-60 360 Z" fill="url(#hs-far)" />
          <path d="M230 120 L250 134 L238 132 L226 140 L214 133 Z M640 140 L660 155 L646 152 L634 160 L622 153 Z M860 150 L878 163 L866 161 L852 168 L842 162 Z" fill="rgba(233,228,216,.10)" />
        </g>
        {/* near ridge */}
        <g className="hs-layer" data-depth="2">
          <path d="M-60 300 C 120 262, 250 250, 380 272 S 640 300, 760 276 S 1000 250, 1260 290 L1260 360 L-60 360 Z" fill="url(#hs-near)" />
          {world?.season === 'winter' && (
            <g className="hs-snow" aria-hidden>
              <path d="M-60 300 C 120 262, 250 250, 380 272 S 640 300, 760 276 S 1000 250, 1260 290 L1260 302 C 1000 262, 760 288, 640 310 S 300 262, -60 312 Z" className="hs-drift" />
            </g>
          )}
          <path d="M210 302 C 330 296, 420 312, 560 306 S 800 300, 940 304 S 1080 312, 1150 306" className="hs-trail" />
          {/* the dirt path from the cabin door down toward you */}
          <path d="M462 300 C 458 318, 430 330, 420 346 L 404 362 L 452 362 C 462 344, 478 328, 478 300 Z" className="hs-path" />
          {/* a small pond holding the moon */}
          <ellipse cx="300" cy="326" rx="70" ry="11" fill="url(#hs-pond)" stroke="rgba(233,228,216,.08)" />
          {world?.season === 'winter' && <ellipse cx="300" cy="326" rx="70" ry="11" className="hs-ice" aria-hidden />}
          <g className="hs-shimmer"><path d="M262 324h22M298 328h30M318 322h14M276 330h16" /></g>
          <ellipse cx="312" cy="325" rx="6" ry="2" fill="rgba(244,236,216,.35)" />
          {/* rocks and grass */}
          <path d="M228 314 q8 -8 18 0 z M372 318 q6 -6 13 0 z M690 312 q9 -9 20 0 z M960 316 q7 -7 15 0 z" fill="#0f1524" />
          <g className="hs-grass">
            {[180, 236, 384, 520, 548, 712, 738, 880, 996, 1110].map((x, i) => (
              <path key={x} d={`M${x} ${310 + (i % 3) * 4} l3 -9 l2 9 l3 -12 l2 12 l3 -8 l2 8`} />
            ))}
          </g>
        </g>

        {/* the lighthouse on the far point: lit at 1,000 hours, a blueprint until then */}
        {world && (
          <g className="hs-layer" data-depth="1">
            <g transform="translate(262 236) scale(.62)" className={world.growth.lighthouse ? 'hs-lh lit' : 'hs-lh plan'} role="img"
              aria-label={world.growth.lighthouse ? 'The lighthouse, lit at 1,000 hours' : `The lighthouse: ${world.growth.hoursToLighthouse} hours to go`}>
              <title>{world.growth.lighthouse ? 'The lighthouse, lit at 1,000 hours' : `The lighthouse lights at 1,000 hours (${world.growth.hoursToLighthouse.toLocaleString('en-US')} to go)`}</title>
              <path d="M-12 0 L-8 -70 L8 -70 L12 0 Z" className="lh-tower" />
              <path d="M-8 -52 H8 M-9 -32 H9 M-11 -12 H11" className="lh-band" />
              <rect x="-9" y="-84" width="18" height="14" className="lh-lamp" />
              <path d="M-11 -84 L0 -94 L11 -84 Z" className="lh-tower" />
              {world.growth.lighthouse && <path d="M0 -77 L140 -100 L140 -54 Z" className="lh-beam" />}
            </g>
          </g>
        )}

        {/* the newer buildings, smaller, up on the far ridge */}
        <g className="hs-layer" data-depth="2">
          {world?.life?.greenhouse && (
            <g transform="translate(700 262) scale(.58)" className="hs-greenhouse" role="link" tabIndex={0} aria-label="The greenhouse: 30 days of looking after the body" onClick={() => go('/forge')}>
              <title>The greenhouse · raised by 30 days of looking after the body</title>
              <circle cx="0" cy="-26" r="54" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <path d="M-46 0 V-34 A46 30 0 0 1 46 -34 V0 Z" className="gh-glass" />
              <path d="M-46 -34 A46 30 0 0 1 46 -34 M-23 0 V-58 M0 0 V-64 M23 0 V-58 M-46 -18 H46" className="gh-frame" />
              {[-30, -12, 8, 28].map((x, i) => <circle key={x} cx={x} cy={-8 - (i % 2) * 6} r="5" className="gh-leaf" />)}
            </g>
          )}
          {world?.life?.guesthouse && (
            <g transform="translate(968 258) scale(.5)" className="hs-guest" role="link" tabIndex={0} aria-label="The guesthouse: 20 hours of time together" onClick={() => go('/hearth')}>
              <title>The guesthouse · raised by 20 hours at the hearth</title>
              <circle cx="0" cy="-30" r="56" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <path d="M-40 0 V-40 L0 -66 L40 -40 V0 Z" className="hs-wall" />
              <rect x="-26" y="-32" width="18" height="16" className="hs-win" /><rect x="8" y="-32" width="18" height="16" className="hs-win" />
              <rect x="-7" y="-22" width="14" height="22" className="hs-door" />
            </g>
          )}
          <g transform="translate(330 262) scale(.62)">
            <Building dust={world?.dust?.forge} area={area('forge')} x={0} y={0} heat={forgeHeat}>
              <circle cx="0" cy="-30" r="60" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <path d="M-46 0 V-50 L0 -78 L46 -50 V0 Z" className="hs-wall" />
              <rect x="-16" y="-34" width="32" height="34" className="hs-win" />
              <rect x="24" y="-92" width="12" height="30" className="hs-wall" />
            </Building>
          </g>
          <g transform="translate(882 262) scale(.62)">
            <Building dust={world?.dust?.hearth} area={area('hearth')} x={0} y={0} heat={hearthHeat}>
              <circle cx="0" cy="-34" r="60" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <path d="M-50 0 V-48 L0 -84 L50 -48 V0 Z" className="hs-wall" />
              <rect x="-36" y="-40" width="22" height="20" className="hs-win" />
              <rect x="14" y="-40" width="22" height="20" className="hs-win" />
              <rect x="-9" y="-28" width="18" height="28" className="hs-door" />
            </Building>
          </g>
          <g transform="translate(1160 250) scale(.55)">
            <Building area={area('bank')} x={0} y={0} heat={0.6}>
              <path d="M-56 -70 L0 -98 L56 -70 Z" className="hs-wall hs-roof" />
              {[-40, -14, 12, 38].map((x) => <rect key={x} x={x - 5} y={-66} width="10" height="58" className="hs-wall" />)}
              <rect x="-60" y="-8" width="120" height="8" className="hs-wall" />
            </Building>
          </g>
        </g>

        {/* buildings */}
        <g className="hs-layer" data-depth="3">
          <Building dust={world?.dust?.observatory} area={area('observatory')} x={150} y={272} heat={obsHeat}>
            <circle cx="0" cy="-40" r="70" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <rect x="-38" y="-46" width="76" height="46" className="hs-wall" />
            <path d="M-44 -46 A44 44 0 0 1 44 -46 Z" className="hs-wall hs-dome" />
            <rect x="-6" y="-88" width="12" height="40" className="hs-slit" transform="rotate(18 0 -46)" />
            <line x1="4" y1="-70" x2="40" y2="-104" className="hs-scope" />
            <rect x="-10" y="-30" width="20" height="30" className="hs-door" />
          </Building>

          <Building dust={world?.dust?.cabin} area={area('cabin')} x={470} y={300}>
            <circle cx="0" cy="-60" r="110" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <rect x="34" y="-128" width="18" height="40" className="hs-wall hs-stone" />
            <path d="M-96 -76 L0 -142 L96 -76 L88 -76 L0 -134 L-88 -76 Z" className="hs-wall hs-roof" />
            <path d="M-88 -76 L0 -134 L88 -76 Z" className="hs-wall hs-roof-in" />
            <rect x="-80" y="-80" width="160" height="80" className="hs-wall hs-logs" />
            {[-70, -60, -50, -40, -30, -20, -10].map((y) => <line key={y} x1="-80" x2="80" y1={y} y2={y} className="hs-log" />)}
            {[-80, 80].map((x) => [-75, -55, -35, -15].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" className="hs-logend" />))}
            {/* windows with the room inside: desk lamp and a chair back */}
            {[-62, 28].map((x) => (
              <g key={x} className="hs-window">
                <rect x={x} y="-62" width="34" height="30" className="hs-win" />
                <g className="hs-inside" transform={`translate(${x} -62)`}>
                  {x < 0 ? (
                    <><path d="M6 30 V20 H28 V30" /><path d="M10 20 L14 8 L22 6" fill="none" /><path d="M18 2 L26 6 L22 11 Z" /></>
                  ) : (
                    <><path d="M8 30 V12 C8 6 26 6 26 12 V30 Z" /><rect x="4" y="22" width="26" height="4" /></>
                  )}
                </g>
                <line x1={x + 17} x2={x + 17} y1="-62" y2="-32" className="hs-mullion" />
                <line x1={x} x2={x + 34} y1="-47" y2="-47" className="hs-mullion" />
                <rect x={x - 3} y="-33" width="40" height="5" className="hs-sill" />
              </g>
            ))}
            {/* porch */}
            <path d="M-34 -50 L0 -66 L34 -50 Z" className="hs-wall hs-roof" />
            <line x1="-28" x2="-28" y1="-50" y2="0" className="hs-post" />
            <line x1="28" x2="28" y1="-50" y2="0" className="hs-post" />
            <rect x="-14" y="-44" width="28" height="44" className="hs-door hs-door-lit" />
            <rect x="-38" y="-2" width="76" height="5" className="hs-step" />
            {/* porch lantern */}
            <g className="hs-lantern" transform="translate(22 -44)">
              <circle r="16" fill="url(#hs-glow)" className="hs-lantern-glow" />
              <path d="M-3 -6 H3 L4 4 H-4 Z" />
            </g>
            {/* woodpile */}
            <g transform="translate(-118 0)" className="hs-woodpile">
              {[0, 1, 2].map((r) => [0, 1, 2, 3].slice(0, 4 - r).map((c) => <circle key={`${r}${c}`} cx={c * 9 + r * 4.5} cy={-5 - r * 8} r="4.4" />))}
            </g>
            <g className="hs-smoke">
              <circle cx="43" cy="-136" r="6" /><circle cx="49" cy="-150" r="8" /><circle cx="41" cy="-168" r="10" /><circle cx="52" cy="-186" r="12" /><circle cx="44" cy="-206" r="13" />
            </g>
            <g className="hs-embers">
              <circle cx="43" cy="-132" r="1.4" /><circle cx="46" cy="-132" r="1.1" /><circle cx="40" cy="-132" r="1.2" />
            </g>
          </Building>

          <Building dust={world?.dust?.chapel} area={area('chapel')} x={790} y={292} heat={chapelHeat}>
            <circle cx="0" cy="-60" r="80" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <rect x="-40" y="-70" width="80" height="70" className="hs-wall" />
            <path d="M-48 -68 L0 -104 L48 -68 Z" className="hs-wall hs-roof" />
            <rect x="-12" y="-150" width="24" height="56" className="hs-wall" />
            <path d="M-16 -148 L0 -172 L16 -148 Z" className="hs-wall hs-roof" />
            <path d="M0 -196 V-172 M-8 -188 H8" className="hs-cross" />
            <path d="M-12 0 V-30 A12 12 0 0 1 12 -30 V0 Z" className="hs-door" />
            <path d="M-6 -126 V-138 A6 6 0 0 1 6 -138 V-126 Z" className="hs-win" />
            {world?.life?.bell && <g className="hs-bell" transform="translate(0 -136)"><title>The bell · rung by 30 days in the Chapel</title><path d="M-5 6 Q-5 -4 0 -5 Q5 -4 5 6 Z" /><circle cy="7.5" r="1.4" /></g>}
          </Building>

          <Building dust={world?.dust?.office} area={area('office')} x={1050} y={282} heat={officeHeat}>
            <circle cx="0" cy="-60" r="90" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <rect x="-58" y="-112" width="116" height="112" className="hs-wall" />
            <path d="M-66 -110 H66 L56 -126 H-56 Z" className="hs-wall hs-roof" />
            {[-96, -66, -36].map((y) => [-42, -14, 14].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="20" height="18" className="hs-win" />))}
            <rect x="34" y="-36" width="16" height="36" className="hs-door" />
          </Building>

          {world?.life?.doghouse && (
            <g transform="translate(676 308) scale(.7)" className="hs-doghouse" role="link" tabIndex={0} aria-label="The doghouse: Cooper and Shadow's kennel" onClick={() => go('/kennel')}>
              <title>The kennel · Cooper and Shadow</title>
              <path d="M-22 0 V-22 L0 -40 L22 -22 V0 Z" className="hs-wall" />
              <path d="M-26 -20 L0 -44 L26 -20" className="hs-wall hs-roof" fill="none" />
              <path d="M-8 0 V-10 A8 8 0 0 1 8 -10 V0 Z" className="dh-door" />
              <rect x="-11" y="-32" width="22" height="7" rx="2" className="dh-sign" /><text y="-26.6" textAnchor="middle" className="dh-name">C · S</text>
            </g>
          )}
          <Pines />
          {world && <Garden g={world.growth} />}
          {world?.season && <SeasonDress season={world.season} holiday={world.holiday ?? null} />}
          <rect x="-60" y="270" width="1320" height="60" fill="url(#hs-mist)" className="hs-mist" />
          {/* Cooper and Shadow out front of the cabin; click them to go in to the Lounge */}
          {world?.newBook && !world.sleeping ? (
            // A book just finished: they sit proud by the cabin with it, tails going, until tomorrow's done.
            <g className="dogs-proud" role="button" tabIndex={0} aria-label={`Cooper and Shadow heard you finished ${world.newBook}`}
              onClick={() => go('/cabin/shelf')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('/cabin/shelf'); } }}>
              <title>{`They heard you finished ${world.newBook}`}</title>
              <g transform="translate(598 244)"><g className="dp-bubble">
                <rect x={-Math.min(150, 34 + world.newBook.length * 3.6)} y="-15" width={Math.min(300, 68 + world.newBook.length * 7.2)} height="26" rx="13" />
                <text x="0" y="3">{`\u2605 ${world.newBook.length > 34 ? `${world.newBook.slice(0, 33)}\u2026` : world.newBook}`}</text>
              </g></g>
              <g transform="translate(572 304) scale(.42)"><g className="dp-wag"><Dog who="cooper" grey={world.grey} pose="proud" /></g></g>
              <g className="dp-book" transform="translate(597 300)"><rect x="-7" y="-10" width="14" height="10" rx="1.5" /><line x1="0" y1="-10" x2="0" y2="0" /></g>
              <g transform="translate(624 306) scale(.42)"><g className="dp-wag d2"><Dog who="shadow" grey={world.grey} pose="proud" /></g></g>
            </g>
          ) : pose === 'sleep' ? (
            <>
              <g transform="translate(560 304) scale(.42)"><Dog who="cooper" grey={world?.grey} pose="sleep" onClick={() => go('/cabin/lounge')} /></g>
              <g transform="translate(612 306) scale(.42)"><Dog who="shadow" grey={world?.grey} pose="sleep" onClick={() => go('/cabin/lounge')} /></g>
            </>
          ) : (
            // Once the day has started, they're out trotting the path between the cabin and the chapel.
            <>
              <g transform="translate(570 306) scale(.42)"><Patrol dist={400} dur={22}><Dog who="cooper" grey={world?.grey} pose="walk" onClick={() => go('/cabin/lounge')} /></Patrol></g>
              <g transform="translate(600 308) scale(.42)"><Patrol dist={380} dur={22} delay={-1.4}><Dog who="shadow" grey={world?.grey} pose="walk" onClick={() => go('/cabin/lounge')} /></Patrol></g>
            </>
          )}
        </g>
      </svg>
      <div className="hs-swipe" aria-hidden>← swipe the homestead →</div>
      {children}
    </div>
  );
}

function Building({ area, x, y, heat, dust = 0, children }: { area: (typeof AREAS)[number]; x: number; y: number; heat?: number; dust?: 0 | 1 | 2; children: ReactNode }) {
  const open = () => go(area.path);
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  return (
    <g
      className={`${area.live ? 'hs-b live' : 'hs-b plan'}${dust ? ` dust-${dust}` : ''}`} transform={`translate(${x} ${y})`} style={heat === undefined ? undefined : ({ '--heat': heat } as CSSProperties)}
      role="link" tabIndex={0} aria-label={`${area.name}${area.live ? '' : ' (being built)'}${dust === 2 ? ' (untended for a while)' : ''}`} onClick={open} onKeyDown={key}
    >
      {!area.live && <rect x="-70" y="-200" width="140" height="200" fill="url(#hs-grid)" className="hs-blue" />}
      {!area.live && (
        <g className="hs-site" aria-hidden>
          <path d="M58 0 V-120 M76 0 V-120 M58 -40 H76 M58 -80 H76 M58 -120 H76 M58 0 L76 -40 L58 -80 L76 -120" />
          <g transform="translate(-58 -6)" className="hs-site-lamp"><circle r="12" fill="url(#hs-glow)" /><rect x="-2.5" y="-4" width="5" height="7" rx="1" /></g>
        </g>
      )}
      {children}
      {dust === 2 && (
        <g className="hs-cobweb" transform="translate(-46 -70)" aria-hidden>
          <path d="M0 0 L22 0 M0 0 L0 22 M0 0 L18 14 M0 0 L9 19 M0 0 L19 7" />
          <path d="M6 0 Q5 5 0 6 M12 0 Q11 9 0 12 M18 0 Q16 13 0 18" />
        </g>
      )}
      <g className="hs-tag" transform="translate(0 -214)">
        <rect x={-area.name.length * 4.4 - 14} y="-15" width={area.name.length * 8.8 + 28} height="26" rx="13" />
        <text textAnchor="middle" y="3">{area.name}</text>
      </g>
      <text className="hs-sub" textAnchor="middle" y="22">{area.live ? 'open' : 'being built'}</text>
    </g>
  );
}

/** By the cabin: a flower for every three days of the streak, saplings for every 50 hours, and the publishing house once an offer comes. */
function Garden({ g }: { g: Growth }) {
  const colors = ['#e5737a', '#f2c46a', '#cfd8ff', '#d97ba4', '#f0a35a', '#9fd3a8'];
  return (
    <g className="hs-garden" aria-hidden>
      {Array.from({ length: g.flowers }, (_, i) => {
        const x = 392 + i * 7 + (i % 2) * 3;
        const y = 318 + (i % 3) * 3;
        return (
          <g key={`f${i}`} className="flower" style={{ animationDelay: `${-i * 0.4}s` }}>
            <path d={`M${x} ${y} v-9`} className="stem" />
            <circle cx={x} cy={y - 10} r="2.6" fill={colors[i % colors.length]} />
          </g>
        );
      })}
      {Array.from({ length: g.saplings }, (_, i) => (
        <path key={`s${i}`} transform={`translate(${410 + i * 9 - (i % 2) * 14} ${332 + i * 2.4}) scale(${0.18 + i * 0.012})`}
          d="M0 -78 L13 -46 L6 -48 L19 -18 L8 -20 L23 6 L3 4 L3 12 L-3 12 L-3 4 L-23 6 L-8 -20 L-19 -18 L-6 -48 L-13 -46 Z" className="sapling" />
      ))}
      {g.publishingHouse && (
        <g transform="translate(640 268) scale(.5)" className="pubhouse">
          <title>The publishing house: an offer came in</title>
          <rect x="-60" y="-90" width="120" height="90" className="ph-wall" />
          <path d="M-70 -88 L0 -126 L70 -88 Z" className="ph-wall" />
          {[-40, -12, 16, 44].map((x) => <rect key={x} x={x - 8} y={-70} width="16" height="22" className="ph-win" />)}
          <rect x="-12" y="-36" width="24" height="36" className="ph-win" />
        </g>
      )}
    </g>
  );
}

/** A few pines around the buildings, deterministic so the scene never reshuffles. */
function Pines() {
  const spots: [number, number, number][] = [
    [40, 300, 1.1], [78, 296, 0.8], [262, 290, 1.25], [300, 296, 0.9], [352, 300, 0.7], [604, 304, 1.15], [646, 300, 0.85],
    [700, 300, 1.0], [958, 292, 1.05], [975, 296, 0.75], [1150, 292, 1.05], [1186, 296, 0.75],
  ];
  return (
    <g className="hs-pines">
      {spots.map(([x, y, s]) => (
        <path key={x} transform={`translate(${x} ${y}) scale(${s})`}
          d="M0 -78 L13 -46 L6 -48 L19 -18 L8 -20 L23 6 L3 4 L3 12 L-3 12 L-3 4 L-23 6 L-8 -20 L-19 -18 L-6 -48 L-13 -46 Z" />
      ))}
    </g>
  );
}

/* ---------------- the seasons, and the days that call for dressing up ---------------- */

/** Points along a line, for strings of lights and rows of icicles. */
const along = (x1: number, y1: number, x2: number, y2: number, n: number) =>
  Array.from({ length: n }, (_, i) => [x1 + ((x2 - x1) * i) / (n - 1), y1 + ((y2 - y1) * i) / (n - 1)] as const);
const BULBS = ['#ff6b5e', '#ffd27a', '#7fd3ff', '#9ff0a8', '#ff9ad5'];

function Tree({ x, y, s = 1, kind }: { x: number; y: number; s?: number; kind: 'blossom' | 'summer' | 'autumn' }) {
  const fill = kind === 'blossom' ? ['#f6b8c8', '#f9d3dd', '#e996ad'] : kind === 'summer' ? ['#2f6b45', '#3d8455', '#285c3b'] : ['#d9662b', '#e8a03a', '#b8442a'];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={`hs-tree t-${kind}`}>
      <path d="M-2 0 L-3 -26 L-12 -36 M-3 -26 L3 -38 M0 -14 L9 -24" className="hs-trunk" />
      <circle cx="-12" cy="-40" r="11" fill={fill[0]} /><circle cx="4" cy="-46" r="13" fill={fill[1]} /><circle cx="14" cy="-34" r="10" fill={fill[2]} />
      <circle cx="-2" cy="-32" r="10" fill={fill[0]} />
      {kind === 'blossom' && [[-16, -46], [8, -54], [16, -40], [-6, -38], [2, -30]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="1.6" fill="#fff4f7" />)}
    </g>
  );
}

function Pumpkin({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className={lit ? 'hs-pumpkin lit' : 'hs-pumpkin'}>
      {lit && <circle r="16" fill="url(#hs-glow)" className="hs-lantern-glow" />}
      <ellipse rx="8" ry="6" cy="-6" fill="#d9701f" /><ellipse rx="4" ry="6" cy="-6" fill="#e8862c" />
      <path d="M0 -12 q1 -4 3 -5" stroke="#4a5a2a" strokeWidth="1.6" fill="none" />
      {lit && <path d="M-4 -8 l1.5 -2 l1.5 2 z M1 -8 l1.5 -2 l1.5 2 z M-4 -4 q4 3 8 0 q-4 1 -8 0 z" fill="#ffe08a" />}
    </g>
  );
}

function SeasonDress({ season, holiday }: { season: Season; holiday: Holiday }) {
  const winter = season === 'winter';
  return (
    <g className={`hs-season s-${season}`} aria-hidden>
      {winter && (
        <g className="hs-snow">
          {/* caps on every roof */}
          <path d="M372 226 L470 156 L568 226 L562 229 L470 165 L378 229 Z" />
          <path d="M436 236 L470 220 L504 236 L500 238 L470 225 L440 238 Z" />
          <path d="M740 226 L790 186 L840 226 L835 228 L790 193 L745 228 Z" />
          <path d="M772 146 L790 118 L808 146 L804 147 L790 124 L776 147 Z" />
          <rect x="986" y="153" width="128" height="5" rx="2.5" />
          <path d="M106 226 A44 44 0 0 1 194 226 L188 226 A38 32 0 0 0 112 226 Z" />
          {/* icicles on the cabin eaves */}
          {along(382, 226, 558, 226, 14).map(([x, y], i) => <path key={i} d={`M${x - 2} ${y} L${x} ${y + 5 + (i % 3) * 3} L${x + 2} ${y} Z`} className="hs-icicle" />)}
        </g>
      )}
      {season === 'spring' && <><Tree x={612} y={306} s={1.05} kind="blossom" /><Tree x={232} y={304} s={0.85} kind="blossom" /><Tree x={930} y={300} s={0.8} kind="blossom" /></>}
      {season === 'summer' && (
        <>
          <Tree x={612} y={306} s={1.05} kind="summer" /><Tree x={930} y={300} s={0.8} kind="summer" />
          {[[838, 300], [848, 302], [858, 299]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`} className="hs-sunflower"><path d={`M0 0 V${-14 - i * 3}`} /><circle cy={-15 - i * 3} r="4" /><circle cy={-15 - i * 3} r="1.8" className="c" /></g>
          ))}
        </>
      )}
      {season === 'autumn' && (
        <>
          <Tree x={612} y={306} s={1.05} kind="autumn" /><Tree x={232} y={304} s={0.85} kind="autumn" /><Tree x={930} y={300} s={0.8} kind="autumn" />
          <path d="M596 308 q14 -7 30 0 z M914 302 q12 -6 26 0 z" className="hs-leafpile" />
          <Pumpkin x={432} y={302} lit={holiday === 'halloween'} /><Pumpkin x={447} y={303} lit={holiday === 'halloween'} /><Pumpkin x={508} y={302} lit={holiday === 'halloween'} />
        </>
      )}
      {holiday === 'christmas' && (
        <g className="hs-xmas">
          {/* lights along the cabin and chapel roofs */}
          {[...along(378, 228, 470, 162, 12), ...along(470, 162, 562, 228, 12)].map(([x, y], i) => <circle key={`c${i}`} cx={x} cy={y + 3} r="2.2" fill={BULBS[i % BULBS.length]} className="bulb" style={{ animationDelay: `${(i % 5) * 0.3}s` }} />)}
          {[...along(744, 228, 790, 192, 6), ...along(790, 192, 836, 228, 6)].map(([x, y], i) => <circle key={`h${i}`} cx={x} cy={y + 3} r="2" fill={BULBS[(i + 2) % BULBS.length]} className="bulb" style={{ animationDelay: `${(i % 4) * 0.35}s` }} />)}
          {/* a wreath on the cabin door */}
          <g transform="translate(470 270)"><circle r="7" className="wreath" /><path d="M-3 5 L0 2 L3 5 L0 8 Z" fill="#d23b3b" /></g>
          {/* a lit tree by the path */}
          <g transform="translate(640 306)" className="xmas-tree">
            <circle cy="-24" r="34" fill="url(#hs-glow)" className="hs-lantern-glow" />
            <path d="M0 -52 L16 -22 L8 -22 L20 0 L-20 0 L-8 -22 L-16 -22 Z" fill="#1f4a32" />
            {[[-8, -10], [6, -14], [-3, -24], [9, -4], [-12, -3], [2, -34]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="1.8" fill={BULBS[i % BULBS.length]} className="bulb" style={{ animationDelay: `${i * 0.25}s` }} />)}
            <path d="M0 -60 l2 4 l4 0.5 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -0.5 z" fill="#ffd27a" className="star" />
          </g>
        </g>
      )}
    </g>
  );
}
