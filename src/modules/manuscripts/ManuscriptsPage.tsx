import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { mondayOf, todayISO } from '../../core/dates';
import { CountUp, embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { fmtMins } from '../ledger/logic';
import { minutesByChapter } from '../timer/logic';
import { useTimer } from '../timer/store';
import { byStatus, chapterNo, dailyTotals, fmtWords, progress, readTime, totalWords, wordsSince } from './logic';
import { useManuscripts } from './store';
import { STATUS_NAME, STATUSES, type Chapter, type ChapterStatus, type Manuscript } from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/manuscripts.css';

const STATUS_COLOR: Record<ChapterStatus, string> = { idea: '#8E7CF0', draft: '#6FB3F2', revise: '#E0A426', done: '#4FBF87' };

export default function ManuscriptsPage() {
  const { manuscripts, active, loaded, load, setActive } = useManuscripts();
  const timer = useTimer();
  useEffect(() => { void load(); void timer.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const m = manuscripts.find((x) => x.id === active) ?? manuscripts[0];
  const mins = useMemo(() => minutesByChapter(timer.sessions), [timer.sessions]);

  if (!loaded) return null;

  return (
    <div className="home mss">
      <section className="rise" style={{ ...rise(0), marginBottom: 18 }}>
        <div className="page-eyebrow">Writer's Cabin · Manuscripts</div>
        <h1 className="hero-title mss-title">The <em>manuscripts.</em></h1>
      </section>

      <div className="ms-books rise" style={rise(1)}>
        {manuscripts.map((x) => <BookCard key={x.id} m={x} on={x.id === m?.id} onPick={() => setActive(x.id)} />)}
        <NewManuscript />
      </div>

      {m && <Workbench key={m.id} m={m} mins={mins} />}
    </div>
  );
}

/* ---------------- a manuscript as a book on the desk ---------------- */

function BookCard({ m, on, onPick }: { m: Manuscript; on: boolean; onPick: () => void }) {
  const w = totalWords(m);
  const p = progress(m);
  const C = 2 * Math.PI * 34;
  return (
    <button className={on ? 'ms-book on tilt' : 'ms-book tilt'} onClick={onPick} aria-pressed={on} {...tilt(6)}>
      <svg viewBox="0 0 80 80" className="ms-ring" aria-hidden>
        <circle cx="40" cy="40" r="34" className="ms-ring-t" />
        <circle cx="40" cy="40" r="34" className="ms-ring-a" strokeDasharray={`${C * p} ${C}`} transform="rotate(-90 40 40)" />
        <text x="40" y="44" textAnchor="middle">{Math.round(p * 100)}%</text>
      </svg>
      <span className="ms-book-b">
        <span className="ms-book-t">{m.title}</span>
        <span className="ms-book-m mono">{fmtWords(w)} / {fmtWords(m.target)} words · {m.chapters.length} chapters</span>
      </span>
    </button>
  );
}

function NewManuscript() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState('');
  if (!open) return <button className="ms-book ms-new" onClick={() => setOpen(true)}><span className="ms-plus">+</span><span>A new manuscript</span></button>;
  return (
    <form className="ms-book ms-new on" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { useManuscripts.getState().addManuscript(t); setOpen(false); setT(''); } }}>
      <label className="field grow"><span>Title</span><input value={t} onChange={(e) => setT(e.target.value)} autoFocus placeholder="A short story" /></label>
      <span className="reward-confirm">
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary sm" disabled={!t.trim()}>Start it</button>
      </span>
    </form>
  );
}

/* ---------------- the workbench for one manuscript ---------------- */

function Workbench({ m, mins }: { m: Manuscript; mins: Record<string, number> }) {
  const s = useManuscripts.getState();
  const total = totalWords(m);
  const today = todayISO();
  const week = wordsSince(m.history, mondayOf(today), total);
  const spark = dailyTotals(m.history, today, 30);
  const sparkMax = Math.max(1, ...spark);
  const cols = byStatus(m.chapters);
  const [edit, setEdit] = useState<Chapter | 'new' | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<ChapterStatus | null>(null);
  const [sure, setSure] = useState(false);
  const left = Math.max(0, m.target - total);

  const drop = (status: ChapterStatus, beforeId?: string) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || drag;
    if (id) s.move(m.id, id, status, beforeId);
    setDrag(null);
    setOver(null);
  };

  return (
    <>
      <section className="ms-head rise" style={rise(2)}>
        <div className="ms-head-l">
          <input className="ms-name" value={m.title} onChange={(e) => s.updateManuscript(m.id, { title: e.target.value })} aria-label="Manuscript title" />
          <input className="ms-logline" value={m.logline ?? ''} onChange={(e) => s.updateManuscript(m.id, { logline: e.target.value })}
            placeholder="One line: who wants what, and what stands in the way…" aria-label="Logline" />
          <div className="ms-count">
            <span className="big"><CountUp value={total} /></span>
            <span className="mono">words</span>
            <span className={week && week > 0 ? 'ms-week up mono' : 'ms-week mono'}>
              {week === null ? 'weekly count starts next week' : week > 0 ? `+${fmtWords(week)} this week` : week < 0 ? `${fmtWords(week)} this week (cut)` : 'no new words yet this week'}
            </span>
          </div>
          <div className="ms-progress" aria-label={`${Math.round(progress(m) * 100)}% of ${fmtWords(m.target)} words`}>
            <div className="ms-strip">
              {m.chapters.filter((c) => c.words > 0).map((c) => (
                <span key={c.id} title={`${chapterNo(m.chapters, c.id)}. ${c.title} · ${fmtWords(c.words)}`}
                  style={{ width: `${(c.words / Math.max(m.target, total)) * 100}%`, background: STATUS_COLOR[c.status] }} />
              ))}
            </div>
            <div className="ms-progress-l mono">
              <span>{fmtWords(left)} to go</span>
              <label>target <input inputMode="numeric" value={m.target} onChange={(e) => s.updateManuscript(m.id, { target: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Target words" /></label>
              <span>~{readTime(total)} to read</span>
            </div>
          </div>
        </div>
        <div className="ms-head-r">
          <svg viewBox="0 0 300 80" className="ms-spark" role="img" aria-label="Word count over the last 30 days">
            <defs><linearGradient id="msfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--lamp)" stopOpacity=".35" /><stop offset="1" stopColor="var(--lamp)" stopOpacity="0" /></linearGradient></defs>
            <path d={`M0 80 ${spark.map((v, i) => `L${(i / 29) * 300} ${78 - (v / sparkMax) * 70}`).join(' ')} L300 80 Z`} fill="url(#msfill)" />
            <path d={spark.map((v, i) => `${i ? 'L' : 'M'}${(i / 29) * 300} ${78 - (v / sparkMax) * 70}`).join(' ')} className="ms-spark-l" />
          </svg>
          <span className="mono faint" style={{ fontSize: 10.5 }}>words · last 30 days</span>
          <div className="ms-head-actions">
            <button className="qlamp" onClick={() => go('/cabin/timer')}><span aria-hidden>◉</span> Lamp mode</button>
            <button className="btn primary" onClick={() => setEdit('new')}>+ Chapter</button>
          </div>
        </div>
      </section>

      <section className="board rise" style={rise(3)}>
        {STATUSES.map((st) => (
          <div key={st} className={`col${over === st ? ' over' : ''}`} style={{ '--sc': STATUS_COLOR[st] } as CSSProperties}
            onDragOver={(e) => { e.preventDefault(); setOver(st); }} onDragLeave={() => setOver(null)} onDrop={drop(st)}>
            <header><span className="col-dot" />{STATUS_NAME[st]}<span className="mono faint">{cols[st].length}</span></header>
            {cols[st].map((c) => (
              <article key={c.id} className={drag === c.id ? 'card dragging' : 'card'} draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDrag(c.id); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); drop(st, c.id)(e); }}>
                <button className="card-open" onClick={() => setEdit(c)}>
                  <span className="card-no mono">Ch. {chapterNo(m.chapters, c.id)}</span>
                  <span className="card-t">{c.title}</span>
                  {c.pov && <span className="card-pov mono">POV · {c.pov}</span>}
                  <span className="card-m mono">
                    <span>{fmtWords(c.words)} words</span>
                    {mins[`${m.id}/${c.id}`] ? <span>◉ {fmtMins(mins[`${m.id}/${c.id}`])}</span> : null}
                  </span>
                </button>
                <span className="card-move">
                  <button aria-label="Move back a column" disabled={st === 'idea'} onClick={() => s.move(m.id, c.id, STATUSES[STATUSES.indexOf(st) - 1])}>‹</button>
                  <button aria-label="Move forward a column" disabled={st === 'done'} onClick={() => s.move(m.id, c.id, STATUSES[STATUSES.indexOf(st) + 1])}>›</button>
                </span>
              </article>
            ))}
            {cols[st].length === 0 && <p className="col-empty">{st === 'idea' ? 'Chapters you haven’t started.' : 'Drag a chapter here.'}</p>}
          </div>
        ))}
      </section>

      <div className="ms-foot">
        {sure
          ? <span className="reward-confirm"><button className="btn ghost sm" onClick={() => setSure(false)}>Keep it</button><button className="btn danger sm" onClick={() => s.removeManuscript(m.id)}>Delete {m.title} and its chapters</button></span>
          : <button className="btn ghost sm" onClick={() => setSure(true)}>Delete this manuscript…</button>}
      </div>

      {edit && <ChapterSheet m={m} chapter={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

/* ---------------- one chapter ---------------- */

function ChapterSheet({ m, chapter, onClose }: { m: Manuscript; chapter: Chapter | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [c, setC] = useState<Omit<Chapter, 'id'> & { id?: string }>(chapter ?? { title: '', words: 0, status: 'draft' });
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  const save = () => {
    const finished = c.status === 'done' && chapter?.status !== 'done';
    useManuscripts.getState().saveChapter(m.id, c);
    if (finished) embers(ref.current, 24);
    setTimeout(close, finished ? 450 : 0);
  };
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="ch-title">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{m.title} · {chapter ? `Chapter ${chapterNo(m.chapters, chapter.id)}` : 'New chapter'}</div>
      <div className="book-fields" style={{ marginTop: 10 }}>
        <label className="field"><span>Chapter title</span><input id="ch-title" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} autoFocus={!chapter} placeholder="The night of the party" /></label>
        <div className="field-row two">
          <label className="field"><span>Words</span><input inputMode="numeric" value={c.words || ''} placeholder="0" onChange={(e) => setC({ ...c, words: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
          <label className="field"><span>Point of view</span><input value={c.pov ?? ''} onChange={(e) => setC({ ...c, pov: e.target.value || undefined })} placeholder="Whose eyes?" /></label>
        </div>
        <div className="seg wide" role="radiogroup" aria-label="Status">
          {STATUSES.map((st) => <button key={st} role="radio" aria-checked={c.status === st} onClick={() => setC({ ...c, status: st })}>{STATUS_NAME[st]}</button>)}
        </div>
        <label className="field"><span>Notes</span><textarea className="ruled" rows={4} value={c.note ?? ''} onChange={(e) => setC({ ...c, note: e.target.value || undefined })} placeholder="What happens, what it has to do, what's still wrong…" /></label>
      </div>
      <div className="sheet-actions">
        {chapter && (sure
          ? <button className="btn danger" onClick={() => { useManuscripts.getState().removeChapter(m.id, chapter.id); close(); }}>Delete this chapter</button>
          : <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Delete…</button>)}
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save}>{chapter ? 'Save' : 'Add chapter'}</button>
      </div>
    </dialog>
  );
}
