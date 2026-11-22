import { describe, expect, it } from 'vitest';
import { exifDateToDay, exifDay } from './exif';

/** A minimal TIFF: IFD0 with Make (inline ASCII), optional DateTime and an optional Exif SubIFD holding DateTimeOriginal. */
function buildTiff(le: boolean, f: { dateTime?: string; original?: string }): number[] {
  const w16 = (n: number) => (le ? [n & 255, (n >> 8) & 255] : [(n >> 8) & 255, n & 255]);
  const w32 = (n: number) => (le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255] : [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);

  const n0 = 1 + (f.dateTime ? 1 : 0) + (f.original ? 1 : 0);
  const ifd0At = 8;
  const ifd0Size = 2 + n0 * 12 + 4;
  const dtAt = ifd0At + ifd0Size;
  const dt = f.dateTime ? ascii(f.dateTime) : [];
  const exifAt = dtAt + dt.length;
  const exifSize = 2 + 12 + 4;
  const origAt = exifAt + exifSize;
  const orig = f.original ? ascii(f.original) : [];

  const out: number[] = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(ifd0At)];
  out.push(...w16(n0));
  out.push(...w16(0x010f), ...w16(2), ...w32(4), ...ascii('Cam')); // Make: "Cam\0", inline
  if (f.dateTime) out.push(...w16(0x0132), ...w16(2), ...w32(dt.length), ...w32(dtAt));
  if (f.original) out.push(...w16(0x8769), ...w16(4), ...w32(1), ...w32(exifAt));
  out.push(...w32(0));
  out.push(...dt);
  if (f.original) {
    out.push(...w16(1), ...w16(0x9003), ...w16(2), ...w32(orig.length), ...w32(origAt), ...w32(0));
    out.push(...orig);
  }
  return out;
}

const seg = (marker: number, body: number[]) => [0xff, marker, ((body.length + 2) >> 8) & 255, (body.length + 2) & 255, ...body];
const JFIF = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const SCAN = [...seg(0xdb, [0, ...Array(64).fill(1)]), ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0x34, 0xff, 0xd9];

function jpeg(tiff: number[] | null): ArrayBuffer {
  const exif = tiff ? seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]) : [];
  return new Uint8Array([0xff, 0xd8, ...JFIF, ...exif, ...SCAN]).buffer;
}

describe('exif dates', () => {
  it('reads DateTimeOriginal from a little-endian (Intel) JPEG', () => {
    expect(exifDay(jpeg(buildTiff(true, { dateTime: '2026:01:02 09:00:00', original: '2025:07:04 18:22:10' })))).toBe('2025-07-04');
  });

  it('reads DateTimeOriginal from a big-endian (Motorola) JPEG', () => {
    expect(exifDay(jpeg(buildTiff(false, { dateTime: '2026:01:02 09:00:00', original: '2024:12:31 23:59:59' })))).toBe('2024-12-31');
  });

  it('falls back to IFD0 DateTime when there is no Exif SubIFD', () => {
    expect(exifDay(jpeg(buildTiff(true, { dateTime: '2023:03:15 08:00:00' })))).toBe('2023-03-15');
    expect(exifDay(jpeg(buildTiff(false, { dateTime: '2023:03:16 08:00:00' })))).toBe('2023-03-16');
  });

  it('falls back to DateTime when DateTimeOriginal is blanked out', () => {
    expect(exifDay(jpeg(buildTiff(false, { dateTime: '2022:05:01 10:00:00', original: '0000:00:00 00:00:00' })))).toBe('2022-05-01');
  });

  it('reads a bare TIFF in both byte orders', () => {
    expect(exifDay(new Uint8Array(buildTiff(true, { original: '2021:11:22 07:30:00' })).buffer)).toBe('2021-11-22');
    expect(exifDay(new Uint8Array(buildTiff(false, { original: '2021:11:23 07:30:00' })).buffer)).toBe('2021-11-23');
  });

  it('gives null for a JPEG with no EXIF, a JPEG with EXIF but no date, and non-images', () => {
    expect(exifDay(jpeg(null))).toBeNull();
    expect(exifDay(jpeg(buildTiff(true, {})))).toBeNull();
    expect(exifDay(new TextEncoder().encode('just some text, not a photo').buffer as ArrayBuffer)).toBeNull();
    expect(exifDay(new ArrayBuffer(0))).toBeNull();
  });

  it('never throws on a cut-off or damaged file', () => {
    const whole = new Uint8Array(jpeg(buildTiff(true, { original: '2025:07:04 18:22:10' })));
    for (let n = 0; n < whole.length; n += 7) expect(() => exifDay(whole.slice(0, n).buffer)).not.toThrow();
    const bad = whole.slice();
    bad[30] = 0xff; bad[31] = 0xff; bad[32] = 0xff; bad[33] = 0xff; // a wild offset
    expect(() => exifDay(bad.buffer)).not.toThrow();
  });

  it('turns EXIF date strings into local days, rejecting impossible ones', () => {
    expect(exifDateToDay('2025:02:28 12:00:00')).toBe('2025-02-28');
    expect(exifDateToDay('2025:02:29 12:00:00')).toBeNull();
    expect(exifDateToDay('2024:02:29 12:00:00')).toBe('2024-02-29');
    expect(exifDateToDay('    ')).toBeNull();
    expect(exifDateToDay(undefined)).toBeNull();
  });
});
