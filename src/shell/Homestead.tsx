import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AREAS, type AreaId } from '../modules/registry';
import { go } from './router';
import { daylight, type Growth, type Holiday, type LifeGrowth } from './worldLogic';
import type { Phase, Season } from '../core/skyLogic';
import { Dog, Patrol } from './Dogs';
import type { DogPose } from '../modules/lounge/logic';

/**
 * The homestead, painted: a ridge of buildings under the sky, lit from inside. Built buildings are
 * solid with lit windows; buildings still on the list are drawn as glowing blueprints. Each one is a door.
 * `heat` (0–1) is how much of today's writing is done; the cabin windows (and the light they throw
 * on the ground) burn with it. Each other building burns with its own `--heat`.
 *
 * Painterly, but phone-cheap: no live SVG filters. Colours come from per-phase CSS variables on
 * `.hs-scene[data-phase]`, the canvas grain is one small bitmap baked once and tiled, and everything
 * that moves animates transform/opacity only.
 */
/** What the scene needs to know about the life around it. */
export interface World { growth: Growth; phase: Phase; sleeping: boolean; grey: number; season?: Season; holiday?: Holiday; /** Buildings left alone gather dust (1) and cobwebs (2). */ dust?: Partial<Record<AreaId, 0 | 1 | 2>>; life?: LifeGrowth; /** A book just finished: the dogs make a fuss about it. */ newBook?: string | null }

/* ---------------- deterministic helpers (the scene never reshuffles) ---------------- */

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Linear interpolation over a polyline: the height of a ridge at x. */
const yAt = (pts: readonly (readonly [number, number])[], x: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

/** A hand-drawn ridge: a smooth curve through the points, roughened with small deterministic wobbles. */
function ridge(pts: readonly (readonly [number, number])[], seed: number, rough: number, step = 14, bottom = 362): string {
  const r = rng(seed);
  let d = `M${pts[0][0]} ${bottom} L${pts[0][0]} ${pts[0][1]}`;
  for (let x = pts[0][0] + step; x <= pts[pts.length - 1][0]; x += step) {
    d += ` L${x} ${(yAt(pts, x) + (r() - 0.5) * rough).toFixed(1)}`;
  }
  return `${d} L${pts[pts.length - 1][0]} ${bottom} Z`;
}

const FAR2: [number, number][] = [[-60, 214], [40, 176], [120, 196], [190, 150], [290, 186], [380, 158], [470, 192], [560, 142], [660, 180], [740, 160], [820, 120], [930, 178], [1010, 150], [1110, 190], [1200, 158], [1260, 186]];
const FAR: [number, number][] = [[-60, 250], [60, 170], [130, 205], [230, 120], [330, 200], [420, 160], [520, 215], [640, 140], [760, 210], [860, 150], [980, 220], [1080, 165], [1260, 240]];
const MID: [number, number][] = [[-60, 268], [40, 244], [140, 236], [260, 240], [360, 252], [470, 250], [560, 240], [680, 230], [800, 236], [900, 226], [1000, 232], [1100, 224], [1260, 238]];
const NEAR = 'M-60 300 C 120 262, 250 250, 380 272 S 640 300, 760 276 S 1000 250, 1260 290 L1260 362 L-60 362 Z';

/** A distant treeline along the mid ridge: one path, many tiny pines. */
const FAR2_D = ridge(FAR2, 3, 3, 10);
const FAR_D = ridge(FAR, 11, 4.5, 9);
const MID_D = ridge(MID, 5, 2.2, 12);

const TREELINE = (() => {
  const r = rng(91);
  let d = '';
  for (let x = -50; x < 1250; x += 5 + r() * 9) {
    if (r() < 0.22) continue;
    const base = yAt(MID, x) + 3;
    const h = 7 + r() * 12, w = 2.6 + r() * 2.4;
    d += `M${(x - w).toFixed(1)} ${base.toFixed(1)} L${x.toFixed(1)} ${(base - h).toFixed(1)} L${(x + w).toFixed(1)} ${base.toFixed(1)} Z `;
  }
  return d;
})();

/** Grass tufts scattered over the near ground: a dark path for the blades and a lit one for the tips. */
const TUFTS = (() => {
  const r = rng(7);
  const near = [[-60, 300], [120, 268], [250, 258], [380, 272], [520, 290], [640, 296], [760, 276], [880, 262], [1000, 256], [1260, 290]] as const;
  let dark = '', lit = '';
  for (let i = 0; i < 70; i++) {
    const x = -40 + r() * 1280;
    if (x > 228 && x < 376 && r() < 0.85) continue; // the pond
    const y = yAt(near, x) + 8 + r() * 46;
    if (y > 352) continue;
    const s = 0.6 + r() * 0.8 * ((y - 250) / 100);
    for (let b = 0; b < 4; b++) {
      const bx = x + (b - 1.5) * 2.2 * s, lean = (r() - 0.5) * 7 * s, h = (6 + r() * 7) * s;
      dark += `M${(bx - 1.1 * s).toFixed(1)} ${y.toFixed(1)} Q${(bx + lean * 0.3).toFixed(1)} ${(y - h * 0.6).toFixed(1)} ${(bx + lean).toFixed(1)} ${(y - h).toFixed(1)} Q${(bx + lean * 0.2 + 0.6).toFixed(1)} ${(y - h * 0.5).toFixed(1)} ${(bx + 1.1 * s).toFixed(1)} ${y.toFixed(1)} Z `;
      if (b % 2) lit += `M${(bx + lean * 0.5).toFixed(1)} ${(y - h * 0.55).toFixed(1)} Q${(bx + lean * 0.8).toFixed(1)} ${(y - h * 0.85).toFixed(1)} ${(bx + lean).toFixed(1)} ${(y - h).toFixed(1)} `;
    }
  }
  return { dark, lit };
})();

/** A pine with layered, drooping boughs (drawn once in <defs>, stamped with <use>). */
const tier = (top: number, bottom: number, w: number) => {
  const h = bottom - top;
  return `M0 ${top} C${w * 0.25} ${top + h * 0.45} ${w * 0.65} ${bottom - h * 0.22} ${w} ${bottom} Q${w * 0.55} ${bottom - 4} ${w * 0.3} ${bottom + 1} Q${w * 0.05} ${bottom - 3} ${-w * 0.2} ${bottom + 1.5} Q${-w * 0.5} ${bottom - 3} ${-w} ${bottom} C${-w * 0.65} ${bottom - h * 0.22} ${-w * 0.25} ${top + h * 0.45} 0 ${top} Z`;
};
const TIERS: [number, number, number][] = [[-94, -64, 8], [-80, -46, 13], [-64, -26, 18], [-46, -4, 24]];
const PINE = TIERS.map(([t, b, w]) => tier(t, b, w)).join(' ');
const PINE_LIT = TIERS.map(([t, b, w]) => `M${w * 0.18} ${t + (b - t) * 0.38} C${w * 0.5} ${t + (b - t) * 0.68} ${w * 0.78} ${b - 3} ${w} ${b}`).join(' ');
const PINE_SNOW = TIERS.map(([t, b, w]) => { const h = b - t; return `M${-w * 0.62} ${b - h * 0.22} Q0 ${t + h * 0.3} ${w * 0.62} ${b - h * 0.22} Q0 ${b - h * 0.4} ${-w * 0.62} ${b - h * 0.22} Z`; }).join(' ');

/** Canvas grain and a few dry-brush strokes, baked once into a small tile. */
let grainTile: string | null = null;
function grain(): string {
  if (grainTile !== null) return grainTile;
  grainTile = '';
  try {
    const N = 160;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    if (!g) return grainTile;
    const r = rng(2024);
    const img = g.createImageData(N, N);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r();
      const lightPx = v > 0.5;
      img.data[i] = lightPx ? 255 : 6; img.data[i + 1] = lightPx ? 246 : 8; img.data[i + 2] = lightPx ? 228 : 18;
      img.data[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 16);
    }
    g.putImageData(img, 0, 0);
    g.lineCap = 'round';
    for (let k = 0; k < 110; k++) {
      const lightStroke = r() < 0.45;
      g.strokeStyle = lightStroke ? `rgba(255,240,215,${(0.018 + r() * 0.026).toFixed(3)})` : `rgba(0,0,12,${(0.03 + r() * 0.05).toFixed(3)})`;
      g.lineWidth = 1 + r() * 3.2;
      const x = r() * N, y = r() * N, a = -0.35 + r() * 0.25, l = 6 + r() * 20;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + Math.cos(a) * l * 0.5, y + oy + Math.sin(a) * l * 0.5 - 1.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
      }
    }
    grainTile = c.toDataURL();
  } catch { /* no canvas (tests, old browsers): the scene just goes without grain */ }
  return grainTile;
}

/** A row of stops whose colours come from CSS (so each phase of the day repaints them). */
const Stops = ({ list }: { list: [number, string][] }) => <>{list.map(([o, c]) => <stop key={o} offset={o} className={c} />)}</>;

export function Homestead({ heat, chapelHeat = 0, officeHeat = 0, obsHeat = 0, forgeHeat = 0, hearthHeat = 0, world, pose, children }: { heat: number; chapelHeat?: number; officeHeat?: number; obsHeat?: number; forgeHeat?: number; hearthHeat?: number; world?: World; pose: DogPose; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tex] = useState(grain);

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
  const winter = world?.season === 'winter';

  return (
    <div ref={ref} className={`hs-scene${world?.sleeping ? ' sleeping' : ''}`} data-phase={world?.phase ?? 'night'} data-season={world?.season}
      style={{ '--heat': heat, '--wall': world ? daylight(world.phase).wall : 0, '--glow': world ? daylight(world.phase).glow : 1 } as CSSProperties}>
      <svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" className="hs-svg" role="group" aria-label="The homestead">
        <defs>
          {/* ---- the land, coloured by the light of day ---- */}
          <linearGradient id="hs-far2" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-far2-a'], [1, 'st-far2-b']]} /></linearGradient>
          <linearGradient id="hs-far" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-far-a'], [0.55, 'st-far-b'], [1, 'st-haze-solid']]} /></linearGradient>
          <linearGradient id="hs-mid" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-mid-a'], [1, 'st-mid-b']]} /></linearGradient>
          <linearGradient id="hs-near" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-gnd-a'], [0.45, 'st-gnd-m'], [1, 'st-gnd-b']]} /></linearGradient>
          <linearGradient id="hs-haze" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-haze-0'], [0.6, 'st-haze-1'], [1, 'st-haze-0']]} /></linearGradient>
          <radialGradient id="hs-mistblob"><Stops list={[[0, 'st-mist-1'], [0.6, 'st-mist-h'], [1, 'st-mist-0']]} /></radialGradient>
          <linearGradient id="hs-cap" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-cap-a'], [1, 'st-cap-b']]} /></linearGradient>
          <linearGradient id="hs-pine-g" x1="0" y1="0" x2="1" y2="0"><Stops list={[[0, 'st-pine-b'], [0.55, 'st-pine-a'], [1, 'st-pine-lit']]} /></linearGradient>
          <linearGradient id="hs-water" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-water-a'], [1, 'st-water-b']]} /></linearGradient>
          <linearGradient id="hs-fg" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-fg-a'], [1, 'st-fg-b']]} /></linearGradient>
          <linearGradient id="hs-trailg" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-trail-a'], [1, 'st-trail-b']]} /></linearGradient>

          {/* ---- materials: they warm up by day (--wall) and sink into blue at night ---- */}
          <linearGradient id="hs-wood" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-wood-a'], [1, 'st-wood-b']]} /></linearGradient>
          <linearGradient id="hs-roofg" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-roof-a'], [1, 'st-roof-b']]} /></linearGradient>
          <linearGradient id="hs-stone" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-stone-a'], [1, 'st-stone-b']]} /></linearGradient>
          <linearGradient id="hs-white" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-white-a'], [1, 'st-white-b']]} /></linearGradient>
          <linearGradient id="hs-brick" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-brick-a'], [1, 'st-brick-b']]} /></linearGradient>
          <linearGradient id="hs-trim" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-trim-a'], [1, 'st-trim-b']]} /></linearGradient>
          <linearGradient id="hs-dome" x1="0" y1="0" x2="1" y2="0"><Stops list={[[0, 'st-dome-a'], [0.62, 'st-dome-hi'], [1, 'st-dome-b']]} /></linearGradient>
          <linearGradient id="hs-col" x1="0" y1="0" x2="1" y2="0"><Stops list={[[0, 'st-col-a'], [0.4, 'st-col-hi'], [1, 'st-col-b']]} /></linearGradient>
          <radialGradient id="hs-logend" cx=".45" cy=".4"><Stops list={[[0, 'st-end-a'], [0.7, 'st-end-b'], [1, 'st-end-c']]} /></radialGradient>
          <radialGradient id="hs-pebble" cx=".4" cy=".25"><Stops list={[[0, 'st-peb-a'], [1, 'st-peb-b']]} /></radialGradient>
          <pattern id="hs-shingle" width="10" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6 H10 M0 0 V6 M5 -3 V3 M0 3 H10" className="pt-shingle" />
          </pattern>
          <pattern id="hs-bricks" width="12" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6 H12 M0 3 H12 M3 0 V3 M9 3 V6" className="pt-brick" />
          </pattern>
          <pattern id="hs-stones" width="14" height="10" patternUnits="userSpaceOnUse">
            <path d="M1 1 h6 q1 0 1 1 v2 q0 1 -1 1 h-6 z M9 1 h4 v4 h-4 z M4 6 h8 q1 0 1 1 v2 h-9 z M0 6 h3 v3 h-3 z" className="pt-stone" />
          </pattern>
          <pattern id="hs-siding" width="8" height="5" patternUnits="userSpaceOnUse">
            <path d="M0 4.6 H8" className="pt-siding" />
          </pattern>

          {/* ---- light (always lamp-warm) ---- */}
          <radialGradient id="hs-glow">
            <stop offset="0" stopColor="#f7c66e" stopOpacity=".9" />
            <stop offset=".45" stopColor="#e8a84b" stopOpacity=".28" />
            <stop offset="1" stopColor="#e8a84b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hs-pool">
            <stop offset="0" stopColor="#ffcf86" stopOpacity=".55" />
            <stop offset=".4" stopColor="#f0a24e" stopOpacity=".22" />
            <stop offset="1" stopColor="#e8a84b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hs-fire" cx=".5" cy=".7">
            <stop offset="0" stopColor="#fff2b8" stopOpacity="1" />
            <stop offset=".35" stopColor="#ff9c3a" stopOpacity=".85" />
            <stop offset=".75" stopColor="#c2401c" stopOpacity=".35" />
            <stop offset="1" stopColor="#8a2210" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hs-room" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe3a0" />
            <stop offset=".6" stopColor="#f2aa52" />
            <stop offset="1" stopColor="#c8742a" />
          </linearGradient>
          <linearGradient id="hs-stained" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd78a" />
            <stop offset=".35" stopColor="#e7884a" />
            <stop offset=".6" stopColor="#c94a5a" />
            <stop offset="1" stopColor="#5a6ad0" />
          </linearGradient>
          <linearGradient id="hs-shaft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd590" stopOpacity=".34" />
            <stop offset="1" stopColor="#ffd590" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hs-refl-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd590" stopOpacity=".85" />
            <stop offset="1" stopColor="#ffb860" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hs-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff1c8" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff1c8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hs-shadow">
            <stop offset="0" stopColor="#000" stopOpacity=".6" />
            <stop offset=".6" stopColor="#000" stopOpacity=".22" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hs-smoke-g" cx=".5" cy=".6"><Stops list={[[0, 'st-smoke-1'], [1, 'st-smoke-0']]} /></radialGradient>
          <radialGradient id="hs-smoke-warm" cx=".5" cy=".75">
            <stop offset="0" stopColor="#ffc884" stopOpacity=".38" />
            <stop offset="1" stopColor="#c8b8c8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hs-mist" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'st-haze-0'], [0.6, 'st-mist-h'], [1, 'st-haze-0']]} /></linearGradient>
          <pattern id="hs-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="rgba(111,179,242,.12)" strokeWidth=".6" />
          </pattern>
          {tex && (
            <pattern id="hs-grain" width="160" height="160" patternUnits="userSpaceOnUse">
              <image href={tex} width="160" height="160" />
            </pattern>
          )}
          <clipPath id="hs-land"><path d={FAR2_D} /></clipPath>
          <clipPath id="hs-pond-clip"><ellipse cx="300" cy="327" rx="76" ry="12" /></clipPath>

          {/* one pine, stamped everywhere */}
          <g id="hs-pine">
            <ellipse cx="3" cy="4" rx="30" ry="4.5" fill="url(#hs-shadow)" />
            <path d="M-2.6 12 L-2 -4 H2 L2.6 12 Z" fill="#120d0b" />
            <path d={PINE} fill="url(#hs-pine-g)" />
            <path d={PINE_LIT} fill="none" style={{ stroke: 'var(--rim)', strokeOpacity: 'calc(var(--rim-o) * .22)', strokeWidth: 1, strokeLinecap: 'round' }} />
            <path d={PINE_SNOW} style={{ fill: 'var(--cap-a)', opacity: 'var(--pine-snow, 0)' }} />
          </g>
        </defs>

        {/* ================= the far distance: two hazy ranges ================= */}
        <g className="hs-layer" data-depth="1">
          <path d={FAR2_D} fill="url(#hs-far2)" />
          <path d={FAR_D} fill="url(#hs-far)" />
          {/* snow on the high peaks, catching the light on their right faces */}
          <g fill="url(#hs-cap)" className="hs-caps">
            <path d="M230 120 L244 131 L240 136 L234 133 L230 140 L224 134 L218 137 L214 132 Z" />
            <path d="M640 140 L656 152 L650 156 L645 153 L640 160 L634 154 L627 158 L624 152 Z" />
            <path d="M860 150 L875 161 L869 164 L864 161 L858 167 L852 162 L846 164 L845 161 Z" />
            <path d="M60 170 L72 180 L66 183 L60 180 L54 184 L50 179 Z" />
            <path d="M1080 165 L1094 175 L1088 178 L1081 175 L1074 180 L1068 175 Z" />
          </g>
          <path className="hs-peaklit" d="M230 120 L330 200 M640 140 L760 210 M860 150 L980 220 M60 170 L130 205 M1080 165 L1180 220" />
          <rect x="-60" y="170" width="1320" height="110" fill="url(#hs-haze)" />
        </g>

        {/* the lighthouse on the far point: lit at 1,000 hours, a blueprint until then */}
        {world && (
          <g className="hs-layer" data-depth="1">
            <g transform="translate(262 236) scale(.62)" className={world.growth.lighthouse ? 'hs-lh lit' : 'hs-lh plan'} role="img"
              aria-label={world.growth.lighthouse ? 'The lighthouse, lit at 1,000 hours' : `The lighthouse: ${world.growth.hoursToLighthouse} hours to go`}>
              <title>{world.growth.lighthouse ? 'The lighthouse, lit at 1,000 hours' : `The lighthouse lights at 1,000 hours (${world.growth.hoursToLighthouse.toLocaleString('en-US')} to go)`}</title>
              {world.growth.lighthouse && <circle cy="-77" r="40" fill="url(#hs-glow)" className="lh-halo" />}
              <path d="M-12 0 L-8 -70 L8 -70 L12 0 Z" className="lh-tower" />
              <path d="M-8 -52 H8 M-9 -32 H9 M-11 -12 H11" className="lh-band" />
              <rect x="-9" y="-84" width="18" height="14" className="lh-lamp" />
              <path d="M-11 -84 L0 -94 L11 -84 Z" className="lh-tower" />
              {world.growth.lighthouse && <path d="M0 -77 L160 -104 L160 -50 Z" fill="url(#hs-beam)" className="lh-beam" />}
            </g>
          </g>
        )}

        {/* ================= the middle distance ================= */}
        <g className="hs-layer" data-depth="2">
          <path d={MID_D} fill="url(#hs-mid)" />
          <path d={TREELINE} className="hs-treeline" />
          <g className="hs-mistband m1">
            <ellipse cx="160" cy="250" rx="280" ry="16" fill="url(#hs-mistblob)" />
            <ellipse cx="700" cy="246" rx="340" ry="14" fill="url(#hs-mistblob)" />
            <ellipse cx="1120" cy="244" rx="240" ry="15" fill="url(#hs-mistblob)" />
          </g>
        </g>

        {/* ================= the near ground ================= */}
        <g className="hs-layer" data-depth="2">
          <path d={NEAR} fill="url(#hs-near)" />
          <path d={NEAR} className="hs-ground-tint" />
          <path d="M-60 300 C 120 262, 250 250, 380 272 S 640 300, 760 276 S 1000 250, 1260 290" className="hs-groundrim" />
          {winter && (
            <g className="hs-snow" aria-hidden>
              <path d="M-60 300 C 120 262, 250 250, 380 272 S 640 300, 760 276 S 1000 250, 1260 290 L1260 302 C 1000 262, 760 288, 640 310 S 300 262, -60 312 Z" className="hs-drift" />
            </g>
          )}
          {/* the cabin's light thrown across the yard */}
          <ellipse cx="478" cy="314" rx="190" ry="30" fill="url(#hs-pool)" className="hs-pool hs-pool-cabin" />
          <path d="M210 302 C 330 296, 420 312, 560 306 S 800 300, 940 304 S 1080 312, 1150 306" className="hs-trail" />
          {/* the dirt path from the cabin door down toward you, set with stones */}
          <path d="M458 300 C 452 318, 424 330, 412 346 L 394 362 L 456 362 C 466 344, 482 328, 482 300 Z" fill="url(#hs-trailg)" className="hs-path" />
          <g fill="url(#hs-pebble)" className="hs-pebbles">
            {[[466, 306, 4, 1.6], [458, 316, 5, 2], [470, 322, 4.4, 1.8], [446, 330, 5.6, 2.2], [460, 338, 5, 2], [432, 344, 6.4, 2.4], [448, 352, 6, 2.3], [420, 356, 6.8, 2.6]].map(([x, y, rx, ry]) => (
              <ellipse key={`${x}${y}`} cx={x} cy={y} rx={rx} ry={ry} />
            ))}
          </g>

          {/* a small pond holding the sky and the lit windows */}
          <ellipse cx="300" cy="328" rx="80" ry="13.5" className="hs-pond-bank" />
          <g clipPath="url(#hs-pond-clip)">
            <rect x="220" y="314" width="160" height="26" fill="url(#hs-water)" />
            {/* upside-down silhouettes of the forge and the near pines */}
            <path d="M300 316 L300 330 L316 324 L332 330 L332 316 Z" className="hs-refl-dark" />
            <path d="M262 316 L266 334 L270 316 Z M354 316 L358 336 L362 316 Z" className="hs-refl-dark" />
            <g className="hs-refl">
              <path d="M314 316 h5 l-1 4 h-3 z M313.5 322 h6 M314 326 h5 M315 330 h3" />
              <path d="M352 315 h14 l-2 5 h-10 z M351 323 h15 M353 327 h11 M355 331 h7 M357 335 h3" className="far" />
            </g>
            <g className="hs-shimmer"><path d="M248 324h22M284 328h30M318 322h14M262 332h16M330 334h22M240 330h10" /></g>
            <ellipse cx="338" cy="321" rx="9" ry="1.6" className="hs-moonglint" />
          </g>
          <path d="M222 327 C 240 338, 360 341, 378 327" className="hs-pond-lip" />
          {winter && <ellipse cx="300" cy="327" rx="76" ry="12" className="hs-ice" aria-hidden />}
          {/* rocks, softly lit from above */}
          <g className="hs-rocks">
            {[[236, 316, 10, 6], [374, 320, 7, 4.5], [696, 313, 11, 6.5], [964, 317, 8, 5], [180, 330, 6, 4], [1080, 328, 9, 5]].map(([x, y, w, h]) => (
              <g key={x}>
                <ellipse cx={x + 2} cy={y + 1} rx={w * 1.2} ry={2.4} fill="url(#hs-shadow)" />
                <path d={`M${x - w} ${y} Q${x - w * 0.8} ${y - h} ${x} ${y - h} Q${x + w * 0.9} ${y - h * 0.9} ${x + w} ${y} Z`} fill="url(#hs-pebble)" />
              </g>
            ))}
          </g>
          <path d={TUFTS.dark} className="hs-tufts" />
          <path d={TUFTS.lit} className="hs-tufts-lit" />
        </g>

        {/* the newer buildings, smaller, up on the far ridge */}
        <g className="hs-layer" data-depth="2">
          {world?.life?.greenhouse && (
            <g transform="translate(700 262) scale(.58)" className="hs-greenhouse" role="link" tabIndex={0} aria-label="The greenhouse: 30 days of looking after the body" onClick={() => go('/forge')}>
              <title>The greenhouse · raised by 30 days of looking after the body</title>
              <ellipse cx="0" cy="2" rx="70" ry="9" fill="url(#hs-shadow)" />
              <circle cx="0" cy="-26" r="58" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <rect x="-50" y="-8" width="100" height="8" fill="url(#hs-stone)" />
              <path d="M-46 -6 V-34 A46 30 0 0 1 46 -34 V-6 Z" className="gh-glass" />
              {[-34, -18, -2, 14, 30].map((x, i) => <circle key={x} cx={x} cy={-14 - (i % 2) * 7} r={6 + (i % 3)} className="gh-leaf" />)}
              <path d="M-46 -34 A46 30 0 0 1 46 -34 M-23 -6 V-58 M0 -6 V-64 M23 -6 V-58 M-46 -20 H46" className="gh-frame" />
              <path d="M-30 -52 A40 24 0 0 1 10 -63" className="gh-shine" />
            </g>
          )}
          {world?.life?.guesthouse && (
            <g transform="translate(968 258) scale(.5)" className="hs-guest" role="link" tabIndex={0} aria-label="The guesthouse: 20 hours of time together" onClick={() => go('/hearth')}>
              <title>The guesthouse · raised by 20 hours at the hearth</title>
              <ellipse cx="0" cy="2" rx="60" ry="8" fill="url(#hs-shadow)" />
              <circle cx="0" cy="-30" r="60" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <path d="M-40 0 V-40 L0 -66 L40 -40 V0 Z" fill="url(#hs-white)" className="hs-guestwall" />
              <path d="M-40 0 V-40 L0 -66 L40 -40 V0 Z" fill="url(#hs-siding)" />
              <path d="M-46 -38 L0 -72 L46 -38" className="hs-guestroof" />
              <rect x="-26" y="-32" width="18" height="16" fill="url(#hs-room)" className="hs-guestwin" /><rect x="8" y="-32" width="18" height="16" fill="url(#hs-room)" className="hs-guestwin" />
              <rect x="-7" y="-22" width="14" height="22" className="hs-guestdoor" />
            </g>
          )}
          {/* the forge: a stone smithy, its fire open to the yard */}
          <g transform="translate(330 262) scale(.62)">
            <Building dust={world?.dust?.forge} area={area('forge')} x={0} y={0} heat={forgeHeat}>
              <ellipse cx="0" cy="3" rx="80" ry="9" fill="url(#hs-shadow)" className="hs-shadow" />
              <ellipse cx="-4" cy="12" rx="90" ry="20" fill="url(#hs-pool)" className="hs-pool hs-pool-fire" />
              <circle cx="0" cy="-30" r="70" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <rect x="24" y="-96" width="14" height="40" className="hs-wall m-stone" />
              <rect x="24" y="-96" width="14" height="40" fill="url(#hs-stones)" className="hs-detail" />
              <rect x="22" y="-100" width="18" height="5" className="hs-detail m-stonecap" />
              <path d="M-46 0 V-50 L0 -78 L46 -50 V0 Z" className="hs-wall m-stone" />
              <path d="M-46 0 V-50 L0 -78 L46 -50 V0 Z" fill="url(#hs-stones)" className="hs-detail" />
              <path d="M-54 -46 L0 -82 L54 -46" className="hs-roofline" />
              <path d="M0 -82 L54 -46" className="hs-rim" />
              {/* the open bay with the fire in it */}
              <path d="M-20 0 V-30 Q0 -44 20 -30 V0 Z" className="hs-win hs-forgebay" />
              <ellipse cx="0" cy="-8" rx="18" ry="14" fill="url(#hs-fire)" className="hs-fire" />
              <path d="M-20 0 V-30 Q0 -44 20 -30 V0" className="hs-arch hs-detail" />
              {/* the anvil out front, glowing on its face */}
              <g transform="translate(-34 0)" className="hs-anvil hs-detail">
                <path d="M-4 0 L-2 -6 H6 L8 0 Z M-12 -6 Q-12 -11 -4 -11 H14 L12 -8 H6 V-6 H-2 V-8 Z" />
                <path d="M-11 -10.4 H13" className="anvil-hot" />
              </g>
              <g className="hs-embers sparks">
                <circle cx="31" cy="-100" r="1.4" /><circle cx="33" cy="-100" r="1.1" /><circle cx="29" cy="-100" r="1.2" />
              </g>
            </Building>
          </g>
          {/* the hearth: a low cottage with a big chimney and flower boxes */}
          <g transform="translate(882 262) scale(.62)">
            <Building dust={world?.dust?.hearth} area={area('hearth')} x={0} y={0} heat={hearthHeat}>
              <ellipse cx="0" cy="3" rx="82" ry="9" fill="url(#hs-shadow)" className="hs-shadow" />
              <ellipse cx="0" cy="14" rx="96" ry="20" fill="url(#hs-pool)" className="hs-pool" />
              <circle cx="0" cy="-34" r="66" fill="url(#hs-glow)" className="hs-cabin-glow" />
              <rect x="-40" y="-92" width="16" height="44" className="hs-wall m-stone" />
              <rect x="-40" y="-92" width="16" height="44" fill="url(#hs-stones)" className="hs-detail" />
              <path d="M-50 0 V-48 L0 -84 L50 -48 V0 Z" className="hs-wall m-white" />
              <path d="M-50 0 V-48 L0 -84 L50 -48 V0 Z" fill="url(#hs-siding)" className="hs-detail" />
              <path d="M-58 -44 L0 -90 L58 -44 L52 -44 L0 -84 L-52 -44 Z" className="hs-wall hs-roof m-roof" />
              <path d="M0 -90 L58 -44" className="hs-rim" />
              <circle cx="0" cy="-60" r="6" className="hs-win" />
              <rect x="-36" y="-40" width="22" height="20" className="hs-win" />
              <rect x="14" y="-40" width="22" height="20" className="hs-win" />
              <path d="M-25 -40 V-20 M-36 -30 H-14 M25 -40 V-20 M14 -30 H36" className="hs-mullion hs-detail" />
              <g className="hs-detail hs-flowerbox">
                <rect x="-38" y="-20" width="26" height="5" /><rect x="12" y="-20" width="26" height="5" />
                {[-34, -28, -22, -16, 16, 22, 28, 34].map((x, i) => <circle key={x} cx={x} cy="-21" r="2" className={`fb${i % 3}`} />)}
              </g>
              <rect x="-9" y="-28" width="18" height="28" className="hs-door" />
              <rect x="-6" y="-25" width="12" height="10" className="hs-win hs-doorlite" />
              <g className="hs-smoke small">
                <circle cx="-32" cy="-98" r="5" /><circle cx="-28" cy="-112" r="7" /><circle cx="-34" cy="-128" r="9" />
              </g>
            </Building>
          </g>
          {/* the ledger house: columns and a pediment */}
          <g transform="translate(1160 250) scale(.55)">
            <Building area={area('bank')} x={0} y={0} heat={0.6}>
              <ellipse cx="0" cy="3" rx="90" ry="9" fill="url(#hs-shadow)" className="hs-shadow" />
              <rect x="-52" y="-66" width="104" height="58" className="hs-wall m-white" />
              <rect x="-20" y="-44" width="40" height="36" className="hs-win hs-bankdoor" />
              <path d="M-56 -70 L0 -98 L56 -70 Z" className="hs-wall hs-roof m-white" />
              <path d="M-42 -74 L0 -94 L42 -74 Z" className="hs-detail hs-tympanum" />
              <path d="M0 -98 L56 -70" className="hs-rim" />
              <rect x="-60" y="-72" width="120" height="6" className="hs-wall m-white" />
              {[-40, -14, 12, 38].map((x) => <rect key={x} x={x - 5} y={-66} width="10" height="58" className="hs-wall m-col" />)}
              <rect x="-60" y="-8" width="120" height="4" className="hs-wall m-white" />
              <rect x="-66" y="-4" width="132" height="4" className="hs-wall m-white" />
            </Building>
          </g>
        </g>

        {/* far mist drifting between the ridge and the yard */}
        <g className="hs-layer" data-depth="2">
          <g className="hs-mistband m2">
            <ellipse cx="80" cy="282" rx="260" ry="12" fill="url(#hs-mistblob)" />
            <ellipse cx="640" cy="286" rx="300" ry="10" fill="url(#hs-mistblob)" />
            <ellipse cx="1140" cy="278" rx="260" ry="12" fill="url(#hs-mistblob)" />
          </g>
        </g>

        {/* ================= the homestead ================= */}
        <g className="hs-layer" data-depth="3">
          {/* the observatory: stone drum, a silver dome with its slit open to the stars */}
          <Building dust={world?.dust?.observatory} area={area('observatory')} x={150} y={272} heat={obsHeat}>
            <ellipse cx="4" cy="3" rx="70" ry="9" fill="url(#hs-shadow)" className="hs-shadow" />
            <ellipse cx="0" cy="12" rx="90" ry="18" fill="url(#hs-pool)" className="hs-pool" />
            <circle cx="0" cy="-44" r="76" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <rect x="-38" y="-46" width="76" height="46" className="hs-wall m-stone" />
            <rect x="-38" y="-46" width="76" height="46" fill="url(#hs-stones)" className="hs-detail" />
            <rect x="-42" y="-50" width="84" height="6" rx="2" className="hs-detail m-stonecap" />
            <path d="M-44 -46 A44 44 0 0 1 44 -46 Z" className="hs-wall hs-dome m-dome" />
            <path d="M-30 -46 A30 44 0 0 1 0 -90 M30 -46 A30 44 0 0 0 0 -90 M-12 -46 A12 44 0 0 1 0 -90 M12 -46 A12 44 0 0 0 0 -90" className="hs-ribs hs-detail" />
            <path d="M14 -86 A44 44 0 0 1 42 -56" className="hs-rim" />
            <g transform="rotate(18 0 -46)">
              <rect x="-6" y="-88" width="12" height="42" className="hs-slit" />
              <g className="hs-detail hs-slitstars"><circle cx="-2" cy="-80" r=".9" /><circle cx="2" cy="-70" r=".7" /><circle cx="-1" cy="-60" r=".8" /></g>
            </g>
            <g className="hs-scopeg">
              <line x1="4" y1="-70" x2="40" y2="-104" className="hs-scope" />
              <line x1="34" y1="-98" x2="44" y2="-108" className="hs-scope-end hs-detail" />
              <circle cx="44" cy="-108" r="2.2" className="hs-scope-lens hs-detail" />
            </g>
            <rect x="-30" y="-36" width="10" height="12" rx="5" className="hs-win" />
            <rect x="20" y="-36" width="10" height="12" rx="5" className="hs-win" />
            <path d="M-10 0 V-26 A10 6 0 0 1 10 -26 V0 Z" className="hs-door" />
          </Building>

          {/* the writer's cabin */}
          <Building dust={world?.dust?.cabin} area={area('cabin')} x={470} y={300}>
            <ellipse cx="6" cy="3" rx="130" ry="10" fill="url(#hs-shadow)" className="hs-shadow" />
            <circle cx="0" cy="-60" r="130" fill="url(#hs-glow)" className="hs-cabin-glow" />
            {/* window light lying on the ground */}
            <ellipse cx="-46" cy="12" rx="40" ry="9" fill="url(#hs-pool)" className="hs-spill" /><ellipse cx="46" cy="12" rx="40" ry="9" fill="url(#hs-pool)" className="hs-spill" />
            <ellipse cx="0" cy="16" rx="34" ry="12" fill="url(#hs-pool)" className="hs-spill" />
            {/* stone chimney */}
            <rect x="32" y="-130" width="22" height="50" className="hs-wall m-stone" />
            <rect x="32" y="-130" width="22" height="50" fill="url(#hs-stones)" className="hs-detail" />
            <rect x="30" y="-134" width="26" height="6" className="hs-detail m-stonecap" />
            <path d="M54 -128 V-96" className="hs-rim" />
            {/* the gable, shingled, with a lit attic window */}
            <path d="M-88 -76 L0 -134 L88 -76 Z" className="hs-wall hs-roof-in m-wood" />
            <path d="M-88 -76 L0 -134 L88 -76 Z" fill="url(#hs-siding)" className="hs-detail" />
            <circle cx="0" cy="-100" r="8" className="hs-win hs-attic" />
            <path d="M-8 -100 H8 M0 -108 V-92" className="hs-mullion hs-detail" />
            <path d="M-96 -76 L0 -142 L96 -76 L88 -76 L0 -134 L-88 -76 Z" className="hs-wall hs-roof m-roof" />
            <path d="M-96 -76 L0 -142 L96 -76 L88 -76 L0 -134 L-88 -76 Z" fill="url(#hs-shingle)" className="hs-detail" />
            <path d="M0 -142 L96 -76" className="hs-rim" />
            <path d="M-96 -76 L0 -142" className="hs-rim soft" />
            {/* log walls */}
            <rect x="-80" y="-80" width="160" height="80" className="hs-wall hs-logs m-wood" />
            {[-70, -60, -50, -40, -30, -20, -10].map((y) => (
              <g key={y} className="hs-detail"><line x1="-80" x2="80" y1={y} y2={y} className="hs-log" /><line x1="-80" x2="80" y1={y + 1.6} y2={y + 1.6} className="hs-log-hi" /></g>
            ))}
            {[-84, 84].map((x) => [-75, -65, -55, -45, -35, -25, -15, -5].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="4.6" fill="url(#hs-logend)" className="hs-logend hs-detail" />))}
            <path d="M80 -80 V0" className="hs-rim soft" />
            {/* windows with the room inside: desk lamp and a chair back */}
            {[-62, 28].map((x) => (
              <g key={x} className="hs-window">
                <rect x={x - 4} y="-66" width="42" height="38" fill="url(#hs-glow)" className="hs-win-halo" />
                <rect x={x - 3} y="-65" width="40" height="36" className="hs-detail hs-frame" />
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
                <rect x={x - 4} y="-33" width="42" height="5" className="hs-sill" />
                <path d={`M${x - 10} -64 h7 v32 h-7 z M${x + 37} -64 h7 v32 h-7 z`} className="hs-shutter hs-detail" />
              </g>
            ))}
            {/* porch: deck, posts, railing and its own little roof */}
            <rect x="-62" y="-6" width="124" height="6" className="hs-wall m-trim hs-deck" />
            <g className="hs-detail hs-rail">
              <path d="M-60 -24 H-28 M28 -24 H60 M-60 -6 V-24 M60 -6 V-24" />
              {[-56, -51, -46, -41, -36, -31, 31, 36, 41, 46, 51, 56].map((x) => <line key={x} x1={x} x2={x} y1="-23" y2="-6" />)}
            </g>
            <path d="M-38 -48 L0 -68 L38 -48 L34 -48 L0 -63 L-34 -48 Z" className="hs-wall hs-roof m-roof" />
            <path d="M-34 -48 L0 -63 L34 -48 Z" className="hs-wall m-wood" />
            <path d="M0 -68 L38 -48" className="hs-rim" />
            <rect x="-30" y="-48" width="4" height="42" className="hs-post m-trim" />
            <rect x="26" y="-48" width="4" height="42" className="hs-post m-trim" />
            {/* the door stands ajar, lamplight in the gap */}
            <rect x="-14" y="-44" width="28" height="38" className="hs-door hs-door-lit" />
            <path d="M-14 -44 H6 L4 -6 H-14 Z" className="hs-doorleaf" />
            <rect x="-40" y="-2" width="80" height="5" className="hs-step" />
            {/* porch lantern */}
            <g className="hs-lantern" transform="translate(20 -40)">
              <circle r="26" fill="url(#hs-glow)" className="hs-lantern-glow" />
              <path d="M0 -10 V-6" className="hs-lantern-hook" />
              <path d="M-3 -6 H3 L4 4 H-4 Z" />
            </g>
            {/* woodpile, end grain out */}
            <g transform="translate(-122 0)" className="hs-woodpile">
              <ellipse cx="12" cy="1" rx="22" ry="3" fill="url(#hs-shadow)" />
              {[0, 1, 2].map((r) => [0, 1, 2, 3].slice(0, 4 - r).map((c) => <circle key={`${r}${c}`} cx={c * 9 + r * 4.5} cy={-5 - r * 8} r="4.4" fill="url(#hs-logend)" />))}
              <circle cx="38" cy="-4" r="4" className="hs-stump" /><path d="M34 -10 L46 -22" className="hs-axe" />
            </g>
            <g className="hs-smoke">
              <circle cx="43" cy="-138" r="6" className="warm" /><circle cx="49" cy="-152" r="8" className="warm" /><circle cx="41" cy="-170" r="10" /><circle cx="52" cy="-188" r="12" /><circle cx="44" cy="-208" r="13" />
            </g>
            <g className="hs-embers">
              <circle cx="43" cy="-134" r="1.4" /><circle cx="46" cy="-134" r="1.1" /><circle cx="40" cy="-134" r="1.2" />
            </g>
          </Building>

          {/* the chapel: whitewashed boards, a belfry and stained glass */}
          <Building dust={world?.dust?.chapel} area={area('chapel')} x={790} y={292} heat={chapelHeat}>
            <ellipse cx="6" cy="3" rx="74" ry="9" fill="url(#hs-shadow)" className="hs-shadow" />
            <ellipse cx="0" cy="14" rx="96" ry="20" fill="url(#hs-pool)" className="hs-pool" />
            <circle cx="0" cy="-70" r="94" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <ellipse cx="-24" cy="10" rx="22" ry="6" fill="url(#hs-pool)" className="hs-spill tint" /><ellipse cx="24" cy="10" rx="22" ry="6" fill="url(#hs-pool)" className="hs-spill tint" />
            <rect x="-12" y="-150" width="24" height="56" className="hs-wall m-white" />
            <rect x="-12" y="-150" width="24" height="56" fill="url(#hs-siding)" className="hs-detail" />
            <path d="M12 -150 V-96" className="hs-rim soft" />
            <path d="M-7 -122 V-138 A7 7 0 0 1 7 -138 V-122 Z" className="hs-belfry hs-detail" />
            <path d="M-6 -126 V-138 A6 6 0 0 1 6 -138 V-126 Z" className="hs-win" />
            <path d="M-16 -148 L0 -172 L16 -148 Z" className="hs-wall hs-roof m-roof" />
            <path d="M0 -172 L16 -148" className="hs-rim" />
            <path d="M0 -196 V-172 M-8 -188 H8" className="hs-cross" />
            <rect x="-40" y="-70" width="80" height="70" className="hs-wall m-white" />
            <rect x="-40" y="-70" width="80" height="70" fill="url(#hs-siding)" className="hs-detail" />
            <path d="M40 -70 V0" className="hs-rim soft" />
            <path d="M-48 -68 L0 -104 L48 -68 Z" className="hs-wall hs-roof m-roof" />
            <path d="M-48 -68 L0 -104 L48 -68 Z" fill="url(#hs-shingle)" className="hs-detail" />
            <path d="M0 -104 L48 -68" className="hs-rim" />
            {/* tall lancet windows of stained glass, and a rose above the door */}
            {[-28, 18].map((x) => (
              <g key={x}>
                <path d={`M${x} -12 V-42 Q${x + 5} -54 ${x + 10} -42 V-12 Z`} className="hs-win hs-stained" />
                <path d={`M${x + 5} -12 V-48 M${x} -28 H${x + 10}`} className="hs-lead hs-detail" />
              </g>
            ))}
            <circle cx="0" cy="-52" r="7" className="hs-win hs-stained" />
            <path d="M-7 -52 H7 M0 -59 V-45 M-5 -57 L5 -47 M5 -57 L-5 -47" className="hs-lead hs-detail" />
            <path d="M-12 0 V-30 A12 12 0 0 1 12 -30 V0 Z" className="hs-door" />
            <path d="M0 0 V-42" className="hs-lead hs-detail" />
            <rect x="-16" y="-2" width="32" height="4" className="hs-step" />
            {world?.life?.bell && <g className="hs-bell" transform="translate(0 -136)"><title>The bell · rung by 30 days in the Chapel</title><path d="M-5 6 Q-5 -4 0 -5 Q5 -4 5 6 Z" /><circle cy="7.5" r="1.4" /></g>}
          </Building>

          {/* the office: a brick block with a cornice, a water tower and a streetlamp */}
          <Building dust={world?.dust?.office} area={area('office')} x={1050} y={282} heat={officeHeat}>
            <ellipse cx="8" cy="3" rx="92" ry="10" fill="url(#hs-shadow)" className="hs-shadow" />
            <ellipse cx="0" cy="14" rx="110" ry="20" fill="url(#hs-pool)" className="hs-pool" />
            <circle cx="0" cy="-60" r="100" fill="url(#hs-glow)" className="hs-cabin-glow" />
            <g className="hs-detail hs-tank">
              <path d="M-40 -126 L-42 -138 M-24 -126 L-22 -138 M-41 -132 H-23" />
              <path d="M-44 -138 V-156 Q-32 -160 -20 -156 V-138 Z" className="m-wood" />
              <path d="M-46 -156 L-32 -166 L-18 -156 Z" className="m-roof" />
            </g>
            <rect x="-58" y="-112" width="116" height="112" className="hs-wall m-brick" />
            <rect x="-58" y="-112" width="116" height="112" fill="url(#hs-bricks)" className="hs-detail" />
            <path d="M58 -112 V0" className="hs-rim soft" />
            <path d="M-66 -110 H66 L56 -126 H-56 Z" className="hs-wall hs-roof m-stone" />
            <path d="M-56 -126 H56 L66 -110" className="hs-rim" />
            <path d="M-58 -78 H58 M-58 -48 H58" className="hs-band hs-detail" />
            {[-96, -66, -36].map((y) => [-42, -14, 14].map((x) => (
              <g key={`${x}${y}`}>
                <rect x={x - 2} y={y - 2} width="24" height="22" className="hs-detail hs-frame" />
                <rect x={x} y={y} width="20" height="18" className="hs-win" />
                <path d={`M${x} ${y + 5} H${x + 20} M${x + 10} ${y} V${y + 18}`} className="hs-blind hs-detail" />
              </g>
            )))}
            <rect x="34" y="-36" width="16" height="36" className="hs-door" />
            <rect x="36" y="-34" width="12" height="10" className="hs-win hs-doorlite" />
            <path d="M30 -40 H54 L52 -44 H32 Z" className="hs-detail m-roof" />
            {/* streetlamp */}
            <g transform="translate(-74 0)" className="hs-streetlamp">
              <circle cy="-46" r="26" fill="url(#hs-glow)" className="hs-lantern-glow" />
              <path d="M0 0 V-42 M-4 0 H4" className="lamp-post" />
              <path d="M-4 -42 H4 L3 -50 H-3 Z" className="lamp-head" />
            </g>
          </Building>

          {world?.life?.doghouse && (
            <g transform="translate(676 308) scale(.7)" className="hs-doghouse" role="link" tabIndex={0} aria-label="The doghouse: Cooper and Shadow's kennel" onClick={() => go('/kennel')}>
              <title>The kennel · Cooper and Shadow</title>
              <ellipse cx="2" cy="2" rx="34" ry="5" fill="url(#hs-shadow)" />
              <path d="M-22 0 V-22 L0 -40 L22 -22 V0 Z" fill="url(#hs-wood)" className="dh-wall" />
              <path d="M-22 0 V-22 L0 -40 L22 -22 V0 Z" fill="url(#hs-siding)" />
              <path d="M-26 -20 L0 -44 L26 -20" className="dh-roof" fill="none" />
              <path d="M0 -44 L26 -20" className="hs-rim" />
              <path d="M-8 0 V-10 A8 8 0 0 1 8 -10 V0 Z" className="dh-door" />
              <rect x="-11" y="-32" width="22" height="7" rx="2" className="dh-sign" /><text y="-26.6" textAnchor="middle" className="dh-name">C · S</text>
              <path d="M10 0 q4 -3 8 0" className="dh-bowl" />
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
                <text x="0" y="3">{`★ ${world.newBook.length > 34 ? `${world.newBook.slice(0, 33)}…` : world.newBook}`}</text>
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

        {/* ================= the foreground, closest to you ================= */}
        <g className="hs-layer hs-fore" data-depth="4" aria-hidden>
          <ellipse className="hs-mistband m3" cx="760" cy="330" rx="420" ry="9" fill="url(#hs-mistblob)" />
          <path d="M-60 362 L-60 318 C -20 314, 30 322, 70 334 C 110 344, 150 350, 190 362 Z" fill="url(#hs-fg)" />
          <path d="M1260 362 L1260 316 C 1210 314, 1150 324, 1100 338 C 1060 348, 1020 354, 990 362 Z" fill="url(#hs-fg)" />
          <path className="hs-fg-blades" d="M-20 326 q4 -16 2 -28 q3 12 4 28 z M6 330 q8 -18 14 -24 q-6 10 -8 25 z M30 334 q-2 -14 -10 -22 q12 8 14 22 z M54 340 q4 -12 12 -18 q-6 8 -6 19 z M1128 334 q-4 -16 -12 -24 q12 8 16 24 z M1156 328 q2 -16 -2 -30 q8 12 8 30 z M1184 324 q6 -14 14 -20 q-8 8 -9 21 z M1214 322 q-2 -14 -8 -22 q10 8 12 22 z M1080 344 q4 -10 10 -14 q-4 6 -4 15 z" />
          <path className="hs-fg-rim" d="M-60 318 C -20 314, 30 322, 70 334 C 110 344, 150 350, 190 362 M1260 316 C 1210 314, 1150 324, 1100 338 C 1060 348, 1020 354, 990 362" />
        </g>

        {/* canvas grain over the whole painting */}
        {tex && <rect x="0" y="0" width="1200" height="360" fill="url(#hs-grain)" clipPath="url(#hs-land)" className="hs-grain" />}
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
      {/* one group carries the hover glow and the dust, so it's one filter, not one per shape */}
      <g className="hs-body">{children}</g>
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
      {g.flowers > 0 && <ellipse cx={392 + g.flowers * 3.5} cy="321" rx={g.flowers * 4.5 + 8} ry="4" className="hs-bed" />}
      {Array.from({ length: g.flowers }, (_, i) => {
        const x = 392 + i * 7 + (i % 2) * 3;
        const y = 318 + (i % 3) * 3;
        return (
          <g key={`f${i}`} className="flower" style={{ animationDelay: `${-i * 0.4}s` }}>
            <path d={`M${x} ${y} v-9`} className="stem" />
            <path d={`M${x} ${y - 4} q-4 -1 -5 -4 q4 0 5 3`} className="leaf" />
            <circle cx={x} cy={y - 10} r="3" fill={colors[i % colors.length]} />
            <circle cx={x - 0.8} cy={y - 10.8} r="1.1" className="petal-hi" />
          </g>
        );
      })}
      {Array.from({ length: g.saplings }, (_, i) => (
        <use key={`s${i}`} href="#hs-pine" transform={`translate(${410 + i * 9 - (i % 2) * 14} ${332 + i * 2.4}) scale(${0.18 + i * 0.012})`} className="sapling" />
      ))}
      {g.publishingHouse && (
        <g transform="translate(640 268) scale(.5)" className="pubhouse">
          <title>The publishing house: an offer came in</title>
          <ellipse cx="0" cy="3" rx="90" ry="10" fill="url(#hs-shadow)" />
          <circle cx="0" cy="-60" r="110" fill="url(#hs-glow)" className="ph-glow" />
          <rect x="-60" y="-90" width="120" height="90" className="ph-wall" />
          <path d="M-70 -88 L0 -126 L70 -88 Z" className="ph-wall" />
          {[-40, -12, 16, 44].map((x) => <rect key={x} x={x - 8} y={-70} width="16" height="22" className="ph-win" />)}
          <rect x="-12" y="-36" width="24" height="36" className="ph-win" />
        </g>
      )}
    </g>
  );
}

/** Pines around the buildings, deterministic so the scene never reshuffles. */
function Pines() {
  const spots: [number, number, number][] = [
    [40, 300, 1.1], [78, 296, 0.8], [262, 290, 1.25], [300, 296, 0.9], [352, 300, 0.7], [604, 304, 1.15], [646, 300, 0.85],
    [700, 300, 1.0], [958, 292, 1.05], [975, 296, 0.75], [1150, 292, 1.05], [1186, 296, 0.75],
  ];
  return (
    <g className="hs-pines">
      {spots.map(([x, y, s]) => <use key={x} href="#hs-pine" transform={`translate(${x} ${y}) scale(${s})`} />)}
    </g>
  );
}

/* ---------------- the seasons, and the days that call for dressing up ---------------- */

/** Points along a line, for strings of lights and rows of icicles. */
const along = (x1: number, y1: number, x2: number, y2: number, n: number) =>
  Array.from({ length: n }, (_, i) => [x1 + ((x2 - x1) * i) / (n - 1), y1 + ((y2 - y1) * i) / (n - 1)] as const);
const BULBS = ['#ff6b5e', '#ffd27a', '#7fd3ff', '#9ff0a8', '#ff9ad5'];

/** A broadleaf tree: a forked trunk and a crown of overlapping clumps, lit on the upper right. */
function Tree({ x, y, s = 1, kind }: { x: number; y: number; s?: number; kind: 'blossom' | 'summer' | 'autumn' }) {
  const fill = kind === 'blossom' ? ['#c98aa0', '#f2bccb', '#a8687e', '#ffe0e8'] : kind === 'summer' ? ['#244f36', '#3a7a4e', '#1a3a28', '#6aa86e'] : ['#a8461f', '#e08a34', '#7a2e18', '#ffc060'];
  const clumps: [number, number, number, number][] = [[-12, -38, 12, 2], [12, -34, 11, 2], [0, -30, 12, 2], [-14, -48, 11, 0], [10, -50, 12, 0], [-2, -56, 12, 1], [2, -44, 13, 1]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={`hs-tree t-${kind}`}>
      <ellipse cx="4" cy="1" rx="26" ry="3.5" fill="url(#hs-shadow)" />
      <path d="M-3 0 Q-1 -14 -3 -26 L-12 -36 M-3 -26 L3 -40 M-1 -14 L9 -24" className="hs-trunk" />
      {clumps.map(([cx, cy, r, f], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={fill[f]} />)}
      {/* the lit side of the crown */}
      <path d="M2 -66 A13 13 0 0 1 14 -58 M18 -48 A12 12 0 0 1 22 -38 M20 -30 A10 10 0 0 1 18 -24" className="tree-lit" style={{ stroke: fill[3] }} />
      {kind === 'blossom' && [[-16, -46], [8, -54], [16, -40], [-6, -38], [2, -30], [-10, -56], [14, -30], [-18, -34]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="1.7" fill="#fff4f7" />)}
      {kind === 'autumn' && [[-22, -18], [20, -12], [-8, -8], [26, -4]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="1.4" fill={fill[1]} className="falling" style={{ animationDelay: `${-i * 1.7}s` }} />)}
    </g>
  );
}

function Pumpkin({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className={lit ? 'hs-pumpkin lit' : 'hs-pumpkin'}>
      <ellipse cx="1" cy="0" rx="10" ry="2" fill="url(#hs-shadow)" />
      {lit && <circle r="18" cy="-6" fill="url(#hs-glow)" className="hs-lantern-glow" />}
      <ellipse rx="8" ry="6" cy="-6" fill="#b8561a" /><ellipse rx="5" ry="6" cy="-6" fill="#d9701f" /><ellipse rx="2.4" ry="5.6" cy="-6" fill="#e8862c" />
      <path d="M-5 -10 q2 -1 3 0" stroke="rgba(255,220,160,.5)" strokeWidth=".8" fill="none" />
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
          <path d="M372 226 L470 156 L568 226 L562 229 Q540 222 530 228 Q510 214 490 220 L470 165 L450 220 Q430 214 410 228 Q396 222 378 229 Z" />
          <path d="M430 254 L470 230 L510 254 L505 256 L470 236 L435 256 Z" />
          <rect x="30" y="-134" width="26" height="5" rx="2.5" transform="translate(470 300)" />
          <path d="M740 226 L790 186 L840 226 L835 228 L790 193 L745 228 Z" />
          <path d="M772 146 L790 118 L808 146 L804 147 L790 124 L776 147 Z" />
          <rect x="986" y="153" width="128" height="5" rx="2.5" />
          <path d="M106 226 A44 44 0 0 1 194 226 L188 226 A38 32 0 0 0 112 226 Z" />
          {/* the forge and the hearth, up on the ridge */}
          <path d="M296 233 L330 211 L364 233 L360 234 L330 215 L300 234 Z" />
          <path d="M846 236 L882 206 L918 236 L914 237 L882 211 L850 237 Z" />
          {/* icicles on the cabin eaves */}
          {along(382, 226, 558, 226, 14).map(([x, y], i) => <path key={i} d={`M${x - 2} ${y} L${x} ${y + 5 + (i % 3) * 3} L${x + 2} ${y} Z`} className="hs-icicle" />)}
          {/* drifts against the cabin and the chapel */}
          <path d="M392 302 Q420 292 452 300 Z M488 300 Q520 290 556 302 Z M752 294 Q770 286 784 292 Z M796 292 Q812 285 830 294 Z" />
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
            <circle cy="-24" r="40" fill="url(#hs-glow)" className="hs-lantern-glow" />
            <ellipse cx="2" cy="1" rx="22" ry="3" fill="url(#hs-shadow)" />
            <path d="M0 -52 L16 -22 L8 -22 L20 0 L-20 0 L-8 -22 L-16 -22 Z" fill="#1f4a32" />
            <path d="M0 -52 L16 -22 L8 -22 L20 0" fill="none" stroke="#3f7a52" strokeWidth="1.2" />
            {[[-8, -10], [6, -14], [-3, -24], [9, -4], [-12, -3], [2, -34]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="1.8" fill={BULBS[i % BULBS.length]} className="bulb" style={{ animationDelay: `${i * 0.25}s` }} />)}
            <path d="M0 -60 l2 4 l4 0.5 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -0.5 z" fill="#ffd27a" className="star" />
          </g>
        </g>
      )}
    </g>
  );
}
