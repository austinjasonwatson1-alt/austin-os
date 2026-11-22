import type { CSSProperties } from 'react';
import { LIFE_AREAS, type Spoke } from './logic';
import '../../styles/life.css';

/** The wheel: one spoke per area, this week filled in amber over last week's outline. */
export function BalanceWheel({ now, prev, size = 340, onPick }: { now: Spoke[]; prev?: Spoke[]; size?: number; onPick?: (path: string) => void }) {
  const R = 120, c = 160, n = now.length;
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const; };
  const poly = (sp: Spoke[]) => sp.map((s, i) => pt(i, 14 + Math.max(0.04, s.score) * (R - 14)).join(',')).join(' ');
  return (
    <svg className="wheel" viewBox="0 0 320 320" width={size} height={size} role="img" aria-label={`This week: ${now.map((s) => `${LIFE_AREAS.find((a) => a.id === s.area)!.name} ${Math.round(s.score * 100)}%`).join(', ')}`}>
      <defs>
        <radialGradient id="wheel-fill"><stop offset="0" stopColor="#ffd27a" stopOpacity=".55" /><stop offset="1" stopColor="#e8a84b" stopOpacity=".18" /></radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((r) => <circle key={r} cx={c} cy={c} r={14 + r * (R - 14)} className="wheel-ring" />)}
      {now.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="wheel-spoke" />; })}
      {prev && <polygon points={poly(prev)} className="wheel-prev" />}
      <polygon points={poly(now)} className="wheel-now" fill="url(#wheel-fill)" />
      {now.map((s, i) => {
        const a = LIFE_AREAS.find((l) => l.id === s.area)!;
        const [x, y] = pt(i, 14 + Math.max(0.04, s.score) * (R - 14));
        const [lx, ly] = pt(i, R + 22);
        return (
          <g key={s.area} className="wheel-pt" style={{ '--c': a.color } as CSSProperties} onClick={() => onPick?.(a.path)} role={onPick ? 'link' : undefined}>
            <circle cx={x} cy={y} r="4.5" />
            <text x={lx} y={ly - 4} textAnchor="middle" className="wheel-glyph">{a.glyph}</text>
            <text x={lx} y={ly + 10} textAnchor="middle" className="wheel-lbl">{a.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

