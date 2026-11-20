/**
 * Ambient sound and chimes, synthesized in the browser with Web Audio. There are no audio files
 * to download and nothing to license. Everything is off until the user turns it on.
 */

export type AmbientKind = 'rain' | 'fire' | 'wind';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let stopCurrent: (() => void) | null = null;
let current: AmbientKind | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A looping buffer of noise. `brown` integrates it for a deeper rumble. */
function noise(c: AudioContext, brown = false): AudioBufferSourceNode {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function fadeIn(c: AudioContext, g: GainNode, to: number) {
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(to, c.currentTime + 1.5);
}

function build(c: AudioContext, kind: AmbientKind, out: AudioNode): () => void {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const g = c.createGain();
  g.connect(out);

  if (kind === 'rain') {
    const n = noise(c);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    n.connect(hp).connect(lp).connect(g);
    fadeIn(c, g, 0.22);
    nodes.push(n);
    // the odd heavier drop on the roof
    const drop = () => {
      const o = c.createOscillator(); const dg = c.createGain();
      o.frequency.value = 1800 + Math.random() * 2400;
      dg.gain.setValueAtTime(0.03, c.currentTime); dg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
      o.connect(dg).connect(g); o.start(); o.stop(c.currentTime + 0.06);
      timers.push(setTimeout(drop, 40 + Math.random() * 260));
    };
    drop();
  } else if (kind === 'fire') {
    const n = noise(c, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    n.connect(lp).connect(g);
    fadeIn(c, g, 0.5);
    nodes.push(n);
    const crack = () => {
      const s = noise(c); const cg = c.createGain(); const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 3000; bp.Q.value = 2;
      const t = c.currentTime;
      cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.3, t + 0.005);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.06);
      s.connect(bp).connect(cg).connect(g); s.start(t); s.stop(t + 0.12);
      timers.push(setTimeout(crack, 60 + Math.random() * (Math.random() < 0.2 ? 900 : 300)));
    };
    crack();
  } else {
    const n = noise(c);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8;
    const lfo = c.createOscillator(); const lg = c.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 320;
    lfo.connect(lg).connect(bp.frequency);
    const swell = c.createOscillator(); const sg = c.createGain(); const vol = c.createGain();
    swell.frequency.value = 0.11; sg.gain.value = 0.12; vol.gain.value = 0.2;
    swell.connect(sg).connect(vol.gain);
    n.connect(bp).connect(vol).connect(g);
    fadeIn(c, g, 0.8);
    nodes.push(n, lfo, swell);
    lfo.start(); swell.start();
  }
  nodes.forEach((x) => { try { x.start(); } catch { /* already started */ } });

  return () => {
    timers.forEach(clearTimeout);
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.8);
    setTimeout(() => { nodes.forEach((x) => { try { x.stop(); } catch { /* fine */ } }); g.disconnect(); }, 900);
  };
}

/** Play one ambient loop (replacing any other), or pass null to stop. Must first be called from a click. */
export function setAmbient(kind: AmbientKind | null) {
  if (kind === current) return;
  stopCurrent?.();
  stopCurrent = null;
  current = kind;
  if (!kind) return;
  const c = audio();
  if (!c || !master) return;
  stopCurrent = build(c, kind, master);
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
