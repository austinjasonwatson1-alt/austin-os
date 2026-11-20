import { useEffect, useRef, type CSSProperties } from 'react';
import { moonName, moonPath, moonPhase, season as seasonOf, skyPhase, type Phase, type Season, type Weather } from '../core/skyLogic';
import { useSky } from '../core/skyStore';
import { todayISO } from '../core/dates';
import { dayTotal, lampHeat } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { useMinuteClock } from './lamp';

interface Star { x: number; y: number; r: number; base: number; speed: number; phase: number; warm: boolean }
type Effect = 'snow' | 'rain' | 'leaves' | 'petals' | 'fireflies' | 'none';
interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; spin: number; t: number }

/** Deterministic PRNG so the sky is the same every load. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** `?sky=dawn&season=winter&weather=rain` previews any sky (handy for checking every look). */
function override<T extends string>(key: string, allowed: readonly T[]): T | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get(key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

const STAR_LIGHT: Record<Phase, number> = { night: 1, dusk: 0.55, dawn: 0.4, golden: 0.18, day: 0.08 };

function effectFor(season: Season, weather: Weather | null): Effect {
  if (weather === 'rain' || weather === 'storm') return 'rain';
  if (weather === 'snow') return 'snow';
  return { winter: 'snow', spring: 'petals', summer: 'fireflies', autumn: 'leaves' }[season] as Effect;
}

/**
 * The sky behind everything: follows the real clock (dawn, day, golden hour, dusk, night), shows
 * tonight's actual moon, the season (snow, petals, fireflies, leaves) or the real weather if it is
 * turned on, drifts with the pointer, and throws a shooting star on an elite day.
 */
export function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);
  const now = useMinuteClock();
  const { weather: liveWeather } = useSky();
  const phase = override('sky', ['night', 'dawn', 'day', 'golden', 'dusk'] as const) ?? skyPhase(now);
  const season = override('season', ['winter', 'spring', 'summer', 'autumn'] as const) ?? seasonOf(now);
  const weather = override('weather', ['clear', 'cloudy', 'fog', 'rain', 'snow', 'storm'] as const) ?? liveWeather;
  const effect = effectFor(season, weather);
  const cloudy = weather === 'cloudy' || weather === 'fog' || weather === 'rain' || weather === 'storm' || weather === 'snow';
  const moon = moonPhase(now);

  // Read by the canvas loop without restarting it.
  const live = useRef({ starLight: STAR_LIGHT[phase] * (cloudy ? 0.35 : 1), effect, storm: weather === 'storm' });
  live.current = { starLight: STAR_LIGHT[phase] * (cloudy ? 0.35 : 1), effect, storm: weather === 'storm' };

  // The cabin glow along the treeline burns brighter the more of today you've put in.
  const heat = useLedger((s) => lampHeat(dayTotal(s.days[todayISO()]), s.thresholds));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: Star[] = [];
    let parts: Particle[] = [];
    let partsFor: Effect | null = null;
    let w = 0;
    let h = 0;
    let raf = 0;
    type Shoot = { x: number; y: number; vx: number; vy: number; life: number; big: boolean };
    let shoots: Shoot[] = [];
    let nextShoot = performance.now() + 6000;
    let flash = 0;
    let nextBolt = performance.now() + 8000;

    const spawn = (e: Effect, anywhere: boolean): Particle => {
      const y = anywhere ? Math.random() * h : -10;
      const base = { x: Math.random() * w, y, vx: 0, vy: 0, r: 1, a: 1, spin: Math.random() * Math.PI * 2, t: Math.random() * 1000 };
      switch (e) {
        case 'snow': return { ...base, vx: (Math.random() - 0.5) * 0.3, vy: 0.35 + Math.random() * 0.7, r: 0.8 + Math.random() * 2, a: 0.35 + Math.random() * 0.5 };
        case 'rain': return { ...base, vx: -1.4, vy: 9 + Math.random() * 6, r: 8 + Math.random() * 10, a: 0.12 + Math.random() * 0.18 };
        case 'leaves': return { ...base, vx: 0.3 + Math.random() * 0.6, vy: 0.5 + Math.random() * 0.6, r: 3 + Math.random() * 3, a: 0.55 + Math.random() * 0.3 };
        case 'petals': return { ...base, vx: 0.4 + Math.random() * 0.5, vy: 0.4 + Math.random() * 0.5, r: 2 + Math.random() * 2, a: 0.5 + Math.random() * 0.3 };
        case 'fireflies': return { ...base, y: h * (0.55 + Math.random() * 0.4), vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2, r: 1.4 + Math.random() * 1.2, a: 1 };
        default: return base;
      }
    };
    const density: Record<Effect, number> = { snow: 1 / 9000, rain: 1 / 5000, leaves: 1 / 45000, petals: 1 / 40000, fireflies: 1 / 38000, none: 0 };
    const seedParts = (e: Effect) => {
      partsFor = e;
      parts = reduce ? [] : Array.from({ length: Math.round(w * h * density[e]) }, () => spawn(e, true));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = rng(1337);
      stars = Array.from({ length: Math.round((w * h) / 7500) }, () => ({
        x: rand() * w, y: rand() * h * 0.85, r: rand() < 0.08 ? 1.5 + rand() : 0.4 + rand() * 0.9,
        base: 0.25 + rand() * 0.6, speed: 0.4 + rand() * 1.4, phase: rand() * Math.PI * 2, warm: rand() < 0.18,
      }));
      seedParts(live.current.effect);
    };

    const celebrate = () => {
      shoots.push({ x: w * 0.95, y: h * 0.08, vx: -11, vy: 4.2, life: 1.4, big: true });
      flash = 0.5;
    };
    window.addEventListener('austin:celebrate', celebrate);

    const drawShoot = (s: Shoot) => {
      const len = s.big ? 18 : 9;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
      grad.addColorStop(0, `rgba(255,244,214,${Math.min(1, s.life)})`);
      grad.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.big ? 2.6 : 1.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * len, s.y - s.vy * len);
      ctx.stroke();
      if (s.big) {
        ctx.globalAlpha = Math.min(1, s.life);
        ctx.fillStyle = '#fff6dc';
        ctx.shadowColor = '#ffd27a';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      s.x += s.vx;
      s.y += s.vy;
      s.life -= s.big ? 0.012 : 0.018;
    };

    const draw = (t: number) => {
      const { starLight, effect: fx, storm } = live.current;
      if (fx !== partsFor) seedParts(fx);
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const a = (reduce ? s.base : s.base * (0.65 + 0.35 * Math.sin((t / 1000) * s.speed + s.phase))) * starLight;
        if (a < 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.warm ? '#f3d9a4' : '#dfe8ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const p of parts) {
        p.t += 1;
        if (fx === 'rain') {
          ctx.strokeStyle = `rgba(190,210,240,${p.a})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.2, p.y + p.r);
          ctx.stroke();
        } else if (fx === 'snow') {
          p.vx += Math.sin(p.t / 60 + p.spin) * 0.01;
          ctx.globalAlpha = p.a;
          ctx.fillStyle = '#f2f5fb';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (fx === 'leaves' || fx === 'petals') {
          p.spin += 0.03;
          p.vx = (fx === 'leaves' ? 0.5 : 0.4) + Math.sin(p.t / 50 + p.spin) * 0.5;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          ctx.scale(1, Math.abs(Math.sin(p.spin * 1.3)) * 0.8 + 0.2);
          ctx.globalAlpha = p.a;
          ctx.fillStyle = fx === 'leaves' ? (p.r > 4.5 ? '#c4632b' : '#d99a3a') : '#e8b8c8';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (fx === 'fireflies') {
          p.vx += (Math.random() - 0.5) * 0.04;
          p.vy += (Math.random() - 0.5) * 0.04;
          p.vx *= 0.98;
          p.vy *= 0.98;
          const glow = Math.max(0, Math.sin(p.t / 40 + p.spin * 7));
          ctx.globalAlpha = glow * 0.9;
          ctx.fillStyle = '#e6f59a';
          ctx.shadowColor = '#d8f070';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > h + 20 || p.x > w + 20 || p.x < -20 || (fx === 'fireflies' && (p.y < h * 0.4 || p.y > h))) Object.assign(p, spawn(fx, fx === 'fireflies'));
      }
      ctx.globalAlpha = 1;

      if (!reduce) {
        if (t > nextShoot && starLight > 0.3) {
          shoots.push({ x: w * (0.3 + Math.random() * 0.6), y: h * Math.random() * 0.3, vx: -6, vy: 2.6, life: 1, big: false });
          nextShoot = t + 14000 + Math.random() * 16000;
        }
        shoots.forEach(drawShoot);
        shoots = shoots.filter((s) => s.life > 0);
        if (storm && t > nextBolt) {
          flash = 0.35;
          nextBolt = t + 7000 + Math.random() * 14000;
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(200,215,255,${flash * 0.25})`;
          ctx.fillRect(0, 0, w, h);
          flash -= 0.02;
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    // Stars drift a little with the pointer.
    const sky = canvas.parentElement;
    const move = (e: PointerEvent) => {
      if (reduce || !sky) return;
      sky.style.setProperty('--spx', `${((e.clientX / w) * 2 - 1) * -8}px`);
      sky.style.setProperty('--spy', `${((e.clientY / h) * 2 - 1) * -5}px`);
    };
    window.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('austin:celebrate', celebrate);
    };
  }, []);

  return (
    <>
      <div className="sky" data-phase={phase} data-weather={weather ?? 'clear'} aria-hidden>
        {(['night', 'dawn', 'day', 'golden', 'dusk'] as Phase[]).map((p) => (
          <div key={p} className={`sky-layer sky-${p}`} style={{ opacity: p === phase ? 1 : 0 }} />
        ))}
        <Moon p={moon} phase={phase} dim={cloudy} />
        {cloudy && <div className="clouds"><i /><i /><i /><i /></div>}
        <canvas ref={ref} />
      </div>
      <div className="sky-heat" style={{ '--heat': heat } as CSSProperties} aria-hidden />
      <Treeline snow={season === 'winter' || weather === 'snow'} />
      <div className="fog" aria-hidden />
    </>
  );
}

function Moon({ p, phase, dim }: { p: number; phase: Phase; dim: boolean }) {
  const light = phase === 'day' ? 0.28 : phase === 'golden' ? 0.45 : 0.95;
  return (
    <svg className="moon" viewBox="-60 -60 120 120" style={{ opacity: light * (dim ? 0.45 : 1) }}>
      <title>{moonName(p)}</title>
      <defs>
        <radialGradient id="moonglow"><stop offset="0" stopColor="#f4ecd8" stopOpacity=".35" /><stop offset="1" stopColor="#f4ecd8" stopOpacity="0" /></radialGradient>
        <radialGradient id="moonface" cx=".4" cy=".35"><stop offset="0" stopColor="#fbf6ea" /><stop offset="1" stopColor="#d9d1bd" /></radialGradient>
      </defs>
      <circle r="58" fill="url(#moonglow)" />
      <circle r="24" fill="rgba(233,228,216,.07)" />
      <path d={moonPath(p, 24)} fill="url(#moonface)" />
      <g fill="rgba(150,140,120,.22)">
        <circle cx="-7" cy="-6" r="4" /><circle cx="6" cy="7" r="5" /><circle cx="9" cy="-9" r="2.5" />
      </g>
    </svg>
  );
}

/** Procedural pine silhouettes along the bottom edge; snow on them in winter. */
function Treeline({ snow }: { snow: boolean }) {
  const rand = rng(42);
  const trees: string[] = [];
  let x = -20;
  while (x < 1600) {
    const hgt = 50 + rand() * 80;
    const wd = 22 + rand() * 26;
    const tiers = 4 + Math.floor(rand() * 3);
    let d = `M${x},150 L${x + wd / 2 - 1.5},150 `;
    for (let i = 0; i < tiers; i++) {
      const ty = 150 - (hgt * (i + 1)) / tiers;
      const tw = (wd / 2) * (1 - (i / tiers) * 0.8);
      d += `L${x + wd / 2 + tw},${ty + hgt / tiers / 2} L${x + wd / 2 + tw * 0.4},${ty + hgt / tiers / 2} `;
    }
    d += `L${x + wd / 2},${150 - hgt - 8} `;
    for (let i = tiers - 1; i >= 0; i--) {
      const ty = 150 - (hgt * (i + 1)) / tiers;
      const tw = (wd / 2) * (1 - (i / tiers) * 0.8);
      d += `L${x + wd / 2 - tw * 0.4},${ty + hgt / tiers / 2} L${x + wd / 2 - tw},${ty + hgt / tiers / 2} `;
    }
    d += `L${x + wd / 2 + 1.5},150 Z`;
    trees.push(d);
    x += wd * (0.5 + rand() * 0.45);
  }
  return (
    <svg className="treeline" viewBox="0 0 1600 150" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="tl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141c30" />
          <stop offset="1" stopColor="#05070d" />
        </linearGradient>
        <linearGradient id="tls" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d3e6" />
          <stop offset=".1" stopColor="#5d6a85" />
          <stop offset=".22" stopColor="#141c30" />
          <stop offset="1" stopColor="#05070d" />
        </linearGradient>
      </defs>
      <path d={trees.join(' ')} fill={snow ? 'url(#tls)' : 'url(#tl)'} />
    </svg>
  );
}
