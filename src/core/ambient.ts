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

/**
 * How loud each layer sits on its own before the scene's mix: tuned by measuring each one, so a
 * mix of 0.8 rain and 0.3 fire sounds like that, not like whichever layer happens to be hottest.
 */
const TRIM: Record<Layer, number> = { calm: 0.6, rain: 1.3, fire: 1, wind: 0.55, organ: 1.9, room: 0.8, birds: 0.6, crickets: 0.8, brook: 1, chimes: 0.5, thunder: 0.5, owl: 0.45, hush: 0.5 };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    // The end of the chain: a gentle cut of the very top (no hiss), and a soft limiter (no spikes).
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 7000; shelf.gain.value = -5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    master.connect(shelf).connect(comp).connect(ctx.destination);
    meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter);
    // One shared room: everything is heard dry, and through a soft, dark reverb tail.
    bus = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 0.82;
    const verb = ctx.createConvolver(); verb.buffer = roomTail(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.34;
    bus.connect(dry).connect(master);
    bus.connect(verb).connect(wet).connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** A reverb tail: stereo decaying noise, darkening as it fades, with a short pre-delay. */
function roomTail(c: BaseAudioContext): AudioBuffer {
  const sr = c.sampleRate, len = Math.floor(sr * 2.9), pre = Math.floor(sr * 0.018);
  const b = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      // the tail gets darker as it decays: a one-pole lowpass whose cutoff falls with time
      const k = Math.min(0.9, 0.08 + t * 0.35);
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = lp * Math.exp(-t / 0.42) * (1 - Math.max(0, (t - 2.5) / 0.4)) * 1.1;
    }
  }
  return b;
}

/* ---------------- sources: stereo noise, and textures rendered once ---------------- */

type Colour = 'white' | 'pink' | 'brown';
const bufCache = new Map<string, AudioBuffer>();

/** Stereo noise (independent left and right, so it's wide, not a point in the middle). */
function noiseBuf(c: BaseAudioContext, colour: Colour): AudioBuffer {
  const key = `n:${colour}`;
  let b = bufCache.get(key);
  if (b) return b;
  const len = Math.floor(c.sampleRate * 6);
  b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'white') d[i] = w * 0.5;
      else if (colour === 'pink') {
        // Paul Kellet's pink filter: equal energy per octave, softer than white.
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
  }
  bufCache.set(key, b);
  return b;
}

/** A looping source of a buffer, starting somewhere random so layers never line up. */
function loop(c: BaseAudioContext, buf: AudioBuffer, rate = 1): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
  (s as AudioBufferSourceNode & { __offset?: number }).__offset = Math.random() * buf.duration;
  return s;
}

/** Render a stereo texture once (drops, crackles, bubbles) and keep it. */
function texture(c: BaseAudioContext, key: string, secs: number, fill: (L: Float32Array, R: Float32Array, sr: number) => void): AudioBuffer {
  let b = bufCache.get(key);
  if (b) return b;
  b = c.createBuffer(2, Math.floor(c.sampleRate * secs), c.sampleRate);
  fill(b.getChannelData(0), b.getChannelData(1), c.sampleRate);
  bufCache.set(key, b);
  return b;
}

/** A short excitation through a resonator (a biquad band-pass, in plain JS), added into L/R. */
function ring(L: Float32Array, R: Float32Array, sr: number, at: number, f: number, q: number, amp: number, burst: number, panv: number) {
  const w0 = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr, alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha, b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - alpha) / a0;
  const n = Math.min(L.length - at, Math.floor(sr * (burst + 12 * q / f + 0.01)));
  const gl = Math.sqrt(0.5 * (1 - panv)), gr = Math.sqrt(0.5 * (1 + panv));
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const bl = Math.max(1, Math.floor(sr * burst));
  for (let i = 0; i < n; i++) {
    const x = i < bl ? (Math.random() * 2 - 1) * Math.exp((-4 * i) / bl) : 0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    L[at + i] += y * amp * gl; R[at + i] += y * amp * gr;
  }
}

/** A bubble or a drip: a sine that rises in pitch as it dies away (that rise is what makes it "water"). */
function bubble(L: Float32Array, R: Float32Array, sr: number, at: number, f0: number, tau: number, rise: number, amp: number, panv: number) {
  const n = Math.min(L.length - at, Math.floor(sr * tau * 6));
  const gl = Math.sqrt(0.5 * (1 - panv)), gr = Math.sqrt(0.5 * (1 + panv));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * f0 * (1 + rise * t)) / sr;
    const env = (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / tau);
    const y = Math.sin(ph) * env * amp;
    L[at + i] += y * gl; R[at + i] += y * gr;
  }
}

/* ---------------- small helpers for live voices ---------------- */

const panner = (c: BaseAudioContext, v: number, out: AudioNode) => { const p = c.createStereoPanner(); p.pan.value = v; p.connect(out); return p; };
const filt = (c: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
const amp = (c: BaseAudioContext, v: number) => { const g = c.createGain(); g.gain.value = v; return g; };

/** A note with a soft attack and an exponential tail. */
function tone(c: BaseAudioContext, out: AudioNode, f: number, vol: number, len: number, at: number, type: OscillatorType = 'sine', attack = 0.012) {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(out); o.start(at); o.stop(at + len + 0.05);
  return o;
}

/** A felt piano note: slightly stretched partials, the high ones dying first, a soft hammer. */
function piano(c: BaseAudioContext, out: AudioNode, f: number, vol: number, at: number) {
  const parts = [1, 0.42, 0.2, 0.11, 0.05, 0.03];
  const lp = filt(c, 'lowpass', 2600); lp.connect(out);
  parts.forEach((a, i) => {
    const k = i + 1;
    tone(c, lp, f * k * Math.sqrt(1 + 0.00035 * k * k), vol * a, 4.2 / Math.pow(k, 0.75), at, 'sine', 0.006 + i * 0.002);
  });
}

/** A pipe-organ tone: the 8′, 4′, 2⅔′ and 2′ ranks drawn together. */
let organWave: PeriodicWave | null = null;
const organ = (c: BaseAudioContext) => organWave ?? (organWave = c.createPeriodicWave(new Float32Array([0, 1, 0.55, 0.3, 0.22, 0.06, 0.1, 0.02, 0.05]), new Float32Array(9)));

/* ---------------- the layers ---------------- */

/** Build one layer; the engine sets how much of it you hear. Returns a stop function. */
function build(c: AudioContext, kind: Layer, out: AudioNode): () => void {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  /** Do something now and then; skipped while the audio is paused, so nothing piles up. */
  const every = (fn: () => void, min: number, max: number, first = rand(min, max)) => {
    const run = () => { if (c.state === 'running') fn(); timers.push(setTimeout(run, rand(min, max))); };
    timers.push(setTimeout(run, first));
  };
  /** Let a value wander slowly between lo and hi (gusts, flicker, a brook's swell). */
  const drift = (p: AudioParam, lo: number, hi: number, minMs: number, maxMs: number, glide: number) => {
    p.value = rand(lo, hi);
    every(() => p.setTargetAtTime(rand(lo, hi), c.currentTime, glide), minMs, maxMs, rand(0, minMs));
  };
  const start = (...s: AudioScheduledSourceNode[]) => nodes.push(...s);
  const g = amp(c, TRIM[kind]);
  g.connect(out);

  switch (kind) {
    case 'rain': {
      // The steady fall: soft pink noise, wide, breathing a little heavier and lighter.
      const bed = loop(c, noiseBuf(c, 'pink'));
      const hp = filt(c, 'highpass', 220), lp = filt(c, 'lowpass', 3200), bv = amp(c, 0.5);
      bed.connect(hp).connect(lp).connect(bv).connect(g);
      drift(bv.gain, 0.38, 0.62, 3000, 7000, 2.5);
      // Thousands of drops on leaves and roof, each a tiny ringing tap; two loops of different
      // lengths so the pattern never repeats.
      for (const [secs, per, gain] of [[7.3, 900, 0.85], [5.1, 520, 0.6]] as const) {
        const buf = texture(c, `drops${secs}`, secs, (L, R, sr) => {
          for (let i = 0; i < per * secs / 6; i++) ring(L, R, sr, Math.floor(Math.random() * (L.length - sr * 0.05)), rand(1800, 7000), rand(2, 5), rand(0.04, 0.22) ** 1.4, rand(0.0005, 0.002), rand(-0.9, 0.9));
        });
        const s = loop(c, buf); const v = amp(c, gain);
        s.connect(v).connect(g); start(s);
      }
      // Now and then, a fat drip off the eaves into a puddle.
      const drips = texture(c, 'drips', 9.7, (L, R, sr) => {
        for (let i = 0; i < 9; i++) bubble(L, R, sr, Math.floor(Math.random() * (L.length - sr * 0.3)), rand(700, 1300), rand(0.018, 0.035), rand(6, 14), rand(0.08, 0.16), rand(-0.7, 0.7));
      });
      const ds = loop(c, drips); ds.connect(amp(c, 0.5)).connect(g);
      start(bed, ds);
      break;
    }
    case 'fire': {
      // The body of the fire: a low roar that flickers.
      const roar = loop(c, noiseBuf(c, 'brown'));
      const rl = filt(c, 'lowpass', 340), rv = amp(c, 0.5);
      roar.connect(rl).connect(rv).connect(g);
      drift(rv.gain, 0.3, 0.62, 180, 700, 0.12);
      drift(rl.frequency, 240, 480, 400, 1400, 0.3);
      // Crackle: clusters of tiny dry clicks, and once in a while a proper pop.
      for (const [secs, key] of [[8.3, 'crackA'], [6.1, 'crackB']] as const) {
        const buf = texture(c, key, secs, (L, R, sr) => {
          let t = rand(0.05, 0.3);
          while (t < secs - 0.3) {
            const n = Math.floor(rand(1, 9)), p = rand(-0.5, 0.5);
            for (let k = 0; k < n; k++) {
              const at = Math.floor((t + k * rand(0.004, 0.045)) * sr);
              const loud = Math.random() < 0.06;
              ring(L, R, sr, at, loud ? rand(600, 1400) : rand(2200, 7000), loud ? 1.5 : 0.9, loud ? rand(0.35, 0.6) : rand(0.05, 0.25), loud ? 0.004 : rand(0.0003, 0.0012), p + rand(-0.1, 0.1));
            }
            t += rand(0.05, 0.6) * (Math.random() < 0.15 ? 3 : 1);
          }
        });
        const s = loop(c, buf); s.connect(amp(c, 0.8)).connect(g); start(s);
      }
      // A breath of hiss from the logs.
      const hiss = loop(c, noiseBuf(c, 'white')); const hb = filt(c, 'bandpass', 4200, 0.8), hv = amp(c, 0.02);
      hiss.connect(hb).connect(hv).connect(g);
      drift(hv.gain, 0.005, 0.03, 800, 2500, 0.6);
      start(roar, hiss);
      break;
    }
    case 'wind': {
      // Air moving through pines: a broad band that sweeps and swells in gusts…
      const n = loop(c, noiseBuf(c, 'pink'));
      const bp = filt(c, 'bandpass', 500, 0.55), v = amp(c, 0.5);
      n.connect(bp).connect(v).connect(g);
      drift(bp.frequency, 260, 900, 2500, 6000, 1.8);
      drift(v.gain, 0.18, 0.75, 2500, 7000, 2.2);
      // …a faint whistle at the eaves…
      const w = loop(c, noiseBuf(c, 'white'));
      const wb = filt(c, 'bandpass', 1000, 14), wv = amp(c, 0.06);
      w.connect(wb).connect(wv).connect(g);
      drift(wb.frequency, 650, 1500, 3000, 8000, 2.5);
      drift(wv.gain, 0, 0.09, 3000, 9000, 2);
      // …and the low push of it.
      const r = loop(c, noiseBuf(c, 'brown')); const rl = filt(c, 'lowpass', 140), rv = amp(c, 0.25);
      r.connect(rl).connect(rv).connect(g);
      drift(rv.gain, 0.1, 0.35, 3000, 7000, 2);
      start(n, w, r);
      break;
    }
    case 'organ': {
      // The chapel at rest: a soft organ moving slowly between chords, held, never hurried.
      const CHORDS = [[130.81, 196.0, 261.63, 329.63], [130.81, 174.61, 220.0, 261.63], [110.0, 164.81, 220.0, 261.63], [98.0, 146.83, 196.0, 246.94]];
      const lp = filt(c, 'lowpass', 1500), v = amp(c, 0.055);
      lp.connect(v).connect(g);
      const trem = c.createOscillator(); const tg = amp(c, 0.006); trem.frequency.value = 0.18;
      trem.connect(tg).connect(v.gain);
      start(trem);
      let i = 0; let held: { stop: (t: number) => void } | null = null;
      const play = () => {
        const t = c.currentTime;
        const cg = amp(c, 0); cg.connect(lp);
        const os = CHORDS[i % CHORDS.length].map((f, k) => {
          const o = c.createOscillator(); o.setPeriodicWave(organ(c)); o.frequency.value = f; o.detune.value = rand(-2, 2);
          o.connect(panner(c, [-0.35, 0.2, -0.1, 0.35][k], cg)); o.start(t); return o;
        });
        cg.gain.setTargetAtTime(1, t, 2.2);
        held?.stop(t);
        held = { stop: (at) => { cg.gain.setTargetAtTime(0, at, 2.2); os.forEach((o) => o.stop(at + 12)); } };
        i++;
      };
      play();
      every(play, 18000, 26000, 20000);
      const end = () => held?.stop(c.currentTime);
      return finish(end);
    }
    case 'room': {
      // An office after hours: a low room tone, and now and then someone typing in short runs.
      const n = loop(c, noiseBuf(c, 'brown')); const lp = filt(c, 'lowpass', 220), v = amp(c, 0.3);
      n.connect(lp).connect(v).connect(g);
      start(n);
      every(() => {
        const p = panner(c, rand(-0.5, 0.5), g);
        const keys = Math.floor(rand(3, 14));
        let at = c.currentTime;
        for (let k = 0; k < keys; k++) {
          at += rand(0.07, 0.19) * (Math.random() < 0.1 ? 3 : 1);
          const s = c.createBufferSource(); s.buffer = noiseBuf(c, 'white');
          const bp = filt(c, 'bandpass', rand(1600, 2600), 1.2), kg = c.createGain();
          kg.gain.setValueAtTime(0.0001, at); kg.gain.exponentialRampToValueAtTime(rand(0.08, 0.14), at + 0.002); kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
          s.connect(bp).connect(kg).connect(p); s.start(at, Math.random() * 5); s.stop(at + 0.05);
          tone(c, p, rand(140, 190), 0.03, 0.03, at, 'sine', 0.002);
        }
      }, 3000, 11000, 1500);
      break;
    }
    case 'birds': {
      // A few different birds, here and there in the trees: whistles, trills and warbles.
      const out2 = filt(c, 'lowpass', 7500); out2.connect(g);
      const glide = (p: AudioNode, at: number, f0: number, f1: number, len: number, vol: number, vib = 0) => {
        const o = c.createOscillator(); const og = c.createGain();
        o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + len);
        if (vib) { const m = c.createOscillator(); const mg = c.createGain(); m.frequency.value = vib; mg.gain.value = f0 * 0.04; m.connect(mg).connect(o.frequency); m.start(at); m.stop(at + len + 0.05); }
        og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.03, len / 4)); og.gain.setTargetAtTime(0.0001, at + len * 0.7, len * 0.12);
        o.connect(og).connect(p); o.start(at); o.stop(at + len + 0.2);
      };
      const songs = [
        // a robin-like carol: a few rising and falling notes
        (p: AudioNode, t: number) => { for (let k = 0, n = Math.floor(rand(3, 6)); k < n; k++) { const f = rand(2200, 3400); glide(p, t + k * rand(0.16, 0.26), f, f * rand(0.82, 1.22), rand(0.1, 0.17), 0.05, 0); } },
        // a two-note whistle, high then lower
        (p: AudioNode, t: number) => { const f = rand(3600, 4100); glide(p, t, f, f * 0.99, 0.32, 0.045); glide(p, t + 0.42, f * 0.84, f * 0.83, 0.3, 0.04); },
        // a trill falling away
        (p: AudioNode, t: number) => { const f = rand(4200, 5000); glide(p, t, f, f * 0.75, rand(0.7, 1.1), 0.035, rand(24, 36)); },
        // a busy little warble
        (p: AudioNode, t: number) => { for (let k = 0; k < 8; k++) { const f = rand(2800, 4600); glide(p, t + k * 0.075, f, f * rand(0.85, 1.25), 0.06, 0.03); } },
      ];
      const voices = [0, 1, 2, 3].map(() => ({ song: pick(songs), pan: rand(-0.85, 0.85), far: rand(0.4, 1) }));
      every(() => { const v = pick(voices); const a = amp(c, v.far); a.connect(panner(c, v.pan, out2)); v.song(a, c.currentTime + 0.05); }, 900, 4500, 300);
      break;
    }
    case 'crickets': {
      // Three crickets, near and far, each chirping in its own rhythm.
      const lp = filt(c, 'lowpass', 6500); lp.connect(g);
      for (const [side, near] of [[-0.7, 1], [0.6, 0.8], [0.1, 0.4]] as const) {
        const p = panner(c, side, lp); const f = rand(4200, 4800), pulses = Math.floor(rand(3, 5));
        every(() => {
          const t0 = c.currentTime + 0.02;
          for (let k = 0; k < pulses; k++) {
            const at = t0 + k * rand(0.028, 0.034);
            tone(c, p, f, 0.03 * near, 0.022, at, 'sine', 0.004);
            tone(c, p, f * 2, 0.004 * near, 0.015, at, 'sine', 0.004);
          }
        }, 480, 820, rand(0, 600));
      }
      break;
    }
    case 'brook': {
      // Water over stones: a moving wash of noise, and the bubbles that make it sound like water.
      const n = loop(c, noiseBuf(c, 'pink')); const bp = filt(c, 'bandpass', 520, 0.6), v = amp(c, 0.45);
      n.connect(bp).connect(v).connect(g);
      drift(bp.frequency, 380, 760, 1200, 3500, 1);
      drift(v.gain, 0.3, 0.55, 1500, 4000, 1.2);
      for (const [secs, per] of [[6.7, 160], [4.9, 110]] as const) {
        const buf = texture(c, `bubbles${secs}`, secs, (L, R, sr) => {
          for (let i = 0; i < per; i++) bubble(L, R, sr, Math.floor(Math.random() * (L.length - sr * 0.3)), rand(380, 1700), rand(0.006, 0.03), rand(3, 12), rand(0.02, 0.09), rand(-0.6, 0.6));
        });
        const s = loop(c, buf); s.connect(amp(c, 0.9)).connect(g); start(s);
      }
      start(n);
      break;
    }
    case 'calm': {
      // For writing: a warm pad that moves through four chords, and a felt piano that only ever plays
      // notes that belong (D major pentatonic), so nothing jars.
      const CHORDS = [
        [146.83, 220.0, 277.18, 329.63, 369.99], // Dmaj9
        [123.47, 185.0, 220.0, 293.66, 329.63], // Bm11
        [98.0, 146.83, 185.0, 220.0, 246.94], // Gmaj9
        [110.0, 164.81, 246.94, 277.18, 329.63], // Aadd9
      ];
      const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0];
      const padLp = filt(c, 'lowpass', 700, 0.5), padV = amp(c, 0.09);
      padLp.connect(padV).connect(g);
      drift(padLp.frequency, 480, 900, 4000, 9000, 3);
      let i = 0; let held: { stop: (t: number) => void } | null = null;
      const chord = () => {
        const t = c.currentTime;
        const cg = amp(c, 0); cg.connect(padLp);
        const os: OscillatorNode[] = [];
        CHORDS[i % CHORDS.length].forEach((f, k) => {
          const p = panner(c, [-0.5, 0.4, -0.2, 0.25, -0.05][k], cg);
          // two soft voices a hair apart: a slow, gentle shimmer rather than a pulse
          for (const [type, det, lvl] of [['triangle', -1, 1], ['sine', 1, 0.35]] as const) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det * rand(1, 3); const og = amp(c, lvl); o.connect(og).connect(p); o.start(t); os.push(o); }
        });
        cg.gain.setTargetAtTime(1, t, 2.4);
        held?.stop(t);
        held = { stop: (at) => { cg.gain.setTargetAtTime(0, at, 2.4); os.forEach((o) => o.stop(at + 14)); } };
        i++;
      };
      chord();
      every(chord, 13000, 17000, 14000);
      const keys = amp(c, 1); keys.connect(g);
      every(() => {
        const t = c.currentTime + 0.05;
        const n = Math.random() < 0.55 ? 1 : Math.floor(rand(2, 4));
        let at = t;
        for (let k = 0; k < n; k++) { piano(c, panner(c, rand(-0.35, 0.35), keys), pick(SCALE), rand(0.05, 0.08), at); at += rand(0.32, 0.75); }
        if (Math.random() < 0.25) piano(c, keys, CHORDS[(i - 1 + CHORDS.length) % CHORDS.length][0], 0.05, t + 0.1);
      }, 2800, 7500, 1500);
      return finish(() => held?.stop(c.currentTime));
    }
    case 'chimes': {
      // Wind chimes on the porch, tuned to the same key as the music; they ring when a breeze comes.
      const NOTES = [1174.66, 1318.51, 1479.98, 1760.0, 1975.53];
      const PARTS = [[1, 1, 4.5], [2.76, 0.35, 2.2], [5.4, 0.15, 1.1], [8.93, 0.06, 0.5]] as const;
      every(() => {
        const n = Math.floor(rand(1, 5)); const p = panner(c, rand(-0.6, 0.6), g);
        for (let k = 0; k < n; k++) {
          const f = pick(NOTES), at = c.currentTime + 0.03 + k * rand(0.1, 0.45), v = rand(0.02, 0.04);
          for (const [r, a, len] of PARTS) tone(c, p, f * r, v * a, len, at, 'sine', 0.003);
        }
      }, 2500, 10000, 800);
      break;
    }
    case 'thunder': {
      // Far-off thunder: sometimes a crack first, then a long roll that comes in waves.
      every(() => {
        const t = c.currentTime + 0.05, len = rand(5, 9), p = panner(c, rand(-0.7, 0.7), g);
        const s = loop(c, noiseBuf(c, 'brown')); const lp = filt(c, 'lowpass', rand(110, 220)); const tg = c.createGain();
        tg.gain.setValueAtTime(0.0001, t);
        let at = t;
        for (let k = 0, n = Math.floor(rand(3, 6)); k < n; k++) { tg.gain.setTargetAtTime(rand(0.6, 1.5) / (k * 0.35 + 1), at, rand(0.15, 0.4)); at += rand(0.6, 1.6); tg.gain.setTargetAtTime(rand(0.15, 0.4) / (k * 0.4 + 1), at, rand(0.3, 0.7)); }
        tg.gain.setTargetAtTime(0.0001, at, 1.2);
        s.connect(lp).connect(tg).connect(p); s.start(t); s.stop(t + len + 4);
        if (Math.random() < 0.35) {
          const k2 = loop(c, noiseBuf(c, 'white')); const kb = filt(c, 'bandpass', rand(500, 1100), 0.7); const kg = c.createGain();
          kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(0.12, t + 0.02); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          k2.connect(kb).connect(kg).connect(p); k2.start(t); k2.stop(t + 0.6);
        }
      }, 15000, 40000, 4000);
      break;
    }
    case 'owl': {
      // A great horned owl, far off in the pines: hoo, hoo-hoo, hooo.
      const lp = filt(c, 'lowpass', 1100); lp.connect(g);
      every(() => {
        const p = panner(c, rand(-0.8, 0.8), lp); const t = c.currentTime + 0.05; const f = rand(290, 340);
        for (const [d, len] of [[0, 0.38], [0.62, 0.17], [0.86, 0.17], [1.2, 0.62]] as const) {
          const o = c.createOscillator(); const og = c.createGain(); o.type = 'sine';
          o.frequency.setValueAtTime(f * 1.03, t + d); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + d + len);
          og.gain.setValueAtTime(0.0001, t + d); og.gain.exponentialRampToValueAtTime(0.07, t + d + 0.05); og.gain.setTargetAtTime(0.0001, t + d + len * 0.75, 0.05);
          o.connect(og).connect(p); o.start(t + d); o.stop(t + d + len + 0.3);
          const o2 = c.createOscillator(); const og2 = c.createGain(); o2.frequency.value = f * 2; og2.gain.value = 0;
          og2.gain.setValueAtTime(0.0001, t + d); og2.gain.exponentialRampToValueAtTime(0.012, t + d + 0.05); og2.gain.setTargetAtTime(0.0001, t + d + len * 0.7, 0.05);
          o2.connect(og2).connect(p); o2.start(t + d); o2.stop(t + d + len + 0.3);
        }
      }, 12000, 32000, 3000);
      break;
    }
    case 'hush': {
      // The muffled quiet of snow, or a still room: a low, soft air that barely moves.
      const n = loop(c, noiseBuf(c, 'pink')); const lp = filt(c, 'lowpass', 520), v = amp(c, 0.32);
      n.connect(lp).connect(v).connect(g);
      drift(v.gain, 0.22, 0.4, 4000, 9000, 3);
      start(n);
      break;
    }
  }
  return finish();

  function finish(onStop?: () => void) {
    nodes.forEach((x) => { try { (x as AudioBufferSourceNode).start(0, (x as AudioBufferSourceNode & { __offset?: number }).__offset ?? 0); } catch { try { x.start(); } catch { /* already started */ } } });
    return () => {
      timers.forEach(clearTimeout);
      onStop?.();
      setTimeout(() => { nodes.forEach((x) => { try { x.stop(); } catch { /* fine */ } }); g.disconnect(); }, (FADE + 0.3) * 1000);
    };
  }
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
