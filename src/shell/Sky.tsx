import { useEffect, useRef, type CSSProperties } from 'react';
import { todayISO } from '../core/dates';
import { dayTotal, lampHeat } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  speed: number;
  phase: number;
  warm: boolean;
}

/** Deterministic PRNG so the sky is the same every load. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** A slowly twinkling starfield with the occasional shooting star, plus a pine treeline silhouette. */
export function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = performance.now() + 6000;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = rng(1337);
      const count = Math.round((w * h) / 7500);
      stars = Array.from({ length: count }, () => ({
        x: rand() * w,
        y: rand() * h * 0.85,
        r: rand() < 0.08 ? 1.5 + rand() : 0.4 + rand() * 0.9,
        base: 0.25 + rand() * 0.6,
        speed: 0.4 + rand() * 1.4,
        phase: rand() * Math.PI * 2,
        warm: rand() < 0.18,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? s.base : s.base * (0.65 + 0.35 * Math.sin(t / 1000 * s.speed + s.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = s.warm ? '#f3d9a4' : '#dfe8ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce) {
        if (!shoot && t > nextShoot) {
          shoot = { x: w * (0.3 + Math.random() * 0.6), y: h * Math.random() * 0.3, vx: -6, vy: 2.6, life: 1 };
          nextShoot = t + 14000 + Math.random() * 16000;
        }
        if (shoot) {
          const grad = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
          grad.addColorStop(0, `rgba(255,244,214,${shoot.life})`);
          grad.addColorStop(1, 'rgba(255,244,214,0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
          ctx.stroke();
          shoot.x += shoot.vx;
          shoot.y += shoot.vy;
          shoot.life -= 0.018;
          if (shoot.life <= 0) shoot = null;
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // The cabin glow along the treeline burns brighter the more of today you've put in.
  const heat = useLedger((s) => lampHeat(dayTotal(s.days[todayISO()]), s.thresholds));

  return (
    <>
      <div className="sky" aria-hidden>
        <canvas ref={ref} />
      </div>
      <div className="sky-heat" style={{ '--heat': heat } as CSSProperties} aria-hidden />
      <Treeline />
      <div className="fog" aria-hidden />
    </>
  );
}

/** Procedural pine silhouettes along the bottom edge. */
function Treeline() {
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
      </defs>
      <path d={trees.join(' ')} fill="url(#tl)" />
    </svg>
  );
}
