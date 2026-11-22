import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { todayISO } from '../../core/dates';
import { embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { useKeeper } from '../keeper/store';
import { useManuscripts } from '../manuscripts/store';
import { allTags, daysSince, filterIdeas, KINDS, kindCounts, parseCapture, revisit, STAGES, type Idea, type IdeaKind, type IdeaStage } from './logic';
import { useIdeas } from './store';
import '../../styles/cabin.css';
import '../../styles/shelf.css';
import '../../styles/ideas.css';

const kindOf = (k: IdeaKind) => KINDS.find((x) => x.k === k)!;
const lean = (id: string) => (([...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 7) - 3) * 0.45;

/** The Idea Vault: a card catalog for every book, story and scene idea. */
export default function IdeasPage() {
  const v = useIdeas();
  useEffect(() => { void v.load(); void useManuscripts.getState().load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [kind, setKind] = useState<IdeaKind | null>(null);
  const [stage, setStage] = useState<IdeaStage | 'open' | null>('open');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<Idea | null>(null);
  const [capKind, setCapKind] = useState<IdeaKind>('novel');
  const [cap, setCap] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const capRef = useRef<HTMLInputElement>(null);
  const today = todayISO();
  const shown = useMemo(() => filterIdeas(v.ideas, { q, kind, stage, tag }), [v.ideas, q, kind, stage, tag]);
  const counts = useMemo(() => kindCounts(v.ideas), [v.ideas]);
  const tags = useMemo(() => allTags(v.ideas).slice(0, 14), [v.ideas]);
  const again = useMemo(() => (v.ideas.length >= 3 ? revisit(v.ideas, today, seed) : null), [v.ideas, today, seed]);
  const preview = cap.trim() ? parseCapture(cap, capKind) : null;

  const capture = () => {
    if (!preview || !preview.spark) return;
    const i = v.add(preview);
    setCap(''); setFresh(i.id);
    embers(capRef.current, 14);
    setTimeout(() => setFresh(null), 1600);
  };

  if (!v.loaded) return null;
  return (
    <div className="home ideas">
      <section className="hero ideas-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">Writer's Cabin · The Idea Vault</div>
          <h1 className="hero-title">The Idea<br /><em>Vault.</em></h1>
          <p className="hero-line">Every what-if, caught before it’s gone: the next novel, the short story for a contest, a scene, a name, a title. Write it down; it keeps.</p>
        </div>
        <div className="ideas-tally">
          <b>{v.ideas.length}</b><span className="mono">ideas kept</span>
          <span className="mono faint">{counts.novel} novel · {counts.short + counts.flash} short · {v.ideas.filter((i) => i.stage === 'written').length} written</span>
        </div>
      </section>

      <form className="capture rise" style={rise(1)} onSubmit={(e) => { e.preventDefault(); capture(); }}>
        <div className="cap-kinds" role="radiogroup" aria-label="What kind of idea">
          {KINDS.slice(0, 6).map((k) => (
            <button key={k.k} type="button" role="radio" aria-checked={capKind === k.k} className={capKind === k.k ? 'ck on' : 'ck'} style={{ '--c': k.color } as CSSProperties} onClick={() => { setCapKind(k.k); capRef.current?.focus(); }}>
              <span aria-hidden>{k.glyph}</span> {k.label}
            </button>
          ))}
        </div>
        <div className="cap-row">
          <input ref={capRef} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="What if… (a title — then the idea, #tags at the end)" aria-label="Capture an idea" autoFocus />
          <button className="btn primary" disabled={!preview?.spark}>Keep it</button>
        </div>
        {preview?.spark && (
          <p className="cap-preview mono">
            <span style={{ color: kindOf(preview.kind).color }}>{kindOf(preview.kind).label}</span>
            {preview.title && <> · “{preview.title}”</>}
            {preview.tags.length > 0 && <> · {preview.tags.map((t) => `#${t}`).join(' ')}</>}
          </p>
        )}
      </form>

      {again && (
        <div className="revisit rise" style={rise(2)}>
          <span className="mono">From the back of the drawer · {daysSince(again.updated, today)} days untouched</span>
          <button className="rv-card" onClick={() => setOpen(again)} style={{ '--c': kindOf(again.kind).color } as CSSProperties}>
            {again.title && <b>{again.title}</b>}<span>{again.spark}</span>
          </button>
          <button className="linkish" onClick={() => setSeed(seed + 1)}>Pull another card</button>
        </div>
      )}

      <section className="catalog rise" style={rise(3)}>
        <div className="drawers" role="tablist" aria-label="Drawers">
          <button role="tab" aria-selected={kind === null} className={kind === null ? 'drawer on' : 'drawer'} onClick={() => setKind(null)}><span className="dr-pull" aria-hidden /><b>All</b><span className="mono">{v.ideas.filter((i) => i.stage !== 'shelved').length}</span></button>
          {KINDS.map((k) => (
            <button key={k.k} role="tab" aria-selected={kind === k.k} className={kind === k.k ? 'drawer on' : 'drawer'} style={{ '--c': k.color } as CSSProperties} onClick={() => setKind(kind === k.k ? null : k.k)}>
              <span className="dr-pull" aria-hidden /><b>{k.plural}</b><span className="mono">{counts[k.k]}</span>
            </button>
          ))}
        </div>

        <div className="cat-tools">
          <label className="shelf-search"><span aria-hidden>⌕</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the vault…" aria-label="Search ideas" /></label>
          <div className="seg" role="radiogroup" aria-label="Stage">
            {([['open', 'Open'], ...STAGES.map((s) => [s.k, s.label]), [null, 'Everything']] as [IdeaStage | 'open' | null, string][]).map(([k, l]) => (
              <button key={String(k)} role="radio" aria-checked={stage === k} onClick={() => setStage(k)}>{l}</button>
            ))}
          </div>
        </div>
        {tags.length > 0 && (
          <div className="genre-chips">
            {tags.map((t) => <button key={t.tag} className={tag === t.tag ? 'gchip on' : 'gchip'} onClick={() => setTag(tag === t.tag ? null : t.tag)}>#{t.tag}</button>)}
          </div>
        )}

        {v.ideas.length === 0 ? (
          <div className="vault-empty"><p>The vault is empty, and waiting.</p><span className="mono">Type the first idea above and press Enter. “short: The Lighthouse Wife — she keeps the light after he drowns #grief”</span></div>
        ) : shown.length === 0 ? <p className="dim" style={{ textAlign: 'center', padding: 30 }}>Nothing in this drawer.</p> : (
          <div className="cards">
            {shown.map((i) => {
              const k = kindOf(i.kind);
              return (
                <button key={i.id} className={`icard st-${i.stage}${fresh === i.id ? ' fresh' : ''}`} style={{ '--c': k.color, '--lean': `${lean(i.id)}deg` } as CSSProperties} onClick={() => setOpen(i)} {...tilt(5)}>
                  <span className="ic-tab mono" aria-hidden>{k.glyph} {k.label}</span>
                  <span className="ic-heat" aria-label={`Heat ${i.heat} of 3`}>{'●'.repeat(i.heat)}<i>{'●'.repeat(3 - i.heat)}</i></span>
                  {i.title && <b className="ic-title">{i.title}</b>}
                  <span className="ic-spark">{i.spark}</span>
                  <span className="ic-foot mono">{STAGES.find((s) => s.k === i.stage)!.label}{i.tags.length ? ` · ${i.tags.map((t) => `#${t}`).join(' ')}` : ''}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {open && <IdeaSheet idea={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------------- one idea, opened up ---------------- */

function IdeaSheet({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState<Idea>(idea);
  const [tagLine, setTagLine] = useState(idea.tags.map((t) => `#${t}`).join(' '));
  const [sure, setSure] = useState(false);
  const keeper = useKeeper();
  const [help, setHelp] = useState<{ busy: boolean; text: string } | null>(null);
  useEffect(() => { ref.current?.showModal(); void keeper.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { ref.current?.close(); onClose(); };
  const set = <K extends keyof Idea>(k: K, val: Idea[K]) => setI((x) => ({ ...x, [k]: val }));
  const tags = () => [...new Set(tagLine.split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean))];
  const save = () => { useIdeas.getState().save({ ...i, tags: tags() }); close(); };
  const k = kindOf(i.kind);
  const develop = async () => {
    setHelp({ busy: true, text: '' });
    try {
      const text = await keeper.ask('free', { question: `Help me develop this ${k.label.toLowerCase()} idea${i.title ? ` called "${i.title}"` : ''}: ${i.spark}${i.notes ? `\n\nMy notes so far: ${i.notes}` : ''}\n\nGive me: the strongest version of the premise in one sentence; what's at stake and for whom; two possible twists or turns that would suit a domestic thriller reader; and two or three comp titles it would sit beside. Be specific and brief.` });
      setHelp({ busy: false, text });
    } catch (e) { setHelp({ busy: false, text: e instanceof Error ? e.message : String(e) }); }
  };
  return (
    <dialog ref={ref} className="sheet idea-sheet" onClose={onClose} aria-labelledby="idea-t" style={{ '--c': k.color } as CSSProperties}>
      <div className="is-card">
        <div className="page-eyebrow" style={{ fontSize: 10.5, color: k.color }}>{k.glyph} {k.label} · kept {new Date(i.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <input id="idea-t" className="is-title" value={i.title} onChange={(e) => set('title', e.target.value)} placeholder="A working title" aria-label="Working title" />
        <textarea className="is-spark" rows={2} value={i.spark} onChange={(e) => set('spark', e.target.value)} aria-label="The idea in a line" />
      </div>
      <div className="seg wide" role="radiogroup" aria-label="Kind">
        {KINDS.map((x) => <button key={x.k} role="radio" aria-checked={i.kind === x.k} onClick={() => set('kind', x.k)}>{x.label}</button>)}
      </div>
      <div className="is-row">
        <div className="seg" role="radiogroup" aria-label="Stage">
          {STAGES.map((s) => <button key={s.k} role="radio" aria-checked={i.stage === s.k} onClick={() => set('stage', s.k)}>{s.label}</button>)}
        </div>
        <div className="is-heat" role="radiogroup" aria-label="How alive it feels">
          <span className="mono">heat</span>
          {([1, 2, 3] as const).map((n) => <button key={n} role="radio" aria-checked={i.heat === n} className={i.heat >= n ? 'on' : ''} onClick={() => set('heat', n)} aria-label={`${n} of 3`}>●</button>)}
        </div>
      </div>
      <label className="field"><span>Notes</span><textarea className="ruled" rows={6} value={i.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} placeholder="Characters, the twist, the ending you can see, the first line…" /></label>
      <div className="field-row two">
        <label className="field"><span>Comps</span><input value={i.comps ?? ''} onChange={(e) => set('comps', e.target.value || undefined)} placeholder="Gone Girl meets Big Little Lies" /></label>
        <label className="field"><span>Tags</span><input value={tagLine} onChange={(e) => setTagLine(e.target.value)} placeholder="#marriage #secrets" /></label>
      </div>
      {help && <div className="is-help"><span className="mono">The Keeper</span>{help.busy ? <p className="dim">Turning it over…</p> : <p>{help.text}</p>}</div>}
      <div className="sheet-actions">
        {sure ? <button className="btn danger" onClick={() => { useIdeas.getState().remove(i.id); close(); }}>Throw it out</button>
          : <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Remove…</button>}
        {keeper.enabled && !help && <button className="btn ghost" onClick={() => void develop()}>Develop it with the Keeper</button>}
        {i.kind === 'novel' && !i.ms && <button className="btn" onClick={() => { useIdeas.getState().save({ ...i, tags: tags() }); useIdeas.getState().startManuscript(i.id); close(); go('/cabin/manuscripts'); }}>Start it as a manuscript</button>}
        {(i.kind === 'short' || i.kind === 'flash') && <button className="btn ghost" onClick={() => { save(); go('/cabin/contests'); }}>Find it a contest</button>}
        {i.ms && <button className="btn ghost" onClick={() => { close(); go('/cabin/manuscripts'); }}>Open the manuscript</button>}
        <button className="btn primary" onClick={save} disabled={!i.spark.trim()}>Save</button>
      </div>
    </dialog>
  );
}
