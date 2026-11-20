import { describe, expect, it } from 'vitest';
import { routeMotion } from './routeLogic';

describe('routeMotion', () => {
  it('walks in, steps out, or moves along', () => {
    expect(routeMotion('/home', '/cabin')).toBe('in');
    expect(routeMotion('/cabin', '/cabin/ledger')).toBe('in');
    expect(routeMotion('/cabin/ledger', '/home')).toBe('out');
    expect(routeMotion('/cabin/ledger', '/cabin/lounge')).toBe('side');
    expect(routeMotion('/cabin', '/chapel')).toBe('side');
    expect(routeMotion(null, '/home')).toBe('side');
  });
});
