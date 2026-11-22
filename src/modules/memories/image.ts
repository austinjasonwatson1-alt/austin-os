/**
 * Browser-side photo shrinking: every photo is stored as a JPEG data URL so it can travel
 * inside the JSON backup and sync file. Not unit-tested (canvas + image decoding).
 */

export const FULL_SIDE = 1280;
export const THUMB_SIDE = 360;
const FULL_Q = 0.82;
const THUMB_Q = 0.74;

export interface Processed { full: string; thumb: string }

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<{ src: Source; w: number; h: number; done: () => void }> {
  // createImageBitmap honours EXIF orientation, so phone photos come out the right way up.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('This browser can’t read that image. (iPhone HEIC photos: export as JPEG first.)');
  }
}

function draw(src: Source, w: number, h: number, side: number, q: number): string {
  const k = Math.min(1, side / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  if (!g) throw new Error('Couldn’t prepare the photo (no canvas).');
  g.fillStyle = '#0b0f18'; // transparent PNGs get a night background, not black-on-JPEG
  g.fillRect(0, 0, cw, ch);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, cw, ch);
  return c.toDataURL('image/jpeg', q);
}

/** Shrink a photo to a ~1280px JPEG plus a ~360px thumbnail, both as data URLs. */
export async function processImage(file: Blob): Promise<Processed> {
  const { src, w, h, done } = await decode(file);
  try {
    if (!w || !h) throw new Error('That image is empty.');
    return { full: draw(src, w, h, FULL_SIDE, FULL_Q), thumb: draw(src, w, h, THUMB_SIDE, THUMB_Q) };
  } finally {
    done();
  }
}

/** Rough stored size of a data URL, in KB. */
export const dataUrlKB = (s: string) => Math.round((s.length * 3) / 4 / 1024);
