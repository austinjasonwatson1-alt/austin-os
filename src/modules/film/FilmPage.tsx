import { useEffect, useMemo, useRef, useState } from 'react';
import { rise } from '../../shell/lamp';
import { Dog } from '../../shell/Dogs';
import dogsCss from '../../styles/dogs.css?raw';
import { useChapel } from '../chapel/store';
import { useDrafts } from '../drafts/store';
import { useLedger } from '../ledger/store';
import { useManuscripts } from '../manuscripts/store';
import { usePub } from '../pub/store';
import { useShelf } from '../shelf/store';
import type { HallInput } from '../records/logic';
import { timeline, yearFilm, type Scene } from './logic';
import { drawFilm, H, W, type Assets } from './render';
import '../../styles/cabin.css';
import '../../styles/film.css';

/** The best video format this browser can record: MP4 where it can (iPhone, recent Chrome), else WebM. */
function pickType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/** Cooper and Shadow, drawn once (hidden on the page) and turned into a picture the film can use. */
function dogsImage(svg: SVGSVGElement | null): Promise<HTMLImageElement | null> {
  if (!svg) return Promise.resolve(null);
  const markup = new XMLSerializer().serializeToString(svg)
    .replace(/<svg([^>]*)>/, `<svg$1><style>${dogsCss.replace(/animation[^;]*;/g, '').replace(/</g, '')}</style>`);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

/** Covers, fetched so they can be drawn into a video (books whose cover won't load get a drawn one). */
function loadCovers(scenes: Scene[]): Promise<Map<string, HTMLImageElement>> {
  const urls = scenes.flatMap((s) => (s.kind === 'books' ? s.covers.map((b) => b.cover).filter((u): u is string => Boolean(u)) : []));
  const out = new Map<string, HTMLImageElement>();
  return Promise.all(urls.map((u) => new Promise<void>((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (img.naturalWidth > 20) out.set(u, img); res(); };
    img.onerror = () => res();
    img.src = u;
  }))).then(() => out);
}

/** The year as a short film: plays here, and records to a video to keep or share. */
export default function FilmPage() {
  const ledger = useLedger(); const shelf = useShelf(); const mss = useManuscripts(); const pub = usePub(); const chapel = useChapel(); const drafts = useDrafts();
  useEffect(() => { void ledger.load(); void shelf.load(); void mss.load(); void pub.load(); void chapel.load(); void drafts.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = ledger.loaded && shelf.loaded && mss.loaded && pub.loaded && chapel.loaded && drafts.loaded;

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [withChapel, setWithChapel] = useState(true);
  const input: HallInput = { days: ledger.days, thresholds: ledger.thresholds, weekly: ledger.weekly, books: shelf.books, goals: shelf.goals ?? {}, manuscripts: mss.manuscripts, queries: pub.queries, contests: pub.contests, chapel: chapel.days, prayers: chapel.prayers, sprints: drafts.sprints };
  const scenes = useMemo(() => (ready ? yearFilm(input, year, { chapel: withChapel }) : []), [ready, year, withChapel, ledger.days, shelf.books, mss.manuscripts, pub.queries, chapel.days, drafts.sprints]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => {
    const ys = new Set<number>([thisYear]);
    for (const k of Object.keys(ledger.days)) ys.add(Number(k.slice(0, 4)));
    return [...ys].filter((y) => y <= thisYear).sort((a, b) => b - a).slice(0, 4);
  }, [ledger.days, thisYear]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const dogSvg = useRef<SVGSVGElement>(null);
  const assets = useRef<Assets>({ covers: new Map(), dogs: null });
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const [rec, setRec] = useState<{ p: number } | null>(null);
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  const total = scenes.length ? timeline(scenes).total : 0;
  const type = useMemo(pickType, []);

  // Fonts, covers and the dogs, before the first frame.
  useEffect(() => {
    if (!scenes.length) return;
    let live = true;
    setLoading(true);
    void Promise.all([
      document.fonts.load("900 100px 'Bodoni Moda Variable'"), document.fonts.load("italic 400 100px 'Bodoni Moda Variable'"),
      document.fonts.load("400 40px 'Inter Tight Variable'"), document.fonts.load("500 30px 'JetBrains Mono Variable'"),
      loadCovers(scenes), assets.current.dogs ? Promise.resolve(assets.current.dogs) : dogsImage(dogSvg.current),
    ]).then(([, , , , covers, dogs]) => {
      if (!live) return;
      assets.current = { covers, dogs };
      setLoading(false);
      tRef.current = 0; setT(0); setPlaying(true);
    });
    return () => { live = false; };
  }, [scenes]);

  // The play loop.
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c || loading || !scenes.length) return;
    if (!playing) { drawFilm(c, scenes, tRef.current, assets.current); return; }
    let raf = 0; let last = performance.now();
    const frame = (now: number) => {
      tRef.current = Math.min(total, tRef.current + (now - last) / 1000); last = now;
      drawFilm(c, scenes, tRef.current, assets.current);
      setT(tRef.current);
      if (tRef.current >= total) { setPlaying(false); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, loading, scenes, total]);

  const record = () => {
    const cv = canvas.current;
    if (!cv || !type) return;
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    const stream = cv.captureStream(30);
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      setVideo({ url: URL.createObjectURL(blob), blob, ext: type.includes('mp4') ? 'mp4' : 'webm' });
      setRec(null);
    };
    tRef.current = 0; setT(0);
    setRec({ p: 0 });
    mr.start(500);
    setPlaying(true);
    const tick = setInterval(() => {
      setRec({ p: tRef.current / total });
      if (tRef.current >= total) { clearInterval(tick); setTimeout(() => mr.stop(), 300); }
    }, 200);
  };

  const share = async () => {
    if (!video) return;
    const file = new File([video.blob], `austin-os-${year}.${video.ext}`, { type: video.blob.type });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `My ${year}` }).catch(() => {});
  };
  const canShare = Boolean(video && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([video.blob], `x.${video.ext}`, { type: video.blob.type })] }));

  if (!ready) return null;
  return (
    <div className="home film">
      <section className="film-hero rise" style={rise(0)}>
        <div className="page-eyebrow">The year in review · the film</div>
        <h1 className="hero-title">Your <em>{year}.</em></h1>
        <p className="hero-line">The year, told in under a minute: the hours, the best month, the books, the trophies. Watch it here, or make a video to keep and share.</p>
        <div className="film-ctl">
          <div className="seg" role="radiogroup" aria-label="Which year">
            {years.map((y) => <button key={y} role="radio" aria-checked={year === y} onClick={() => setYear(y)}>{y}</button>)}
          </div>
          <label className="switch">
            <input type="checkbox" checked={withChapel} onChange={(e) => setWithChapel(e.target.checked)} />
            <span className="switch-ui" aria-hidden />
            <span>Include the Chapel</span>
          </label>
        </div>
      </section>

      <svg ref={dogSvg} xmlns="http://www.w3.org/2000/svg" viewBox="-95 -135 360 145" width="1200" height="483" className="film-dogs-src" aria-hidden>
        <g><Dog who="cooper" pose="proud" /></g>
        <g transform="translate(170 6) scale(.88)"><Dog who="shadow" pose="proud" /></g>
      </svg>
      <div className="film-stage rise" style={rise(1)}>
        <div className="film-frame">
          <canvas ref={canvas} width={W} height={H} aria-label={`A film of ${year}`} role="img" onClick={() => { if (!rec) { if (tRef.current >= total) tRef.current = 0; setPlaying(!playing); } }} />
          {loading && <div className="film-loading mono">Gathering the year…</div>}
          {rec && <div className="film-rec mono"><i />Recording · {Math.round(rec.p * 100)}%</div>}
        </div>
        <div className="film-side">
          <div className="film-bar"><i style={{ width: `${total ? (t / total) * 100 : 0}%` }} /></div>
          <div className="film-btns">
            <button className="btn" disabled={Boolean(rec) || loading} onClick={() => { if (tRef.current >= total) tRef.current = 0; setPlaying(!playing); }}>{playing ? 'Pause' : t >= total ? 'Play again' : 'Play'}</button>
            <button className="btn ghost" disabled={Boolean(rec) || loading} onClick={() => { tRef.current = 0; setT(0); setPlaying(true); }}>From the start</button>
          </div>
          <p className="mono faint film-len">{Math.round(total)} seconds · {scenes.length} scenes</p>
          {scenes.length <= 2 && <p className="faint film-note">There’s not much to tell about {year} yet. Log time in the Ledger and finish books on the Shelf, and the film fills in by itself.</p>}
          {type ? (
            <>
              <button className="btn primary film-make" disabled={Boolean(rec) || loading} onClick={record}>{rec ? 'Recording… keep this page open' : video ? 'Make it again' : 'Make the video'}</button>
              <p className="faint film-note">It plays through once while it records ({Math.round(total)} seconds). Keep this page on screen until it’s done.</p>
            </>
          ) : <p className="faint film-note">This browser can’t record video. Play it here, or open Austin OS in Safari or Chrome to make a video.</p>}
          {video && (
            <div className="film-done">
              <video src={video.url} controls playsInline muted />
              <div className="film-btns">
                {canShare && <button className="btn primary" onClick={() => void share()}>Share…</button>}
                <a className="btn" href={video.url} download={`austin-os-${year}.${video.ext}`}>Save the video</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
