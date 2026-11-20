import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { todayISO } from '../../core/dates';
import { CountUp, embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { parseCsvRows } from '../ledger/logic';
import { csvToObjects, filterBooks, genres, parseShelfJson, previewImport, readingYear, shelfOrder, spine } from './logic';
import { useShelf } from './store';
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
  const year = new Date().getFullYear();
  const y = readingYear(books, year);
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

      {y.books.length > 0 && (
        <section className="rise" style={rise(3)}>
          <h2 className="section-h">{year} in books · {y.count} read{y.pages ? ` · ${y.pages.toLocaleString('en-US')} pages` : ''}</h2>
          <div className="covers small">{y.books.map((b) => <Cover key={b.id} b={b} onOpen={() => setOpen(b)} />)}</div>
        </section>
      )}

      {open && <BookSheet book={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------------- a spine on the shelf ---------------- */

function Spine({ b, onOpen }: { b: Book; onOpen: () => void }) {
  const s = spine(b);
  return (
    <div className="slot">
      <button className={`spine st-${b.status}`} style={{ '--c': s.color, height: s.height, width: s.width } as CSSProperties} onClick={onOpen}
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
    <button className="cover tilt" style={{ '--c': s.color } as CSSProperties} onClick={onOpen} {...tilt(8)}>
      <span className="cover-frame">
        <span className="cover-t">{b.title}</span>
        <span className="cover-rule" />
        <span className="cover-a mono">{b.author}</span>
      </span>
      {b.rating > 0 && <span className="cover-stars" aria-label={`${b.rating} stars`}>{stars(b.rating)}</span>}
    </button>
  );
}

const stars = (r: number) => '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : '');

/* ---------------- the book sheet: view and edit ---------------- */

function BookSheet({ book, onClose }: { book: Book | null; onClose: () => void }) {
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
    useShelf.getState().save(b);
    if (finishedNow) embers(ref.current?.querySelector('.sheet-cover') as HTMLElement, 22);
    setTimeout(close, finishedNow ? 500 : 0);
  };

  return (
    <dialog ref={ref} className="sheet book-sheet" onClose={onClose} aria-labelledby="book-title">
      <div className="book-grid">
        <div className="sheet-cover" style={{ '--c': s.color } as CSSProperties}>
          <span className="cover-frame">
            <span className="cover-t">{b.title || 'Untitled'}</span>
            <span className="cover-rule" />
            <span className="cover-a mono">{b.author || 'Author'}</span>
          </span>
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
  const [file, setFile] = useState<{ name: string; found: Book[] | null } | null>(null);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => { if (file) ref.current?.showModal(); }, [file]);
  const plan = file?.found ? previewImport(books, file.found) : null;

  const read = async (f: File) => {
    const text = await f.text();
    let found: Book[] | null = null;
    try {
      found = parseShelfJson(JSON.parse(text), new Date().toISOString());
    } catch {
      found = parseShelfJson(csvToObjects(parseCsvRows(text)), new Date().toISOString());
    }
    setDone(null);
    setFile({ name: f.name, found });
  };
  const close = () => { ref.current?.close(); setFile(null); };

  return (
    <>
      <button className="btn" onClick={() => input.current?.click()}>Import old shelf</button>
      <input ref={input} type="file" hidden accept=".json,.csv,application/json,text/csv"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
      {file && (
        <dialog ref={ref} className="sheet" onClose={() => setFile(null)} aria-labelledby="imp-title">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Import</div>
          <h2 id="imp-title" className="sheet-title">{done !== null ? 'On the shelf.' : 'Bring your books in'}</h2>
          <p className="sheet-src mono">{file.name}</p>
          {!plan ? (
            <p className="sheet-warn">No books found in that file. It needs a list of books with at least a title (JSON, or a CSV such as a Goodreads export).</p>
          ) : done !== null ? (
            <p className="dim">Added {done} book{done === 1 ? '' : 's'}. Changed your mind? A restore point named “Before importing {file.name}” was saved first.</p>
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
