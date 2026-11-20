import { describe, expect, it } from 'vitest';
import { moonName, moonPath, moonPhase, roughly, season, skyPhase, sunTimes, weatherKind } from './skyLogic';

const at = (s: string) => new Date(s);

describe('the sky', () => {
  it('has long summer days and short winter ones', () => {
    const s = sunTimes(at('2026-06-21T12:00:00')), w = sunTimes(at('2026-12-21T12:00:00'));
    expect(s.rise).toBeLessThan(5.5);
    expect(s.set).toBeGreaterThan(19.9);
    expect(w.rise).toBeGreaterThan(7.5);
    expect(w.set).toBeLessThan(17.1);
  });

  it('moves through the light of a November day', () => {
    expect(['02:00', '07:00', '12:00', '16:15', '17:45', '21:00'].map((t) => skyPhase(at(`2026-11-20T${t}:00`))))
      .toEqual(['night', 'dawn', 'day', 'golden', 'dusk', 'night']);
  });

  it('knows the moon', () => {
    expect(moonPhase(at('2024-01-11T11:57:00Z'))).toBeLessThan(0.02);
    expect(Math.abs(moonPhase(at('2024-01-25T17:54:00Z')) - 0.5)).toBeLessThan(0.02);
    expect(moonName(0.5)).toBe('Full moon');
    expect(moonName(0.26)).toBe('First quarter');
    expect(moonPath(0.5, 10)).toBe('M0 -10 A10 10 0 0 1 0 10 A10.00 10 0 0 1 0 -10 Z');
  });

  it('names the season', () => {
    expect(['01', '04', '07', '10', '12'].map((m) => season(at(`2026-${m}-15T12:00:00`)))).toEqual(['winter', 'spring', 'summer', 'autumn', 'winter']);
  });

  it('reads weather codes and blurs location', () => {
    expect([0, 3, 45, 61, 80, 73, 95].map(weatherKind)).toEqual(['clear', 'cloudy', 'fog', 'rain', 'rain', 'snow', 'storm']);
    expect(roughly(40.71234)).toBe(40.7);
  });
});
