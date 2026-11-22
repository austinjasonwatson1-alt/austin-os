import type { CSSProperties, ReactNode } from 'react';
import { coverSeed, type Stage } from './projects';
import '../../styles/pjcover.css';

/**
 * A small painting for a project card. The kind picks the scene, the name seeds the colours,
 * and an idea is drawn as a blueprint (lines only) until it's being built.
 */
export function ProjectCover({ name, kind, stage }: { name: string; kind: string; stage: Stage }) {
  const s = coverSeed(name);
  const id = `pc${Math.abs(s.hue * 7919 + Math.round(s.a * 1e4))}`;
  const H = s.hue, H2 = (s.hue + 40 + Math.round(s.b * 60)) % 360;
  return (
    <svg className={`pj-cover k-${kind.toLowerCase().replace(/\s+/g, '-')} st-${stage}`} viewBox="0 0 240 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={`hsl(${H} 45% 16%)`} />
          <stop offset="1" stopColor={`hsl(${H2} 40% 8%)`} />
        </linearGradient>
        <radialGradient id={`${id}g`} cx={0.25 + s.a * 0.5} cy="0.35" r="0.7">
          <stop offset="0" stopColor={`hsl(${H2} 80% 62%)`} stopOpacity=".55" />
          <stop offset="1" stopColor={`hsl(${H2} 80% 62%)`} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${H} 70% 70%)`} />
          <stop offset="1" stopColor={`hsl(${H2} 60% 45%)`} />
        </linearGradient>
      </defs>
      <rect width="240" height="110" fill={`url(#${id}s)`} />
      <rect width="240" height="110" fill={`url(#${id}g)`} />
      {Array.from({ length: 9 }, (_, i) => <circle key={i} className="pc-star" cx={(i * 53 + s.c * 240) % 240} cy={(i * 31 + s.b * 40) % 52} r={i % 3 ? 0.7 : 1.2} />)}
      <g className="pc-art" style={{ '--pf': `url(#${id}f)`, '--pl': `hsl(${H} 80% 78%)` } as CSSProperties}>{scene(kind, s)}</g>
      {stage === 'idea' && <g className="pc-grid">{Array.from({ length: 12 }, (_, i) => <line key={i} x1={i * 20} y1="0" x2={i * 20} y2="110" />)}{Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 20} x2="240" y2={i * 20} />)}</g>}
    </svg>
  );
}

type Seed = ReturnType<typeof coverSeed>;

function scene(kind: string, s: Seed): ReactNode {
  switch (kind) {
    case 'Game': {
      // a field under lights: the pitch, its lines, a ball mid-flight
      const bx = 60 + s.a * 120;
      return (
        <>
          <path className="pc-fill" d="M0 110 L40 70 H200 L240 110 Z" opacity=".55" />
          <path className="pc-line" d="M120 70 V110 M70 70 L50 110 M170 70 L190 110 M60 90 H180" />
          <ellipse className="pc-line" cx="120" cy="90" rx="22" ry="7" />
          <path className="pc-trail" d={`M30 96 Q${bx} ${8 + s.b * 20} ${bx + 50} 40`} />
          <circle className="pc-glow" cx={bx + 50} cy="40" r="5" />
          {[24, 216].map((x) => <g key={x}><line className="pc-line" x1={x} y1="70" x2={x} y2="20" /><rect className="pc-glow" x={x - 7} y="14" width="14" height="6" rx="2" /></g>)}
        </>
      );
    }
    case 'Writing tool':
      return (
        <>
          <g transform={`rotate(${-6 + s.a * 8} 110 70)`}>
            <rect className="pc-paper" x="70" y="26" width="90" height="100" rx="3" />
            {Array.from({ length: 7 }, (_, i) => <line key={i} className="pc-rule" x1="80" y1={42 + i * 10} x2={140 - (i === 6 ? 30 : (i * 13) % 20)} y2={42 + i * 10} />)}
          </g>
          <path className="pc-fill" d="M196 14 C176 30 160 56 150 92 L156 94 C168 60 186 36 204 20 Z" />
          <path className="pc-line" d="M150 92 L144 104" />
        </>
      );
    case 'Job search':
      return (
        <>
          <path className="pc-glow-soft" d="M60 110 A60 60 0 0 1 180 110 Z" />
          <g transform={`rotate(${-4 + s.b * 8} 120 66)`}>
            <rect className="pc-paper" x="76" y="40" width="88" height="56" rx="4" />
            <path className="pc-rule" d="M76 42 L120 74 L164 42" />
            <circle className="pc-seal" cx="120" cy="74" r="7" />
          </g>
          {[0, 1, 2].map((i) => <path key={i} className="pc-trail" d={`M${186 + i * 10} ${70 - i * 12} l14 -6`} />)}
        </>
      );
    case 'Agent': {
      // a little constellation: nodes the agent visits, the path it takes
      const pts = Array.from({ length: 7 }, (_, i) => [24 + i * 32 + ((s.a * 100 + i * 37) % 14), 30 + ((s.b * 200 + i * 53) % 60)] as const);
      return (
        <>
          <path className="pc-trail" d={`M${pts.map((p) => p.join(' ')).join(' L')}`} />
          {pts.map(([x, y], i) => <circle key={i} className={i === Math.floor(s.c * 7) ? 'pc-glow' : 'pc-node'} cx={x} cy={y} r={i === Math.floor(s.c * 7) ? 6 : 3.4} />)}
        </>
      );
    }
    case 'Life':
      return (
        <>
          <path className="pc-hill" d="M0 110 Q60 64 130 86 T240 78 V110 Z" />
          <path className="pc-fill" d="M90 96 V70 L120 48 L150 70 V96 Z" />
          <rect className="pc-glow" x="104" y="74" width="12" height="11" rx="1" />
          <rect className="pc-glow" x="124" y="74" width="12" height="11" rx="1" opacity=".6" />
          <rect className="pc-line-fill" x="138" y="50" width="6" height="12" />
        </>
      );
    case 'Work':
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => { const h = 18 + ((s.a * 90 + i * 23) % 50) + i * 6; return <rect key={i} className="pc-fill" x={58 + i * 26} y={100 - h} width="18" height={h} rx="2" opacity={0.55 + i * 0.1} />; })}
          <path className="pc-trail" d="M50 82 L92 66 L126 70 L166 40 L196 28" />
        </>
      );
    default:
      return (
        <>
          {[38, 28, 18].map((r, i) => <circle key={r} className={i === 2 ? 'pc-fill' : 'pc-line'} cx={120 + (s.a - 0.5) * 60} cy="60" r={r} />)}
        </>
      );
  }
}
