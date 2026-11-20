import type { CSSProperties } from 'react';
import '../../styles/candle.css';

/** A candle: the flame grows with `heat` (0 = unlit). */
export function Candle({ heat, size = 1 }: { heat: number; size?: number }) {
  return (
    <span className={heat > 0 ? 'candle lit' : 'candle'} style={{ '--h': heat, '--s': size } as CSSProperties} aria-hidden>
      <span className="candle-glow" />
      <span className="candle-flame"><i /></span>
      <span className="candle-wick" />
      <span className="candle-wax" />
    </span>
  );
}
