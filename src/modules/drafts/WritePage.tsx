import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { chime, setAmbient } from '../../core/ambient';
import { useSky } from '../../core/skyStore';
import { todayISO } from '../../core/dates';
import { embers } from '../../shell/fx';
import { usePub } from '../pub/store';
import type { Feedback } from '../pub/types';
import { go, useRoute } from '../../shell/router';
import { DogsAtFeet } from '../../shell/DogsAtFeet';
import { fmtMins } from '../ledger/logic';
import { useManuscripts } from '../manuscripts/store';
import { elapsedMs, fmtClock } from '../timer/logic';
import { useTimer } from '../timer/store';
import type { Ambient } from '../timer/types';
import { countWords, sprintVerdict } from './logic';
import { SPRINT_LENGTHS, type Sprint } from './types';
import { useDrafts } from './store';
import '../../styles/write.css';

/** 'off' means no sound of its own: the soundscape plays (if it's on), otherwise silence. */
const AMBIENT_LIST: { k: Ambient; label: string }[] = [
  { k: 'off', label: 'Silence' }, { k: 'calm', label: 'Calm' }, { k: 'rain', label: 'Rain' }, { k: 'fire', label: 'Fire' }, { k: 'wind', label: 'Wind' },
];
const ambients = (soundscape: boolean) => AMBIENT_LIST.map((a) => (a.k === 'off' && soundscape ? { ...a, label: 'Soundscape' } : a));

/**
 * Writing inside the cabin: the chapter on the page, everything else dark. The first keystroke
 * lights a lamp-mode session pointed at this chapter, so the minutes log themselves; the word count
 * on the board keeps up as you type, and versions are kept as you go.
 */
export default function WritePage() {
  const soundscapeOn = useSky((st) => Boolean(st.prefs.roomSound));
  const route = useRoute();
  const [, , , msId, chId] = route.split('/');
  const mss = useManuscripts();
  const drafts = useDrafts();
  const timer = useTimer();
  useEffect(() => { void mss.load(); void drafts.load(); void timer.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m = mss.manuscripts.find((x) => x.id === msId);
  const idx = m?.chapters.findIndex((c) => c.id === chId) ?? -1;
  const ch = m && idx >= 0 ? m.chapters[idx] : undefined;
  const key = `${msId}/${chId}`;
  const saved = drafts.drafts[key]?.text ?? '';
  const [text, setText] = useState<string | null>(null);
  const startWords = useRef<number | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showVersions, setShowVersions] = useState(false);
  const [saving, setSaving] = useState<'saved' | 'typing'>('saved');
  const [focus, setFocus] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  // A word sprint: when it started, how long, and the word count it started from.
  const [sprint, setSprint] = useState<{ start: number; planned: number; from: number } | null>(null);
  const [pickSprint, setPickSprint] = useState(false);
  const [result, setResult] = useState<{ s: Sprint; best: boolean; pace: number; prevBest: number } | null>(null);
  const pub = usePub();
  useEffect(() => { void pub.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the chapter's text once both stores are ready.
  useEffect(() => {
    if (drafts.loaded && text === null) {
      setText(saved);
      startWords.current = countWords(saved);
    }
  }, [drafts.loaded, saved, text]);

  // Keep a version when leaving the page, and save anything pending.
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (area.current) useDrafts.getState().setText(msId, chId, area.current.value);
    useDrafts.getState().keepVersion(msId, chId);
    setAmbient(null);
  }, [msId, chId]);

  const run = timer.running;
  const live = Boolean(run && run.pausedAt === null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!run && !sprint) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run, sprint]);
  useEffect(() => { setAmbient(live && timer.ambient !== 'off' ? timer.ambient : null); }, [live, timer.ambient]);

  const words = useMemo(() => countWords(text ?? ''), [text]);
  // Size the page to the text once it's loaded.
  useEffect(() => { const el = area.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }, [text === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = startWords.current === null ? 0 : words - startWords.current;

  // The sprint ends on its own when the time is up.
  const sprintLeft = sprint ? Math.max(0, sprint.planned * 60_000 - (now - sprint.start)) : 0;
  const sprintWords = sprint ? Math.max(0, words - sprint.from) : 0;
  const endSprint = (completed: boolean) => {
    if (!sprint) return;
    const minutes = completed ? sprint.planned : Math.floor((Date.now() - sprint.start) / 60_000);
    setSprint(null);
    if (minutes < 1) return;
    if (area.current) useDrafts.getState().setText(msId, chId, area.current.value);
    const before = useDrafts.getState().sprints ?? [];
    const sp = useDrafts.getState().addSprint({ at: new Date(sprint.start).toISOString(), day: todayISO(), ms: msId, ch: chId, planned: sprint.planned, minutes, words: sprintWords, completed });
    setResult({ s: sp, ...sprintVerdict(sp, before) });
    if (completed) chime();
  };
  useEffect(() => { if (sprint && sprintLeft === 0) endSprint(true); }, [sprintLeft]); // eslint-disable-line react-hooks/exhaustive-deps
  const startSprint = (planned: number) => {
    setPickSprint(false);
    setResult(null);
    setSprint({ start: Date.now(), planned, from: words });
    const t = useTimer.getState();
    if (!t.running) { t.setChapter({ ms: msId, id: chId }); t.start(ch?.status === 'revise' ? 'editing' : 'writing', t.lastGoal); }
    area.current?.focus();
  };
  const notes = pub.feedback.filter((f) => f.ms === msId && (f.chapter === chId || !f.chapter));
  const openNotes = notes.filter((f) => !f.resolved && f.chapter === chId).length;
  // A chapter in revision opens with its notes beside it.
  useEffect(() => { if (pub.loaded && ch?.status === 'revise' && openNotes > 0) setShowNotes(true); }, [pub.loaded, chId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mss.loaded || !drafts.loaded) return null;
  if (!m || !ch) {
    return (
      <div className="write missing">
        <p>That chapter isn't on the board any more.</p>
        <button className="btn primary" onClick={() => go('/cabin/manuscripts')}>Back to Manuscripts</button>
      </div>
    );
  }

  const onType = (v: string) => {
    setText(v);
    setSaving('typing');
    // The first keystroke lights the lamp: a session pointed at this chapter.
    const t = useTimer.getState();
    if (!t.running) {
      t.setChapter({ ms: msId, id: chId });
      t.start(ch.status === 'revise' ? 'editing' : 'writing', t.lastGoal);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { useDrafts.getState().setText(msId, chId, v); setSaving('saved'); }, 800);
    // Typewriter feel: writing at the end keeps the line you're on in the middle of the screen.
    const el = area.current;
    if (el && el.selectionStart === v.length) {
      const bottom = el.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({ top: Math.max(0, bottom - window.innerHeight * 0.55) });
    }
  };

  const stopAndLog = () => {
    const s = useTimer.getState().stop();
    if (s) setSaving('saved');
  };

  const prev = idx > 0 ? m.chapters[idx - 1] : null;
  const next = idx < m.chapters.length - 1 ? m.chapters[idx + 1] : null;

  return (
    <div className={`write${focus ? ' focus' : ''}`}>
      <header className="w-bar">
        <button className="w-back" onClick={() => go('/cabin/manuscripts')} aria-label="Back to Manuscripts">‹ {m.title}</button>
        <div className="w-stats mono">
          <span><b>{words.toLocaleString('en-US')}</b> words</span>
          {session !== 0 && <span className={session > 0 ? 'up' : ''}>{session > 0 ? '+' : ''}{session.toLocaleString('en-US')} this sitting</span>}
          <span className="faint">{saving === 'typing' ? 'saving…' : 'saved'}</span>
        </div>
        <div className="w-tools">
          {run ? (
            <>
              <span className={`w-clock mono${live ? ' live' : ''}`} title="Lamp mode">◉ {fmtClock(elapsedMs(run, now))}</span>
              {live ? <button className="btn ghost sm" onClick={timer.pause}>Pause</button> : <button className="btn ghost sm" onClick={timer.resume}>Resume</button>}
              <button className="btn primary sm" onClick={stopAndLog} disabled={elapsedMs(run, now) < 60_000}>Stop &amp; log {fmtMins(Math.floor(elapsedMs(run, now) / 60_000))}</button>
            </>
          ) : <span className="w-clock mono faint">the lamp lights when you type</span>}
          <select className="w-amb" value={timer.ambient} onChange={(e) => timer.setAmbient(e.target.value as Ambient)} aria-label="Ambient sound">
            {ambients(soundscapeOn).map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}
          </select>
          {sprint ? (
            <span className="w-sprint-live" style={{ '--sp': 1 - sprintLeft / (sprint.planned * 60_000) } as CSSProperties}>
              <i className="sp-ring" aria-hidden />
              <span className="mono"><b>+{sprintWords.toLocaleString('en-US')}</b> · {fmtClock(sprintLeft)}</span>
              <button className="btn ghost sm" onClick={() => endSprint(false)}>End</button>
            </span>
          ) : (
            <span className="w-sprint-wrap">
              <button className="btn sm w-sprint-btn" onClick={() => setPickSprint(!pickSprint)} aria-expanded={pickSprint}>⚡ Sprint</button>
              {pickSprint && (
                <span className="w-sprint-pick" role="menu">
                  {SPRINT_LENGTHS.map((n) => <button key={n} role="menuitem" className="btn ghost sm" onClick={() => startSprint(n)}>{n} min</button>)}
                </span>
              )}
            </span>
          )}
          <button className={openNotes ? 'btn sm w-notes-btn has' : 'btn ghost sm w-notes-btn'} onClick={() => { setShowNotes(!showNotes); setShowVersions(false); }} aria-expanded={showNotes}>
            Notes{openNotes ? <b>{openNotes}</b> : null}
          </button>
          <button className="btn ghost sm" onClick={() => setFocus(!focus)} aria-pressed={focus}>{focus ? 'Show more' : 'Focus'}</button>
          <button className="btn ghost sm" onClick={() => { setShowVersions(!showVersions); setShowNotes(false); }} aria-expanded={showVersions}>Versions</button>
        </div>
      </header>

      <main className="w-page" style={{ '--lamp-heat': Math.min(1, words / 3000) } as CSSProperties}>
        <div className="w-head">
          <span className="mono">Chapter {idx + 1}</span>
          <input className="w-title" value={ch.title} onChange={(e) => mss.saveChapter(msId, { ...ch, title: e.target.value })} aria-label="Chapter title" />
        </div>
        <textarea ref={area} className="w-text" value={text ?? ''} onChange={(e) => onType(e.target.value)} spellCheck
          placeholder="Begin. A blank line starts a new paragraph; a line with just # is a scene break; *asterisks* for italics."
          onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
          autoFocus />
        <nav className="w-nav">
          {prev ? <button className="btn ghost" onClick={() => go(`/cabin/write/${msId}/${prev.id}`)}>‹ {prev.title}</button> : <span />}
          {next ? <button className="btn ghost" onClick={() => go(`/cabin/write/${msId}/${next.id}`)}>{next.title} ›</button> : <span />}
        </nav>
      </main>

      {run && <DogsAtFeet minutes={Math.floor(elapsedMs(run, now) / 60_000)} />}
      {sprint && <div className="sprint-bar" aria-hidden><i style={{ width: `${(1 - sprintLeft / (sprint.planned * 60_000)) * 100}%` }} /></div>}
      {result && <SprintCard r={result} onClose={() => setResult(null)} onAgain={() => startSprint(result.s.planned)} />}
      {showNotes && <RevisionDesk notes={notes} chId={chId} chapterTitle={ch.title} onClose={() => setShowNotes(false)} />}
      {showVersions && <Versions ms={msId} ch={chId} onClose={() => setShowVersions(false)} onRestored={(t) => { setText(t); startWords.current = countWords(t); }} />}
    </div>
  );
}

function Versions({ ms, ch, onClose, onRestored }: { ms: string; ch: string; onClose: () => void; onRestored: (t: string) => void }) {
  const list = useDrafts((s) => s.versions[`${ms}/${ch}`]) ?? [];
  const [peek, setPeek] = useState<string | null>(null);
  const shown = list.find((v) => v.at === peek);
  return (
    <aside className="w-versions" aria-label="Versions">
      <div className="panel-h"><p className="panel-t">Versions</p><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      <p className="faint" style={{ fontSize: 12.5, margin: '0 0 10px' }}>Kept every ten minutes of writing and whenever you leave. Restoring keeps the current text as a version first.</p>
      {list.length === 0 && <p className="dim" style={{ fontSize: 13 }}>No versions yet.</p>}
      <ul>
        {list.map((v) => (
          <li key={v.at} className={peek === v.at ? 'on' : ''}>
            <button className="w-v" onClick={() => setPeek(peek === v.at ? null : v.at)}>
              <span>{new Date(v.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              <span className="mono faint">{v.words.toLocaleString('en-US')} words{v.label ? ` · ${v.label}` : ''}</span>
            </button>
            {peek === v.at && (
              <div className="w-peek">
                <p>{(shown?.text ?? '').slice(0, 600)}{(shown?.text.length ?? 0) > 600 ? '…' : ''}</p>
                <button className="btn primary sm" onClick={() => { useDrafts.getState().restoreVersion(ms, ch, v.at); onRestored(v.text); setPeek(null); }}>Restore this version</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* ---------------- the end of a sprint ---------------- */

function SprintCard({ r, onClose, onAgain }: { r: { s: Sprint; best: boolean; pace: number; prevBest: number }; onClose: () => void; onAgain: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (r.best) embers(ref.current?.querySelector('.sc-num') as HTMLElement, 30); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { s } = r;
  return (
    <div ref={ref} className={r.best ? 'sprint-card best' : 'sprint-card'} role="status">
      <span className="mono sc-eyebrow">{s.completed ? `${s.planned}-minute sprint` : `Sprint stopped at ${s.minutes} min`}</span>
      <p className="sc-num"><b>{s.words.toLocaleString('en-US')}</b> words</p>
      <p className="sc-line">{r.pace} words a minute{r.best ? (r.prevBest ? ` · a new best, past ${r.prevBest.toLocaleString('en-US')}` : ' · your first best') : r.prevBest ? ` · best is ${r.prevBest.toLocaleString('en-US')}` : ''}</p>
      {s.completed && <p className="mono faint sc-pts">+{r.best && r.prevBest ? 15 : 5} pts in the Lounge</p>}
      <div className="sc-actions">
        <button className="btn ghost sm" onClick={onClose}>Back to the page</button>
        <button className="btn primary sm" onClick={onAgain}>Another {s.planned}</button>
      </div>
    </div>
  );
}

/* ---------------- the revision desk ---------------- */

const KIND: Record<Feedback['kind'], string> = { beta: 'Beta reader', editor: 'Editor', critique: 'Critique partner', agent: 'Agent' };

/** The Vault's notes for this chapter (and the whole book), beside the text, to tick off while revising. */
function RevisionDesk({ notes, chId, chapterTitle, onClose }: { notes: Feedback[]; chId: string; chapterTitle: string; onClose: () => void }) {
  const [showDone, setShowDone] = useState(false);
  const mine = notes.filter((f) => f.chapter === chId);
  const book = notes.filter((f) => !f.chapter);
  const open = mine.filter((f) => !f.resolved);
  const done = mine.filter((f) => f.resolved);
  const tick = (f: Feedback, el: HTMLElement) => { if (!f.resolved) embers(el, 10); usePub.getState().put('feedback', { ...f, resolved: !f.resolved }); };
  const Note = ({ f }: { f: Feedback }) => (
    <li className={f.resolved ? 'rd-note done' : 'rd-note'}>
      <button className="rd-tick" role="checkbox" aria-checked={Boolean(f.resolved)} aria-label={f.resolved ? 'Mark as not addressed' : 'Mark as addressed'} onClick={(e) => tick(f, e.currentTarget)}>{f.resolved ? '✓' : ''}</button>
      <div>
        <span className="mono faint">{f.from} · {KIND[f.kind]}</span>
        <p>{f.text}</p>
      </div>
    </li>
  );
  return (
    <aside className="w-versions rev-desk" aria-label="Revision notes">
      <div className="panel-h"><p className="panel-t">The revision desk</p><button className="btn ghost sm" onClick={onClose}>Close</button></div>
      <p className="faint" style={{ fontSize: 12.5, margin: '0 0 12px' }}>Notes from the Editorial Vault on “{chapterTitle}”. Tick each one off as you handle it.</p>
      {mine.length === 0 && <p className="dim" style={{ fontSize: 13 }}>No notes on this chapter yet. Add them in the Editorial Vault and pin them to it.</p>}
      {mine.length > 0 && open.length === 0 && <p className="rd-clear">Every note on this chapter is handled. ✦</p>}
      <ul className="rd-list">{open.map((f) => <Note key={f.id} f={f} />)}</ul>
      {done.length > 0 && (
        <>
          <button className="linkish" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} {done.length} handled</button>
          {showDone && <ul className="rd-list">{done.map((f) => <Note key={f.id} f={f} />)}</ul>}
        </>
      )}
      {book.filter((f) => !f.resolved).length > 0 && (
        <>
          <p className="panel-t" style={{ margin: '18px 0 8px' }}>On the whole book</p>
          <ul className="rd-list">{book.filter((f) => !f.resolved).map((f) => <Note key={f.id} f={f} />)}</ul>
        </>
      )}
    </aside>
  );
}
