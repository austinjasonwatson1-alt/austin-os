import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { parseISO, todayISO } from '../../core/dates';
import { saveWithSnapshot, snapshotNow } from '../../core/storage';
import { embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import {
  APPS_LIST, STAGES, STAGE_LABEL, appKey, appText, applyApplications, itemKey, parseApplications, pipeline,
  previewApplications, splitAppText, statusOf, type AppStatus, type AppsPlan, type MovedApp, type ParsedApp,
} from './apps';
import { AREA_STORES } from './store';
import { OFFICE, type AreaData, type AreaItem } from './types';
import '../../styles/apps.css';

const ROAD = STAGES.filter((s) => s.k !== 'closed');
const short = (d: string) => (d ? parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—');
const newId = () => `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const LABEL = 'Before importing applications';

/**
 * Bring previewed applications in, after a named restore point. The plan is worked out again
 * against what's stored right now, so nothing that changed meanwhile is overwritten blindly.
 */
async function importApps(apps: ParsedApp[], keepBack: boolean): Promise<{ added: number; moved: number }> {
  const store = AREA_STORES.office;
  if (!store.getState().loaded) await store.getState().load();
  const { days, items } = store.getState();
  const plan = previewApplications(items, apps);
  const moved = plan.moved.filter((m) => !(keepBack && m.back));
  if (!plan.add.length && !moved.length) return { added: 0, moved: 0 };
  await snapshotNow(OFFICE.key, { days, items } satisfies AreaData, LABEL);
  const before = new Map(store.getState().items.map((i) => [i.id, JSON.stringify(i)]));
  const now = new Date().toISOString();
  // Stamp what the import changed, so the newest status wins when devices sync.
  const next = applyApplications(store.getState().items, plan.add, moved, todayISO(), newId).map((i) => (before.has(i.id) && before.get(i.id) !== JSON.stringify(i) ? { ...i, edited: now } : i));
  store.setState({ items: next });
  await saveWithSnapshot(OFFICE.key, { days: store.getState().days, items: next } satisfies AreaData);
  return { added: plan.add.length, moved: moved.length };
}

/** Job Search HQ's pipeline: Saved → Applied → Screen → Interview → Offer, with Closed set apart. */
export function AppsPipeline() {
  const a = AREA_STORES.office();
  useEffect(() => { void AREA_STORES.office.getState().load(); }, []);
  const today = todayISO();
  const apps = useMemo(() => a.items.filter((i) => i.list === APPS_LIST), [a.items]);
  const p = useMemo(() => pipeline(a.items, today), [a.items, today]);
  const [open, setOpen] = useState<AppStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);

  if (!a.loaded) return null;
  const top = Math.max(1, ...ROAD.map((s) => p.counts[s.k]));
  const empty = p.total === 0;
  const pick = () => fileRef.current?.click();
  const shown = open ? apps.filter((i) => statusOf(i) === open).sort((x, y) => y.date.localeCompare(x.date)) : [];

  return (
    <section className={`panel ap rise${empty ? ' empty' : ''}`} style={rise(2)} aria-labelledby="ap-t">
      <div className="panel-h ap-h">
        <p className="panel-t" id="ap-t">The pipeline</p>
        {!empty && (
          <span className="ap-h-r">
            <span className="mono faint">{p.total} application{p.total === 1 ? '' : 's'}</span>
            <button className="btn sm" onClick={pick}>Import .csv</button>
          </span>
        )}
      </div>

      <div className="ap-road" role="group" aria-label="Stages">
        <ol className="ap-stages">
          {ROAD.map((s, i) => (
            <li key={s.k} className={`ap-stage st-${s.k}${open === s.k ? ' on' : ''}${p.counts[s.k] ? '' : ' none'}`} style={{ '--fill': p.counts[s.k] / top, '--n': i } as CSSProperties}>
              <button onClick={() => setOpen(open === s.k ? null : s.k)} aria-expanded={open === s.k} disabled={empty} aria-label={`${s.label}: ${p.counts[s.k]}`}>
                <span className="ap-node" aria-hidden />
                <span className="ap-n">{p.counts[s.k]}</span>
                <span className="ap-l">{s.label}</span>
                <span className="ap-meter" aria-hidden><i /></span>
              </button>
            </li>
          ))}
        </ol>
        <div className={`ap-stage ap-closed${open === 'closed' ? ' on' : ''}${p.counts.closed ? '' : ' none'}`}>
          <button onClick={() => setOpen(open === 'closed' ? null : 'closed')} aria-expanded={open === 'closed'} disabled={empty} aria-label={`Closed: ${p.counts.closed}`}>
            <span className="ap-drawer" aria-hidden>▭</span>
            <span className="ap-n">{p.counts.closed}</span>
            <span className="ap-l">Closed</span>
          </button>
        </div>
      </div>

      {!empty && (
        <div className="ap-figs">
          <Fig k="7 days" v={String(p.last7)} sub={`sent this week`} />
          <Fig k="30 days" v={String(p.last30)} sub={`sent this month`} />
          <Fig k="Response rate" v={p.responseRate === null ? '—' : `${Math.round(p.responseRate * 100)}%`} sub={`${p.counts.screen + p.counts.interview + p.counts.offer} of ${p.sent} heard back`} meter={p.responseRate ?? 0} />
        </div>
      )}

      {open && !empty && <StageList stage={open} items={shown} onClose={() => setOpen(null)} />}

      {empty && (
        <div className="ap-empty">
          <span className="ap-empty-g" aria-hidden>▤</span>
          <div className="ap-empty-t">
            <b>Bring your pipeline in.</b>
            <span className="dim">In your Application Ledger, export the list as a CSV, then choose it here. You’ll see what changes before anything is added, and importing again later only moves statuses.</span>
          </div>
          <button className="btn primary" onClick={pick}>Import from your Application Ledger (.csv)</button>
        </div>
      )}

      <AddApp apps={apps} empty={empty} />

      <input ref={fileRef} type="file" hidden accept=".csv,text/csv,text/plain"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void f.text().then((text) => setFile({ name: f.name, text })); }} />
      {file && <ImportSheet file={file} onClose={() => setFile(null)} />}
    </section>
  );
}

function Fig({ k, v, sub, meter }: { k: string; v: string; sub: string; meter?: number }) {
  return (
    <div className="ap-fig">
      <span className="ap-fig-k mono">{k}</span>
      <span className="ap-fig-v">{v}</span>
      <span className="ap-fig-s mono faint">{sub}</span>
      {meter !== undefined && <span className="ap-fig-m" aria-hidden><i style={{ width: `${Math.round(meter * 100)}%` }} /></span>}
    </div>
  );
}

/* ---------------- one stage, opened ---------------- */

function StageList({ stage, items, onClose }: { stage: AppStatus; items: AreaItem[]; onClose: () => void }) {
  const move = (i: AreaItem, to: AppStatus, el: HTMLElement) => {
    if (to === statusOf(i)) return;
    if (to === 'offer' || to === 'interview' || to === 'screen') embers(el, to === 'offer' ? 22 : 10);
    AREA_STORES.office.getState().patchItem(i.id, { status: to });
  };
  return (
    <div className={`ap-list st-${stage}`}>
      <div className="ap-list-h">
        <span className="mono">{STAGE_LABEL[stage]} · {items.length}</span>
        <button className="linkish" onClick={onClose}>Close</button>
      </div>
      {items.length === 0 ? (
        <p className="faint ap-none">Nothing here right now.</p>
      ) : (
        <ul>
          {items.map((i) => {
            const { company, role } = splitAppText(i.text);
            return (
              <li key={i.id}>
                <span className="ap-co">
                  <b>{company}</b>
                  {role && <span className="dim">{role}</span>}
                </span>
                <span className="ap-when mono faint">{short(i.date)}</span>
                {i.link ? <a className="ap-link" href={i.link} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${company} posting`}>↗</a> : <span />}
                <label className="ap-move">
                  <span className="sr">Status of {i.text}</span>
                  <select value={statusOf(i)} onChange={(e) => move(i, e.target.value as AppStatus, e.currentTarget)}>
                    {STAGES.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
                  </select>
                </label>
                {i.body && <p className="ap-body dim">{i.body}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- adding one by hand ---------------- */

function AddApp({ apps, empty }: { apps: AreaItem[]; empty: boolean }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<AppStatus>('applied');
  const dupe = company.trim() !== '' && apps.some((i) => itemKey(i) === appKey(company, role));
  const ok = company.trim() !== '' && role.trim() !== '' && !dupe;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ok) return;
    embers(e.currentTarget.querySelector('button'), 10);
    AREA_STORES.office.getState().addItem(APPS_LIST, appText(company, role), { status });
    setCompany(''); setRole(''); setStatus('applied');
  };
  return (
    <form className="ap-add" onSubmit={submit}>
      <span className="ap-add-k mono">{empty ? 'Or log one by hand' : 'Log one by hand'}</span>
      <label className="ap-in"><span>Company</span><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Toast" autoComplete="off" /></label>
      <label className="ap-in"><span>Role</span><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Product Manager" autoComplete="off" /></label>
      <label className="ap-in ap-in-s"><span>Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)}>
          {STAGES.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
        </select>
      </label>
      <button className="btn primary" disabled={!ok}>Add</button>
      {dupe && <span className="ap-dupe mono">Already in your pipeline. Change its status from its stage above.</span>}
    </form>
  );
}

/* ---------------- the import sheet ---------------- */

function ImportSheet({ file, onClose }: { file: { name: string; text: string }; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const items = AREA_STORES.office((s) => s.items);
  const [keepBack, setKeepBack] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ added: number; moved: number } | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  const parsed = useMemo(() => parseApplications(file.text), [file]);
  // Frozen once applied, so the "done" screen doesn't re-read the plan against the new items.
  const live: AppsPlan | null = useMemo(() => (parsed.ok ? previewApplications(items, parsed.apps) : null), [parsed, items]);
  const [frozen, setFrozen] = useState<AppsPlan | null>(null);
  const plan = frozen ?? live;
  const back = plan ? plan.moved.filter((m) => m.back).length : 0;
  const moving = plan ? plan.moved.filter((m) => !(keepBack && m.back)) : [];
  const changes = plan ? plan.add.length + moving.length : 0;

  const apply = async () => {
    if (!parsed.ok || !plan) return;
    setBusy(true);
    setFrozen(plan);
    try { setDone(await importApps(parsed.apps, keepBack)); } finally { setBusy(false); }
  };
  const close = () => ref.current?.close();

  return (
    <dialog ref={ref} className="sheet ap-sheet" onClose={onClose} aria-labelledby="ap-imp-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Import · Application Ledger</div>
      <h2 id="ap-imp-t" className="sheet-title">{done ? 'On the board.' : 'Bring your applications in'}</h2>
      <p className="sheet-src mono">{file.name}</p>

      {!parsed.ok ? (
        <p className="sheet-warn">{parsed.error}</p>
      ) : done ? (
        <p className="dim">
          Added {done.added} application{done.added === 1 ? '' : 's'}{done.moved ? <> and moved {done.moved}</> : null}. Nothing was deleted.
          {' '}Changed your mind? A restore point named “{LABEL}” was saved first (Settings → Restore).
        </p>
      ) : plan ? (
        <>
          <p className="ap-cols mono">
            <span className="faint">Read</span>
            {Object.entries(parsed.columns).map(([k, v]) => <span key={k} className="ap-col" title={k}>{v}</span>)}
          </p>
          <p className="ap-sum">
            <b className="ap-g-new">{plan.add.length} new</b>, <b className="ap-g-moved">{plan.moved.length} whose status moved</b>
            {plan.moved[0] ? <> (e.g. {STAGE_LABEL[plan.moved[0].from].toLowerCase()} → {STAGE_LABEL[plan.moved[0].to].toLowerCase()})</> : null}, {plan.same.length} unchanged.
            <span className="dim"> Nothing is ever deleted by an import.</span>
          </p>
          <Notes parsed={parsed} repeats={plan.repeats} />

          {plan.add.length > 0 && (
            <div className="ap-sec">
              <h3 className="mono">New · {plan.add.length}</h3>
              <ul className="ap-imp">
                {plan.add.slice(0, 40).map((x, n) => (
                  <li key={n}>
                    <span className="ap-imp-d"><b>{x.company}</b>{x.role && <span className="dim"> — {x.role}</span>}</span>
                    <span className="mono faint">{x.date ? short(x.date) : 'today'}</span>
                    <StagePill s={x.status} />
                  </li>
                ))}
                {plan.add.length > 40 && <li className="mono faint">…and {plan.add.length - 40} more</li>}
              </ul>
            </div>
          )}

          {plan.moved.length > 0 && (
            <div className="ap-sec">
              <h3 className="mono">Status moved · {plan.moved.length}</h3>
              <ul className="ap-imp">
                {plan.moved.map((m) => <MovedRow key={m.item.id} m={m} skipped={keepBack && m.back} />)}
              </ul>
              {back > 0 && (
                <label className="ap-keep">
                  <input type="checkbox" checked={keepBack} onChange={(e) => setKeepBack(e.target.checked)} />
                  <span>Leave the <b>{back}</b> that would go <b>backwards</b> as they are here (you may have moved {back === 1 ? 'it' : 'them'} on by hand).</span>
                </label>
              )}
            </div>
          )}

          {plan.same.length > 0 && (
            <details className="ap-sec ap-same">
              <summary className="mono">Unchanged · {plan.same.length}</summary>
              <ul className="ap-imp">
                {plan.same.map((s) => (
                  <li key={s.item.id}><span className="ap-imp-d">{s.item.text}</span><span /><StagePill s={statusOf(s.item)} /></li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : null}

      <div className="sheet-actions">
        {parsed.ok && !done && changes > 0 ? (
          <>
            <button className="btn ghost" onClick={close}>Cancel</button>
            <button className="btn primary" disabled={busy} onClick={() => void apply()}>
              {[plan!.add.length ? `Add ${plan!.add.length}` : '', moving.length ? `move ${moving.length}` : ''].filter(Boolean).join(' · ').replace(/^m/, 'M')}
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={close}>{parsed.ok && !done ? 'Nothing to change' : 'Done'}</button>
        )}
      </div>
    </dialog>
  );
}

function Notes({ parsed, repeats }: { parsed: Extract<ReturnType<typeof parseApplications>, { ok: true }>; repeats: number }) {
  const notes: string[] = [];
  if (!parsed.columns.status) notes.push('No status column, so new ones come in as Applied and existing ones keep theirs.');
  if (parsed.unknown.length) notes.push(`Read as Applied (status not recognised): ${parsed.unknown.slice(0, 5).map((u) => `“${u}”`).join(', ')}${parsed.unknown.length > 5 ? ` and ${parsed.unknown.length - 5} more` : ''}.`);
  if (parsed.undated) notes.push(`${parsed.undated} date${parsed.undated === 1 ? '' : 's'} couldn’t be read; ${parsed.undated === 1 ? 'it' : 'they'}’ll be dated today.`);
  if (parsed.skipped) notes.push(`${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} without a company skipped.`);
  if (repeats) notes.push(`${repeats} row${repeats === 1 ? '' : 's'} repeat${repeats === 1 ? 's' : ''} an earlier one (same company and role); the first counts.`);
  if (!notes.length) return null;
  return <ul className="ap-notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul>;
}

function MovedRow({ m, skipped }: { m: MovedApp; skipped: boolean }) {
  return (
    <li className={skipped ? 'skipped' : m.back ? 'back' : ''}>
      <span className="ap-imp-d">{m.item.text}</span>
      <span className="mono faint">{m.back ? (skipped ? 'kept' : '↩ back') : ''}</span>
      <span className="ap-move-to"><StagePill s={m.from} /><span aria-label="to">→</span><StagePill s={m.to} /></span>
    </li>
  );
}

const StagePill = ({ s }: { s: AppStatus }) => <span className={`ap-pill st-${s}`}>{STAGE_LABEL[s]}</span>;
