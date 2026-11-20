import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AREAS, type AreaId } from '../modules/registry';
import { go } from './router';
import { Dog } from './Dogs';
import type { DogPose } from '../modules/lounge/logic';

/**
 * The homestead at night: four buildings along a ridge under the sky. Built buildings are solid with
 * lit windows; buildings still on the list are drawn as glowing blueprints. Each one is a door.
 * `heat` (0–1) is how much of today's writing is done; the cabin windows burn with it.
 */
export function Homestead({ heat, pose, children }: { heat: number; pose: DogPose; children?: ReactNode }) {
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
    <div ref={ref} className="hs-scene" style={{ '--heat': heat } as CSSProperties}>
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
          <path d="M210 302 C 330 296, 420 312, 560 306 S 800 300, 940 304 S 1080 312, 1150 306" className="hs-trail" />
        </g>

        {/* buildings */}
        <g className="hs-layer" data-depth="3">
          <Building area={area('observatory')} x={150} y={272}>
            <rect x="-38" y="-46" width="76" height="46" className="hs-wall" />
            <path d="M-44 -46 A44 44 0 0 1 44 -46 Z" className="hs-wall hs-dome" />
            <rect x="-6" y="-88" width="12" height="40" className="hs-slit" transform="rotate(18 0 -46)" />
            <line x1="4" y1="-70" x2="40" y2="-104" className="hs-scope" />
            <rect x="-10" y="-30" width="20" height="30" className="hs-door" />
          </Building>

          <Building area={area('cabin')} x={470} y={300}>
            <rect x="34" y="-128" width="18" height="40" className="hs-wall" />
            <path d="M-92 -78 L0 -140 L92 -78 Z" className="hs-wall hs-roof" />
            <rect x="-80" y="-80" width="160" height="80" className="hs-wall hs-logs" />
            {[-64, -48, -32, -16].map((y) => <line key={y} x1="-80" x2="80" y1={y} y2={y} className="hs-log" />)}
            <rect x="-62" y="-60" width="34" height="28" className="hs-win" />
            <rect x="28" y="-60" width="34" height="28" className="hs-win" />
            <line x1="-45" x2="-45" y1="-60" y2="-32" className="hs-mullion" />
            <line x1="45" x2="45" y1="-60" y2="-32" className="hs-mullion" />
            <rect x="-14" y="-46" width="28" height="46" className="hs-door hs-door-lit" />
            <circle cx="0" cy="-60" r="80" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <g className="hs-smoke">
              <circle cx="43" cy="-136" r="6" /><circle cx="49" cy="-150" r="8" /><circle cx="41" cy="-168" r="10" />
            </g>
          </Building>

          <Building area={area('chapel')} x={790} y={292}>
            <rect x="-40" y="-70" width="80" height="70" className="hs-wall" />
            <path d="M-48 -68 L0 -104 L48 -68 Z" className="hs-wall hs-roof" />
            <rect x="-12" y="-150" width="24" height="56" className="hs-wall" />
            <path d="M-16 -148 L0 -172 L16 -148 Z" className="hs-wall hs-roof" />
            <path d="M0 -196 V-172 M-8 -188 H8" className="hs-cross" />
            <path d="M-12 0 V-30 A12 12 0 0 1 12 -30 V0 Z" className="hs-door" />
            <path d="M-6 -126 V-138 A6 6 0 0 1 6 -138 V-126 Z" className="hs-win" />
          </Building>

          <Building area={area('office')} x={1050} y={282}>
            <rect x="-58" y="-112" width="116" height="112" className="hs-wall" />
            <path d="M-66 -110 H66 L56 -126 H-56 Z" className="hs-wall hs-roof" />
            {[-96, -66, -36].map((y) => [-42, -14, 14].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="20" height="18" className="hs-win" />))}
            <rect x="34" y="-36" width="16" height="36" className="hs-door" />
          </Building>

          <Pines />
          {/* Cooper and Shadow out front of the cabin; click them to go in to the Lounge */}
          <g transform="translate(588 304) scale(.42)"><Dog who="cooper" pose={pose} onClick={() => go('/cabin/lounge')} /></g>
          <g transform="translate(640 306) scale(.42)"><Dog who="shadow" pose={pose} onClick={() => go('/cabin/lounge')} /></g>
        </g>
      </svg>
      <div className="hs-swipe" aria-hidden>← swipe the homestead →</div>
      {children}
    </div>
  );
}

function Building({ area, x, y, children }: { area: (typeof AREAS)[number]; x: number; y: number; children: ReactNode }) {
  const open = () => go(area.path);
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  return (
    <g
      className={area.live ? 'hs-b live' : 'hs-b plan'} transform={`translate(${x} ${y})`}
      role="link" tabIndex={0} aria-label={`${area.name}${area.live ? '' : ' (being built)'}`} onClick={open} onKeyDown={key}
    >
      {!area.live && <rect x="-70" y="-200" width="140" height="200" fill="url(#hs-grid)" className="hs-blue" />}
      {children}
      <g className="hs-tag" transform="translate(0 -214)">
        <rect x={-area.name.length * 4.4 - 14} y="-15" width={area.name.length * 8.8 + 28} height="26" rx="13" />
        <text textAnchor="middle" y="3">{area.name}</text>
      </g>
      <text className="hs-sub" textAnchor="middle" y="22">{area.live ? 'open' : 'being built'}</text>
    </g>
  );
}

/** A few pines around the buildings, deterministic so the scene never reshuffles. */
function Pines() {
  const spots: [number, number, number][] = [
    [40, 300, 1.1], [78, 296, 0.8], [262, 290, 1.25], [300, 296, 0.9], [352, 300, 0.7], [604, 304, 1.15], [646, 300, 0.85],
    [700, 300, 1.0], [900, 290, 1.2], [940, 294, 0.8], [1150, 292, 1.05], [1186, 296, 0.75],
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
