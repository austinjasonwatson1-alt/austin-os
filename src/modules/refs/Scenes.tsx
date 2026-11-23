import { useEffect, useMemo, useRef, useState } from 'react';
import { rise } from '../../shell/lamp';
import { CountUp, embers } from '../../shell/fx';
import { useShelf } from '../shelf/store';
import { findScenes, kindCounts, kindOf, matchBook, matchKind, parseSceneCapture, SCENE_KINDS } from './logic';
import { useRefs } from './store';
import type { SceneRef } from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/shelf.css';
import '../../styles/scenes.css';

/** One marked scene, as a card from the catalogue. */
export function SceneCard({ s, onOpen, compact }: { s: SceneRef; onOpen: () => void; compact?: boolean }) {
  const k = kindOf(s.kind);
  // A quick capture names the scene from the start of "why it works": then the why is the title, said once.
  const fromWhy = Boolean(s.why && s.why.startsWith(s.label.replace(/…$/, '')));
  return (
    <article className={compact ? 'sc-card compact' : 'sc-card'}>
      <button className="sc-main" onClick={onOpen} aria-label={`Open ${s.label}`}>
        <span className="sc-stamp mono"><span aria-hidden>{k.glyph}</span>{k.label}</span>
        <b className={fromWhy ? 'sc-label long' : 'sc-label'}>{fromWhy ? s.why : s.label}</b>
        {s.passage && <blockquote className="sc-passage">{s.passage}</blockquote>}
        {s.why && !fromWhy && <span className="sc-why"><i className="mono">Why it works</i>{s.why}</span>}
        <span className="sc-src mono">{s.bookId ? '▥ ' : ''}{s.source}{s.where ? ` · ${s.where}` : ''}</span>
        {!compact && s.tags.length > 0 && <span className="sc-tags">{s.tags.map((t) => <span key={t} className="mono">#{t}</span>)}</span>}
      </button>
    </article>
  );
}

/** The catalogue drawers (kinds with counts), a search, and the cards. Used by the page and the writing desk. */
export function SceneBrowser({ initialKinds = [], compact, onNew }: { initialKinds?: string[]; compact?: boolean; onNew?: () => void }) {
  const r = useRefs();
  useEffect(() => { void r.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('');
  const counts = useMemo(() => kindCounts(r.scenes), [r.scenes]);
  const [kinds, setKinds] = useState<string[]>(() => initialKinds);
  // Only keep suggested kinds that actually have scenes; otherwise show everything.
  const live = kinds.filter((k) => counts.some((c) => c.k === k));
  const shown = useMemo(() => findScenes(r.scenes, q, live), [r.scenes, q, live.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<SceneRef | null>(null);
  const toggle = (k: string) => setKinds(live.includes(k) ? live.filter((x) => x !== k) : [...live, k]);
  return (
    <div className="sc-browser">
      <div className="sc-tools">
        <label className="shelf-search"><span aria-hidden>⌕</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scenes, books, why it works…" aria-label="Search the scene library" /></label>
        {onNew && <button className="btn primary sm" onClick={onNew}>+ Mark a scene</button>}
      </div>
      {counts.length > 0 && (
        <div className="sc-drawers" role="group" aria-label="Scene types">
          <button className={live.length === 0 ? 'sc-drawer on' : 'sc-drawer'} onClick={() => setKinds([])}><span>All</span><b className="mono">{r.scenes.length}</b></button>
          {counts.map((c) => (
            <button key={c.k} className={live.includes(c.k) ? 'sc-drawer on' : 'sc-drawer'} aria-pressed={live.includes(c.k)} onClick={() => toggle(c.k)}>
              <span><i aria-hidden>{c.glyph}</i>{c.label}</span><b className="mono">{c.n}</b>
            </button>
          ))}
        </div>
      )}
      {r.loaded && r.scenes.length === 0 ? (
        <div className="sc-empty">
          <p>The catalogue is empty.</p>
          <span className="mono">Reading and a scene lands? Mark it: “interrogation: Gone Girl p. 212 — the detective lets the silence do the work”. When you come to write one, it’s here.</span>
        </div>
      ) : shown.length === 0 ? (
        <p className="dim sc-none">No scenes match{q ? ` “${q}”` : ''}.</p>
      ) : (
        <div className={compact ? 'sc-grid compact' : 'sc-grid'}>{shown.map((s) => <SceneCard key={s.id} s={s} compact={compact} onOpen={() => setOpen(s)} />)}</div>
      )}
      {open && <SceneSheet scene={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The quick-capture line: type it the way you'd say it. */
export function SceneCapture() {
  const r = useRefs();
  const shelf = useShelf();
  useEffect(() => { void shelf.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [t, setT] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const draft = t.trim() ? parseSceneCapture(t, shelf.books) : null;
  const keep = (el: HTMLElement) => { if (!draft) return; const s = r.save(draft); embers(el, 12); setT(''); setSaved(s.label); setTimeout(() => setSaved(null), 2600); };
  return (
    <form className="sc-capture" onSubmit={(e) => { e.preventDefault(); keep(e.currentTarget); }}>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="interrogation: Gone Girl p. 212 — the detective lets the silence do the work" aria-label="Mark a scene" />
      <button className="btn primary" disabled={!draft}>Mark it</button>
      <span className="sc-capture-hint mono" aria-live="polite">
        {saved ? `Filed: ${saved}` : draft ? <>Files as <b>{kindOf(draft.kind).label}</b> · {draft.source || '—'}{draft.where ? ` · ${draft.where}` : ''}{draft.bookId ? ' · on your shelf' : ''}</> : 'type: book, page — why it works'}
      </span>
    </form>
  );
}

/** Add or edit one scene. `scene` null with `bookId` starts a new one from that book. */
export function SceneSheet({ scene, bookId, onClose }: { scene: SceneRef | null; bookId?: string | null; onClose: () => void }) {
  const r = useRefs();
  const shelf = useShelf();
  useEffect(() => { void shelf.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const book = shelf.books.find((b) => b.id === (scene?.bookId ?? bookId));
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState({
    kind: scene?.kind ?? 'interrogation', label: scene?.label ?? '', source: scene?.source ?? (book ? `${book.title}${book.author ? ` · ${book.author}` : ''}` : ''),
    where: scene?.where ?? '', passage: scene?.passage ?? '', why: scene?.why ?? '', tags: (scene?.tags ?? []).join(' '),
  });
  const [own, setOwn] = useState(scene && !SCENE_KINDS.some((k) => k.k === scene.kind) ? scene.kind : '');
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  const kind = own.trim() ? matchKind(own) : v.kind;
  const linked = matchBook(v.source.split(' · ')[0], shelf.books);
  const ok = Boolean(v.label.trim() || v.why.trim()) && Boolean(v.source.trim());
  const save = () => {
    r.save({ id: scene?.id, kind, label: v.label.trim() || v.why.trim().split(/\s+/).slice(0, 8).join(' '), source: v.source, bookId: linked?.id, where: v.where, passage: v.passage, why: v.why, tags: v.tags.split(/[\s,]+/) });
    close();
  };
  return (
    <dialog ref={ref} className="sheet sc-sheet" onClose={onClose} aria-labelledby="sc-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>The Scene Library</div>
      <h2 id="sc-t" className="sheet-title">{scene ? scene.label : 'Mark a scene'}</h2>
      <div className="sc-kinds" role="radiogroup" aria-label="Kind of scene">
        {SCENE_KINDS.map((k) => <button key={k.k} role="radio" aria-checked={!own && v.kind === k.k} className={!own && v.kind === k.k ? 'gchip on' : 'gchip'} onClick={() => { setOwn(''); setV({ ...v, kind: k.k }); }}><span aria-hidden>{k.glyph}</span> {k.label}</button>)}
        <input className="sc-own" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="or your own: dinner party…" aria-label="Your own kind of scene" />
      </div>
      <label className="field"><span>What happens</span><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="The detective breaks the husband" autoFocus={!scene} /></label>
      <div className="sc-row">
        <label className="field"><span>From</span><input value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} placeholder="A book, a film, a show" list="sc-books" /></label>
        <label className="field sc-where"><span>Where</span><input value={v.where} onChange={(e) => setV({ ...v, where: e.target.value })} placeholder="p. 212" /></label>
      </div>
      <datalist id="sc-books">{shelf.books.map((b) => <option key={b.id} value={`${b.title}${b.author ? ` · ${b.author}` : ''}`} />)}</datalist>
      {linked && <p className="mono sc-linked">▥ On your shelf: {linked.title}</p>}
      <label className="field"><span>Why it works (the move to borrow)</span><textarea rows={3} value={v.why} onChange={(e) => setV({ ...v, why: e.target.value })} placeholder="She never asks the question he’s braced for. Silence does the work; he fills it." /></label>
      <label className="field"><span>The passage (optional)</span><textarea rows={3} className="sc-passage-in" value={v.passage} onChange={(e) => setV({ ...v, passage: e.target.value })} placeholder="A line or two, to hear the rhythm again." /></label>
      <label className="field"><span>Tags</span><input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="police pacing subtext" /></label>
      <div className="sheet-actions">
        {scene && (sure ? <button className="btn danger" onClick={() => { r.remove(scene.id); close(); }}>Remove it</button> : <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Remove…</button>)}
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={save}>{scene ? 'Save' : 'File it'}</button>
      </div>
    </dialog>
  );
}

/** The room: the catalogue of scenes worth learning from. */
export default function ScenesPage() {
  const r = useRefs();
  useEffect(() => { void r.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState<boolean>(false);
  // Arriving from a book on the Shelf: open a new card for it straight away.
  useEffect(() => { if (r.startFrom) setAdding(true); }, [r.startFrom]);
  const books = new Set(r.scenes.map((s) => s.source)).size;
  const kinds = kindCounts(r.scenes).length;
  return (
    <div className="home scenes">
      <section className="hero sc-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">Writer's Cabin · The Scene Library</div>
          <h1 className="hero-title">The Scene<br /><em>Library.</em></h1>
          <p className="hero-line">Every scene that taught you something, filed by kind. Reading and a scene lands, mark it. Sitting down to write one, pull the drawer.</p>
          <SceneCapture />
        </div>
        <div className="ledger-stats">
          <div className="lstat"><span className="lstat-v"><CountUp value={r.scenes.length} /></span><span className="lstat-u mono">scenes</span><span className="lstat-l mono">Marked</span></div>
          <div className="lstat"><span className="lstat-v"><CountUp value={kinds} /></span><span className="lstat-u mono">kinds</span><span className="lstat-l mono">Drawers</span></div>
          <div className="lstat"><span className="lstat-v"><CountUp value={books} /></span><span className="lstat-u mono">sources</span><span className="lstat-l mono">Books & more</span></div>
        </div>
      </section>
      <section className="rise" style={rise(2)}>
        <SceneBrowser onNew={() => setAdding(true)} />
      </section>
      {adding && <SceneSheet scene={null} bookId={r.startFrom} onClose={() => { setAdding(false); r.setStartFrom(null); }} />}
    </div>
  );
}
