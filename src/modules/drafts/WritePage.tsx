import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { setAmbient } from '../../core/ambient';
import { go, useRoute } from '../../shell/router';
import { DogsAtFeet } from '../../shell/DogsAtFeet';
import { fmtMins } from '../ledger/logic';
import { useManuscripts } from '../manuscripts/store';
import { elapsedMs, fmtClock } from '../timer/logic';
import { useTimer } from '../timer/store';
import type { Ambient } from '../timer/types';
import { countWords } from './logic';
import { useDrafts } from './store';
import '../../styles/write.css';

const AMBIENTS: { k: Ambient; label: string }[] = [{ k: 'off', label: 'Silence' }, { k: 'rain', label: 'Rain' }, { k: 'fire', label: 'Fire' }, { k: 'wind', label: 'Wind' }];

/**
 * Writing inside the cabin: the chapter on the page, everything else dark. The first keystroke
 * lights a lamp-mode session pointed at this chapter, so the minutes log themselves; the word count
 * on the board keeps up as you type, and versions are kept as you go.
 */
export default function WritePage() {
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
    if (!run) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run]);
  useEffect(() => { setAmbient(live && timer.ambient !== 'off' ? timer.ambient : null); }, [live, timer.ambient]);

  const words = useMemo(() => countWords(text ?? ''), [text]);
  // Size the page to the text once it's loaded.
  useEffect(() => { const el = area.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }, [text === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = startWords.current === null ? 0 : words - startWords.current;

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
            {AMBIENTS.map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}
          </select>
          <button className="btn ghost sm" onClick={() => setFocus(!focus)} aria-pressed={focus}>{focus ? 'Show more' : 'Focus'}</button>
          <button className="btn ghost sm" onClick={() => setShowVersions(!showVersions)} aria-expanded={showVersions}>Versions</button>
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
