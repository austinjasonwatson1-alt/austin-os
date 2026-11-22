import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { addDays, mondayOf, todayISO } from '../../core/dates';
import { embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { useFeeds } from '../feeds/store';
import { kennelWalkMinutes } from '../kennel/logic';
import { useKennel } from '../kennel/store';
import { fmtMins } from '../ledger/logic';
import { groupProjects, KINDS, parseProjectList, previewProjects, STAGE_LABEL, type Stage } from './projects';
import { areaMinutes } from './logic';
import { AREA_STORES } from './store';
import type { AreaItem } from './types';

const KIND_GLYPH: Record<string, string> = { Game: '♟', 'Writing tool': '✒', 'Job search': '✉', Work: '▣', Life: '⌂', Agent: '✦', Other: '◇' };

/** The Observatory's hero side: what's on the board. */
export function ProjectsTally() {
  const items = AREA_STORES.observatory((s) => s.items).filter((i) => i.list === 'projects');
  const n = (st: Stage) => items.filter((i) => (i.stage ?? 'shipped') === st).length;
  return (
    <div className="area-today pj-tally">
      <span className="big">{items.length || '—'}</span>
      <span className="mono">projects built</span>
      <span className="mono faint">{n('shipped')} shipped · {n('building')} in the works · {n('idea')} ideas</span>
    </div>
  );
}

/** Every project: a gallery by kind, a quick "worked on it today", and a paste-in import. */
export function ProjectsGallery() {
  const a = AREA_STORES.observatory();
  const items = a.items.filter((i) => i.list === 'projects');
  const groups = groupProjects(items);
  const [open, setOpen] = useState<AreaItem | 'new' | null>(null);
  const [paste, setPaste] = useState(false);
  const today = todayISO();
  const workedToday = (a.days[today]?.build ?? 0) > 0;
  return (
    <section className="pj rise" style={rise(2)}>
      <div className="pj-head">
        <h2 className="section-h">The workbench</h2>
        <div className="pj-actions">
          <button className={workedToday ? 'btn sm pj-today on' : 'btn sm pj-today'} aria-pressed={workedToday}
            onClick={(e) => { if (!workedToday) embers(e.currentTarget, 10); a.setMinutes(today, 'build', workedToday ? 0 : 1); }}>
            {workedToday ? '✓ Worked on a project today' : 'I worked on a project today'}
          </button>
          <button className="btn sm" onClick={() => setPaste(true)}>Paste a list</button>
          <button className="btn primary sm" onClick={() => setOpen('new')}>+ A project</button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="pj-empty"><p>The workbench is clear.</p><span className="mono">Add what you’ve built one at a time, or paste a whole list: one per line, “Name | link | kind | stage”.</span></div>
      ) : groups.map((g) => (
        <div key={g.kind} className="pj-group">
          <h3><span aria-hidden>{KIND_GLYPH[g.kind] ?? '◇'}</span>{g.kind}<span className="mono faint">{g.items.length}</span></h3>
          <div className="pj-grid">
            {g.items.map((p) => (
              <article key={p.id} className={`pj-card st-${p.stage ?? 'shipped'}`} {...tilt(4)}>
                <button className="pj-main" onClick={() => setOpen(p)}>
                  <span className="pj-stage mono">{STAGE_LABEL[p.stage ?? 'shipped']}</span>
                  <b>{p.text}</b>
                  {p.body && <span className="pj-body">{p.body}</span>}
                </button>
                {p.link && <a className="pj-open" href={p.link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.text}`}>Open ↗</a>}
              </article>
            ))}
          </div>
        </div>
      ))}
      {open && <ProjectSheet item={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
      {paste && <PasteSheet existing={items} onClose={() => setPaste(false)} />}
    </section>
  );
}

function ProjectSheet({ item, onClose }: { item: AreaItem | null; onClose: () => void }) {
  const a = AREA_STORES.observatory();
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState({ text: item?.text ?? '', link: item?.link ?? '', body: item?.body ?? '', kind: item?.kind ?? 'Other', stage: (item?.stage ?? 'building') as Stage });
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  const save = () => {
    const extra = { link: v.link.trim() || undefined, body: v.body.trim() || undefined, kind: v.kind, stage: v.stage };
    if (item) a.patchItem(item.id, { text: v.text.trim(), ...extra }); else a.addItem('projects', v.text.trim(), extra);
    close();
  };
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="pj-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>The Observatory</div>
      <h2 id="pj-t" className="sheet-title">{item ? item.text : 'A project'}</h2>
      <label className="field"><span>Name</span><input value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} autoFocus={!item} placeholder="Road to the NFL" /></label>
      <label className="field"><span>What it is</span><input value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="A kicker career game, built with Claude" /></label>
      <label className="field"><span>Link</span><input value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} placeholder="https://" inputMode="url" /></label>
      <div className="seg wide" role="radiogroup" aria-label="Stage">{(['idea', 'building', 'shipped'] as Stage[]).map((s) => <button key={s} role="radio" aria-checked={v.stage === s} onClick={() => setV({ ...v, stage: s })}>{STAGE_LABEL[s]}</button>)}</div>
      <div className="pj-kinds" role="radiogroup" aria-label="Kind">{KINDS.map((k) => <button key={k} role="radio" aria-checked={v.kind === k} className={v.kind === k ? 'gchip on' : 'gchip'} onClick={() => setV({ ...v, kind: k })}>{KIND_GLYPH[k]} {k}</button>)}</div>
      <div className="sheet-actions">
        {item && (sure ? <button className="btn danger" onClick={() => { a.removeItem(item.id); close(); }}>Remove it</button> : <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Remove…</button>)}
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!v.text.trim()} onClick={save}>Save</button>
      </div>
    </dialog>
  );
}

function PasteSheet({ existing, onClose }: { existing: AreaItem[]; onClose: () => void }) {
  const a = AREA_STORES.observatory();
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  const plan = previewProjects(existing, parseProjectList(text));
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="pp-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>The Observatory · import</div>
      <h2 id="pp-t" className="sheet-title">{done === null ? 'Paste your projects' : 'On the workbench.'}</h2>
      {done === null ? (
        <>
          <p className="dim" style={{ fontSize: 13.5, margin: 0 }}>One per line: <span className="mono">Name | link | kind | stage | what it is</span>. Only the name is needed. Kinds: {KINDS.join(', ')}. Stages: idea, building, shipped.</p>
          <textarea className="ruled" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Road to the NFL | https://… | Game | shipped | A kicker career game'} aria-label="Projects, one per line" />
          {text.trim() && <p className="mono" style={{ fontSize: 11.5 }}><b className="g-good">{plan.add.length} new</b>{plan.skip ? ` · ${plan.skip} already here or repeated (left as they are)` : ''}. Nothing on the workbench changes or goes away.</p>}
          {plan.add.length > 0 && <ul className="imp-list">{plan.add.slice(0, 60).map((p, i) => <li key={i}><span>{p.text}</span><span className="mono faint">{p.kind} · {STAGE_LABEL[p.stage]}{p.link ? ' · link' : ''}</span></li>)}</ul>}
        </>
      ) : <p className="dim">Added {done} project{done === 1 ? '' : 's'}.</p>}
      <div className="sheet-actions">
        {done === null ? (
          <>
            <button className="btn ghost" onClick={close}>Cancel</button>
            <button className="btn primary" disabled={!plan.add.length} onClick={() => { for (const p of plan.add) a.addItem('projects', p.text, { link: p.link, kind: p.kind, stage: p.stage, body: p.body }); setDone(plan.add.length); }}>Add {plan.add.length} project{plan.add.length === 1 ? '' : 's'}</button>
          </>
        ) : <button className="btn primary" onClick={close}>Done</button>}
      </div>
    </dialog>
  );
}

/** The Forge's hero side: the body this week, from Apple Health and the Kennel. */
export function BodyTally() {
  const forge = AREA_STORES.forge();
  const feeds = useFeeds();
  const kennel = useKennel();
  useEffect(() => { void feeds.load(); void kennel.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const week = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i)).filter((d) => d <= today);
  const workout = week.reduce((n, d) => n + areaMinutes(forge.days[d]), 0);
  const walks = week.reduce((n, d) => n + kennelWalkMinutes(kennel, d), 0);
  const steps = feeds.days[today]?.steps;
  return (
    <div className="area-today pj-tally" style={{ '--ac': '#E07A3F' } as CSSProperties}>
      <span className="big">{steps !== undefined ? steps.toLocaleString('en-US') : '—'}</span>
      <span className="mono">steps today</span>
      <span className="mono faint">{fmtMins(workout)} of workouts · {fmtMins(walks)} walking the dogs, this week</span>
    </div>
  );
}
