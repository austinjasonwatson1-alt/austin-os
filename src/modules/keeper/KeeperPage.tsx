import { useEffect, useState } from 'react';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { useDrafts } from '../drafts/store';
import { useManuscripts } from '../manuscripts/store';
import type { Ask } from './logic';
import { useKeeper } from './store';
import '../../styles/cabin.css';
import '../../styles/keeper.css';

interface Turn { who: 'you' | 'keeper'; text: string }

const PRESETS: { kind: Ask; label: string; you: string }[] = [
  { kind: 'morning', label: 'Today’s note', you: 'Where do I stand today?' },
  { kind: 'week', label: 'Look at my weeks', you: 'What patterns do you see in my weeks?' },
  { kind: 'craft', label: 'Craft help on a chapter', you: '' },
  { kind: 'query', label: 'Critique my query letter', you: 'Here’s my query letter.' },
];

/** The Keeper: ask the mentor who has read the whole homestead. */
export default function KeeperPage() {
  const k = useKeeper();
  const mss = useManuscripts();
  const drafts = useDrafts();
  useEffect(() => { void k.load(); void mss.load(); void drafts.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Ask>('free');
  const [chapter, setChapter] = useState('');
  const [letter, setLetter] = useState('');

  const run = async (kind: Ask, you: string, extra: Parameters<typeof k.ask>[1] = {}) => {
    setTurns((t) => [...t, { who: 'you', text: you }]);
    setBusy(true);
    try {
      const text = await k.ask(kind, extra);
      setTurns((t) => [...t, { who: 'keeper', text }]);
    } catch (e) {
      setTurns((t) => [...t, { who: 'keeper', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
    }
  };
  const chapters = mss.manuscripts.flatMap((m) => m.chapters.map((c, i) => ({ key: `${m.id}/${c.id}`, label: `${m.title} · ${i + 1}. ${c.title}`, title: c.title })));

  if (!k.loaded) return null;
  return (
    <div className="home keeper">
      <section className="keeper-hero rise" style={rise(0)}>
        <div className="keeper-lantern" aria-hidden><i /></div>
        <div>
          <div className="page-eyebrow">The Keeper</div>
          <h1 className="hero-title">The <em>Keeper.</em></h1>
          <p className="hero-line">A mentor who lives in the cabin and has read your whole ledger: your days, your chapters, your weeks, your shelf. Ask anything about the work.</p>
        </div>
      </section>

      {!k.enabled ? (
        <section className="panel keeper-off rise" style={rise(1)}>
          <p>The Keeper is resting. It needs an Anthropic API key to speak, and you decide what it’s allowed to read.</p>
          <button className="btn primary" onClick={() => go('/settings')}>Set it up in Settings</button>
        </section>
      ) : (
        <>
          <div className="keeper-presets rise" style={rise(1)}>
            {PRESETS.map((p) => (
              <button key={p.kind} className={mode === p.kind ? 'kp on' : 'kp'} disabled={busy}
                onClick={() => (p.kind === 'craft' || p.kind === 'query' ? setMode(p.kind) : void run(p.kind, p.you))}>{p.label}</button>
            ))}
          </div>

          {mode === 'craft' && (
            <div className="panel keeper-form">
              <label className="field"><span>Which chapter?</span>
                <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
                  <option value="">Choose a chapter</option>
                  {chapters.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <p className="mono faint" style={{ fontSize: 11 }}>{k.allow.chapterText ? 'The chapter’s text will be sent with the question.' : 'Only the chapter’s title, status and word count are shared (allow chapter text in Settings for line-level help).'}</p>
              <button className="btn primary sm" disabled={!chapter || busy} onClick={() => {
                const c = chapters.find((x) => x.key === chapter)!;
                setMode('free');
                void run('craft', `Help me with “${c.title}”.`, { chapterTitle: c.title, chapterText: drafts.drafts[chapter]?.text });
              }}>Ask</button>
            </div>
          )}
          {mode === 'query' && (
            <div className="panel keeper-form">
              <label className="field"><span>Your query letter</span><textarea className="ruled" rows={10} value={letter} onChange={(e) => setLetter(e.target.value)} /></label>
              <button className="btn primary sm" disabled={!letter.trim() || busy} onClick={() => { setMode('free'); void run('query', 'Here’s my query letter. Be honest.', { query: letter }); }}>Critique it</button>
            </div>
          )}

          <section className="convo">
            {turns.length === 0 && <p className="dim" style={{ textAlign: 'center' }}>Pick one above, or ask in your own words below.</p>}
            {turns.map((t, i) => <div key={i} className={`turn ${t.who}`}><span className="mono">{t.who === 'you' ? 'You' : 'The Keeper'}</span><p>{t.text}</p></div>)}
            {busy && <div className="turn keeper thinking"><span className="mono">The Keeper</span><p><i /><i /><i /></p></div>}
          </section>

          <form className="keeper-ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { const v = q; setQ(''); void run('free', v, { question: v }); } }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the Keeper…" aria-label="Ask the Keeper" disabled={busy} />
            <button className="btn primary" disabled={!q.trim() || busy}>Ask</button>
          </form>
          <p className="mono faint keeper-foot">Reads: {Object.entries(k.allow).filter(([, v]) => v).map(([n]) => n).join(', ') || 'nothing'} · change in Settings</p>
        </>
      )}
    </div>
  );
}
