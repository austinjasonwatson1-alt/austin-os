/** How a page change should feel: walking deeper in, stepping back out, or moving along. */
export type Motion = 'in' | 'out' | 'side';

const depth = (p: string) => (p === '/home' ? 0 : p.split('/').filter(Boolean).length);

export function routeMotion(prev: string | null, next: string): Motion {
  if (!prev || prev === next) return 'side';
  const a = depth(prev);
  const b = depth(next);
  return b > a ? 'in' : b < a ? 'out' : 'side';
}
