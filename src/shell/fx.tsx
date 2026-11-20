import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A number that rolls up (or down) to its value. Instant for reduced motion. */
export function CountUp({ value, format = (n) => n.toLocaleString('en-US'), ms = 900 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion()) return void setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return <>{format(shown)}</>;
}

/** Pointer handlers that tilt a card toward the cursor and move a lamplight sheen across it. */
export function tilt(max = 6) {
  return {
    onPointerMove(e: RPointerEvent<HTMLElement>) {
      if (e.pointerType !== 'mouse' || reducedMotion()) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`);
      el.style.setProperty('--sx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--sy', `${(y * 100).toFixed(1)}%`);
    },
    onPointerLeave(e: RPointerEvent<HTMLElement>) {
      const el = e.currentTarget;
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    },
  };
}

/** A short burst of embers rising from an element (celebrations). */
export function embers(el: HTMLElement | null, n = 18) {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'ember';
    s.style.left = `${r.left + r.width * (0.2 + Math.random() * 0.6)}px`;
    s.style.top = `${r.top + r.height * (0.4 + Math.random() * 0.4)}px`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    s.style.setProperty('--dy', `${-80 - Math.random() * 140}px`);
    s.style.animationDelay = `${Math.random() * 180}ms`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1700);
  }
}
