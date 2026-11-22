import { MONTH_NAMES, timeline, type Scene } from './logic';

/** The film is drawn frame by frame on a phone-shaped canvas, so it can play here and record to a video. */
export const W = 1080;
export const H = 1920;

const DISPLAY = "'Bodoni Moda Variable', 'Bodoni Moda', Georgia, serif";
const UI = "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif";
const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";
const LAMP = '#e8a84b';
const BONE = '#ece5d6';
const DIM = 'rgba(236, 229, 214, .62)';
const FAINT = 'rgba(236, 229, 214, .38)';

export interface Assets {
  covers: Map<string, HTMLImageElement>;
  dogs: HTMLImageElement | null;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp = (x: number) => Math.min(1, Math.max(0, x));
/** 0→1 over [a, b] of a scene's progress, eased. */
const span = (p: number, a: number, b: number) => ease((p - a) / (b - a));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const PINES = [0, 1].map((row) => { const r = rng(31 + row * 17); const out: { x: number; h: number }[] = []; for (let x = -40; x < W + 60; x += 46 + r() * 50) out.push({ x, h: 110 + r() * 150 }); return out; });
/** A pine: tiers of boughs narrowing to the top. */
function pine(c: CanvasRenderingContext2D, x: number, base: number, h: number) {
  const w = h * 0.42;
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const top = base - h + (h * i) / 4.4, bot = base - h + (h * (i + 1.6)) / 4.4, half = (w * (i + 1.4)) / 5.4;
    c.moveTo(x, top); c.lineTo(x + half, bot); c.lineTo(x - half, bot); c.closePath();
  }
  c.rect(x - w * 0.05, base - h * 0.12, w * 0.1, h * 0.12);
  c.fill();
}
const STARS = (() => { const r = rng(7); return Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H * 0.75, s: r() * 2.4 + 0.4, tw: r() * 6 })); })();

function sky(c: CanvasRenderingContext2D, t: number, glow: number) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#05070d'); g.addColorStop(0.55, '#0b1020'); g.addColorStop(1, '#141018');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (const s of STARS) {
    c.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.tw));
    c.fillStyle = '#fff6e0'; c.beginPath(); c.arc(s.x, s.y, s.s, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  const lamp = c.createRadialGradient(W / 2, H * 0.92, 0, W / 2, H * 0.92, H * 0.7);
  lamp.addColorStop(0, `rgba(232, 168, 75, ${0.22 * glow})`); lamp.addColorStop(1, 'rgba(232, 168, 75, 0)');
  c.fillStyle = lamp; c.fillRect(0, 0, W, H);
  // The homestead's pines along the bottom: two rows, the far one lighter.
  for (const [row, col, base, scale] of [[0, '#0b0f1a', H - 150, 0.75], [1, '#05070c', H - 96, 1]] as const) {
    c.fillStyle = col;
    for (const pn of PINES[row]) pine(c, pn.x, base, pn.h * scale);
    c.fillRect(0, base - 2, W, H - base + 2);
  }
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center', alpha = 1) {
  c.globalAlpha = alpha; c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(s, x, y); c.globalAlpha = 1;
}
function eyebrow(c: CanvasRenderingContext2D, s: string, y: number, a: number) {
  c.save(); c.globalAlpha = a; c.font = `500 30px ${MONO}`; c.fillStyle = LAMP; c.textAlign = 'center';
  c.letterSpacing = '9px'; c.fillText(s.toUpperCase(), W / 2, y); c.restore();
}
/** Lines that wrap to a width. */
function wrap(c: CanvasRenderingContext2D, s: string, x: number, y: number, max: number, lh: number, font: string, color: string, alpha = 1) {
  c.font = font; const words = s.split(' '); let line = ''; let yy = y;
  for (const w of words) { const test = line ? `${line} ${w}` : w; if (c.measureText(test).width > max && line) { text(c, line, x, yy, font, color, 'center', alpha); line = w; yy += lh; } else line = test; }
  if (line) text(c, line, x, yy, font, color, 'center', alpha);
}
function gilt(c: CanvasRenderingContext2D, x0: number, x1: number, t: number) {
  const g = c.createLinearGradient(x0, 0, x1, 0); const o = (t * 0.25) % 1;
  g.addColorStop(0, '#c98a32'); g.addColorStop(clamp(o), '#fff1c8'); g.addColorStop(1, '#e8a84b'); return g;
}

function drawScene(c: CanvasRenderingContext2D, s: Scene, p: number, t: number, a: Assets) {
  const fade = s.kind === 'end' ? span(p, 0, 0.12) : Math.min(span(p, 0, 0.12), 1 - span(p, 0.9, 1));
  const rise = (d: number) => (1 - span(p, d, d + 0.18)) * 40;
  c.save();
  c.globalAlpha = fade;
  switch (s.kind) {
    case 'title': {
      eyebrow(c, 'Austin OS · the year in review', 700 + rise(0), span(p, 0.05, 0.25));
      c.font = `900 300px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = gilt(c, 200, 880, t);
      c.globalAlpha = fade * span(p, 0.1, 0.35); c.fillText(String(s.year), W / 2, 1000 + rise(0.1)); c.globalAlpha = fade;
      text(c, 'in the lamplight.', W / 2, 1120 + rise(0.25), `italic 400 86px ${DISPLAY}`, BONE, 'center', span(p, 0.25, 0.5));
      break;
    }
    case 'hours': {
      eyebrow(c, 'Hours toward the book', 640, span(p, 0.05, 0.2));
      const n = s.hours * span(p, 0.1, 0.6);
      c.font = `900 340px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = gilt(c, 160, 920, t); c.fillText(fmt(n), W / 2, 1010 + rise(0.1));
      text(c, 'hours', W / 2, 1110, `italic 400 80px ${DISPLAY}`, BONE, 'center', span(p, 0.3, 0.5));
      text(c, `on ${fmt(s.days)} of ${fmt(s.ofDays)} days`, W / 2, 1220, `400 44px ${UI}`, DIM, 'center', span(p, 0.45, 0.65));
      break;
    }
    case 'months': {
      eyebrow(c, 'Month by month', 420, span(p, 0.05, 0.2));
      const max = Math.max(1, ...s.hours); const bw = 62, gap = 18, x0 = (W - (12 * bw + 11 * gap)) / 2, base = 1280, hmax = 620;
      s.hours.forEach((h, i) => {
        const grow = span(p, 0.08 + i * 0.018, 0.3 + i * 0.018);
        const bh = Math.max(6, (h / max) * hmax * grow); const x = x0 + i * (bw + gap);
        const best = i === s.best;
        const g = c.createLinearGradient(0, base - bh, 0, base); g.addColorStop(0, best ? '#ffe7a8' : LAMP); g.addColorStop(1, '#8a5a18');
        c.fillStyle = h ? g : 'rgba(236,229,214,.1)'; c.beginPath(); c.roundRect(x, base - bh, bw, bh, [10, 10, 3, 3]); c.fill();
        if (best) { c.shadowColor = 'rgba(255, 210, 122, .8)'; c.shadowBlur = 30; c.fill(); c.shadowBlur = 0; }
        text(c, MONTH_NAMES[i][0], x + bw / 2, base + 56, `500 30px ${MONO}`, best ? LAMP : FAINT);
      });
      const b = span(p, 0.42, 0.6);
      text(c, `Best month: ${MONTH_NAMES[s.best]}`, W / 2, 1480 + (1 - b) * 30, `700 76px ${DISPLAY}`, BONE, 'center', b);
      text(c, `${fmt(s.hours[s.best])} hours`, W / 2, 1560, `400 44px ${UI}`, DIM, 'center', b);
      break;
    }
    case 'streak': {
      eyebrow(c, 'The longest unbroken run', 520, span(p, 0.05, 0.2));
      const shown = Math.round(s.days * span(p, 0.1, 0.65));
      c.font = `900 300px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = gilt(c, 200, 880, t); c.fillText(String(shown), W / 2, 860 + rise(0.1));
      text(c, 'days in a row', W / 2, 960, `italic 400 76px ${DISPLAY}`, BONE, 'center', span(p, 0.25, 0.45));
      // A dot per day, lighting up.
      const per = 14, d = 44, x0 = (W - per * d) / 2 + d / 2;
      for (let i = 0; i < Math.min(s.days, 140); i++) {
        const on = i < shown; c.fillStyle = on ? LAMP : 'rgba(236,229,214,.08)';
        c.beginPath(); c.arc(x0 + (i % per) * d, 1080 + Math.floor(i / per) * d, on ? 12 : 9, 0, Math.PI * 2); c.fill();
      }
      const when = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      text(c, `${when(s.from)} – ${when(s.to)}`, W / 2, 1080 + Math.ceil(Math.min(s.days, 140) / per) * d + 70, `400 40px ${UI}`, DIM, 'center', span(p, 0.5, 0.7));
      break;
    }
    case 'words': {
      eyebrow(c, 'On the page', 640, span(p, 0.05, 0.2));
      if (s.words > 0) {
        c.font = `900 230px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = gilt(c, 120, 960, t);
        c.fillText(`+${fmt(s.words * span(p, 0.1, 0.6))}`, W / 2, 920 + rise(0.1));
        text(c, 'words written', W / 2, 1020, `italic 400 76px ${DISPLAY}`, BONE, 'center', span(p, 0.3, 0.5));
      }
      if (s.sprints) {
        const a = span(p, 0.45, 0.65);
        text(c, `${s.sprints} sprint${s.sprints === 1 ? '' : 's'} to the bell`, W / 2, s.words ? 1180 : 900, `700 64px ${DISPLAY}`, BONE, 'center', a);
        text(c, `best: ${fmt(s.bestSprint)} words`, W / 2, s.words ? 1250 : 970, `400 44px ${UI}`, DIM, 'center', a);
      }
      break;
    }
    case 'books': {
      eyebrow(c, 'The shelf', 300, span(p, 0.05, 0.2));
      const n = s.covers.length; const cols = n <= 4 ? Math.min(n, 2) : 3; const cw = cols === 3 ? 250 : 300; const ch = cw * 1.5, g = 34;
      const rows = Math.ceil(n / cols); const x0 = (W - (cols * cw + (cols - 1) * g)) / 2; const y0 = 380;
      s.covers.forEach((b, i) => {
        const k = span(p, 0.08 + i * 0.05, 0.3 + i * 0.05);
        const x = x0 + (i % cols) * (cw + g), y = y0 + Math.floor(i / cols) * (ch + g) - (1 - k) * 120;
        c.save(); c.globalAlpha = fade * k; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 30; c.shadowOffsetY = 16;
        const img = b.cover ? a.covers.get(b.cover) : undefined;
        if (img) { c.beginPath(); c.roundRect(x, y, cw, ch, [4, 10, 10, 4]); c.clip(); c.drawImage(img, x, y, cw, ch); }
        else {
          const hue = [...b.title].reduce((h, ch2) => h + ch2.charCodeAt(0), 0) % 6;
          c.fillStyle = ['#5a2a22', '#2e3f5a', '#3d4a2e', '#6a4a22', '#4a2e4a', '#2a4a4a'][hue]; c.beginPath(); c.roundRect(x, y, cw, ch, [4, 10, 10, 4]); c.fill();
          c.shadowBlur = 0; c.strokeStyle = 'rgba(224,176,74,.55)'; c.lineWidth = 2; c.strokeRect(x + 14, y + 14, cw - 28, ch - 28);
          wrap(c, b.title, x + cw / 2, y + ch / 2 - 10, cw - 50, 40, `700 34px ${DISPLAY}`, '#f4ead2', fade * k);
        }
        c.restore();
      });
      const ty = y0 + rows * (ch + g) + 80; const a2 = span(p, 0.5, 0.7);
      text(c, `${s.count} book${s.count === 1 ? '' : 's'} read`, W / 2, ty, `700 84px ${DISPLAY}`, BONE, 'center', a2);
      text(c, [s.pages ? `${fmt(s.pages)} pages` : '', s.favorite ? `favorite: ${s.favorite}` : ''].filter(Boolean).join(' · '), W / 2, ty + 70, `400 40px ${UI}`, DIM, 'center', a2);
      break;
    }
    case 'trophies': {
      eyebrow(c, 'New in the Hall of Records', 420, span(p, 0.05, 0.2));
      s.names.forEach((name, i) => {
        const k = span(p, 0.1 + i * 0.07, 0.3 + i * 0.07);
        const col = i % 2, row = Math.floor(i / 2); const cx = W / 2 + (col ? 210 : -210), cy = 640 + row * 330;
        c.save(); c.globalAlpha = fade * k; c.translate(cx, cy); c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
        const m = c.createRadialGradient(-20, -24, 6, 0, 0, 90); m.addColorStop(0, '#fff1c8'); m.addColorStop(0.55, '#e8a84b'); m.addColorStop(1, '#8a5a18');
        c.shadowColor = 'rgba(232,168,75,.6)'; c.shadowBlur = 50; c.fillStyle = m; c.beginPath(); c.arc(0, 0, 90, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0; c.strokeStyle = 'rgba(255,241,200,.6)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 74, 0, Math.PI * 2); c.stroke();
        text(c, '✦', 0, 22, `700 66px ${DISPLAY}`, '#3a2606');
        c.restore();
        wrap(c, name, cx, cy + 150, 380, 50, `700 44px ${DISPLAY}`, BONE, fade * k);
      });
      const more = s.total - s.names.length;
      text(c, more > 0 ? `and ${more} more` : `${s.total} trophies this year`, W / 2, 640 + Math.ceil(s.names.length / 2) * 330 + 40, `400 42px ${UI}`, DIM, 'center', span(p, 0.6, 0.8));
      break;
    }
    case 'chapel': {
      eyebrow(c, 'The Chapel', 560, span(p, 0.05, 0.2));
      // A candle.
      const fl = 1 + 0.06 * Math.sin(t * 9) + 0.04 * Math.sin(t * 13);
      const glow = c.createRadialGradient(W / 2, 760, 0, W / 2, 760, 260); glow.addColorStop(0, 'rgba(255,210,122,.45)'); glow.addColorStop(1, 'rgba(255,210,122,0)');
      c.fillStyle = glow; c.fillRect(0, 480, W, 560);
      c.fillStyle = '#efe6d2'; c.beginPath(); c.roundRect(W / 2 - 34, 790, 68, 190, 8); c.fill();
      c.save(); c.translate(W / 2, 780); c.scale(1, fl);
      const fg = c.createRadialGradient(0, -10, 2, 0, -20, 46); fg.addColorStop(0, '#fff8e0'); fg.addColorStop(0.5, '#ffd27a'); fg.addColorStop(1, 'rgba(240,138,36,0)');
      c.fillStyle = fg; c.beginPath(); c.ellipse(0, -24, 22, 46, 0, 0, Math.PI * 2); c.fill(); c.restore();
      text(c, `${s.hours} hours`, W / 2, 1150 + rise(0.2), `700 110px ${DISPLAY}`, BONE, 'center', span(p, 0.2, 0.4));
      text(c, `with God, on ${s.days} days`, W / 2, 1240, `italic 400 60px ${DISPLAY}`, DIM, 'center', span(p, 0.3, 0.5));
      if (s.answered) text(c, `${s.answered} prayer${s.answered === 1 ? '' : 's'} answered`, W / 2, 1360, `500 46px ${UI}`, LAMP, 'center', span(p, 0.5, 0.7));
      break;
    }
    case 'road': {
      eyebrow(c, 'The road to the debut', 620, span(p, 0.05, 0.2));
      c.font = `900 280px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = gilt(c, 200, 880, t); c.fillText(fmt(s.sent * span(p, 0.1, 0.5)), W / 2, 960 + rise(0.1));
      text(c, `quer${s.sent === 1 ? 'y' : 'ies'} out in the world`, W / 2, 1060, `italic 400 68px ${DISPLAY}`, BONE, 'center', span(p, 0.3, 0.5));
      if (s.requests) text(c, `${s.requests} request${s.requests === 1 ? '' : 's'} for pages${s.offers ? ` · ${s.offers} offer${s.offers === 1 ? '' : 's'}` : ''}`, W / 2, 1180, `500 48px ${UI}`, LAMP, 'center', span(p, 0.5, 0.7));
      break;
    }
    case 'end': {
      if (a.dogs) { c.globalAlpha = fade * span(p, 0.05, 0.3); const dw = 980, dh = dw * (a.dogs.height / a.dogs.width); c.drawImage(a.dogs, (W - dw) / 2, 1120 - dh + rise(0.05) * 0.5, dw, dh); c.globalAlpha = fade; }
      text(c, 'Cooper and Shadow say', W / 2, 1220, `400 44px ${UI}`, DIM, 'center', span(p, 0.25, 0.45));
      c.font = `700 120px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = gilt(c, 160, 920, t);
      c.globalAlpha = fade * span(p, 0.35, 0.6); c.fillText(`see you in ${s.next}.`, W / 2, 1360); c.globalAlpha = fade;
      eyebrow(c, 'No zero days', 1480, span(p, 0.55, 0.75));
      break;
    }
  }
  c.restore();
}

/** Draw the film at time t (seconds). */
export function drawFilm(c: CanvasRenderingContext2D, scenes: Scene[], t: number, a: Assets) {
  const tl = timeline(scenes);
  const { i, p } = tl.at(Math.min(t, tl.total - 0.001));
  sky(c, t, scenes[i].kind === 'chapel' ? 1.6 : 1);
  drawScene(c, scenes[i], p, t, a);
  // A thin progress line, like story apps.
  c.fillStyle = 'rgba(236,229,214,.15)'; c.fillRect(60, 70, W - 120, 5);
  c.fillStyle = LAMP; c.fillRect(60, 70, (W - 120) * clamp(t / tl.total), 5);
}
