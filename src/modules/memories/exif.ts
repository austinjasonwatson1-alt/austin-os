/**
 * A tiny EXIF date reader. Pure: give it the first bytes of a photo (an ArrayBuffer), get back
 * the local calendar day the photo was taken, or null. Reads JPEG (the APP1 "Exif" segment) and
 * bare TIFF, in both byte orders. Only dates are read; everything else is skipped.
 *
 * EXIF dates have no timezone: "2025:07:04 18:22:10" is the camera's own wall clock, which is
 * exactly the local day we want, so the date part is used as-is (never through a Date/UTC).
 */

const DATE_TIME = 0x0132; // IFD0: DateTime (last changed — often the same as taken)
const EXIF_IFD = 0x8769; // IFD0: pointer to the Exif SubIFD
const DATE_TIME_ORIGINAL = 0x9003; // Exif SubIFD: when the shutter fired

/** How much of a file to read for {@link exifDay}: the Exif segment sits at the very start. */
export const EXIF_SCAN_BYTES = 256 * 1024;

/** "2025:07:04 18:22:10" → "2025-07-04"; blank/zeroed/impossible dates → null. */
export function exifDateToDay(s: string | null | undefined): string | null {
  const m = s?.trim().match(/^(\d{4})[:\-/](\d{2})[:\-/](\d{2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return null;
  const dim = new Date(y, mo, 0).getDate();
  if (d > dim) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

interface Tiff { v: DataView; start: number; end: number; le: boolean }

const u16 = (t: Tiff, at: number) => t.v.getUint16(at, t.le);
const u32 = (t: Tiff, at: number) => t.v.getUint32(at, t.le);

/** Read one IFD's entries we care about: ASCII values and the Exif pointer. */
function readIfd(t: Tiff, rel: number, want: Set<number>): Map<number, string | number> {
  const out = new Map<number, string | number>();
  const at = t.start + rel;
  if (rel < 8 || at + 2 > t.end) return out;
  const n = u16(t, at);
  for (let i = 0; i < n && i < 512; i++) {
    const e = at + 2 + i * 12;
    if (e + 12 > t.end) break;
    const tag = u16(t, e);
    if (!want.has(tag)) continue;
    const type = u16(t, e + 2), count = u32(t, e + 4);
    if (type === 2) {
      // ASCII: inline when it fits in 4 bytes, else at an offset from the TIFF header.
      const p = count <= 4 ? e + 8 : t.start + u32(t, e + 8);
      if (p < t.start || p + count > t.end || count > 64) continue;
      let s = '';
      for (let j = 0; j < count; j++) {
        const c = t.v.getUint8(p + j);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      out.set(tag, s);
    } else if (type === 4 || type === 13) {
      out.set(tag, u32(t, e + 8)); // LONG / IFD offset
    }
  }
  return out;
}

/** The date in a TIFF structure starting at `start` (DateTimeOriginal, else DateTime). */
function tiffDay(v: DataView, start: number, end: number): string | null {
  if (start + 8 > end) return null;
  const bo = v.getUint16(start, false);
  if (bo !== 0x4949 && bo !== 0x4d4d) return null; // "II" little-endian, "MM" big-endian
  const t: Tiff = { v, start, end, le: bo === 0x4949 };
  if (u16(t, start + 2) !== 42) return null;
  const ifd0 = readIfd(t, u32(t, start + 4), new Set([DATE_TIME, EXIF_IFD]));
  const ptr = ifd0.get(EXIF_IFD);
  if (typeof ptr === 'number') {
    const exif = readIfd(t, ptr, new Set([DATE_TIME_ORIGINAL]));
    const taken = exifDateToDay(exif.get(DATE_TIME_ORIGINAL) as string | undefined);
    if (taken) return taken;
  }
  return exifDateToDay(ifd0.get(DATE_TIME) as string | undefined);
}

/**
 * The day a photo was taken, from its EXIF, or null (no EXIF, not a JPEG/TIFF, or no usable date).
 * Never throws: a damaged file just gives null.
 */
export function exifDay(buf: ArrayBuffer): string | null {
  try {
    const v = new DataView(buf);
    const len = v.byteLength;
    if (len < 4) return null;
    const first = v.getUint16(0, false);
    if (first === 0x4949 || first === 0x4d4d) return tiffDay(v, 0, len);
    if (first !== 0xffd8) return null; // not a JPEG
    let off = 2;
    while (off + 4 <= len) {
      if (v.getUint8(off) !== 0xff) return null;
      const marker = v.getUint8(off + 1);
      if (marker === 0xff) { off++; continue; } // fill byte
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      if (marker === 0xda || marker === 0xd9) return null; // image data starts: no Exif before it
      const size = v.getUint16(off + 2, false);
      if (size < 2) return null;
      const segEnd = Math.min(len, off + 2 + size);
      if (marker === 0xe1 && off + 10 <= segEnd
        && v.getUint32(off + 4, false) === 0x45786966 /* "Exif" */ && v.getUint16(off + 8, false) === 0) {
        const day = tiffDay(v, off + 10, segEnd);
        if (day) return day;
      }
      off += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}
