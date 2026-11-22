import { useState, type CSSProperties, type ReactNode } from 'react';
import { skyPhase, type Phase } from '../../core/skyLogic';
import { daylight } from '../../shell/worldLogic';
import type { AreaKey } from './types';
import '../../styles/areaart.css';

/**
 * Each building's header art: a small painting of walking up to that building at this hour.
 * Painted the same way as the homestead on Home: gradient fills whose colours come from per-phase CSS
 * variables (`.area-art[data-phase]`), soft light from radial gradients, one baked grain tile and no
 * live SVG filters (they stutter on phones). Anything that moves animates transform/opacity only.
 * `heat` (0–1) is how much of today is done here: windows, fire and glow burn with it.
 */

const W = 300, H = 220;
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const yAt = (pts: readonly (readonly [number, number])[], x: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

/** A hand-drawn ridge through the points, roughened with small deterministic wobbles. */
function ridge(pts: readonly (readonly [number, number])[], seed: number, rough: number, step: number): string {
  const r = rng(seed);
  let d = `M${pts[0][0]} ${H} L${pts[0][0]} ${pts[0][1]}`;
  for (let x = pts[0][0] + step; x <= pts[pts.length - 1][0]; x += step) d += ` L${x} ${(yAt(pts, x) + (r() - 0.5) * rough).toFixed(1)}`;
  return `${d} L${pts[pts.length - 1][0]} ${H} Z`;
}

const FAR2: [number, number][] = [[-10, 112], [36, 90], [80, 118], [120, 104], [160, 120], [205, 102], [252, 82], [292, 106], [310, 100]];
const FAR: [number, number][] = [[-10, 140], [30, 130], [78, 112], [122, 136], [170, 127], [220, 140], [262, 120], [310, 136]];
const MID: [number, number][] = [[-10, 162], [60, 154], [130, 158], [200, 152], [260, 156], [310, 152]];
const FAR2_D = ridge(FAR2, 3, 1.6, 7);
/** Snow on a peak: a jagged cap hanging down both slopes. */
const cap = (x: number, y: number, w: number) =>
  `M${x} ${y - 0.6} L${x + w * 0.62} ${y + w * 0.4} L${x + w * 0.42} ${y + w * 0.58} L${x + w * 0.18} ${y + w * 0.46} L${x - 0.04 * w} ${y + w * 0.7} L${x - w * 0.24} ${y + w * 0.44} L${x - w * 0.5} ${y + w * 0.56} L${x - w * 0.62} ${y + w * 0.3} Z`;
/** The worn path from a door down to where you stand, set with a few stones. */
function Trail({ x, y, w = 7 }: { x: number; y: number; w?: number }) {
  const r = rng(Math.round(x * 7 + y));
  return (
    <g className="aa-trail">
      <path d={`M${x - w} ${y} C${x - w - 2} ${y + 8} ${x - w - 12} ${y + 18} ${x - w - 22} ${H} L${x + w + 16} ${H} C${x + w + 8} ${y + 18} ${x + w + 2} ${y + 8} ${x + w} ${y} Z`} fill="url(#aa-trailg)" />
      {Array.from({ length: 6 }, (_, i) => {
        const t = (i + 0.5) / 6, cy = y + 3 + t * (H - y - 6), cx = x - 3 * t + (r() - 0.5) * (w + 8 * t), rx = 1.6 + t * 2.6;
        return <ellipse key={i} cx={cx.toFixed(1)} cy={cy.toFixed(1)} rx={rx.toFixed(1)} ry={(rx * 0.38).toFixed(1)} fill="url(#aa-pebble)" />;
      })}
    </g>
  );
}
const FAR_D = ridge(FAR, 11, 3, 6);
const MID_D = ridge(MID, 5, 1.6, 8);
const NEAR_TOP = 'M-10 180 C 60 170, 118 168, 170 173 S 262 180, 310 170';
const NEAR = `${NEAR_TOP} L310 ${H} L-10 ${H} Z`;
const FORE = `M-10 206 Q 70 197 150 203 T 310 199 L310 ${H} L-10 ${H} Z`;

const TREELINE = (() => {
  const r = rng(91);
  let d = '';
  for (let x = -6; x < 306; x += 3 + r() * 5) {
    if (r() < 0.25) continue;
    const base = yAt(MID, x) + 2, h = 4 + r() * 7, w = 1.6 + r() * 1.4;
    d += `M${(x - w).toFixed(1)} ${base.toFixed(1)} L${x.toFixed(1)} ${(base - h).toFixed(1)} L${(x + w).toFixed(1)} ${base.toFixed(1)} Z `;
  }
  return d;
})();

/** Grass along the near foreground: dark blades and a lit path for their tips. */
const TUFTS = (() => {
  const r = rng(7);
  let dark = '', lit = '';
  for (let i = 0; i < 34; i++) {
    const x = -4 + r() * 308;
    const y = 196 + r() * 22;
    const s = 0.7 + r() * 0.7;
    for (let b = 0; b < 4; b++) {
      const bx = x + (b - 1.5) * 1.8 * s, lean = (r() - 0.5) * 6 * s, h = (5 + r() * 6) * s;
      dark += `M${(bx - 0.9 * s).toFixed(1)} ${y.toFixed(1)} Q${(bx + lean * 0.3).toFixed(1)} ${(y - h * 0.6).toFixed(1)} ${(bx + lean).toFixed(1)} ${(y - h).toFixed(1)} Q${(bx + lean * 0.2 + 0.5).toFixed(1)} ${(y - h * 0.5).toFixed(1)} ${(bx + 0.9 * s).toFixed(1)} ${y.toFixed(1)} Z `;
      if (b % 2) lit += `M${(bx + lean * 0.5).toFixed(1)} ${(y - h * 0.55).toFixed(1)} Q${(bx + lean * 0.8).toFixed(1)} ${(y - h * 0.85).toFixed(1)} ${(bx + lean).toFixed(1)} ${(y - h).toFixed(1)} `;
    }
  }
  return { dark, lit };
})();

/** A pine with layered, drooping boughs (the same tree as the homestead), stamped with <use>. */
const tier = (top: number, bottom: number, w: number) => {
  const h = bottom - top;
  return `M0 ${top} C${w * 0.25} ${top + h * 0.45} ${w * 0.65} ${bottom - h * 0.22} ${w} ${bottom} Q${w * 0.55} ${bottom - 4} ${w * 0.3} ${bottom + 1} Q${w * 0.05} ${bottom - 3} ${-w * 0.2} ${bottom + 1.5} Q${-w * 0.5} ${bottom - 3} ${-w} ${bottom} C${-w * 0.65} ${bottom - h * 0.22} ${-w * 0.25} ${top + h * 0.45} 0 ${top} Z`;
};
const TIERS: [number, number, number][] = [[-94, -64, 8], [-80, -46, 13], [-64, -26, 18], [-46, -4, 24]];
const PINE = TIERS.map(([t, b, w]) => tier(t, b, w)).join(' ');
const PINE_LIT = TIERS.map(([t, b, w]) => `M${w * 0.18} ${t + (b - t) * 0.38} C${w * 0.5} ${t + (b - t) * 0.68} ${w * 0.78} ${b - 3} ${w} ${b}`).join(' ');

/** Stars, scattered once. The Observatory gets a richer sky. */
const starField = (n: number, seed: number) => {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: r() * W, y: r() * 118, r: r() < 0.14 ? 1.25 : 0.45 + r() * 0.5, tw: r() < 0.35, d: -r() * 4 }));
};
const STARS = starField(38, 17);
const STARS_RICH = starField(84, 29);

/** Canvas grain and a few dry-brush strokes, baked once into a small tile. */
let grainTile: string | null = null;
function grain(): string {
  if (grainTile !== null) return grainTile;
  grainTile = '';
  try {
    const N = 128;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    if (!g) return grainTile;
    const r = rng(2024);
    const img = g.createImageData(N, N);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r();
      const light = v > 0.5;
      img.data[i] = light ? 255 : 6; img.data[i + 1] = light ? 246 : 8; img.data[i + 2] = light ? 228 : 18;
      img.data[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 20);
    }
    g.putImageData(img, 0, 0);
    g.lineCap = 'round';
    for (let k = 0; k < 80; k++) {
      const lightStroke = r() < 0.45;
      g.strokeStyle = lightStroke ? `rgba(255,240,215,${(0.02 + r() * 0.03).toFixed(3)})` : `rgba(0,0,12,${(0.035 + r() * 0.05).toFixed(3)})`;
      g.lineWidth = 1 + r() * 2.6;
      const x = r() * N, y = r() * N, a = -0.35 + r() * 0.25, l = 5 + r() * 16;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + Math.cos(a) * l * 0.5, y + oy + Math.sin(a) * l * 0.5 - 1.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
      }
    }
    grainTile = c.toDataURL();
  } catch { /* no canvas (tests, old browsers): the painting goes without grain */ }
  return grainTile;
}

/** The light of day: the real clock, or `?sky=` to preview another hour (same as Home). */
function phaseNow(): Phase {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('sky');
  return v === 'night' || v === 'dawn' || v === 'day' || v === 'golden' || v === 'dusk' ? v : skyPhase(new Date());
}

/** Gradient stops whose colours come from CSS, so each light of day repaints them. */
const Stops = ({ list }: { list: [number, string][] }) => <>{list.map(([o, c]) => <stop key={o} offset={o} className={c} />)}</>;

interface Scene { moon?: [number, number]; pines: [number, number, number][]; rich?: boolean; sky?: ReactNode; body: ReactNode }

export function AreaArt({ id, heat }: { id: AreaKey; heat: number }) {
  const [tex] = useState(grain);
  const [phase] = useState(phaseNow);
  const light = daylight(phase);
  const h = Math.max(0, Math.min(1, heat));
  const scene = SCENES[id](h);
  const stars = scene.rich ? STARS_RICH : STARS;

  return (
    <svg className={`area-art aa-${id}`} viewBox={`0 0 ${W} ${H}`} aria-hidden data-phase={phase}
      style={{ '--heat': h, '--wall': light.wall, '--glow': light.glow } as CSSProperties}>
      <defs>
        {/* ---- sky and land, coloured by the light of day ---- */}
        <linearGradient id="aa-sky" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-sky-a'], [0.55, 'aa-s-sky-b'], [1, 'aa-s-sky-c']]} /></linearGradient>
        <radialGradient id="aa-horizon" cx=".5" cy=".5"><Stops list={[[0, 'aa-s-ac-1'], [1, 'aa-s-ac-0']]} /></radialGradient>
        <linearGradient id="aa-far2" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-far2-a'], [1, 'aa-s-far2-b']]} /></linearGradient>
        <linearGradient id="aa-far" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-far-a'], [0.6, 'aa-s-far-b'], [1, 'aa-s-haze-solid']]} /></linearGradient>
        <linearGradient id="aa-mid" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-mid-a'], [1, 'aa-s-mid-b']]} /></linearGradient>
        <linearGradient id="aa-near" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-gnd-a'], [0.5, 'aa-s-gnd-m'], [1, 'aa-s-gnd-b']]} /></linearGradient>
        <linearGradient id="aa-haze" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-haze-0'], [0.6, 'aa-s-haze-1'], [1, 'aa-s-haze-0']]} /></linearGradient>
        <linearGradient id="aa-cap" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-cap-a'], [1, 'aa-s-cap-b']]} /></linearGradient>
        <linearGradient id="aa-pine-g" x1="0" y1="0" x2="1" y2="0"><Stops list={[[0, 'aa-s-pine-b'], [0.55, 'aa-s-pine-a'], [1, 'aa-s-pine-lit']]} /></linearGradient>
        <linearGradient id="aa-fg" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-fg-a'], [1, 'aa-s-fg-b']]} /></linearGradient>
        <radialGradient id="aa-mistblob"><Stops list={[[0, 'aa-s-mist-1'], [0.6, 'aa-s-mist-h'], [1, 'aa-s-mist-0']]} /></radialGradient>
        <radialGradient id="aa-smoke-g" cx=".5" cy=".6"><Stops list={[[0, 'aa-s-smoke-1'], [1, 'aa-s-smoke-0']]} /></radialGradient>
        <radialGradient id="aa-smoke-warm" cx=".5" cy=".75"><stop offset="0" stopColor="#ffc884" stopOpacity=".42" /><stop offset="1" stopColor="#c8b8c8" stopOpacity="0" /></radialGradient>
        <linearGradient id="aa-trailg" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-trail-a'], [1, 'aa-s-trail-b']]} /></linearGradient>
        <radialGradient id="aa-pebble" cx=".4" cy=".25"><Stops list={[[0, 'aa-s-peb-a'], [1, 'aa-s-peb-b']]} /></radialGradient>
        <linearGradient id="aa-slitglow" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stopColor="#f2aa52" stopOpacity="0" /><stop offset=".85" stopColor="#f2aa52" stopOpacity=".4" /><stop offset="1" stopColor="#ffd590" stopOpacity=".85" /></linearGradient>

        {/* ---- materials: warm by day (--wall), sunk into blue at night ---- */}
        <linearGradient id="aa-wood" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-wood-a'], [1, 'aa-s-wood-b']]} /></linearGradient>
        <linearGradient id="aa-roof" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-roof-a'], [1, 'aa-s-roof-b']]} /></linearGradient>
        <linearGradient id="aa-stone" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-stone-a'], [1, 'aa-s-stone-b']]} /></linearGradient>
        <linearGradient id="aa-white" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-white-a'], [1, 'aa-s-white-b']]} /></linearGradient>
        <linearGradient id="aa-brick" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-brick-a'], [1, 'aa-s-brick-b']]} /></linearGradient>
        <linearGradient id="aa-trim" x1="0" y1="0" x2="0" y2="1"><Stops list={[[0, 'aa-s-trim-a'], [1, 'aa-s-trim-b']]} /></linearGradient>
        <linearGradient id="aa-dome" x1="0" y1="0" x2="1" y2="0"><Stops list={[[0, 'aa-s-dome-a'], [0.64, 'aa-s-dome-hi'], [1, 'aa-s-dome-b']]} /></linearGradient>
        <linearGradient id="aa-col" x1="0" y1="0" x2="1" y2="0"><Stops list={[[0, 'aa-s-col-a'], [0.4, 'aa-s-col-hi'], [1, 'aa-s-col-b']]} /></linearGradient>
        <linearGradient id="aa-iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3c48" /><stop offset="1" stopColor="#101118" /></linearGradient>
        <pattern id="aa-shingle" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 H8 M0 0 V5 M4 -2.5 V2.5 M0 2.5 H8" className="aa-pt-line" /></pattern>
        <pattern id="aa-bricks" width="10" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 H10 M0 2.5 H10 M2.5 0 V2.5 M7.5 2.5 V5" className="aa-pt-brick" /></pattern>
        <pattern id="aa-stones" width="12" height="9" patternUnits="userSpaceOnUse">
          <path d="M1 1 h5 q1 0 1 1 v2 q0 1 -1 1 h-5 z M8 1 h3 v4 h-3 z M3.5 5.5 h7 q1 0 1 1 v1.8 h-8 z M0 5.5 h2.5 v2.8 h-2.5 z" className="aa-pt-stone" />
        </pattern>
        <pattern id="aa-siding" width="6" height="4" patternUnits="userSpaceOnUse"><path d="M0 3.7 H6" className="aa-pt-siding" /></pattern>

        {/* ---- light (lamp-warm) ---- */}
        <radialGradient id="aa-glow"><stop offset="0" stopColor="#f7c66e" stopOpacity=".85" /><stop offset=".45" stopColor="#e8a84b" stopOpacity=".26" /><stop offset="1" stopColor="#e8a84b" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-pool"><stop offset="0" stopColor="#ffcf86" stopOpacity=".6" /><stop offset=".4" stopColor="#f0a24e" stopOpacity=".24" /><stop offset="1" stopColor="#e8a84b" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-acglow"><Stops list={[[0, 'aa-s-acl-1'], [0.5, 'aa-s-acl-h'], [1, 'aa-s-acl-0']]} /></radialGradient>
        <radialGradient id="aa-fire" cx=".5" cy=".72"><stop offset="0" stopColor="#fff2b8" /><stop offset=".3" stopColor="#ffb04a" stopOpacity=".95" /><stop offset=".7" stopColor="#c2401c" stopOpacity=".4" /><stop offset="1" stopColor="#8a2210" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-firelight"><stop offset="0" stopColor="#ff9c4a" stopOpacity=".7" /><stop offset=".45" stopColor="#e0602a" stopOpacity=".22" /><stop offset="1" stopColor="#c2401c" stopOpacity="0" /></radialGradient>
        <linearGradient id="aa-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff4c4" /><stop offset=".45" stopColor="#ffb347" /><stop offset="1" stopColor="#e2541f" stopOpacity="0" /></linearGradient>
        <linearGradient id="aa-room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a0" /><stop offset=".6" stopColor="#f2aa52" /><stop offset="1" stopColor="#c8742a" /></linearGradient>
        <linearGradient id="aa-roomdeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6c47a" /><stop offset="1" stopColor="#9a5420" /></linearGradient>
        <linearGradient id="aa-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbe6" stopOpacity=".95" /><stop offset="1" stopColor="#fff1c8" stopOpacity="0" /></linearGradient>
        <linearGradient id="aa-spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd590" stopOpacity=".55" /><stop offset="1" stopColor="#ffb860" stopOpacity="0" /></linearGradient>
        <radialGradient id="aa-coin" cx=".38" cy=".32"><stop offset="0" stopColor="#fff3c0" /><stop offset=".45" stopColor="#e8c25a" /><stop offset="1" stopColor="#8a6414" /></radialGradient>
        <radialGradient id="aa-gold"><stop offset="0" stopColor="#ffe08a" stopOpacity=".8" /><stop offset=".4" stopColor="#c9a227" stopOpacity=".3" /><stop offset="1" stopColor="#c9a227" stopOpacity="0" /></radialGradient>
        <linearGradient id="aa-heart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd9b0" /><stop offset=".5" stopColor="#f08aa8" /><stop offset="1" stopColor="#b8456e" /></linearGradient>
        <radialGradient id="aa-pink"><stop offset="0" stopColor="#ffb0c8" stopOpacity=".75" /><stop offset=".45" stopColor="#d97ba4" stopOpacity=".24" /><stop offset="1" stopColor="#d97ba4" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-moonface" cx=".4" cy=".35"><stop offset="0" stopColor="#fbf6ea" /><stop offset="1" stopColor="#cfc6b0" /></radialGradient>
        <radialGradient id="aa-moonglow"><stop offset="0" stopColor="#f4ecd8" stopOpacity=".32" /><stop offset="1" stopColor="#f4ecd8" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-starglow"><stop offset="0" stopColor="#e8eeff" stopOpacity=".7" /><stop offset="1" stopColor="#c9d4ff" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-shadow"><stop offset="0" stopColor="#000" stopOpacity=".6" /><stop offset=".6" stopColor="#000" stopOpacity=".22" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <radialGradient id="aa-vignette" cx=".5" cy=".46" r=".72"><stop offset=".55" stopColor="#03040a" stopOpacity="0" /><stop offset="1" stopColor="#03040a" stopOpacity=".62" /></radialGradient>
        {tex && <pattern id="aa-grain" width="128" height="128" patternUnits="userSpaceOnUse"><image href={tex} width="128" height="128" /></pattern>}
        <clipPath id="aa-clip"><rect width={W} height={H} rx="18" /></clipPath>

        <g id="aa-pine">
          <ellipse cx="3" cy="3" rx="30" ry="4.5" fill="url(#aa-shadow)" />
          <path d="M-2.6 12 L-2 -4 H2 L2.6 12 Z" fill="#120d0b" />
          <path d={PINE} fill="url(#aa-pine-g)" />
          <path d={PINE_LIT} className="aa-pine-lit" />
        </g>
      </defs>

      <g clipPath="url(#aa-clip)">
        {/* ================= the sky ================= */}
        <rect width={W} height={H} fill="url(#aa-sky)" />
        <ellipse cx="150" cy="142" rx="210" ry="64" fill="url(#aa-horizon)" />
        <g className="aa-stars">
          {stars.map((s, i) => <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r} className={s.tw ? 'tw' : undefined} style={s.tw ? { animationDelay: `${s.d.toFixed(2)}s` } : undefined} />)}
        </g>
        {scene.moon && (
          <g transform={`translate(${scene.moon[0]} ${scene.moon[1]})`} className="aa-moon">
            <circle r="34" fill="url(#aa-moonglow)" />
            <circle r="10" fill="url(#aa-moonface)" />
            <circle cx="-3" cy="-2" r="2.2" className="aa-crater" /><circle cx="3" cy="3" r="1.6" className="aa-crater" /><circle cx="2.5" cy="-4" r="1" className="aa-crater" />
          </g>
        )}

        {scene.sky}

        {/* ================= the land ================= */}
        <path d={FAR2_D} fill="url(#aa-far2)" />
        <g fill="url(#aa-cap)" className="aa-caps">
          <path d={cap(36, 90, 10)} /><path d={cap(252, 82, 12)} />
        </g>
        <path className="aa-peaklit" d="M36 90 L80 118 M252 82 L292 106" />
        <path d={FAR_D} fill="url(#aa-far)" />
        <path d={cap(78, 112, 8)} fill="url(#aa-cap)" className="aa-caps" />
        <rect x="-10" y="112" width="320" height="56" fill="url(#aa-haze)" />
        <path d={MID_D} fill="url(#aa-mid)" />
        <path d={TREELINE} className="aa-treeline" />
        <g className="aa-mistband">
          <ellipse cx="60" cy="160" rx="120" ry="8" fill="url(#aa-mistblob)" />
          <ellipse cx="240" cy="157" rx="130" ry="7" fill="url(#aa-mistblob)" />
        </g>
        <path d={NEAR} fill="url(#aa-near)" />
        <path d={NEAR_TOP} className="aa-groundrim" />

        {/* ================= the building, drawn a little larger than life ================= */}
        <g transform="translate(150 186) scale(1.1) translate(-150 -186)">{scene.body}</g>

        {/* ================= the foreground: pines framing the view, grass at your feet ================= */}
        {scene.pines.map(([x, y, s]) => <use key={`${x}${y}`} href="#aa-pine" transform={`translate(${x} ${y}) scale(${s})`} />)}
        <path d={FORE} fill="url(#aa-fg)" />
        <path d={TUFTS.dark} className="aa-tufts" />
        <path d={TUFTS.lit} className="aa-tufts-lit" />

        {tex && <rect width={W} height={H} fill="url(#aa-grain)" className="aa-grain" />}
        <rect width={W} height={H} fill="url(#aa-vignette)" />
      </g>
      <rect x=".75" y=".75" width={W - 1.5} height={H - 1.5} rx="17.5" className="aa-frame" />
    </svg>
  );
}

/* ---------------- the buildings ---------------- */

/** Job Search HQ: a brick office at night. One upstairs window for each of the day's four moves, the study lit below. */
function Office(heat: number): Scene {
  const wins = [101, 127, 155, 181];
  return {
    moon: [252, 34],
    pines: [[42, 176, 0.42], [258, 172, 0.5], [276, 176, 0.36], [12, 226, 1.18], [294, 228, 1.02]],
    body: (
      <g className="aa-b">
        <ellipse cx="152" cy="183" rx="86" ry="6" fill="url(#aa-shadow)" />
        <circle cx="146" cy="132" r="104" fill="url(#aa-glow)" className="aa-bglow" />
        <ellipse cx="140" cy="190" rx="96" ry="13" fill="url(#aa-pool)" className="aa-pool" />
        {/* the street lamp out front */}
        <ellipse cx="66" cy="192" rx="34" ry="6" fill="url(#aa-pool)" className="aa-lamppool" />
        <circle cx="66" cy="134" r="26" fill="url(#aa-glow)" className="aa-lampglow" />
        <path d="M66 192 V138 M66 142 H60" className="aa-post" />
        <path d="M61.5 130 H70.5 L69 140 H63 Z" className="aa-lamphead" />
        <path d="M60.5 130 L66 125.5 L71.5 130 Z M63 140 H69 V142 H63 Z" className="aa-iron" />

        {/* the building: brick, a stone cornice, and the clock counting down to March 1 */}
        <rect x="92" y="94" width="116" height="88" className="aa-wall m-brick" />
        <rect x="92" y="94" width="116" height="88" fill="url(#aa-bricks)" />
        <path d="M112 89 L150 68 L188 89 Z" className="aa-wall m-stone" />
        <path d="M120 88 L150 72.5 L180 88 Z" className="aa-tympanum" />
        <rect x="86" y="88" width="128" height="7" className="aa-wall m-trim" />
        <rect x="90" y="125" width="120" height="3.5" className="aa-wall m-trim" />
        <g transform="translate(150 81)" className="aa-clock">
          <circle r="7" className="aa-clockface" /><circle r="7" className="aa-clockring" />
          <path d="M0 0 V-4.8 M0 0 L3.4 1.6" className="aa-clockhands" />
        </g>
        <path d="M150 68 L188 89 M86 88 H214" className="aa-rim" />
        <path d="M208 95 V182" className="aa-rim soft" />

        {wins.map((x, i) => {
          const on = heat >= (i + 1) / 4 - 0.01;
          return (
            <g key={x}>
              {on && <rect x={x - 6} y="94" width="30" height="32" fill="url(#aa-glow)" className="aa-halo" />}
              <rect x={x - 1.5} y="98.5" width="21" height="23" className="aa-frame-t" />
              <rect x={x} y="100" width="18" height="20" className={on ? 'aa-win on' : 'aa-win'} />
              {on ? <rect x={x} y="100" width="18" height={4 + (i % 3) * 2} className="aa-blind" /> : <path d={`M${x + 2} ${117} L${x + 9} ${102}`} className="aa-glint" />}
              <path d={`M${x + 9} 100 V120 M${x} 109.5 H${x + 18}`} className="aa-mullion" />
              <rect x={x - 3} y="120.5" width="24" height="2.6" className="aa-sill" />
            </g>
          );
        })}

        {/* the study: desk lamp, letters going out, the calendar on the wall */}
        <rect x="96" y="132" width="66" height="44" fill="url(#aa-glow)" className="aa-halo study" />
        <rect x="98" y="134" width="62" height="38" className="aa-frame-t" />
        <g className="aa-study">
          <rect x="101" y="137" width="56" height="32" fill="url(#aa-room)" />
          <rect x="101" y="137" width="56" height="32" fill="url(#aa-cone)" opacity=".18" />
          <g className="aa-cal">
            <rect x="105" y="140" width="13" height="14" className="cal-page" />
            <rect x="105" y="140" width="13" height="3.4" className="cal-top" />
            {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={106.4 + c * 3} y={145 + r * 2.8} width="1.6" height="1.4" className="cal-day" />))}
            <circle cx="113.2" cy="150.3" r="1.9" className="cal-ring" />
          </g>
          <path d="M142.5 150 L153.5 150 L161 164 L134 164 Z" fill="url(#aa-cone)" className="aa-cone" />
          <path d="M148 150 V163" className="aa-lamparm" />
          <ellipse cx="148" cy="163.4" rx="4" ry="1.1" className="aa-lampbase" />
          <path d="M141.6 150.2 Q141.8 145.4 148 145.2 Q154.2 145.4 154.4 150.2 Z" className="aa-shade" />
          <path d="M143.4 148.6 Q144.6 146.4 148 146.2" className="aa-shade-hi" />
          <rect x="101" y="163" width="56" height="6" className="aa-desk" />
          <g className="aa-letters">
            <rect x="111" y="158.2" width="12" height="7" transform="rotate(-6 117 161)" />
            <path d="M111 158.2 L117 162 L123 158.2" transform="rotate(-6 117 161)" className="flap" />
            <rect x="120" y="159.6" width="11" height="6.4" transform="rotate(5 125 163)" />
            <path d="M120 159.6 L125.5 163 L131 159.6" transform="rotate(5 125 163)" className="flap" />
            <circle cx="125.6" cy="163.2" r="1" className="seal" />
          </g>
          <rect x="131" y="158.6" width="5" height="5.2" rx=".8" className="aa-mug" />
          <path d="M136 160 Q138.4 160.4 136 162.6" className="aa-mughandle" />
        </g>
        <path d="M120 137 V169 M139 137 V169" className="aa-mullion" />
        <rect x="95" y="171.5" width="68" height="3" className="aa-sill" />

        {/* the door with a lit transom, a canopy and two steps */}
        <path d="M165 133.5 H199 L195 129 H169 Z" className="aa-wall m-trim" />
        <rect x="171" y="134.5" width="22" height="6" className="aa-win on" />
        <rect x="171" y="141" width="22" height="41" className="aa-door" />
        <path d="M174 144 h7 v15 h-7 z M183 144 h7 v15 h-7 z M174 162 h7 v16 h-7 z M183 162 h7 v16 h-7 z" className="aa-panel" />
        <circle cx="189.5" cy="162" r="1" className="aa-knob" />
        <rect x="167" y="182" width="30" height="2.6" className="aa-wall m-stone" />
        <rect x="164" y="184.6" width="36" height="2.6" className="aa-wall m-stone" />

        <Trail x={182} y={187.2} w={9} />
        {/* the mailbox, flag up once the day's moves are going out */}
        <ellipse cx="229" cy="191" rx="14" ry="2.4" fill="url(#aa-shadow)" />
        <rect x="226.8" y="168" width="3.2" height="23" className="aa-wall m-wood" />
        <path d="M218 171 V164.5 Q218 159 227 159 Q236 159 236 164.5 V171 Z" className="aa-mailbox" />
        <path d="M227 159 Q236 159 236 164.5" className="aa-rim" />
        <rect x="215.5" y="162.6" width="6" height="4.4" rx=".6" transform="rotate(-12 218 165)" className="aa-letter" />
        <g className={heat > 0 ? 'aa-flag up' : 'aa-flag'}><path d="M236.6 168 V158" /><rect x="236.6" y="157.6" width="6" height="3.8" /></g>
      </g>
    ),
  };
}

/** The projects workbench: the dome open to the stars, and a lit workshop with the builds pinned up. */
function Observatory(_heat: number): Scene {
  return {
    rich: true,
    pines: [[60, 176, 0.4], [78, 178, 0.3], [14, 226, 1.12], [292, 228, 0.86]],
    sky: (
      <g>
        {/* the night the projects are named after: a nebula, a constellation and the star the scope is on */}
        <ellipse cx="74" cy="46" rx="120" ry="22" transform="rotate(-16 74 46)" fill="url(#aa-acglow)" className="aa-nebula" />
        <path d="M30 34 L52 22 L74 32 L90 18 M74 32 L66 54" className="aa-constel" />
        {[[30, 34], [52, 22], [74, 32], [90, 18], [66, 54]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" className="aa-cstar" />)}
        <g transform="translate(208 19)" className="aa-target">
          <circle r="16" fill="url(#aa-starglow)" />
          <path d="M0 -9 V9 M-9 0 H9" /><circle r="1.8" />
        </g>
      </g>
    ),
    body: (
      <g className="aa-b">

        <ellipse cx="164" cy="184" rx="96" ry="6" fill="url(#aa-shadow)" />
        <circle cx="168" cy="132" r="100" fill="url(#aa-glow)" className="aa-bglow" />
        <ellipse cx="206" cy="192" rx="70" ry="11" fill="url(#aa-pool)" className="aa-pool" />

        {/* the stone drum and the silver dome, slit open */}
        <rect x="98" y="132" width="78" height="50" className="aa-wall m-stone" />
        <rect x="98" y="132" width="78" height="50" fill="url(#aa-stones)" />
        <rect x="94" y="128" width="86" height="6" rx="2" className="aa-wall m-stone" />
        <path d="M96 129 A41 41 0 0 1 178 129 Z" className="aa-wall m-dome" />
        <path d="M109 129 A28 40 0 0 1 137 89 M165 129 A28 40 0 0 0 137 89 M126 129 A11 40 0 0 1 137 89 M148 129 A11 40 0 0 0 137 89" className="aa-ribs" />
        <path d="M151 91 A41 41 0 0 1 176 116" className="aa-rim" />
        <g transform="rotate(34 137 129)">
          <rect x="131" y="89.5" width="12" height="39.5" className="aa-slit" />
          <rect x="131" y="89.5" width="12" height="39.5" fill="url(#aa-slitglow)" className="aa-slitlit" />
          <g className="aa-slitstars"><circle cx="134" cy="95" r=".7" /><circle cx="139.5" cy="101" r=".55" /></g>
        </g>
        <line x1="149.3" y1="110.8" x2="179.4" y2="66.1" className="aa-scope" />
        <line x1="175.5" y1="71.9" x2="182.8" y2="61.1" className="aa-scope-end" />
        <circle cx="183.4" cy="60.2" r="2.4" className="aa-lens" />
        <rect x="106" y="145" width="9" height="12" rx="4.5" className="aa-win on" />
        <rect x="159" y="145" width="9" height="12" rx="4.5" className="aa-win on" />
        <path d="M127 182 V162 A10 7 0 0 1 147 162 V182 Z" className="aa-door" />
        <path d="M137 156 V182" className="aa-mullion thin" />
        <path d="M176 133 V182" className="aa-rim soft" />
        <Trail x={137} y={182} w={8} />

        {/* the workshop lean-to: the builds pinned up, a screen still running */}
        <rect x="176" y="144" width="64" height="38" className="aa-wall m-wood" />
        <rect x="176" y="144" width="64" height="38" fill="url(#aa-siding)" />
        <path d="M170 136 L248 147 L248 152.5 L170 141.5 Z" className="aa-wall m-roof" />
        <path d="M170 136 L248 147" className="aa-rim" />
        <rect x="181" y="148" width="54" height="28" fill="url(#aa-glow)" className="aa-halo study" />
        <rect x="183" y="150" width="50" height="24" className="aa-frame-t" />
        <g className="aa-study">
          <rect x="185" y="152" width="46" height="20" fill="url(#aa-room)" />
          <path d="M191 157 L203.5 158.5 L214 156.5 L224 158.6" className="aa-string" />
          <rect x="187.5" y="154.5" width="8" height="6" className="aa-card c1" />
          <rect x="199.5" y="155.5" width="8.5" height="6.2" className="aa-card c2" transform="rotate(4 204 158)" />
          <rect x="210.5" y="153.6" width="7.5" height="6" className="aa-card c3" transform="rotate(-5 214 156)" />
          <rect x="220.5" y="155.4" width="8" height="6" className="aa-card c4" />
          {[189, 201, 212, 222].map((x) => <circle key={x} cx={x + 2.5} cy="155.4" r=".7" className="aa-pin" />)}
          <rect x="188" y="162.5" width="15" height="7" className="aa-blueprint" />
          <path d="M188 165 H203 M188 167.5 H203 M191 162.5 V169.5 M195 162.5 V169.5 M199 162.5 V169.5 M190 168 L194.5 164 L198 166.5 L201 163.5" className="aa-bpgrid" />
          <rect x="210" y="162" width="11" height="7" rx=".6" className="aa-screen" />
          <path d="M211.6 164 H216 M211.6 165.6 H219 M211.6 167.2 H214.6" className="aa-code" />
          <rect x="185" y="169.4" width="46" height="2.6" className="aa-desk" />
        </g>
        <path d="M208 152 V172" className="aa-mullion" />
        <rect x="181" y="173.6" width="54" height="2.6" className="aa-sill" />
        <path d="M240 145 V182" className="aa-rim soft" />
      </g>
    ),
  };
}

/** The Forge: a stone smithy with the fire open to the yard, the anvil hot, and a kettlebell by the stump. */
function Forge(_heat: number): Scene {
  return {
    moon: [50, 34],
    pines: [[44, 174, 0.38], [264, 172, 0.46], [10, 228, 1.0], [294, 226, 1.1]],
    body: (
      <g className="aa-b">
        <ellipse cx="150" cy="184" rx="92" ry="6" fill="url(#aa-shadow)" />
        <circle cx="142" cy="154" r="120" fill="url(#aa-firelight)" className="aa-fireglow" />
        <ellipse cx="146" cy="191" rx="112" ry="15" fill="url(#aa-firelight)" className="aa-pool fire" />

        {/* the chimney, breathing sparks */}
        <rect x="176" y="74" width="18" height="50" className="aa-wall m-stone" />
        <rect x="176" y="74" width="18" height="50" fill="url(#aa-stones)" />
        <rect x="173" y="70" width="24" height="5" className="aa-wall m-stone" />
        <path d="M194 75 V118" className="aa-rim soft" />
        <g className="aa-smoke warm">
          <circle cx="184" cy="62" r="5" className="warm" /><circle cx="188" cy="50" r="7" /><circle cx="182" cy="38" r="9" />
        </g>
        <g className="aa-sparks chimney">
          {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={181 + i * 2} cy="70" r={0.9 + (i % 2) * 0.4} style={{ animationDelay: `${-i * 0.5}s` }} />)}
        </g>

        {/* stone walls and a heavy roof */}
        <path d="M86 182 V126 L146 92 L206 126 V182 Z" className="aa-wall m-stone" />
        <path d="M86 182 V126 L146 92 L206 126 V182 Z" fill="url(#aa-stones)" />
        <path d="M76 130 L146 84 L216 130 L209 133 L146 92 L83 133 Z" className="aa-wall m-roof" />
        <path d="M76 130 L146 84 L216 130 L209 133 L146 92 L83 133 Z" fill="url(#aa-shingle)" />
        <path d="M146 84 L216 130" className="aa-rim" />
        <path d="M206 132 V182" className="aa-rim soft" />
        <circle cx="146" cy="112" r="5" className="aa-win on" />
        <path d="M141 112 H151 M146 107 V117" className="aa-mullion thin" />

        {/* the open bay: the fire, the coals, the tools on the wall */}
        <path d="M112 182 V152 Q140 128 168 152 V182 Z" className="aa-bay" />
        <ellipse cx="140" cy="166" rx="30" ry="24" fill="url(#aa-fire)" className="aa-fire" />
        <path d="M119 146 V162 M116.5 162 L119 166 L121.5 162 M125 143 V156 M122 141 h6 v3 h-6 z" className="aa-tools" />
        <path d="M159 144 V160 M156 144 H162 M160 160 A3 3 0 1 1 158 160" className="aa-tools" />
        <rect x="124" y="171" width="32" height="11" className="aa-hearthbox" />
        <path d="M125 171.4 H155" className="aa-coals" />
        <g className="aa-flames">
          <path d="M131 171 Q129 164 133 158 Q133 164 136 166 Q135 160 140 153 Q141 161 145 164 Q146 159 149 157 Q151 164 149 171 Z" fill="url(#aa-flame)" />
        </g>
        <path d="M112 182 V152 Q140 128 168 152 V182" className="aa-arch" />
        <Trail x={140} y={182} w={14} />
        <path d="M135.5 133 A4.5 5 0 0 0 144.5 133" className="aa-horseshoe" />

        {/* the water barrel */}
        <ellipse cx="70" cy="184" rx="14" ry="2.6" fill="url(#aa-shadow)" />
        <rect x="62" y="166" width="16" height="17" rx="2" className="aa-wall m-wood" />
        <path d="M62 170.5 H78 M62 178.5 H78" className="aa-hoop" />
        <ellipse cx="70" cy="166" rx="8" ry="1.8" className="aa-water" />

        {/* the anvil on its stump, a bar glowing on it, the hammer and a kettlebell */}
        <ellipse cx="222" cy="187" rx="34" ry="4" fill="url(#aa-shadow)" />
        <path d="M203 187 V175 H219 V187 Z" className="aa-wall m-wood" />
        <ellipse cx="211" cy="175" rx="8" ry="1.8" className="aa-stumptop" />
        <g transform="translate(211 175) scale(1.45)">
          <path d="M-4 0 L-2.4 -5 H5 L6.6 0 Z M-12 -5 Q-12 -10 -4 -10 H14 L12 -7 H6 V-5 H-2.4 V-7 Z" className="aa-anvil" />
          <path d="M-11 -9.6 H13" className="aa-anvil-hot" />
        </g>
        <ellipse cx="210" cy="159.6" rx="9" ry="3" fill="url(#aa-firelight)" className="aa-barglow" />
        <path d="M203.5 159.4 H216" className="aa-bar" />
        <g className="aa-sparks anvil">
          {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={211 + (i % 3)} cy="158.6" r={0.7 + (i % 2) * 0.5} style={{ animationDelay: `${-i * 0.3}s`, '--sx': `${(i % 2 ? 1 : -1) * (6 + i * 3)}px` } as CSSProperties} />)}
        </g>
        <path d="M224 187 L231 168" className="aa-handle" />
        <rect x="227" y="164.5" width="9" height="5" rx="1" transform="rotate(20 231.5 167)" className="aa-anvil" />
        <circle cx="244" cy="181" r="5.4" className="aa-bell" />
        <path d="M239.8 177.8 Q239.6 170.6 244 170.6 Q248.4 170.6 248.2 177.8" className="aa-bell-h" />
        <path d="M239.2 179 A5.4 5.4 0 0 1 242 176.2" className="aa-firerim" />
        <path d="M203.4 175.6 V186.6" className="aa-firerim" />
        <path d="M240.2 177.4 Q240 171.4 244 171" className="aa-firerim" />
      </g>
    ),
  };
}

/** The Ledger House: a small stone counting-house, columns and a pediment, a gold coin glowing in it. */
function Bank(_heat: number): Scene {
  const cols = [104, 126, 174, 196];
  return {
    moon: [252, 32],
    pines: [[40, 174, 0.42], [262, 172, 0.44], [12, 226, 1.1], [292, 228, 1.06]],
    body: (
      <g className="aa-b">
        <ellipse cx="150" cy="186" rx="96" ry="6" fill="url(#aa-shadow)" />
        <circle cx="150" cy="134" r="104" fill="url(#aa-glow)" className="aa-bglow" />
        <ellipse cx="150" cy="193" rx="104" ry="13" fill="url(#aa-gold)" className="aa-pool" />

        {/* lanterns either side of the steps */}
        {[78, 222].map((x) => (
          <g key={x}>
            <circle cx={x} cy="150" r="20" fill="url(#aa-glow)" className="aa-lampglow" />
            <path d={`M${x} 188 V156`} className="aa-post" />
            <path d={`M${x - 3.6} 146 H${x + 3.6} L${x + 2.6} 154 H${x - 2.6} Z`} className="aa-lamphead" />
            <path d={`M${x - 4.4} 146 L${x} 142.5 L${x + 4.4} 146 Z M${x - 3} 154 H${x + 3} V156 H${x - 3} Z`} className="aa-iron" />
          </g>
        ))}

        {/* the back wall: tall lit windows and the door, the counting room inside */}
        <rect x="96" y="114" width="108" height="58" className="aa-wall m-white" />
        <rect x="96" y="114" width="108" height="58" fill="url(#aa-stones)" opacity=".5" />
        {[111.5, 181.5].map((x) => (
          <g key={x}>
            <rect x={x - 4} y="122" width="15" height="40" fill="url(#aa-glow)" className="aa-halo" />
            <path d={`M${x} 160 V130 A3.5 3.5 0 0 1 ${x + 7} 130 V160 Z`} className="aa-win on" />
            <path d={`M${x + 3.5} 127 V160 M${x} 142 H${x + 7}`} className="aa-mullion thin" />
          </g>
        ))}
        <path d="M134 172 V136 A16 12 0 0 1 166 136 V172 Z" fill="url(#aa-glow)" className="aa-halo study" />
        <g className="aa-study">
          <path d="M137 172 V138 A13 10 0 0 1 163 138 V172 Z" fill="url(#aa-room)" />
          <path d="M150 142 V148 M142 148 H158 M150 148 V160 M144 160 H156 M142 148 L139.5 154 H144.5 Z M158 148 L155.5 154 H160.5 Z" className="aa-scales" />
          <rect x="137" y="162" width="26" height="10" className="aa-desk" />
          <g className="aa-coins">
            {[[141, 3], [146, 5], [154, 4], [159, 2]].map(([x, n]) => Array.from({ length: n }, (_, k) => <ellipse key={`${x}${k}`} cx={x} cy={161.4 - k * 1.5} rx="2.4" ry=".9" />))}
          </g>
        </g>
        <path d="M137 172 V138 A13 10 0 0 1 163 138 V172" className="aa-doorframe" />

        {/* columns, entablature and the pediment with its coin */}
        {cols.map((x) => (
          <g key={x}>
            <rect x={x - 5.5} y="116" width="11" height="54" className="aa-wall m-col" />
            <path d={`M${x - 2.4} 117 V169 M${x + 1.2} 117 V169`} className="aa-flute" />
            <rect x={x - 7.5} y="112.5" width="15" height="4" className="aa-wall m-white" />
            <rect x={x - 7} y="169" width="14" height="3" className="aa-wall m-white" />
          </g>
        ))}
        <rect x="88" y="104" width="124" height="9" className="aa-wall m-white" />
        <path d="M90 110 H210" className="aa-dentils" />
        <path d="M84 104.5 L150 74 L216 104.5 Z" className="aa-wall m-white" />
        <path d="M99 101.5 L150 78.5 L201 101.5 Z" className="aa-tympanum" />
        <circle cx="150" cy="93" r="22" fill="url(#aa-gold)" className="aa-coinglow" />
        <circle cx="150" cy="93" r="7.4" fill="url(#aa-coin)" className="aa-coin" />
        <circle cx="150" cy="93" r="5.2" className="aa-coin-ring" />
        <rect x="148.2" y="91.2" width="3.6" height="3.6" className="aa-coin-hole" />
        <path d="M150 74 L216 104.5 M88 104 H212" className="aa-rim" />
        {cols.map((x) => <path key={x} d={`M${x + 5.5} 117 V169`} className="aa-rim soft" />)}
        <path d="M204 114 V172" className="aa-rim soft" />

        {/* three steps up */}
        <rect x="90" y="172" width="120" height="4.4" className="aa-wall m-stone" />
        <rect x="84" y="176.2" width="132" height="4.4" className="aa-wall m-stone" />
        <rect x="78" y="180.4" width="144" height="4.6" className="aa-wall m-stone" />
        <Trail x={150} y={185} w={16} />
        <path d="M137 176 L163 176 L170 185 L130 185 Z" fill="url(#aa-spill)" className="aa-spill" />
      </g>
    ),
  };
}

/** A black dog sitting, facing right (mirror for left). Cooper and Shadow at the door. */
const DOG = 'M-9 0 Q-11.4 -6 -7.4 -10 Q-4.4 -12.6 -1 -12 L1 -16 Q2 -21 6.5 -21 Q9 -21 10 -18.8 L13.4 -17.6 Q14.6 -16.6 13.2 -15.4 L9 -14.9 Q7 -14.5 6.4 -12.6 L6.8 -6 L6.6 -0.4 Q7.8 0 7.4 0.8 H4.2 L4 -6 L2.8 -6.2 L2.6 -0.4 Q3.6 0 3.2 0.8 H0 Z';
const DOG_EAR = 'M4.4 -20.6 Q1 -20.2 0.8 -16 Q2.8 -15 4.6 -17.6 Z';
const DOG_RIM = 'M-10.4 -5 Q-9.6 -10 -4.4 -12.1 M1.2 -16.4 Q2.4 -21 6.5 -21 Q9 -21 10 -18.8 L13.2 -17.6';
const DOG_WARM = 'M13 -15.6 L9 -14.9 Q7 -14.5 6.4 -12.6 L6.8 -6 L6.6 -0.4';

/** The Hearth: a white cottage, a heart in the gable, smoke from the chimney, and the dogs at the door. */
function Hearth(heat: number): Scene {
  return {
    moon: [252, 34],
    pines: [[62, 172, 0.4], [244, 170, 0.46], [10, 226, 1.04], [294, 228, 1.0]],
    body: (
      <g className="aa-b">
        <ellipse cx="152" cy="184" rx="90" ry="6" fill="url(#aa-shadow)" />
        <circle cx="152" cy="134" r="104" fill="url(#aa-glow)" className="aa-bglow" />
        <circle cx="152" cy="120" r="44" fill="url(#aa-pink)" className="aa-heartglow" />
        <ellipse cx="152" cy="192" rx="100" ry="13" fill="url(#aa-pool)" className="aa-pool" />

        {/* the chimney and its smoke, lit warm as it leaves */}
        <rect x="104" y="84" width="18" height="50" className="aa-wall m-stone" />
        <rect x="104" y="84" width="18" height="50" fill="url(#aa-stones)" />
        <rect x="101" y="80" width="24" height="5" className="aa-wall m-stone" />
        <g className="aa-smoke warm">
          <circle cx="112" cy="70" r="5" className="warm" /><circle cx="116" cy="56" r="7.5" /><circle cx="110" cy="40" r="10" /><circle cx="118" cy="26" r="12" />
        </g>

        {/* the cottage */}
        <path d="M94 182 V138 L152 100 L210 138 V182 Z" className="aa-wall m-white" />
        <path d="M94 182 V138 L152 100 L210 138 V182 Z" fill="url(#aa-siding)" />
        <path d="M82 142 L152 92 L222 142 L213 145 L152 101 L91 145 Z" className="aa-wall m-roof" />
        <path d="M82 142 L152 92 L222 142 L213 145 L152 101 L91 145 Z" fill="url(#aa-shingle)" />
        <path d="M152 92 L222 142" className="aa-rim" />
        <path d="M210 145 V182" className="aa-rim soft" />

        {/* the heart window in the gable */}
        <path d="M152 131.5 C139 123, 141 111.5, 148 113 Q150.6 113.8 152 116.6 Q153.4 113.8 156 113 C163 111.5, 165 123, 152 131.5 Z" className="aa-heartframe" />
        <path d="M152 129 C141.5 122, 143 113.6, 148.4 114.8 Q150.8 115.6 152 118.4 Q153.2 115.6 155.6 114.8 C161 113.6, 162.5 122, 152 129 Z" fill="url(#aa-heart)" className="aa-heartwin" />
        <path d="M152 118.4 V129 M145 121 H159" className="aa-lead" />

        {/* windows with curtains and flower boxes */}
        {[102, 178].map((x, i) => (
          <g key={x}>
            <rect x={x - 5} y="143" width="34" height="28" fill="url(#aa-glow)" className="aa-halo" />
            <rect x={x - 1.5} y="146.5" width="27" height="23" className="aa-frame-t" />
            <rect x={x} y="148" width="24" height="20" className={i === 1 && heat <= 0.4 ? 'aa-win on dim' : 'aa-win on'} />
            <path d={`M${x} 148 Q${x + 6} 156 ${x + 3} 168 H${x} Z M${x + 24} 148 Q${x + 18} 156 ${x + 21} 168 H${x + 24} Z`} className="aa-curtain" />
            <path d={`M${x + 12} 148 V168 M${x} 158 H${x + 24}`} className="aa-mullion" />
            <path d={`M${x - 7} 147 h5.5 v22 h-5.5 z M${x + 25.5} 147 h5.5 v22 h-5.5 z`} className="aa-shutter" />
            <rect x={x - 2} y="168.5" width="28" height="4.6" className="aa-wall m-wood" />
            {[0, 1, 2, 3, 4, 5].map((k) => <circle key={k} cx={x + 1.5 + k * 4.2} cy={168} r={1.7} className={`aa-bloom b${(k + i) % 3}`} />)}
          </g>
        ))}

        {/* the door stands ajar, lamplight spilling down the path */}
        <Trail x={152} y={184.6} w={11} />
        <path d="M141 182 L163 182 L182 206 L118 206 Z" fill="url(#aa-spill)" className="aa-spill" />
        <path d="M140 182 V157 A12 9 0 0 1 164 157 V182 Z" className="aa-frame-t" />
        <path d="M142 182 V157.5 A10 7.6 0 0 1 162 157.5 V182 Z" className="aa-win on doorway" />
        <path d="M142 182 V157.5 Q142 150.2 152 149.9 L151 182 Z" className="aa-doorleaf" />
        <circle cx="147" cy="164" r="3.4" className="aa-wreath" />
        <circle cx="147" cy="161" r=".9" className="aa-bow" />
        <circle cx="168" cy="160" r="12" fill="url(#aa-glow)" className="aa-lampglow" />
        <path d="M165.6 156 H170.4 L169.6 162 H166.4 Z" className="aa-lamphead" />
        <rect x="138" y="182" width="28" height="2.6" className="aa-wall m-stone" />

        {/* Cooper and Shadow, waiting at the door */}
        {([[124, 195, 1.0, 1], [181, 196, 0.94, -1]] as const).map(([x, y, s, f]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${s * f} ${s})`}>
            <ellipse cx="0" cy="0.6" rx="11" ry="2" fill="url(#aa-shadow)" />
            <path d="M-9 -0.6 Q-14 0 -16 -3" className="aa-dogtail" />
            <path d={DOG} className="aa-dog" />
            <path d={DOG_EAR} className="aa-dogear" />
            <path d={DOG_RIM} className="aa-dogmoon" />
            <path d={DOG_WARM} className="aa-dogrim" />
            <circle cx="8.6" cy="-18.4" r=".6" className="aa-dogeye" />
          </g>
        ))}

        {/* a picket fence either side of the yard */}
        {[[22, 96], [208, 284]].map(([a, b]) => (
          <g key={a} className="aa-fence">
            <path d={`M${a} 187 H${b} M${a} 194 H${b}`} className="aa-rail" />
            {Array.from({ length: Math.floor((b - a) / 7) + 1 }, (_, k) => a + k * 7).map((x) => <path key={x} d={`M${x - 2} 199 V184 L${x} 181.5 L${x + 2} 184 V199 Z`} className="aa-picket" />)}
          </g>
        ))}
      </g>
    ),
  };
}

const SCENES: Record<AreaKey, (heat: number) => Scene> = { office: Office, observatory: Observatory, forge: Forge, bank: Bank, hearth: Hearth };
