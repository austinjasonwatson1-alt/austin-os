import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { todayISO } from '../../core/dates';
import { CountUp, embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { parseCsvRows } from '../ledger/logic';
import { coverSearchUrl, finishMilestone, goalPace, isGoodreads, parseGoodreads, readingStats, readingYears, type Milestone, csvToObjects, filterBooks, genres, parseCoverResults, parseShelfJson, previewImport, readingYear, readWall, shelfOrder, spine, type CoverHit } from './logic';
import { useShelf } from './store';
import { useRefs } from '../refs/store';
import { kindOf } from '../refs/logic';
import { go } from '../../shell/router';
import '../../styles/scenes.css';
import { STATUS_LABEL, type Book, type BookStatus } from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/shelf.css';

const TABS: (BookStatus | 'all')[] = ['all', 'reading', 'read', 'want', 'dnf'];
const TAB_LABEL: Record<BookStatus | 'all', string> = { all: 'All', reading: 'Reading', read: 'Read', want: 'Want to read', dnf: 'Set aside' };

export default function ShelfPage() {
  const { books, loaded, load } = useShelf();
  useEffect(() => { void load(); }, [load]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<BookStatus | 'all'>('all');
  const [genre, setGenre] = useState<string | null>(null);
  const [open, setOpen] = useState<Book | 'new' | null>(null);
  const [cele, setCele] = useState<{ book: Book; from: DOMRect | null; m: Milestone } | null>(null);
  const year = new Date().getFullYear();
  const y = readingYear(books, year);
  const wall = useMemo(() => readWall(books), [books]);
  const shown = useMemo(() => shelfOrder(filterBooks(books, { q, status: tab, genre })), [books, q, tab, genre]);
  const reading = books.filter((b) => b.status === 'reading');

  return (
    <div className="home shelf">
      <section className="hero shelf-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">Writer's Cabin · The Shelf</div>
          <h1 className="hero-title">The<br /><em>Shelf.</em></h1>
          <p className="hero-line">Every book read, rated, and mined for craft. Pull one off the shelf to see what it taught you.</p>
          <div className="shelf-actions">
            <button className="btn primary" onClick={() => setOpen('new')}>+ Add a book</button>
            <ImportShelf />
          </div>
        </div>
        <div className="ledger-stats">
          <div className="lstat"><span className="lstat-v"><CountUp value={y.count} /></span><span className="lstat-u mono">books</span><span className="lstat-l mono">Read in {year}</span></div>
          <div className="lstat"><span className="lstat-v"><CountUp value={reading.length} /></span><span className="lstat-u mono">open</span><span className="lstat-l mono">Reading now</span></div>
          <div className="lstat"><span className="lstat-v"><CountUp value={books.filter((b) => b.status === 'want').length} /></span><span className="lstat-u mono">waiting</span><span className="lstat-l mono">On the list</span></div>
        </div>
      </section>

      {reading.length > 0 && (
        <section className="rise" style={rise(1)}>
          <h2 className="section-h">Reading now</h2>
          <div className="covers">{reading.map((b) => <Cover key={b.id} b={b} onOpen={() => setOpen(b)} />)}</div>
        </section>
      )}

      <section className="rise" style={rise(2)}>
        <div className="shelf-tools">
          <label className="shelf-search">
            <span aria-hidden>⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, authors, notes, craft…" aria-label="Search the shelf" />
          </label>
          <div className="seg" role="radiogroup" aria-label="Show">
            {TABS.map((t) => <button key={t} role="radio" aria-checked={tab === t} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}
          </div>
        </div>
        {genres(books).length > 0 && (
          <div className="genre-chips">
            {genres(books).map((g) => (
              <button key={g} className={genre === g ? 'gchip on' : 'gchip'} onClick={() => setGenre(genre === g ? null : g)}>{g}</button>
            ))}
          </div>
        )}

        <div className="case" aria-label="Bookcase">
          {loaded && books.length === 0 && (
            <div className="case-empty">
              <p>An empty shelf, waiting.</p>
              <span className="mono">Add the book you're reading now, or import your old shelf.</span>
            </div>
          )}
          {loaded && books.length > 0 && shown.length === 0 && <div className="case-empty"><p>Nothing on the shelf matches.</p></div>}
          {shown.map((b) => <Spine key={b.id} b={b} onOpen={() => setOpen(b)} />)}
        </div>
      </section>

      <GoalShelf books={books} year={year} />
      {books.some((b) => b.status === 'read') && <ReadingRoom books={books} />}

      {wall.length > 0 && (
        <section className="rise read-wall" style={rise(3)}>
          <h2 className="section-h">Every book I’ve read · {wall.reduce((n, g) => n + g.books.length, 0)}{y.count ? ` · ${y.count} this year` : ''}{y.pages ? ` · ${y.pages.toLocaleString('en-US')} pages` : ''}</h2>
          {wall.map((g) => (
            <div key={g.year} className="wall-year">
              <div className="wall-y"><span className="mono">{g.year}</span><i /><span className="mono faint">{g.books.length} {g.books.length === 1 ? 'book' : 'books'}</span></div>
              <div className="covers">{g.books.map((b) => <Cover key={b.id} b={b} onOpen={() => setOpen(b)} />)}</div>
            </div>
          ))}
        </section>
      )}

      {open && <BookSheet book={open === 'new' ? null : open} onClose={() => setOpen(null)}
        onFinished={(book, from) => setCele({ book, from, m: finishMilestone(useShelf.getState().books, book) })} />}
      {cele && <Celebration key={cele.book.id + cele.from?.x} {...cele} onDone={() => setCele(null)} />}
    </div>
  );
}

/* ---------------- a spine on the shelf ---------------- */

function Spine({ b, onOpen }: { b: Book; onOpen: () => void }) {
  const s = spine(b);
  return (
    <div className="slot">
      <button data-spine={b.id} className={`spine st-${b.status}`} style={{ '--c': s.color, height: s.height, width: s.width } as CSSProperties} onClick={onOpen}
        title={`${b.title} — ${b.author}`} aria-label={`${b.title} by ${b.author}, ${STATUS_LABEL[b.status]}`}>
        <i className="band top" /><i className="band bottom" />
        <span className="spine-t">{b.title}</span>
        {b.status === 'reading' && <i className="ribbon" />}
        {b.rating >= 4.5 && <i className="gilt" title="A favorite">✦</i>}
      </button>
    </div>
  );
}

/* ---------------- a front cover ---------------- */

function Cover({ b, onOpen }: { b: Book; onOpen: () => void }) {
  const s = spine(b);
  return (
    <button data-book={b.id} className={b.cover ? 'cover tilt has-art' : 'cover tilt'} style={{ '--c': s.color } as CSSProperties} onClick={onOpen} {...tilt(8)}
      aria-label={`${b.title} by ${b.author}${b.rating ? `, ${b.rating} stars` : ''}`}>
      <CoverArt b={b} />
      {b.rating > 0 && <span className="cover-stars" aria-hidden>{starList(b.rating).map((st, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{st}</span>)}</span>}
    </button>
  );
}

/** The real cover if there is one (falls back to the drawn cover if the image won't load). */
function CoverArt({ b }: { b: Pick<Book, 'title' | 'author' | 'cover'> }) {
  const [bad, setBad] = useState<string | null>(null);
  if (b.cover && bad !== b.cover) return <img className="cover-img" src={b.cover} alt="" loading="lazy" onError={() => setBad(b.cover!)} />;
  return (
    <span className="cover-frame">
      <span className="cover-t">{b.title || 'Untitled'}</span>
      <span className="cover-rule" />
      <span className="cover-a mono">{b.author || 'Author'}</span>
    </span>
  );
}

const starList = (r: number) => [...Array(Math.floor(r)).fill('★'), ...(r % 1 ? ['½'] : [])];

/* ---------------- the book sheet: view and edit ---------------- */

/** Scenes marked from this book in the Scene Library, and a way to mark another. */
function BookScenes({ book, onLeave }: { book: Book; onLeave: () => void }) {
  const r = useRefs();
  useEffect(() => { void r.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = r.scenes.filter((s) => s.bookId === book.id);
  return (
    <div className="sc-from-book">
      <span className="mono">Scenes marked{mine.length ? ` · ${mine.length}` : ''}</span>
      {mine.slice(0, 4).map((s) => <p key={s.id} className="dim" style={{ margin: 0, fontSize: 13.5 }}><b style={{ color: 'var(--bone)' }}>{kindOf(s.kind).label}</b> · {s.label}{s.where ? ` (${s.where})` : ''}</p>)}
      <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => { r.setStartFrom(book.id); onLeave(); go('/cabin/scenes'); }}>❝ Mark a scene from this book</button>
    </div>
  );
}

function BookSheet({ book, onClose, onFinished }: { book: Book | null; onClose: () => void; onFinished: (b: Book, from: DOMRect | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const all = useShelf((s) => s.books);
  const [b, setB] = useState<Omit<Book, 'id' | 'addedAt'> & { id?: string }>(
    book ?? { title: '', author: '', genre: '', status: 'reading', rating: 0, craft: [], started: todayISO() },
  );
  const [line, setLine] = useState('');
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  const set = <K extends keyof Book>(k: K, v: Book[K]) => setB((x) => ({ ...x, [k]: v }));
  const ok = b.title.trim() && b.author.trim();
  const s = spine({ title: b.title || 'Untitled', author: b.author || '', pages: b.pages });

  const setStatus = (st: BookStatus) => setB((x) => ({
    ...x, status: st,
    started: st === 'reading' && !x.started ? todayISO() : x.started,
    finished: st === 'read' && !x.finished ? todayISO() : x.finished,
  }));
  const save = () => {
    if (!ok) return;
    const finishedNow = b.status === 'read' && book?.status !== 'read';
    const from = (ref.current?.querySelector('.sheet-cover') as HTMLElement | null)?.getBoundingClientRect() ?? null;
    const saved = useShelf.getState().save(b);
    close();
    if (finishedNow) onFinished(saved, from);
  };

  return (
    <dialog ref={ref} className="sheet book-sheet" onClose={onClose} aria-labelledby="book-title">
      <div className="book-grid">
        <div className="sheet-side">
          <div className={b.cover ? 'sheet-cover has-art' : 'sheet-cover'} style={{ '--c': s.color } as CSSProperties}><CoverArt b={b} /></div>
          <CoverFinder title={b.title} author={b.author} current={b.cover}
            onPick={(h) => setB((x) => ({ ...x, cover: h?.cover, author: x.author.trim() ? x.author : h?.author ?? x.author, pages: x.pages ?? h?.pages }))} />
        </div>
        <div className="book-fields">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{book ? 'From the shelf' : 'A new book'}</div>
          <label className="field"><span>Title</span><input id="book-title" value={b.title} onChange={(e) => set('title', e.target.value)} autoFocus={!book} /></label>
          <div className="field-row two">
            <label className="field"><span>Author</span><input value={b.author} onChange={(e) => set('author', e.target.value)} /></label>
            <label className="field"><span>Genre</span><input value={b.genre} list="shelf-genres" onChange={(e) => set('genre', e.target.value)} placeholder="Domestic thriller" /></label>
            <datalist id="shelf-genres">{genres(all).map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <div className="seg wide" role="radiogroup" aria-label="Status">
            {(['reading', 'read', 'want', 'dnf'] as BookStatus[]).map((st) => (
              <button key={st} role="radio" aria-checked={b.status === st} onClick={() => setStatus(st)}>{TAB_LABEL[st]}</button>
            ))}
          </div>
          <div className="rate-stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={b.rating === n} className={b.rating >= n ? 'on' : b.rating >= n - 0.5 ? 'half' : ''}
                onClick={() => set('rating', b.rating === n ? n - 0.5 : b.rating === n - 0.5 ? 0 : n)} aria-label={`${n} stars`}>★</button>
            ))}
            <span className="mono faint">{b.rating ? `${b.rating} / 5 · tap again for a half` : 'unrated'}</span>
          </div>
          <div className="field-row three">
            <label className="field"><span>Started</span><input type="date" value={b.started ?? ''} onChange={(e) => set('started', e.target.value || undefined)} /></label>
            <label className="field"><span>Finished</span><input type="date" value={b.finished ?? ''} onChange={(e) => set('finished', e.target.value || undefined)} /></label>
            <label className="field"><span>Pages</span><input inputMode="numeric" value={b.pages ?? ''} onChange={(e) => set('pages', Number(e.target.value.replace(/\D/g, '')) || undefined)} /></label>
          </div>
          <label className="field"><span>Notes</span><textarea className="ruled" rows={3} value={b.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} placeholder="What it was, how it landed…" /></label>
          <div className="craft">
            <span className="mono craft-h">What it taught about craft</span>
            <ul>
              {b.craft.map((c, i) => (
                <li key={i}><span>{c}</span><button className="btn ghost sm" aria-label="Remove this lesson" onClick={() => set('craft', b.craft.filter((_, j) => j !== i))}>✕</button></li>
              ))}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); if (line.trim()) { set('craft', [...b.craft, line.trim()]); setLine(''); } }} className="craft-add">
              <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="e.g. Two unreliable narrators, alternating chapters" aria-label="Add a craft lesson" />
              <button className="btn sm" disabled={!line.trim()}>Add</button>
            </form>
          </div>
          {book && <BookScenes book={book} onLeave={close} />}
        </div>
      </div>
      <div className="sheet-actions">
        {book && (sure
          ? <button className="btn danger" onClick={() => { useShelf.getState().remove(book.id); close(); }}>Take it off the shelf</button>
          : <button className="btn ghost" onClick={() => setSure(true)} style={{ marginRight: 'auto' }}>Remove…</button>)}
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!ok}>{book ? 'Save' : 'Put it on the shelf'}</button>
      </div>
    </dialog>
  );
}

/* ---------------- importing an old shelf ---------------- */

function ImportShelf() {
  const input = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const books = useShelf((s) => s.books);
  const [file, setFile] = useState<{ name: string; found: Book[] | null; goodreads?: boolean } | null>(null);
  const [help, setHelp] = useState(false);
  const helpRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (help) helpRef.current?.showModal(); }, [help]);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => { if (file) ref.current?.showModal(); }, [file]);
  const plan = file?.found ? previewImport(books, file.found) : null;

  const read = async (f: File) => {
    const text = await f.text();
    let found: Book[] | null = null;
    let goodreads = false;
    try {
      found = parseShelfJson(JSON.parse(text), new Date().toISOString());
    } catch {
      const rows = csvToObjects(parseCsvRows(text));
      goodreads = isGoodreads(rows);
      found = goodreads ? parseGoodreads(rows, new Date().toISOString()) : parseShelfJson(rows, new Date().toISOString());
    }
    setDone(null);
    setFile({ name: f.name, found, goodreads });
  };
  const close = () => { ref.current?.close(); setFile(null); };

  return (
    <>
      <button className="btn" onClick={() => setHelp(true)}>Import from Goodreads</button>
      {help && (
        <dialog ref={helpRef} className="sheet gr-help" onClose={() => setHelp(false)} aria-labelledby="gr-title">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Import</div>
          <h2 id="gr-title" className="sheet-title">Bring your Goodreads shelf home</h2>
          <ol className="gr-steps">
            <li>On a computer, open <b>goodreads.com → My Books</b>.</li>
            <li>In the left column, under <b>Tools</b>, choose <b>Import and export</b>.</li>
            <li>Click <b>Export Library</b>, wait a moment, then download the <b>.csv</b> file it makes.</li>
            <li>Choose that file below. You’ll see every book before anything is added.</li>
          </ol>
          <p className="mono faint" style={{ fontSize: 11 }}>Ratings, dates read, page counts, reviews and your shelves all come across. Books already on your shelf are left as they are. Also takes a backup from the old Shelf, or any CSV with a Title column.</p>
          <div className="sheet-actions">
            <button className="btn ghost" onClick={() => { helpRef.current?.close(); setHelp(false); }}>Cancel</button>
            <button className="btn primary" onClick={() => { helpRef.current?.close(); setHelp(false); input.current?.click(); }}>Choose the file…</button>
          </div>
        </dialog>
      )}
      <input ref={input} type="file" hidden accept=".json,.csv,application/json,text/csv"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
      {file && (
        <dialog ref={ref} className="sheet" onClose={() => setFile(null)} aria-labelledby="imp-title">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Import</div>
          <h2 id="imp-title" className="sheet-title">{done !== null ? 'On the shelf.' : file.goodreads ? 'Your Goodreads library' : 'Bring your books in'}</h2>
          <p className="sheet-src mono">{file.name}</p>
          {!plan ? (
            <p className="sheet-warn">No books found in that file. It needs a list of books with at least a title (JSON, or a CSV such as a Goodreads export).</p>
          ) : done !== null ? (
            <>
              <p className="dim">Added {done} book{done === 1 ? '' : 's'}. Changed your mind? A restore point named “Before importing {file.name}” was saved first.</p>
              <CoverFill />
            </>
          ) : (
            <>
              <p className="dim" style={{ fontSize: 14 }}>
                <b className="g-good">{plan.add.length} new</b> book{plan.add.length === 1 ? '' : 's'}
                {plan.skip ? <>, and {plan.skip} already on your shelf (left exactly as they are)</> : null}. Nothing on your shelf is changed or removed.
              </p>
              <ul className="imp-list">
                {plan.add.slice(0, 40).map((b) => <li key={b.id}><span>{b.title}</span><span className="mono faint">{b.author} · {STATUS_LABEL[b.status]}</span></li>)}
                {plan.add.length > 40 && <li className="mono faint">…and {plan.add.length - 40} more</li>}
              </ul>
            </>
          )}
          <div className="sheet-actions">
            {plan && done === null && plan.add.length > 0 ? (
              <>
                <button className="btn ghost" onClick={close}>Cancel</button>
                <button className="btn primary" onClick={async () => setDone(await useShelf.getState().importBooks(plan.add, `Before importing ${file.name}`))}>
                  Add {plan.add.length} book{plan.add.length === 1 ? '' : 's'}
                </button>
              </>
            ) : <button className="btn primary" onClick={close}>Done</button>}
          </div>
        </dialog>
      )}
    </>
  );
}

/* ---------------- finding the real cover ---------------- */

function CoverFinder({ title, author, current, onPick }: { title: string; author: string; current?: string; onPick: (h: CoverHit | null) => void }) {
  const [hits, setHits] = useState<CoverHit[] | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'none' | 'offline'>('idle');
  const [paste, setPaste] = useState(false);
  const find = async () => {
    setState('busy');
    try {
      const r = await fetch(coverSearchUrl(title, author));
      const found = parseCoverResults(await r.json());
      setHits(found);
      setState(found.length ? 'idle' : 'none');
    } catch { setState('offline'); }
  };
  return (
    <div className="cover-finder">
      <button className="btn sm" disabled={!title.trim() || state === 'busy'} onClick={() => void find()}>
        {state === 'busy' ? 'Looking…' : current ? 'Change the cover' : 'Find the cover'}
      </button>
      {state === 'none' && <p className="mono faint">No covers found. Check the title, or paste an image link.</p>}
      {state === 'offline' && <p className="mono faint">Couldn’t reach Open Library. Are you online?</p>}
      {hits && hits.length > 0 && (
        <div className="cover-hits" role="listbox" aria-label="Choose a cover">
          {hits.map((h) => (
            <button key={h.cover} role="option" aria-selected={current === h.cover} className={current === h.cover ? 'on' : ''}
              title={`${h.title}${h.author ? ` · ${h.author}` : ''}${h.year ? ` · ${h.year}` : ''}`} onClick={() => onPick(h)}>
              <img src={h.cover.replace('-L.jpg', '-M.jpg')} alt={h.title}
                onLoad={(e) => { if (e.currentTarget.naturalWidth < 20) (e.currentTarget.parentElement as HTMLElement).hidden = true; }}
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).hidden = true; }} />
            </button>
          ))}
        </div>
      )}
      <div className="cover-more">
        {paste
          ? <input autoFocus placeholder="https://… image link" aria-label="Cover image link" onChange={(e) => { const v = e.target.value.trim(); if (/^https:\/\/\S+$/.test(v)) onPick({ cover: v, title, author }); }} />
          : <button className="linkish" onClick={() => setPaste(true)}>Paste a link instead</button>}
        {current && <button className="linkish" onClick={() => { onPick(null); setHits(null); }}>Use the drawn cover</button>}
      </div>
    </div>
  );
}

/* ---------------- finishing a book: the ceremony ---------------- */

/**
 * The cover lifts out of the sheet and flies to its place on the read wall (which opens up to
 * make room), the stars stamp in, the spine drops onto the shelf, and a card marks the moment.
 */
function Celebration({ book, from, m, onDone }: { book: Book; from: DOMRect | null; m: Milestone; onDone: () => void }) {
  const fly = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState(false);
  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`.read-wall [data-book="${book.id}"]`);
    const spineEl = document.querySelector<HTMLElement>(`[data-spine="${book.id}"]`);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];
    const land = () => {
      if (target) { target.style.visibility = ''; target.classList.add('landed'); embers(target, m.big ? 30 : 16); }
      if (spineEl) spineEl.classList.add('shelved');
      setCard(true);
      timers.push(window.setTimeout(() => { target?.classList.remove('landed', 'making-room'); spineEl?.classList.remove('shelved'); }, 2600));
    };
    if (!target || !from || !fly.current || still) { if (target) target.scrollIntoView({ block: 'center' }); land(); return () => timers.forEach(clearTimeout); }
    target.classList.add('making-room');
    target.style.visibility = 'hidden';
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const el = fly.current;
    // Wait a beat for the scroll and the gap to open, then fly to wherever the cover ended up.
    timers.push(window.setTimeout(() => {
      const to = target.getBoundingClientRect();
      const sx = to.width / from.width, sy = to.height / from.height;
      const dx = to.left - from.left, dy = to.top - from.top;
      const lift = Math.min(dy, 0) - 120;
      const a = el.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 },
        { transform: `translate(${dx * 0.45}px, ${lift}px) scale(${(1 + sx) / 2 * 1.12}) rotate(-6deg)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)`, offset: 1 },
      ], { duration: 1100, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
      a.onfinish = () => { el.style.display = 'none'; land(); };
    }, 520));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!card) return;
    const t = setTimeout(onDone, m.big ? 6000 : 4200);
    return () => clearTimeout(t);
  }, [card]); // eslint-disable-line react-hooks/exhaustive-deps
  const sp = spine(book);
  return (
    <>
      {from && (
        <div ref={fly} className={book.cover ? 'flying-cover has-art' : 'flying-cover'} aria-hidden
          style={{ left: from.left, top: from.top, width: from.width, height: from.height, '--c': sp.color } as CSSProperties}>
          <CoverArt b={book} />
        </div>
      )}
      {card && (
        <div className={m.big ? 'finish-card big' : 'finish-card'} role="status">
          <span className="fc-seal" aria-hidden>✦</span>
          <div>
            <p className="fc-h">{m.headline}</p>
            <p className="fc-l mono">{m.line}</p>
          </div>
          <button className="btn ghost sm" onClick={onDone} aria-label="Dismiss">✕</button>
        </div>
      )}
    </>
  );
}

/* ---------------- the reading goal ---------------- */

function GoalShelf({ books, year }: { books: Book[]; year: number }) {
  const goals = useShelf((st) => st.goals);
  const goal = goals?.[String(year)] ?? 0;
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(String(goal || 24));
  const p = goal ? goalPace(books, goal, year, todayISO()) : null;
  const done = books.filter((b) => b.status === 'read' && b.finished?.startsWith(String(year))).sort((a, b) => (a.finished ?? '').localeCompare(b.finished ?? ''));
  const editor = (
    <form className="goal-set" onSubmit={(e) => { e.preventDefault(); useShelf.getState().setGoal(year, Number(n) || 0); setEdit(false); }}>
      <label><span className="mono">Books in {year}</span><input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-label={`Reading goal for ${year}`} autoFocus /></label>
      <button className="btn primary sm" disabled={!Number(n)}>Set the goal</button>
      {goal > 0 && <button type="button" className="linkish" onClick={() => { useShelf.getState().setGoal(year, 0); setEdit(false); }}>Remove</button>}
    </form>
  );
  if (!p) {
    return (
      <section className="panel goal-shelf empty rise" style={rise(3)}>
        <div><p className="panel-t">A reading goal</p><p className="dim" style={{ margin: '4px 0 0', fontSize: 13.5 }}>Pick a number of books for {year}. The shelf will keep a slot for each one and show whether you’re on pace.</p></div>
        {edit ? editor : <button className="btn sm" onClick={() => setEdit(true)}>Set a goal for {year}</button>}
      </section>
    );
  }
  const slots = Math.max(goal, done.length);
  const tick = (p.expected / slots) * 100;
  const pace = p.done ? `Goal met${done.length > goal ? `, and ${done.length - goal} more` : ''}.` : p.ahead > 0 ? `${p.ahead} ${p.ahead === 1 ? 'book' : 'books'} ahead of pace` : p.ahead < 0 ? `${-p.ahead} behind pace` : 'Right on pace';
  return (
    <section className={p.done ? 'panel goal-shelf met rise' : 'panel goal-shelf rise'} style={rise(3)}>
      <div className="goal-head">
        <div>
          <p className="panel-t">The {year} goal</p>
          <p className="goal-big"><b>{p.read}</b><span> of {goal} books</span></p>
        </div>
        <div className="goal-pace">
          <span className={p.done || p.ahead >= 0 ? 'g-good' : 'g-warn'}>{pace}</span>
          {!p.done && <span className="mono faint">{p.perMonth} a month to finish on time</span>}
          {edit ? editor : <button className="linkish" onClick={() => { setN(String(goal)); setEdit(true); }}>Change the goal</button>}
        </div>
      </div>
      <div className={slots > 60 ? 'goal-row dense' : 'goal-row'} role="img" aria-label={`${p.read} of ${goal} books read; ${pace}`}>
        <div className="goal-slots" style={{ width: slots > 60 ? '100%' : `min(100%, ${slots * 25}px)` }}>
        {Array.from({ length: slots }, (_, i) => {
          const b = done[i];
          return <i key={i} className={b ? 'gs on' : 'gs'} style={b ? ({ '--c': spine(b).color } as CSSProperties) : undefined} title={b ? b.title : undefined} />;
        })}
        {!p.done && <span className="goal-tick" style={{ left: `${Math.min(100, tick)}%` }}><span className="mono">pace</span></span>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- reading stats ---------------- */

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function ReadingRoom({ books }: { books: Book[] }) {
  const years = readingYears(books);
  const [pick, setPick] = useState<number | null>(years[0] ?? null);
  const st = useMemo(() => readingStats(books, pick), [books, pick]);
  const maxStar = Math.max(1, ...st.stars);
  const maxMonth = Math.max(1, ...(st.months ?? [1]));
  return (
    <section className="panel reading-room rise" style={rise(3)} aria-label="Reading stats">
      <div className="panel-h">
        <p className="panel-t">The reading room</p>
        <div className="seg" role="radiogroup" aria-label="Which years">
          {years.slice(0, 5).map((y) => <button key={y} role="radio" aria-checked={pick === y} onClick={() => setPick(y)}>{y}</button>)}
          <button role="radio" aria-checked={pick === null} onClick={() => setPick(null)}>All time</button>
        </div>
      </div>
      <div className="rr-nums">
        <div><b><CountUp value={st.count} /></b><span className="mono">books</span></div>
        <div><b><CountUp value={st.pages} /></b><span className="mono">pages</span></div>
        <div><b>{st.avgRating ?? '—'}</b><span className="mono">avg rating</span></div>
        <div><b>{st.avgDays ?? '—'}</b><span className="mono">days a book</span></div>
        <div><b>{st.favorites}</b><span className="mono">5-star</span></div>
      </div>
      <div className="rr-grid">
        <div className="rr-card">
          <p className="rr-h mono">How I rate</p>
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="rr-bar"><span className="mono">{'★'.repeat(n)}</span><i style={{ width: `${(st.stars[n - 1] / maxStar) * 100}%` }} /><span className="mono faint">{st.stars[n - 1]}</span></div>
          ))}
        </div>
        {st.months && (
          <div className="rr-card">
            <p className="rr-h mono">Month by month</p>
            <div className="rr-months">{st.months.map((m, i) => <div key={i} title={`${m} in ${MONTHS[i]}`}><i style={{ height: `${(m / maxMonth) * 100}%` }} className={m ? 'on' : ''} /><span className="mono">{MONTHS[i]}</span></div>)}</div>
          </div>
        )}
        <div className="rr-card">
          <p className="rr-h mono">Most read</p>
          <TopList label="Authors" items={st.authors} />
          <TopList label="Genres" items={st.genres} />
        </div>
        <div className="rr-card rr-records">
          <p className="rr-h mono">Records</p>
          {st.longest && <p><span className="mono faint">Longest</span>{st.longest.title} <em>· {st.longest.pages} pp</em></p>}
          {st.shortest && <p><span className="mono faint">Shortest</span>{st.shortest.title} <em>· {st.shortest.pages} pp</em></p>}
          {st.fastest && <p><span className="mono faint">Fastest</span>{st.fastest.book.title} <em>· {st.fastest.days} {st.fastest.days === 1 ? 'day' : 'days'}</em></p>}
          {st.avgPages && <p><span className="mono faint">Average</span>{st.avgPages} pages</p>}
          {!st.longest && !st.fastest && <p className="dim">Add page counts and start dates to see records.</p>}
        </div>
      </div>
      <CoverFill quiet />
    </section>
  );
}

function TopList({ label, items }: { label: string; items: { name: string; n: number }[] }) {
  if (!items.length) return null;
  return (
    <div className="rr-top">
      <span className="mono faint">{label}</span>
      <ol>{items.slice(0, 3).map((it) => <li key={it.name}><span>{it.name}</span><span className="mono faint">{it.n}</span></li>)}</ol>
    </div>
  );
}

/* ---------------- covers for books that have none (after an import) ---------------- */

function CoverFill({ quiet = false }: { quiet?: boolean }) {
  const books = useShelf((st) => st.books);
  // No cover yet, or a cover guessed from the ISBN (Goodreads) that may turn out not to exist.
  const candidates = books.filter((b) => !b.cover || b.cover.includes('/b/isbn/'));
  const missing = books.filter((b) => !b.cover).length;
  const [run, setRun] = useState<{ done: number; found: number; of: number } | null>(null);
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  if (!candidates.length && !run) return null;
  const loads = (url: string) => new Promise<boolean>((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth > 20); im.onerror = () => res(false); im.src = url; });
  const start = async () => {
    stop.current = false;
    // Check the ISBN guesses first; only the ones that don't load need a search.
    const list: Book[] = [];
    for (const b of candidates) if (!b.cover || !(await loads(b.cover))) list.push(b);
    let found = 0;
    setRun({ done: 0, found: 0, of: list.length });
    for (let i = 0; i < list.length && !stop.current; i++) {
      try {
        const r = await fetch(coverSearchUrl(list[i].title, list[i].author));
        const hit = parseCoverResults(await r.json())[0];
        if (hit) { useShelf.getState().setCover(list[i].id, hit.cover); found++; }
      } catch { /* offline or rate-limited: leave it drawn */ }
      setRun({ done: i + 1, found, of: list.length });
      await new Promise((res) => setTimeout(res, 250));
    }
  };
  if (run) {
    const finished = run.done >= run.of;
    return (
      <div className="cover-fill" role="status">
        <div className="cf-bar"><i style={{ width: `${run.of ? (run.done / run.of) * 100 : 100}%` }} /></div>
        <span className="mono faint">{!run.of ? 'Every book has its cover.' : finished ? `Found ${run.found} of ${run.of} missing covers.` : `Finding covers… ${run.done} of ${run.of}`}</span>
      </div>
    );
  }
  const label = missing ? `Find covers for ${missing} ${missing === 1 ? 'book' : 'books'} without one` : 'Check for missing covers';
  return (
    <div className={quiet ? 'cover-fill quiet' : 'cover-fill'}>
      <button className={quiet ? 'linkish' : 'btn sm'} onClick={() => void start()}>{quiet || missing ? label : 'Find any missing covers'}</button>
    </div>
  );
}
