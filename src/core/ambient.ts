/**
 * The soundscape: ambient sound synthesized in the browser with Web Audio. There are no audio files
 * to download and nothing to license. Several layers play at once (rain + thunder, fire + rain on the
 * roof, birdsong + the brook…) and crossfade as you move around the homestead.
 *
 * Two inputs decide what plays:
 *  - the scene, set from where you are and the weather (see `soundLogic.ts`), only when the
 *    soundscape is switched on;
 *  - an explicit choice (Lamp mode's rain/fire/wind, the Lounge record player), which wins over the
 *    scene and plays even with the soundscape off, because you asked for it.
 * Browsers only allow sound after a tap or key press, so nothing starts until one happens.
 */

export type Layer = 'rain' | 'fire' | 'wind' | 'organ' | 'room' | 'birds' | 'crickets' | 'brook' | 'calm' | 'chimes' | 'thunder' | 'owl' | 'hush';
/** Kept for the rooms that pick one sound. */
export type AmbientKind = Layer;
/** How loud each layer plays, 0–1. */
export type Mix = Partial<Record<Layer, number>>;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let meter: AnalyserNode | null = null;
let volume = 0.6;
let enabled = false;
let scene: Mix = {};
let override: Layer | null = null;
const live = new Map<Layer, { gain: GainNode; stop: () => void }>();
const FADE = 2.2;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
    // A touch of room: everything passes through a soft echo, so layers sit in one space.
    bus = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 0.85;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    bus.connect(dry).connect(master);
    bus.connect(delay); delay.connect(tone).connect(fb).connect(delay); tone.connect(wet).connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** A looping buffer of noise. `brown` integrates it for a deeper rumble. */
const noiseCache = new Map<string, AudioBuffer>();
function noise(c: AudioContext, brown = false): AudioBufferSourceNode {
  const key = brown ? 'b' : 'w';
  let buf = noiseCache.get(key);
  if (!buf) {
    const len = c.sampleRate * 4;
    buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    noiseCache.set(key, buf);
  }
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;
  src.loopStart = Math.random() * 2; // start each loop somewhere different, so layers don't line up
  return src;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pan = (c: AudioContext, v: number, out: AudioNode) => { const p = c.createStereoPanner(); p.pan.value = v; p.connect(out); return p; };

/** A short note with a soft attack and an exponential tail (for piano, chimes, birds). */
function blip(c: AudioContext, out: AudioNode, f: number, vol: number, len: number, type: OscillatorType = 'sine', at = c.currentTime) {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(out); o.start(at); o.stop(at + len + 0.05);
  return o;
}

/** Build one layer at its own natural loudness; the engine sets how much of it you hear. */
function build(c: AudioContext, kind: Layer, out: AudioNode): () => void {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const every = (fn: () => void, min: number, max: number, first = rand(min, max)) => {
    const run = () => { fn(); timers.push(setTimeout(run, rand(min, max))); };
    timers.push(setTimeout(run, first));
  };
  const g = c.createGain();
  g.connect(out);

  switch (kind) {
    case 'rain': {
      const n = noise(c);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const v = c.createGain(); v.gain.value = 0.22;
      n.connect(hp).connect(lp).connect(v).connect(g);
      // a low patter underneath, and the odd heavier drop on the roof
      const b = noise(c, true); const bl = c.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 700; const bv = c.createGain(); bv.gain.value = 0.25;
      b.connect(bl).connect(bv).connect(g);
      nodes.push(n, b);
      every(() => { blip(c, pan(c, rand(-0.8, 0.8), g), rand(1800, 4200), 0.025, 0.05); }, 40, 300, 10);
      break;
    }
    case 'fire': {
      const n = noise(c, true);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const v = c.createGain(); v.gain.value = 0.5;
      n.connect(lp).connect(v).connect(g);
      nodes.push(n);
      every(() => {
        const s = noise(c); const cg = c.createGain(); const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = rand(1500, 4500); bp.Q.value = 2;
        const t = c.currentTime;
        cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(rand(0.25, 0.55), t + 0.005);
        cg.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.03, 0.09));
        s.connect(bp).connect(cg).connect(pan(c, rand(-0.4, 0.4), g)); s.start(t); s.stop(t + 0.12);
      }, 60, Math.random() < 0.2 ? 900 : 320, 30);
      break;
    }
    case 'wind': {
      const n = noise(c);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8;
      const lfo = c.createOscillator(); const lg = c.createGain();
      lfo.frequency.value = 0.07; lg.gain.value = 320;
      lfo.connect(lg).connect(bp.frequency);
      const swell = c.createOscillator(); const sg = c.createGain(); const vol = c.createGain();
      swell.frequency.value = 0.11; sg.gain.value = 0.12; vol.gain.value = 0.2;
      swell.connect(sg).connect(vol.gain);
      n.connect(bp).connect(vol).connect(g);
      nodes.push(n, lfo, swell);
      break;
    }
    case 'organ': {
      // A soft held chord (an open fifth with a gentle third), breathing slowly, like a chapel at rest.
      const lfo = c.createOscillator(); const lg = c.createGain();
      lfo.frequency.value = 0.08; lg.gain.value = 0.03;
      const vol = c.createGain(); vol.gain.value = 0.06;
      lfo.connect(lg).connect(vol.gain);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      for (const f of [130.81, 196.0, 261.63, 329.63]) {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = rand(-3, 3);
        o.connect(lp); nodes.push(o);
      }
      lp.connect(vol).connect(g);
      nodes.push(lfo);
      break;
    }
    case 'room': {
      // Quiet room tone with the odd soft keystroke: an office after hours.
      const n = noise(c, true);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const v = c.createGain(); v.gain.value = 0.25;
      n.connect(lp).connect(v).connect(g);
      nodes.push(n);
      every(() => {
        const s2 = noise(c); const kg = c.createGain(); const hp = c.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 2500;
        const t = c.currentTime;
        kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(0.05, t + 0.003); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        s2.connect(hp).connect(kg).connect(g); s2.start(t); s2.stop(t + 0.06);
      }, 90, Math.random() < 0.15 ? 6000 : 320, 1500);
      break;
    }
    case 'birds': {
      // Little phrases from a few different birds, here and there across the field.
      const song = () => {
        const p = pan(c, rand(-0.9, 0.9), g);
        const t0 = c.currentTime; const kind2 = Math.floor(rand(0, 3));
        const n = kind2 === 2 ? 2 : Math.floor(rand(3, 7));
        for (let i = 0; i < n; i++) {
          const at = t0 + i * (kind2 === 0 ? 0.09 : kind2 === 1 ? 0.16 : 0.35);
          const o = c.createOscillator(); const og = c.createGain(); o.type = 'sine';
          const f = kind2 === 2 ? 2600 - i * 500 : rand(2800, 5200);
          o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * (kind2 === 1 ? 0.7 : rand(1.1, 1.5)), at + 0.07);
          og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(0.08, at + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, at + (kind2 === 2 ? 0.28 : 0.08));
          o.connect(og).connect(p); o.start(at); o.stop(at + 0.3);
        }
      };
      every(song, 900, 4200, 300);
      break;
    }
    case 'crickets': {
      // Two crickets, either side, trilling in short pulses.
      for (const side of [-0.7, 0.6]) {
        const p = pan(c, side, g); const f = rand(4300, 4900);
        every(() => {
          const t0 = c.currentTime;
          for (let i = 0; i < 4; i++) blip(c, p, f, 0.022, 0.03, 'sine', t0 + i * 0.034);
        }, 520, 900, rand(0, 600));
      }
      break;
    }
    case 'brook': {
      // Water over stones: two bands of noise, gently moving.
      for (const [f, q, v, rate] of [[900, 0.6, 0.22, 0.13], [2600, 1.2, 0.09, 0.31]] as const) {
        const n = noise(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.value = rate; lg.gain.value = f * 0.25;
        lfo.connect(lg).connect(bp.frequency);
        const vg = c.createGain(); vg.gain.value = v;
        n.connect(bp).connect(vg).connect(g);
        nodes.push(n, lfo);
      }
      every(() => blip(c, pan(c, rand(-0.5, 0.5), g), rand(700, 1400), 0.012, 0.12), 300, 1400, 200);
      break;
    }
    case 'calm': {
      // For writing: a warm pad that breathes, and now and then a soft piano note from a pentatonic scale.
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      const vol = c.createGain(); vol.gain.value = 0.05;
      const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 0.02;
      lfo.connect(lg).connect(vol.gain);
      for (const f of [146.83, 220.0, 293.66, 329.63, 440.0]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = rand(-4, 4);
        o.connect(lp); nodes.push(o);
      }
      lp.connect(vol).connect(g);
      nodes.push(lfo);
      const scale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99];
      every(() => {
        const f = scale[Math.floor(rand(0, scale.length))];
        const p = pan(c, rand(-0.4, 0.4), g);
        blip(c, p, f, 0.05, 3.2, 'sine'); blip(c, p, f * 2, 0.012, 1.6, 'sine'); blip(c, p, f * 3, 0.005, 0.8, 'triangle');
        if (Math.random() < 0.3) blip(c, p, scale[Math.floor(rand(0, scale.length))] / 2, 0.035, 3.6, 'sine', c.currentTime + 0.4);
      }, 2600, 7000, 1200);
      break;
    }
    case 'chimes': {
      const notes = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0];
      every(() => {
        const n = Math.floor(rand(1, 4)); const p = pan(c, rand(-0.6, 0.6), g);
        for (let i = 0; i < n; i++) {
          const f = notes[Math.floor(rand(0, notes.length))]; const at = c.currentTime + i * rand(0.12, 0.4);
          blip(c, p, f, 0.03, 2.6, 'sine', at); blip(c, p, f * 2.76, 0.008, 1.2, 'sine', at);
        }
      }, 2500, 9000, 800);
      break;
    }
    case 'thunder': {
      // Distant rolls, every so often.
      every(() => {
        const n = noise(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = rand(110, 260);
        const tg = c.createGain(); const t = c.currentTime; const len = rand(3.5, 6);
        tg.gain.setValueAtTime(0.0001, t); tg.gain.exponentialRampToValueAtTime(rand(0.9, 1.6), t + rand(0.3, 0.9)); tg.gain.exponentialRampToValueAtTime(0.0001, t + len);
        n.connect(lp).connect(tg).connect(pan(c, rand(-0.7, 0.7), g)); n.start(t); n.stop(t + len + 0.1);
      }, 16000, 42000, 5000);
      break;
    }
    case 'owl': {
      every(() => {
        const p = pan(c, rand(-0.8, 0.8), g); const t = c.currentTime;
        for (const [d, len] of [[0, 0.32], [0.55, 0.7]] as const) {
          const o = c.createOscillator(); const og = c.createGain(); o.type = 'sine';
          o.frequency.setValueAtTime(390, t + d); o.frequency.linearRampToValueAtTime(350, t + d + len);
          og.gain.setValueAtTime(0.0001, t + d); og.gain.exponentialRampToValueAtTime(0.05, t + d + 0.06); og.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
          o.connect(og).connect(p); o.start(t + d); o.stop(t + d + len + 0.05);
        }
      }, 14000, 34000, 4000);
      break;
    }
    case 'hush': {
      // The muffled quiet of snow, or a still room.
      const n = noise(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const v = c.createGain(); v.gain.value = 0.12;
      n.connect(lp).connect(v).connect(g);
      nodes.push(n);
      break;
    }
  }
  nodes.forEach((x) => { try { x.start(); } catch { /* already started */ } });

  return () => {
    timers.forEach(clearTimeout);
    setTimeout(() => { nodes.forEach((x) => { try { x.stop(); } catch { /* fine */ } }); g.disconnect(); }, (FADE + 0.3) * 1000);
  };
}

/** Bring the playing layers in line with what should be heard, crossfading. */
function apply() {
  const want: Mix = override ? { [override]: 1 } : enabled ? scene : {};
  if (!ctx && !Object.keys(want).length) return;
  const c = audio();
  if (!c || !bus) return;
  const t = c.currentTime;
  for (const [k, l] of live) {
    if (!want[k]) {
      l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(l.gain.gain.value, t); l.gain.gain.linearRampToValueAtTime(0, t + FADE);
      l.stop(); live.delete(k);
    }
  }
  for (const [k, v] of Object.entries(want) as [Layer, number][]) {
    if (!v) continue;
    let l = live.get(k);
    if (!l) {
      const gain = c.createGain(); gain.gain.value = 0; gain.connect(bus);
      l = { gain, stop: build(c, k, gain) };
      live.set(k, l);
    }
    l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(l.gain.gain.value, t); l.gain.gain.linearRampToValueAtTime(v, t + FADE);
  }
}

/** The scene for where you are (only heard while the soundscape is on). */
export function setScene(mix: Mix) {
  const same = JSON.stringify(mix) === JSON.stringify(scene);
  scene = mix;
  if (!same) apply();
}

/** Switch the soundscape on or off. */
export function setSoundscape(on: boolean) {
  enabled = on;
  apply();
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
}

/** Call from a tap or key press: browsers only start audio after one. Returns whether sound is running. */
export function unlock(): boolean {
  const c = audio();
  apply();
  return Boolean(c && c.state === 'running');
}
/** How loud the output is right now (RMS, 0–1): lets a check confirm sound is really coming out. */
export function outputLevel(): number {
  if (!meter) return 0;
  const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
  return Math.sqrt(d.reduce((n, x) => n + x * x, 0) / d.length);
}

/** The layers playing right now (for the dial, and for checking). */
export const playingLayers = (): Layer[] => [...live.keys()].sort();
export const audioRunning = () => Boolean(ctx && ctx.state === 'running');

/** Pause everything while the app is out of sight, and pick up again when it's back. */
export function suspendAudio(hidden: boolean) {
  if (!ctx) return;
  if (hidden) void ctx.suspend().catch(() => {}); else void ctx.resume().catch(() => {});
}

/** Play one chosen sound over the scene (Lamp mode, the record player), or pass null to go back to the scene. */
export function setAmbient(kind: Layer | null) {
  if (kind === override) return;
  override = kind;
  apply();
}

/** A soft bell: a few sine partials with a long tail. */
export function chime() {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  [1, 2.01, 3.02, 4.2].forEach((p, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.value = 523.25 * p;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 / (i + 1), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8 / (i * 0.6 + 1));
    o.connect(g).connect(master!); o.start(t); o.stop(t + 3);
  });
}
