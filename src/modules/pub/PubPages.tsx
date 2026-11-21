import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { parseISO, todayISO } from '../../core/dates';
import { CountUp, embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { useManuscripts } from '../manuscripts/store';
import { daysOut, queryStats, upcomingContests } from './logic';
import { usePub } from './store';
import {
  CONTEST_LABEL, FEEDBACK_LABEL, FOLLOW_UP_WEEKS, OUTREACH_LABEL, OUTREACH_STATUS, QUERY_LABEL,
  type Contest, type ContestStatus, type Feedback, type FeedbackKind, type Outreach, type OutreachKind, type OutreachStatus, type Query, type QueryStatus,
} from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/pub.css';

const short = (d?: string) => (d ? parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
function usePubLoaded() {
  const p = usePub();
  const m = useManuscripts();
  useEffect(() => { void p.load(); void m.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return p.loaded;
}

/* ---------------- shared bits ---------------- */

function Hero({ eyebrow, title, word, line, stats, children }: { eyebrow: string; title: string; word: string; line: string; stats: { v: number; u: string; l: string }[]; children?: ReactNode }) {
  return (
    <section className="hero pub-hero rise" style={rise(0)}>
      <div className="hero-copy">
        <div className="page-eyebrow">Writer's Cabin · {eyebrow}</div>
        <h1 className="hero-title">{title}<br /><em>{word}</em></h1>
        <p className="hero-line">{line}</p>
        {children}
      </div>
      <div className="ledger-stats">
        {stats.map((s) => <div key={s.l} className="lstat"><span className="lstat-v"><CountUp value={s.v} /></span><span className="lstat-u mono">{s.u}</span><span className="lstat-l mono">{s.l}</span></div>)}
      </div>
    </section>
  );
}

function Sheet({ title, eyebrow, onClose, onSave, onRemove, ok, children }: { title: string; eyebrow: string; onClose: () => void; onSave: () => void; onRemove?: () => void; ok: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-label={title}>
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{eyebrow}</div>
      <h2 className="sheet-title">{title}</h2>
      <div className="book-fields" style={{ marginTop: 10 }}>{children}</div>
      <div className="sheet-actions">
        {onRemove && (sure ? <button className="btn danger" onClick={() => { onRemove(); close(); }}>Remove it</button> : <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Remove…</button>)}
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => { onSave(); close(); }}>Save</button>
      </div>
    </dialog>
  );
}

const F = ({ label, children }: { label: string; children: ReactNode }) => <label className="field"><span>{label}</span>{children}</label>;
function Seg<T extends string>({ value, options, onPick, label }: { value: T; options: Record<T, string>; onPick: (v: T) => void; label: string }) {
  return (
    <div className="seg wide wrap" role="radiogroup" aria-label={label}>
      {(Object.keys(options) as T[]).map((k) => <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onPick(k)}>{options[k]}</button>)}
    </div>
  );
}

/* ================= Query Tracker ================= */

const Q_ORDER: QueryStatus[] = ['offer', 'full', 'partial', 'queried', 'researching', 'pass', 'closed'];
const Q_TONE: Record<QueryStatus, string> = { researching: 'var(--bone-faint)', queried: 'var(--aurora)', partial: 'var(--warn)', full: 'var(--lamp)', pass: 'var(--bad)', offer: 'var(--good)', closed: 'var(--bone-faint)' };

export function QueriesPage() {
  const ready = usePubLoaded();
  const p = usePub();
  const mss = useManuscripts((s) => s.manuscripts);
  const today = todayISO();
  const s = queryStats(p.queries, today);
  const [edit, setEdit] = useState<Query | 'new' | null>(null);
  const sorted = useMemo(() => [...p.queries].sort((a, b) => Q_ORDER.indexOf(a.status) - Q_ORDER.indexOf(b.status) || (b.sentOn ?? '').localeCompare(a.sentOn ?? '')), [p.queries]);
  if (!ready) return null;

  return (
    <div className="home pub">
      <Hero eyebrow="Query Tracker" title="The" word="queries." line="Every agent, what you sent, and what came back. Requests land in the Lounge mailbox."
        stats={[{ v: s.sent, u: 'sent', l: 'Queries out' }, { v: s.requests, u: s.rate === null ? 'requests' : `· ${s.rate}%`, l: 'Requests' }, { v: s.offers, u: 'offers', l: 'Offers' }]}>
        <div className="shelf-actions"><button className="btn primary" onClick={() => setEdit('new')}>+ Add an agent</button></div>
      </Hero>

      {s.followUps.length > 0 && (
        <div className="pub-note rise" style={rise(1)}>
          <b>{s.followUps.length} quer{s.followUps.length === 1 ? 'y has' : 'ies have'} been out {FOLLOW_UP_WEEKS}+ weeks</b> — {s.followUps.map((q) => q.agent).join(', ')}. Time for a polite nudge, or to mark it closed.
        </div>
      )}

      <section className="q-list rise" style={rise(2)}>
        {sorted.length === 0 && <p className="dim empty-big">No agents yet. Add the ones you're researching, and log each query when it goes out.</p>}
        {sorted.map((q) => (
          <button key={q.id} className="q tilt" style={{ '--t': Q_TONE[q.status] } as CSSProperties} onClick={() => setEdit(q)} {...tilt(3)}>
            <span className="q-dot" />
            <span className="q-b">
              <span className="q-n">{q.agent}{q.agency ? <span className="q-a"> · {q.agency}</span> : null}</span>
              <span className="q-m mono">
                {q.sentOn ? `sent ${short(q.sentOn)}` : 'not sent yet'}{q.materials ? ` · ${q.materials}` : ''}
                {q.status === 'queried' && q.sentOn ? ` · out ${daysOut(q, today)} days` : ''}
                {q.respondedOn ? ` · answered ${short(q.respondedOn)}` : ''}
              </span>
            </span>
            <span className="q-s mono">{QUERY_LABEL[q.status]}</span>
          </button>
        ))}
      </section>

      {edit && <QuerySheet q={edit === 'new' ? null : edit} mss={mss.map((m) => ({ id: m.id, title: m.title }))} onClose={() => setEdit(null)} />}
    </div>
  );
}

function QuerySheet({ q, mss, onClose }: { q: Query | null; mss: { id: string; title: string }[]; onClose: () => void }) {
  const [v, setV] = useState<Omit<Query, 'id'> & { id?: string }>(q ?? { agent: '', status: 'researching', ms: mss[0]?.id });
  const setStatus = (status: QueryStatus) => setV((x) => ({
    ...x, status,
    sentOn: status !== 'researching' && !x.sentOn ? todayISO() : x.sentOn,
    respondedOn: ['partial', 'full', 'pass', 'offer'].includes(status) && !x.respondedOn ? todayISO() : x.respondedOn,
  }));
  return (
    <Sheet title={q ? q.agent : 'A new agent'} eyebrow="Query Tracker" ok={Boolean(v.agent.trim())} onClose={onClose}
      onSave={() => { usePub.getState().put('queries', v); if (v.status === 'offer' && q?.status !== 'offer') { window.dispatchEvent(new Event('austin:celebrate')); embers(document.body.querySelector('.q-list'), 40); } }}
      onRemove={q ? () => usePub.getState().remove('queries', q.id) : undefined}>
      <div className="field-row two">
        <F label="Agent"><input value={v.agent} onChange={(e) => setV({ ...v, agent: e.target.value })} autoFocus={!q} /></F>
        <F label="Agency"><input value={v.agency ?? ''} onChange={(e) => setV({ ...v, agency: e.target.value || undefined })} /></F>
      </div>
      <Seg label="Status" value={v.status} options={QUERY_LABEL} onPick={setStatus} />
      <div className="field-row three">
        <F label="Sent"><input type="date" value={v.sentOn ?? ''} onChange={(e) => setV({ ...v, sentOn: e.target.value || undefined })} /></F>
        <F label="Answered"><input type="date" value={v.respondedOn ?? ''} onChange={(e) => setV({ ...v, respondedOn: e.target.value || undefined })} /></F>
        <F label="Manuscript">
          <select value={v.ms ?? ''} onChange={(e) => setV({ ...v, ms: e.target.value || undefined })}>{mss.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
        </F>
      </div>
      <div className="field-row two">
        <F label="What you sent"><input value={v.materials ?? ''} onChange={(e) => setV({ ...v, materials: e.target.value || undefined })} placeholder="Query + first 10 pages" /></F>
        <F label="Contact / portal"><input value={v.contact ?? ''} onChange={(e) => setV({ ...v, contact: e.target.value || undefined })} placeholder="QueryManager link or email" /></F>
      </div>
      <F label="Notes"><textarea className="ruled" rows={3} value={v.notes ?? ''} onChange={(e) => setV({ ...v, notes: e.target.value || undefined })} placeholder="Why this agent, what they asked for, personalization…" /></F>
    </Sheet>
  );
}

/* ================= Contests ================= */

export function ContestsPage() {
  const ready = usePubLoaded();
  const p = usePub();
  const today = todayISO();
  const up = upcomingContests(p.contests, today);
  const [edit, setEdit] = useState<Contest | 'new' | null>(null);
  const entered = p.contests.filter((c) => c.status !== 'considering').sort((a, b) => b.deadline.localeCompare(a.deadline));
  const past = p.contests.filter((c) => c.status === 'considering' && c.deadline < today);
  if (!ready) return null;
  return (
    <div className="home pub">
      <Hero eyebrow="Contests" title="The" word="contests." line="Short-story deadlines, fees and word limits, and what happened to every entry. They're pinned to the Lounge corkboard."
        stats={[{ v: up.length, u: 'open', l: 'Deadlines ahead' }, { v: entered.length, u: 'entered', l: 'Entries' }, { v: entered.filter((c) => ['longlist', 'shortlist', 'won'].includes(c.status)).length, u: 'placed', l: 'Placings' }]}>
        <div className="shelf-actions"><button className="btn primary" onClick={() => setEdit('new')}>+ Add a contest</button></div>
      </Hero>
      <h2 className="section-h rise" style={rise(1)}>Deadlines ahead</h2>
      <div className="pins rise" style={rise(1)}>
        {up.length === 0 && <p className="dim">No open deadlines. Add the contests you're eyeing.</p>}
        {up.map((c, i) => (
          <button key={c.id} className="pin tilt" style={{ '--r': `${(i % 3) - 1}deg` } as CSSProperties} onClick={() => setEdit(c)} {...tilt(5)}>
            <i className="tack" />
            <span className="pin-left"><b>{c.left}</b><small>{c.left === 1 ? 'day' : 'days'}</small></span>
            <span className="pin-n">{c.name}</span>
            <span className="pin-m mono">{short(c.deadline)}{c.wordLimit ? ` · ${c.wordLimit.toLocaleString('en-US')} words` : ''}{c.fee ? ` · $${c.fee}` : ''}</span>
            {c.prize && <span className="pin-m mono">prize · {c.prize}</span>}
          </button>
        ))}
      </div>
      {entered.length > 0 && (
        <>
          <h2 className="section-h rise" style={rise(2)}>Entries</h2>
          <div className="q-list rise" style={rise(2)}>
            {entered.map((c) => (
              <button key={c.id} className="q" style={{ '--t': c.status === 'won' ? 'var(--good)' : c.status === 'not-placed' ? 'var(--bone-faint)' : 'var(--lamp)' } as CSSProperties} onClick={() => setEdit(c)}>
                <span className="q-dot" />
                <span className="q-b"><span className="q-n">{c.name}</span><span className="q-m mono">{c.piece ? `“${c.piece}” · ` : ''}deadline {short(c.deadline)}</span></span>
                <span className="q-s mono">{CONTEST_LABEL[c.status]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {past.length > 0 && <p className="faint mono" style={{ fontSize: 11, marginTop: 14 }}>{past.length} deadline{past.length === 1 ? '' : 's'} passed without an entry.</p>}
      {edit && <ContestSheet c={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ContestSheet({ c, onClose }: { c: Contest | null; onClose: () => void }) {
  const [v, setV] = useState<Omit<Contest, 'id'> & { id?: string }>(c ?? { name: '', deadline: '', status: 'considering' });
  const num = (s: string) => Number(s.replace(/[^\d.]/g, '')) || undefined;
  return (
    <Sheet title={c ? c.name : 'A new contest'} eyebrow="Contests" ok={Boolean(v.name.trim() && v.deadline)} onClose={onClose}
      onSave={() => { usePub.getState().put('contests', v); if (v.status === 'won' && c?.status !== 'won') window.dispatchEvent(new Event('austin:celebrate')); }}
      onRemove={c ? () => usePub.getState().remove('contests', c.id) : undefined}>
      <div className="field-row two">
        <F label="Contest"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus={!c} /></F>
        <F label="Deadline"><input type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} /></F>
      </div>
      <div className="field-row three">
        <F label="Fee ($)"><input inputMode="decimal" value={v.fee ?? ''} onChange={(e) => setV({ ...v, fee: num(e.target.value) })} /></F>
        <F label="Word limit"><input inputMode="numeric" value={v.wordLimit ?? ''} onChange={(e) => setV({ ...v, wordLimit: num(e.target.value) })} /></F>
        <F label="Prize"><input value={v.prize ?? ''} onChange={(e) => setV({ ...v, prize: e.target.value || undefined })} /></F>
      </div>
      <Seg label="Status" value={v.status} options={CONTEST_LABEL as Record<ContestStatus, string>} onPick={(status) => setV({ ...v, status })} />
      <div className="field-row two">
        <F label="Piece entered"><input value={v.piece ?? ''} onChange={(e) => setV({ ...v, piece: e.target.value || undefined })} /></F>
        <F label="Link"><input value={v.url ?? ''} onChange={(e) => setV({ ...v, url: e.target.value || undefined })} /></F>
      </div>
      <F label="Notes"><textarea className="ruled" rows={2} value={v.notes ?? ''} onChange={(e) => setV({ ...v, notes: e.target.value || undefined })} /></F>
    </Sheet>
  );
}

/* ================= Editorial Vault ================= */

export function EditorialPage() {
  const ready = usePubLoaded();
  const p = usePub();
  const mss = useManuscripts((s) => s.manuscripts);
  const [edit, setEdit] = useState<Feedback | 'new' | null>(null);
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = p.feedback.filter((f) => show === 'all' || !f.resolved).sort((a, b) => b.date.localeCompare(a.date));
  const chName = (f: Feedback) => {
    const m = mss.find((x) => x.id === f.ms);
    const i = m?.chapters.findIndex((c) => c.id === f.chapter) ?? -1;
    return m ? `${m.title}${i >= 0 ? ` · Ch. ${i + 1} ${m.chapters[i].title}` : ''}` : '';
  };
  if (!ready) return null;
  return (
    <div className="home pub">
      <Hero eyebrow="Editorial Vault" title="The" word="vault." line="Every note from beta readers, editors and critique partners, pinned to the chapter it's about. Tick it off when it's handled."
        stats={[{ v: p.feedback.filter((f) => !f.resolved).length, u: 'open', l: 'To address' }, { v: p.feedback.filter((f) => f.resolved).length, u: 'done', l: 'Addressed' }, { v: new Set(p.feedback.map((f) => f.from)).size, u: 'readers', l: 'Voices' }]}>
        <div className="shelf-actions">
          <button className="btn primary" onClick={() => setEdit('new')}>+ Add a note</button>
          <div className="seg" role="radiogroup" aria-label="Show"><button role="radio" aria-checked={show === 'open'} onClick={() => setShow('open')}>Open</button><button role="radio" aria-checked={show === 'all'} onClick={() => setShow('all')}>All</button></div>
        </div>
      </Hero>
      <div className="notes rise" style={rise(1)}>
        {list.length === 0 && <p className="dim empty-big">{p.feedback.length ? 'Everything has been addressed.' : 'Feedback lands here: paste it in, tie it to a chapter, and work through it.'}</p>}
        {list.map((f) => (
          <article key={f.id} className={f.resolved ? 'note resolved' : 'note'}>
            <header>
              <span className="mono">{FEEDBACK_LABEL[f.kind]} · {f.from}</span>
              <span className="mono faint">{short(f.date)}</span>
            </header>
            {chName(f) && <span className="note-ch mono">{chName(f)}</span>}
            <p>{f.text}</p>
            <footer>
              <button className="btn ghost sm" onClick={() => setEdit(f)}>Edit</button>
              <button className={f.resolved ? 'btn ghost sm' : 'btn sm'} onClick={(e) => { if (!f.resolved) embers(e.currentTarget, 10); usePub.getState().put('feedback', { ...f, resolved: !f.resolved }); }}>{f.resolved ? 'Reopen' : 'Addressed ✓'}</button>
            </footer>
          </article>
        ))}
      </div>
      {edit && <FeedbackSheet f={edit === 'new' ? null : edit} mss={mss} onClose={() => setEdit(null)} />}
    </div>
  );
}

function FeedbackSheet({ f, mss, onClose }: { f: Feedback | null; mss: { id: string; title: string; chapters: { id: string; title: string }[] }[]; onClose: () => void }) {
  const [v, setV] = useState<Omit<Feedback, 'id'> & { id?: string }>(f ?? { from: '', kind: 'beta', date: todayISO(), text: '', ms: mss[0]?.id });
  const m = mss.find((x) => x.id === v.ms);
  return (
    <Sheet title={f ? `Note from ${f.from}` : 'A new note'} eyebrow="Editorial Vault" ok={Boolean(v.from.trim() && v.text.trim())} onClose={onClose}
      onSave={() => usePub.getState().put('feedback', v)} onRemove={f ? () => usePub.getState().remove('feedback', f.id) : undefined}>
      <div className="field-row two">
        <F label="From"><input value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} autoFocus={!f} placeholder="Name" /></F>
        <F label="Date"><input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></F>
      </div>
      <Seg label="Who" value={v.kind} options={FEEDBACK_LABEL as Record<FeedbackKind, string>} onPick={(kind) => setV({ ...v, kind })} />
      <div className="field-row two">
        <F label="Manuscript"><select value={v.ms ?? ''} onChange={(e) => setV({ ...v, ms: e.target.value || undefined, chapter: undefined })}>{mss.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></F>
        <F label="Chapter"><select value={v.chapter ?? ''} onChange={(e) => setV({ ...v, chapter: e.target.value || undefined })}><option value="">The whole book</option>{m?.chapters.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.title}</option>)}</select></F>
      </div>
      <F label="The note"><textarea className="ruled" rows={6} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} placeholder="Paste or type the feedback…" /></F>
    </Sheet>
  );
}

/* ================= Outreach ================= */

const O_COLS: OutreachStatus[] = ['idea', 'contacted', 'yes', 'done', 'no'];

export function OutreachPage() {
  const ready = usePubLoaded();
  const p = usePub();
  const [edit, setEdit] = useState<Outreach | 'new' | null>(null);
  if (!ready) return null;
  return (
    <div className="home pub">
      <Hero eyebrow="Outreach" title="The" word="launch list." line="Everyone you'll reach when the debut comes out: reviewers, bookstores, podcasts, authors, press, and the people who'll cheer loudest."
        stats={[{ v: p.outreach.length, u: 'people', l: 'On the list' }, { v: p.outreach.filter((o) => o.status === 'yes' || o.status === 'done').length, u: 'yes', l: 'Said yes' }, { v: p.outreach.filter((o) => o.status === 'contacted').length, u: 'waiting', l: 'Waiting' }]}>
        <div className="shelf-actions"><button className="btn primary" onClick={() => setEdit('new')}>+ Add someone</button></div>
      </Hero>
      <section className="o-board rise" style={rise(1)}>
        {O_COLS.map((st) => (
          <div key={st} className="o-col">
            <header className="mono">{OUTREACH_STATUS[st]} <span className="faint">{p.outreach.filter((o) => o.status === st).length || ''}</span></header>
            {p.outreach.filter((o) => o.status === st).map((o) => (
              <button key={o.id} className="o-card" onClick={() => setEdit(o)}>
                <span className="o-n">{o.name}</span>
                <span className="o-k mono">{OUTREACH_LABEL[o.kind]}</span>
              </button>
            ))}
          </div>
        ))}
      </section>
      {edit && <OutreachSheet o={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function OutreachSheet({ o, onClose }: { o: Outreach | null; onClose: () => void }) {
  const [v, setV] = useState<Omit<Outreach, 'id'> & { id?: string }>(o ?? { name: '', kind: 'reviewer', status: 'idea' });
  return (
    <Sheet title={o ? o.name : 'Someone new'} eyebrow="Outreach" ok={Boolean(v.name.trim())} onClose={onClose}
      onSave={() => usePub.getState().put('outreach', { ...v, date: v.status !== o?.status ? todayISO() : v.date })} onRemove={o ? () => usePub.getState().remove('outreach', o.id) : undefined}>
      <div className="field-row two">
        <F label="Name"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus={!o} /></F>
        <F label="Contact"><input value={v.contact ?? ''} onChange={(e) => setV({ ...v, contact: e.target.value || undefined })} /></F>
      </div>
      <Seg label="Kind" value={v.kind} options={OUTREACH_LABEL as Record<OutreachKind, string>} onPick={(kind) => setV({ ...v, kind })} />
      <Seg label="Status" value={v.status} options={OUTREACH_STATUS as Record<OutreachStatus, string>} onPick={(status) => setV({ ...v, status })} />
      <F label="Notes"><textarea className="ruled" rows={3} value={v.notes ?? ''} onChange={(e) => setV({ ...v, notes: e.target.value || undefined })} /></F>
    </Sheet>
  );
}
