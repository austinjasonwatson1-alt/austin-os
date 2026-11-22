import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { daysUntil, MONTHS_SHORT, parseISO, prettyDate, todayISO } from '../../core/dates';
import { CountUp, embers, reducedMotion, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { dataUrlKB, processImage } from './image';
import { EXIF_SCAN_BYTES, exifDay } from './exif';
import {
  agoLabel, capsuleState, countdownLabel, daysToOpen, dayOf, filterByTag, groupByMonth, leanFor, onThisDay, photoDay,
  sealedFor, sealProblem, sortCapsules, tagCounts, type CapsuleDraft,
} from './logic';
import { useMemories, type NewPhoto } from './store';
import { TAG_LABEL, TAGS, type Capsule, type Memory, type MemoryTag } from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/memories.css';

export { OnThisDay, CapsuleReady } from './widgets';

const fullDate = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
const shortDate = (d: string) => `${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;

export default function MemoriesPage() {
  const { items, capsules, loaded, load, view, setView } = useMemories();
  useEffect(() => { void load(); }, [load]);
  const today = todayISO();
  const sealed = capsules.filter((c) => !c.openedOn).length;
  const days = useMemo(() => new Set(items.map((m) => m.day)).size, [items]);

  return (
    <div className="home memories">
      <section className="hero mem-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · Memories</div>
          <h1 className="hero-title">Kept<br /><em>by lamplight.</em></h1>
          <p className="hero-line">Photos pinned to the days they belong to, and letters to the man you’re becoming — sealed until it’s time.</p>
          <div className="seg mem-tabs" role="tablist" aria-label="Memories or the time capsule">
            <button role="tab" aria-selected={view === 'memories'} aria-checked={view === 'memories'} onClick={() => setView('memories')}>Memories</button>
            <button role="tab" aria-selected={view === 'capsule'} aria-checked={view === 'capsule'} onClick={() => setView('capsule')}>Time capsule</button>
          </div>
        </div>
        <div className="ledger-stats">
          <div className="lstat"><span className="lstat-v"><CountUp value={items.length} /></span><span className="lstat-u mono">photos</span><span className="lstat-l mono">On the wall</span></div>
          <div className="lstat"><span className="lstat-v"><CountUp value={days} /></span><span className="lstat-u mono">days</span><span className="lstat-l mono">Remembered</span></div>
          <div className="lstat"><span className="lstat-v"><CountUp value={sealed} /></span><span className="lstat-u mono">sealed</span><span className="lstat-l mono">Letters waiting</span></div>
        </div>
      </section>

      {view === 'memories'
        ? <MemoryWall items={items} loaded={loaded} today={today} />
        : <CapsuleRoom capsules={capsules} loaded={loaded} today={today} />}
    </div>
  );
}

/* ====================================================================== */
/*  Memories                                                              */
/* ====================================================================== */

function MemoryWall({ items, loaded, today }: { items: Memory[]; loaded: boolean; today: string }) {
  const [tag, setTag] = useState<MemoryTag | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => filterByTag(items, tag), [items, tag]);
  const groups = useMemo(() => groupByMonth(shown), [shown]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const counts = useMemo(() => tagCounts(items), [items]);
  const otd = useMemo(() => onThisDay(items, today), [items, today]);
  const open = openId ? items.find((m) => m.id === openId) ?? null : null;

  return (
    <>
      <section className="mem-tools rise" style={rise(1)}>
        <button className="btn primary" onClick={() => input.current?.click()}>+ Add photos</button>
        <input ref={input} type="file" accept="image/*" multiple hidden
          onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) setFiles(f); }} />
        {counts.length > 0 && (
          <div className="mem-tags" role="radiogroup" aria-label="Filter by tag">
            <button role="radio" aria-checked={tag === null} className={tag === null ? 'mtag on' : 'mtag'} onClick={() => setTag(null)}>All <em>{items.length}</em></button>
            {counts.map(({ tag: t, n }) => (
              <button key={t} role="radio" aria-checked={tag === t} className={`mtag t-${t}${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
                {TAG_LABEL[t]} <em>{n}</em>
              </button>
            ))}
          </div>
        )}
      </section>

      {otd && !tag && (
        <section className="mem-otd rise" style={rise(2)}>
          <h2 className="section-h">On this day · {agoLabel(otd.items[0].day, today, otd.kind)}</h2>
          <div className="otd-row">
            {otd.items.slice(0, 6).map((m) => <Polaroid key={m.id} m={m} onOpen={() => setOpenId(m.id)} big />)}
          </div>
        </section>
      )}

      <section className="rise" style={rise(3)}>
        {loaded && items.length === 0 && (
          <div className="mem-empty">
            <div className="mem-empty-pins" aria-hidden><i /><i /><i /></div>
            <p>The wall is bare.</p>
            <span className="mono">Pin the first one — Cooper asleep by the stove, the desk at 5 a.m., a page you were proud of.</span>
            <button className="btn primary" onClick={() => input.current?.click()}>Choose photos…</button>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="mem-month">
            <div className="mem-wall-y"><span className="mono">{g.label}</span><i /><span className="mono faint">{g.items.length} {g.items.length === 1 ? 'photo' : 'photos'}</span></div>
            <div className="mem-wall">
              {g.items.map((m) => <Polaroid key={m.id} m={m} onOpen={() => setOpenId(m.id)} />)}
            </div>
          </div>
        ))}
      </section>

      {files && <UploadSheet files={files} onClose={() => setFiles(null)} />}
      {open && <Lightbox key={open.id} m={open} list={flat} onGo={setOpenId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function Polaroid({ m, onOpen, big = false }: { m: Memory; onOpen: () => void; big?: boolean }) {
  return (
    <button className={big ? 'polaroid big' : 'polaroid'} style={{ '--lean': `${leanFor(m.id)}deg` } as CSSProperties} onClick={onOpen} {...tilt(6)}
      aria-label={`${m.caption || 'Photo'}, ${prettyDate(m.day)}${m.tag ? `, ${TAG_LABEL[m.tag]}` : ''}`}>
      <span className="pol-tape" aria-hidden />
      <span className="pol-img"><img src={m.thumb} alt="" loading="lazy" /></span>
      <span className="pol-cap">{m.caption || <span className="faint">—</span>}</span>
      <span className="pol-meta mono">{shortDate(m.day)}{m.day.slice(0, 4) !== todayISO().slice(0, 4) ? ` ’${m.day.slice(2, 4)}` : ''}{m.tag && <i className={`pol-tag t-${m.tag}`}>{TAG_LABEL[m.tag]}</i>}</span>
    </button>
  );
}

function TagPicker({ value, onChange, label = 'Tag' }: { value: MemoryTag | undefined; onChange: (t: MemoryTag | undefined) => void; label?: string }) {
  return (
    <div className="mem-tags tight" role="radiogroup" aria-label={label}>
      {TAGS.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={value === t} className={`mtag t-${t}${value === t ? ' on' : ''}`} onClick={() => onChange(value === t ? undefined : t)}>
          {TAG_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

/* ---------------- upload: shrink, date, caption, then pin ---------------- */

interface Pending { key: string; name: string; day: string; from: 'photo' | 'file' | 'you'; caption: string; tag?: MemoryTag; full?: string; thumb?: string; err?: string }

function UploadSheet({ files, onClose }: { files: File[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Pending[]>(() => files.map((f, i) => ({ key: `${i}-${f.name}`, name: f.name, ...photoDay(null, f.lastModified, todayISO()), caption: '' })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  // Shrink one at a time so a phone's worth of photos doesn't take all the memory at once.
  useEffect(() => {
    let live = true;
    (async () => {
      // The real day first, from each photo's EXIF (the shrunk copy loses it). Quick: only the first bytes are read.
      for (let i = 0; i < files.length && live; i++) {
        try {
          const taken = exifDay(await files[i].slice(0, EXIF_SCAN_BYTES).arrayBuffer());
          const pd = photoDay(taken, files[i].lastModified, todayISO());
          if (live && pd.from === 'photo') setRows((r) => r.map((x, j) => (j === i && x.from !== 'you' ? { ...x, ...pd } : x)));
        } catch { /* keep the file's day */ }
      }
      for (let i = 0; i < files.length && live; i++) {
        try {
          const p = await processImage(files[i]);
          if (live) setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
        } catch (e) {
          if (live) setRows((r) => r.map((x, j) => (j === i ? { ...x, err: e instanceof Error ? e.message : 'Couldn’t read that image.' } : x)));
        }
      }
    })();
    return () => { live = false; };
  }, [files]);

  const close = () => { ref.current?.close(); onClose(); };
  const edit = (k: string, patch: Partial<Pending>) => setRows((r) => r.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const ready = rows.filter((r) => r.full && r.thumb && !r.err);
  const busy = rows.some((r) => !r.full && !r.err);
  const kb = ready.reduce((n, r) => n + dataUrlKB(r.full!) + dataUrlKB(r.thumb!), 0);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const photos: NewPhoto[] = ready.map((r) => ({ full: r.full!, thumb: r.thumb!, day: r.day, caption: r.caption, tag: r.tag }));
      await useMemories.getState().addPhotos(photos);
      embers(ref.current?.querySelector('.sheet-actions') as HTMLElement | null, 14);
      close();
    } catch {
      setErr('Something went wrong saving — nothing was lost, but those photos weren’t pinned. Try again?');
      setSaving(false);
    }
  };

  return (
    <dialog ref={ref} className="sheet mem-upload" onClose={onClose} aria-labelledby="up-title">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>New on the wall</div>
      <h2 id="up-title" className="sheet-title">{files.length === 1 ? 'One photo' : `${files.length} photos`}</h2>
      <p className="sheet-src mono">Shrunk to 1280px on this device, so they ride along in every backup and sync.</p>
      {rows.length > 1 && (
        <div className="up-all">
          <span className="mono faint">Tag them all</span>
          <TagPicker value={rows.every((r) => r.tag && r.tag === rows[0].tag) ? rows[0].tag : undefined} onChange={(t) => setRows((r) => r.map((x) => ({ ...x, tag: t })))} label="Tag every photo" />
        </div>
      )}
      <ul className="up-list">
        {rows.map((r) => (
          <li key={r.key} className={r.err ? 'up-row bad' : 'up-row'}>
            <span className="up-thumb">{r.thumb ? <img src={r.thumb} alt="" /> : r.err ? <b aria-hidden>✕</b> : <i className="up-spin" aria-label="Preparing" />}</span>
            <div className="up-fields">
              {r.err ? (
                <p className="up-err"><b>{r.name}</b> — {r.err}</p>
              ) : (
                <>
                  <div className="field-row up-two">
                    <label className="field"><span>Day <em className={`up-from ${r.from}`}>{r.from === 'photo' ? '· taken' : r.from === 'file' ? '· file date' : ''}</em></span><input type="date" value={r.day} max={todayISO()} onChange={(e) => e.target.value && edit(r.key, { day: e.target.value, from: 'you' })} /></label>
                    <label className="field"><span>Caption</span><input value={r.caption} placeholder="What was happening…" onChange={(e) => edit(r.key, { caption: e.target.value })} /></label>
                  </div>
                  <TagPicker value={r.tag} onChange={(t) => edit(r.key, { tag: t })} />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {err && <p className="sheet-warn">{err}</p>}
      <div className="sheet-actions">
        <span className="mono faint up-size">{busy ? 'Preparing…' : `${ready.length} ready · ~${kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}`}</span>
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy || saving || !ready.length}>{saving ? 'Pinning…' : ready.length === 1 ? 'Pin it to the wall' : `Pin ${ready.length} to the wall`}</button>
      </div>
    </dialog>
  );
}

/* ---------------- the lightbox ---------------- */

function Lightbox({ m, list, onGo, onClose }: { m: Memory; list: Memory[]; onGo: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [full, setFull] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [d, setD] = useState({ caption: m.caption, day: m.day, tag: m.tag });
  const [sure, setSure] = useState(false);
  const gone = useRef(false);
  const dirty = d.caption !== m.caption || d.day !== m.day || d.tag !== m.tag;
  const i = list.findIndex((x) => x.id === m.id);
  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;

  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);
  useEffect(() => {
    let live = true;
    void useMemories.getState().photo(m.id).then((p) => { if (!live) return; if (p) setFull(p); else setMissing(true); });
    return () => { live = false; };
  }, [m.id]);

  // Words are never thrown away: leaving the lightbox keeps what was typed.
  const keep = () => { if (dirty && !gone.current) useMemories.getState().update(m.id, { caption: d.caption, day: d.day, tag: d.tag }); };
  const goTo = (x: Memory | null) => { if (!x) return; keep(); onGo(x.id); };
  const close = () => { keep(); ref.current?.close(); };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') goTo(prev);
    if (e.key === 'ArrowRight') goTo(next);
  };

  return (
    <dialog ref={ref} className="mem-light" onClose={() => { keep(); onClose(); }} onKeyDown={onKey} aria-label={m.caption || `Photo from ${prettyDate(m.day)}`}
      onClick={(e) => { if (e.target === ref.current) close(); }}>
      <div className="light-grid">
        <figure className="light-photo">
          <img className={full ? 'thumb gone' : 'thumb'} src={m.thumb} alt="" />
          {full && <img className="full" src={full} alt={m.caption || ''} />}
          {missing && <figcaption className="mono light-missing">Only the small copy is on this device — the full photo will arrive with the next sync.</figcaption>}
          {prev && <button className="light-nav l" onClick={() => goTo(prev)} aria-label="Previous photo">‹</button>}
          {next && <button className="light-nav r" onClick={() => goTo(next)} aria-label="Next photo">›</button>}
        </figure>
        <div className="light-side">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{prettyDate(d.day)} · {d.day.slice(0, 4)}</div>
          <label className="field light-cap"><span>Caption</span>
            <textarea className="ruled" rows={3} value={d.caption} placeholder="What was happening…" onChange={(e) => setD({ ...d, caption: e.target.value })} />
          </label>
          <label className="field"><span>Day</span><input type="date" value={d.day} onChange={(e) => e.target.value && setD({ ...d, day: e.target.value })} /></label>
          <div className="field"><span>Tag</span><TagPicker value={d.tag} onChange={(t) => setD({ ...d, tag: t })} /></div>
          <p className="mono faint light-added">Pinned {fullDate(dayOf(Date.parse(m.addedAt) || Date.now()))}{list.length > 1 && i >= 0 ? ` · ${i + 1} of ${list.length}` : ''}</p>
          <div className="sheet-actions">
            {sure
              ? <button className="btn danger-solid" onClick={() => { gone.current = true; void useMemories.getState().remove(m.id); ref.current?.close(); }}>Delete this photo for good</button>
              : <button className="btn ghost danger" onClick={() => setSure(true)} style={{ marginRight: 'auto' }}>Delete…</button>}
            {sure && <button className="btn ghost" onClick={() => setSure(false)}>Keep it</button>}
            <button className="btn primary" onClick={close}>{dirty ? 'Save' : 'Done'}</button>
          </div>
        </div>
      </div>
      <button className="light-x" onClick={close} aria-label="Close">✕</button>
    </dialog>
  );
}

/* ====================================================================== */
/*  The time capsule                                                      */
/* ====================================================================== */

const EVENTS = ['The day I sign with an agent', 'The day the book sells', 'The day I hold the finished book', 'The day I finish the first draft'];

function CapsuleRoom({ capsules, loaded, today }: { capsules: Capsule[]; loaded: boolean; today: string }) {
  const [writing, setWriting] = useState(false);
  const [reading, setReading] = useState<{ c: Capsule; unseal: boolean } | null>(null);
  const [confirm, setConfirm] = useState<Capsule | null>(null);
  const sorted = useMemo(() => sortCapsules(capsules, today), [capsules, today]);
  const waiting = sorted.filter((c) => capsuleState(c, today) !== 'open');
  const opened = sorted.filter((c) => capsuleState(c, today) === 'open');

  const openIt = (c: Capsule) => {
    const st = capsuleState(c, today);
    if (st === 'open') setReading({ c, unseal: false });
    else if (st === 'ready') setReading({ c, unseal: true });
    else if (c.event) setConfirm(c);
  };

  return (
    <>
      <section className="cap-intro rise" style={rise(1)}>
        <p>Write to future Austin. Once sealed, not even you can read it — until the day comes.</p>
        <button className="btn primary" onClick={() => setWriting(true)}>✒ Write a letter</button>
      </section>

      <section className="rise" style={rise(2)}>
        {loaded && capsules.length === 0 && (
          <div className="mem-empty cap-empty">
            <Envelope state="sealed" title="To the man who signed with an agent" sub="opens the day it happens" ghost />
            <p>No letters yet.</p>
            <span className="mono">Tell him what this year cost, what you hoped, who was by the stove.</span>
          </div>
        )}
        {waiting.length > 0 && (
          <>
            <h2 className="section-h">Sealed · {waiting.length}</h2>
            <div className="env-grid">
              {waiting.map((c) => {
                const st = capsuleState(c, today);
                const n = daysToOpen(c, today);
                const sub = st === 'ready' ? 'Its day has come' : n !== null ? countdownLabel(n) : `opens ${lowerFirst(c.event ?? 'when it happens')}`;
                return (
                  <Envelope key={c.id} state={st} title={c.title} sub={sub}
                    foot={`Sealed ${fullDate(c.written)}${c.opensOn ? ` · opens ${fullDate(c.opensOn)}` : ''}`}
                    action={st === 'ready' ? 'Break the seal' : c.event ? 'Open it now…' : undefined}
                    onOpen={st === 'ready' || c.event ? () => openIt(c) : undefined}
                    onBurn={() => useMemories.getState().removeCapsule(c.id)} />
                );
              })}
            </div>
          </>
        )}
        {opened.length > 0 && (
          <>
            <h2 className="section-h">Opened · {opened.length}</h2>
            <div className="letter-grid">
              {opened.map((c) => (
                <button key={c.id} className="letter-card" onClick={() => openIt(c)} {...tilt(5)}>
                  <span className="lc-t">{c.title}</span>
                  <span className="lc-b">{c.body.slice(0, 160)}{c.body.length > 160 ? '…' : ''}</span>
                  <span className="lc-f mono">Written {fullDate(c.written)} · opened {fullDate(c.openedOn!)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {writing && <WriteSheet today={today} onClose={() => setWriting(false)} />}
      {confirm && <ConfirmOpen c={confirm} onClose={() => setConfirm(null)} onYes={() => { setReading({ c: confirm, unseal: true }); setConfirm(null); }} />}
      {reading && <LetterSheet key={reading.c.id} c={reading.c} unseal={reading.unseal} today={today} onClose={() => setReading(null)} />}
    </>
  );
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function Envelope({ state, title, sub, foot, action, onOpen, onBurn, ghost = false }: {
  state: 'sealed' | 'ready' | 'open'; title: string; sub: string; foot?: string; action?: string;
  onOpen?: () => void; onBurn?: () => void; ghost?: boolean;
}) {
  const [burn, setBurn] = useState(false);
  return (
    <div className={`envelope s-${state}${ghost ? ' ghost' : ''}`} {...(ghost ? {} : tilt(5))}>
      <div className="env-paper" aria-hidden><i className="env-flap" /><i className="env-fold l" /><i className="env-fold r" /></div>
      <span className="wax" aria-hidden>A</span>
      <div className="env-copy">
        <span className="env-to mono">To future Austin</span>
        <span className="env-t">{title}</span>
        <span className="env-sub mono">{sub}</span>
        {foot && <span className="env-foot mono">{foot}</span>}
      </div>
      {!ghost && (
        <div className="env-acts">
          {burn ? (
            <>
              <button className="btn sm danger-solid" onClick={onBurn}>Burn it unread</button>
              <button className="btn sm ghost" onClick={() => setBurn(false)}>Keep it</button>
            </>
          ) : (
            <>
              {action && onOpen && <button className={state === 'ready' ? 'btn sm primary' : 'btn sm'} onClick={onOpen}>{action}</button>}
              <button className="btn sm ghost env-burn" onClick={() => setBurn(true)} aria-label={`Destroy “${title}” without reading it`}>✕</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WriteSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [d, setD] = useState<CapsuleDraft>({ title: '', body: '', opensOn: undefined, event: undefined });
  const [mode, setMode] = useState<'date' | 'event'>('date');
  const [tried, setTried] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const draft: CapsuleDraft = mode === 'date' ? { ...d, event: undefined } : { ...d, opensOn: undefined };
  const problem = sealProblem(draft, today);
  const yearOut = String(Number(today.slice(0, 4)) + 1) + today.slice(4);

  const cancel = () => {
    if (d.body.trim() && !sure) return setSure(true);
    ref.current?.close();
  };
  const seal = () => {
    setTried(true);
    if (problem) return;
    useMemories.getState().writeCapsule(draft);
    embers(ref.current?.querySelector('.btn.primary') as HTMLElement | null, 22);
    ref.current?.close();
  };

  return (
    <dialog ref={ref} className="sheet cap-write" onClose={onClose} onCancel={(e) => { if (d.body.trim() && !sure) { e.preventDefault(); setSure(true); } }} aria-labelledby="cw-title">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>A letter to future Austin · {fullDate(today)}</div>
      <label className="field"><span>On the envelope</span>
        <input id="cw-title" className="cw-title" value={d.title} placeholder="Open this when…" onChange={(e) => setD({ ...d, title: e.target.value })} autoFocus />
      </label>
      <label className="field cw-body"><span>The letter</span>
        <textarea className="ruled cw-paper" rows={11} value={d.body} placeholder={'Dear Austin,\n\n'} onChange={(e) => setD({ ...d, body: e.target.value })} />
      </label>
      <div className="cw-when">
        <div className="seg wide" role="radiogroup" aria-label="When it opens">
          <button role="radio" aria-checked={mode === 'date'} onClick={() => setMode('date')}>On a day</button>
          <button role="radio" aria-checked={mode === 'event'} onClick={() => setMode('event')}>When something happens</button>
        </div>
        {mode === 'date' ? (
          <div className="cw-row">
            <label className="field"><span>Opens on</span><input type="date" min={today} value={d.opensOn ?? ''} onChange={(e) => setD({ ...d, opensOn: e.target.value || undefined })} /></label>
            <div className="cw-quick">
              {[['In a year', yearOut], ['New Year’s', `${Number(today.slice(0, 4)) + 1}-01-01`], ['In 5 years', String(Number(today.slice(0, 4)) + 5) + today.slice(4)]].map(([l, v]) => (
                <button key={l} type="button" className={d.opensOn === v ? 'mtag on' : 'mtag'} onClick={() => setD({ ...d, opensOn: v })}>{l}</button>
              ))}
            </div>
            {d.opensOn && d.opensOn > today && <span className="mono dim cw-count">{countdownLabel(daysUntil(d.opensOn, today))}</span>}
          </div>
        ) : (
          <div className="cw-row">
            <label className="field"><span>Open it on</span><input value={d.event ?? ''} list="cap-events" placeholder="The day I sign with an agent" onChange={(e) => setD({ ...d, event: e.target.value })} /></label>
            <datalist id="cap-events">{EVENTS.map((x) => <option key={x} value={x} />)}</datalist>
            <span className="mono faint">You’ll open it yourself, when it happens.</span>
          </div>
        )}
      </div>
      {tried && problem && <p className="sheet-warn">{problem}</p>}
      {sure && <p className="sheet-warn">Throw this letter away? <b>It hasn’t been sealed or saved.</b></p>}
      <div className="sheet-actions">
        {sure
          ? <><button className="btn danger" onClick={() => ref.current?.close()}>Throw it away</button><button className="btn ghost" onClick={() => setSure(false)}>Keep writing</button></>
          : <button className="btn ghost" onClick={cancel}>Cancel</button>}
        <button className="btn primary" onClick={seal} disabled={tried && !!problem}>Seal it with wax</button>
      </div>
    </dialog>
  );
}

function ConfirmOpen({ c, onClose, onYes }: { c: Capsule; onClose: () => void; onYes: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="sheet cap-confirm" onClose={onClose} aria-labelledby="cc-title">
      <span className="wax big" aria-hidden>A</span>
      <h2 id="cc-title" className="sheet-title">Has it happened?</h2>
      <p className="dim">This letter is meant for <em className="cc-event">{lowerFirst(c.event ?? 'a day still to come')}</em>. Once the seal is broken it can’t be sealed again.</p>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => ref.current?.close()}>Not yet — keep it sealed</button>
        <button className="btn primary" onClick={() => { ref.current?.close(); onYes(); }}>It happened. Open it.</button>
      </div>
    </dialog>
  );
}

function LetterSheet({ c, unseal, today, onClose }: { c: Capsule; unseal: boolean; today: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<'seal' | 'breaking' | 'open'>(unseal ? 'seal' : 'open');
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  const breakSeal = () => {
    useMemories.getState().openCapsule(c.id);
    if (reducedMotion()) return setPhase('open');
    setPhase('breaking');
    embers(ref.current?.querySelector('.wax') as HTMLElement | null, 20);
    setTimeout(() => setPhase('open'), 1500);
  };
  const openedOn = c.openedOn ?? today;
  const days = sealedFor({ ...c, openedOn }, today);

  return (
    <dialog ref={ref} className={`sheet cap-letter p-${phase}`} onClose={onClose} aria-labelledby="cl-title">
      {phase !== 'open' ? (
        <div className="unseal">
          <div className="unseal-stage">
            <div className="unseal-env" aria-hidden>
              <i className="env-flap" /><i className="env-fold l" /><i className="env-fold r" />
              <i className="unseal-page" />
            </div>
            <button className="wax big seal-btn" onClick={breakSeal} disabled={phase === 'breaking'} aria-label="Break the seal">
              <i className="half a">A</i><i className="half b">A</i>
            </button>
          </div>
          <h2 id="cl-title" className="sheet-title unseal-t">{c.title}</h2>
          <p className="mono dim">Sealed {fullDate(c.written)}{phase === 'seal' ? ' · touch the wax to open' : ''}</p>
        </div>
      ) : (
        <article className="letter">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Written {fullDate(c.written)} · sealed {days} day{days === 1 ? '' : 's'}</div>
          <h2 id="cl-title" className="letter-t">{c.title}</h2>
          <div className="letter-body">{c.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
          <div className="sheet-actions">
            {sure
              ? <><button className="btn danger-solid" onClick={() => { useMemories.getState().removeCapsule(c.id); ref.current?.close(); }}>Delete this letter for good</button><button className="btn ghost" onClick={() => setSure(false)}>Keep it</button></>
              : <button className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Delete…</button>}
            <button className="btn primary" onClick={() => ref.current?.close()}>Fold it away</button>
          </div>
        </article>
      )}
    </dialog>
  );
}
