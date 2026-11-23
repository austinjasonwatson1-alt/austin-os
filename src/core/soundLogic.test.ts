import { describe, expect, it } from 'vitest';
import { outdoors, sceneFor, type SoundWorld } from './soundLogic';

const day: SoundWorld = { weather: null, phase: 'day', season: 'summer' };

describe('soundscape scenes', () => {
  it('lets the real weather lead outdoors', () => {
    expect(outdoors({ ...day, weather: 'rain' }).mix.rain).toBeGreaterThan(0.5);
    expect(outdoors({ ...day, weather: 'storm' }).mix.thunder).toBeGreaterThan(0);
    expect(outdoors({ ...day, weather: 'snow' }).mix.rain).toBeUndefined();
  });

  it('follows the time of day and the season without weather', () => {
    expect(outdoors(day).mix.birds).toBeGreaterThan(0);
    expect(outdoors({ ...day, phase: 'night' }).mix.crickets).toBeGreaterThan(0);
    expect(outdoors({ ...day, phase: 'night', season: 'winter' }).mix.crickets).toBeUndefined();
    expect(outdoors({ ...day, phase: 'night', season: 'winter' }).mix.owl).toBeGreaterThan(0);
  });

  it('gives each place its own sound', () => {
    expect(sceneFor('/home', day)).toEqual(outdoors(day));
    expect(sceneFor('/chapel', day).mix.organ).toBeGreaterThan(0);
    expect(sceneFor('/cabin/shelf', day).mix.fire).toBeGreaterThan(0);
    expect(sceneFor('/office', day).mix.room).toBeGreaterThan(0);
    expect(sceneFor('/cabin/write/m/c', day).mix.calm).toBeGreaterThan(0);
    expect(sceneFor('/cabin/timer', day).mix.calm).toBeGreaterThan(0);
    expect(sceneFor('/somewhere-new', day)).toEqual(outdoors(day));
    expect(sceneFor('/kennel', day).mix.fire).toBeGreaterThan(0);
    expect(sceneFor('/day', day).mix.calm).toBeGreaterThan(0);
  });

  it('brings the weather indoors as rain on the roof', () => {
    const wet = { ...day, weather: 'rain' as const };
    expect(sceneFor('/cabin', wet).mix.rain).toBeGreaterThan(0);
    expect(sceneFor('/cabin', day).mix.rain).toBeUndefined();
    expect(sceneFor('/cabin/write/m/c', wet).mix.rain).toBeGreaterThan(sceneFor('/cabin/write/m/c', day).mix.rain!);
    expect(sceneFor('/cabin', wet).label).toMatch(/rain/);
  });
});

describe('the schedule', () => {
  it('is a calm room', () => {
    expect(sceneFor('/schedule', { weather: null, phase: 'day', season: 'summer' }).label).toBe('A calm room');
  });
});
