import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { mondayOf, parseISO, todayISO } from '../../core/dates';
import { Dog } from '../../shell/Dogs';
import { CountUp, embers } from '../../shell/fx';
import { rise, useMinuteClock } from '../../shell/lamp';
import { careHistory, careLabel, careProblem, kennelPose, kennelWalkMinutes, latestWeight, nextCareFor, notesFor, sparkPoints, upcomingCare, walkStreak, walkStrip, walksOn, weekMinutes, weightChange, weightsOf, type Due } from './logic';
import { useKennel } from './store';
import { CARE_KINDS, DOGS, WHO_LABEL, type Care, type CareKind, type DogId, type KennelData, type Note, type Walk, type Weight, type Who } from './types';
import '../../styles/cabin.css';
import '../../styles/kennel.css';

const WHOS: Who[] = ['both', 'cooper', 'shadow'];
const QUICK = [15, 30, 45, 60];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const short = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtM = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const kindOf = (k: CareKind) => CARE_KINDS.find((x) => x.k === k)!;
const longDate = (d: string) => parseISO(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const dueText = (d: Due) => (d.days === 0 ? 'due today' : d.overdue ? `${-d.days} day${d.days === -1 ? '' : 's'} overdue` : `in ${d.days} day${d.days === 1 ? '' : 's'}`);

type Sheet =
  | { kind: 'walk'; walk?: Walk }
  | { kind: 'care'; care?: Care }
  | { kind: 'weight'; weight: Weight }
  | { kind: 'note'; note: Note }
  | null;

export default function KennelPage() {
  const k = useKennel();
  useEffect(() => { void k.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useMinuteClock();
  const today = todayISO();
  const heroRef = useRef<HTMLElement>(null);
  const [who, setWho] = useState<Who>('both');
  const [sheet, setSheet] = useState<Sheet>(null);

  if (!k.loaded) return null;
  const mins = kennelWalkMinutes(k, today);
  const streak = walkStreak(k.walks, today);
  const week = weekMinutes(k.walks, mondayOf(today));
  const strip = walkStrip(k.walks, today);
  const top = Math.max(45, ...strip.map((d) => d.minutes));
  const todays = walksOn(k.walks, today);
  const upcoming = upcomingCare(k.care, today);
  const close = () => setSheet(null);

  const logWalk = (minutes: number) => {
    if (!todays.length) embers(heroRef.current, 14);
    k.addWalk({ date: today, who, minutes });
  };

  return (
    <div className="home kennel">
      <section className="hero kennel-hero rise" style={rise(0)} ref={heroRef}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · The Kennel</div>
          <h1 className="hero-title">The<br /><em>Kennel.</em></h1>
          <p className="hero-line">Cooper and Shadow: their walks, their shots, their weight, and the small stolen-pancake moments worth keeping.</p>
          <div className="kn-log" aria-label="Log a walk for today">
            <div className="seg kn-who-seg" role="radiogroup" aria-label="Who went">
              {WHOS.map((w) => <button key={w} role="radio" aria-checked={who === w} onClick={() => setWho(w)}>{WHO_LABEL[w]}</button>)}
            </div>
            <div className="kn-quick">
              {QUICK.map((n) => (
                <button key={n} className="kn-q" onClick={() => logWalk(n)} aria-label={`Log a ${n} minute walk`}><em>+</em>{n}<small>min</small></button>
              ))}
              <button className="btn ghost sm kn-more" onClick={() => setSheet({ kind: 'walk' })}>Walk with a note…</button>
            </div>
          </div>
        </div>
        <div className="kn-today">
          <span className="kn-big">{mins ? <CountUp value={mins} format={fmtM} /> : '—'}</span>
          <span className="mono">walked today</span>
          <span className="kn-streak mono"><b>{streak}</b> day{streak === 1 ? '' : 's'} in a row</span>
          <span className="mono faint">{fmtM(week)} this week</span>
        </div>
      </section>

      <div className="kn-dogs">
        {DOGS.map((d, i) => <DogCard key={d.id} id={d.id} data={k} today={today} hour={now.getHours()} delay={1 + i} />)}
      </div>

      <div className="kn-grid">
        <section className="panel kn-walks rise" style={rise(3)}>
          <div className="panel-h"><p className="panel-t">Walks · last 7 days</p><span className="mono faint kn-count">{streak > 1 ? `${streak}-day streak` : ''}</span></div>
          <div className="kn-strip">
            {strip.map((d) => (
              <div key={d.date} className={`kn-day${d.date === today ? ' today' : ''}${d.count ? '' : ' none'}`} title={`${d.date}: ${d.count} walk${d.count === 1 ? '' : 's'}, ${fmtM(d.minutes)}`}>
                <span className="kn-v mono">{d.minutes ? fmtM(d.minutes) : ''}</span>
                <span className="kn-bar"><span style={{ height: `${(d.minutes / top) * 100}%` }} /></span>
                <span className="kn-n mono">{DOW[parseISO(d.date).getDay()]}</span>
              </div>
            ))}
          </div>
          <p className="kn-sub mono">Today</p>
          {todays.length === 0 && <p className="dim kn-empty">No walk yet today. The leashes are by the door.</p>}
          <ul className="kn-list">
            {todays.map((w) => (
              <Row key={w.id} glyph="⟿" label={`Edit the ${fmtM(w.minutes)} walk`} onOpen={() => setSheet({ kind: 'walk', walk: w })}>
                <span className="kn-t">{fmtM(w.minutes)} <span className="kn-who">{WHO_LABEL[w.who]}</span></span>
                {w.note && <span className="kn-note">{w.note}</span>}
              </Row>
            ))}
          </ul>
        </section>

        <section className="panel kn-care rise" style={rise(4)}>
          <div className="panel-h"><p className="panel-t">Vet &amp; care</p><button className="btn sm kn-add-care" onClick={() => setSheet({ kind: 'care' })}>+ Add care</button></div>
          <p className="kn-sub mono">Coming up · 30 days</p>
          {upcoming.length === 0 && <p className="dim kn-empty">Nothing due in the next month. Good dogs, well kept.</p>}
          <ul className="kn-list">
            {upcoming.map((d) => (
              <Row key={d.care.id} glyph={kindOf(d.care.kind).glyph} className={`kn-due${d.overdue ? ' overdue' : d.days <= 7 ? ' soon' : ''}`} label={`Edit ${careLabel(d.care)}`} onOpen={() => setSheet({ kind: 'care', care: d.care })}>
                <span className="kn-t">{careLabel(d.care)} <span className="kn-who">{WHO_LABEL[d.care.who]}</span></span>
                <span className="kn-m mono">{short(d.due)} · {dueText(d)}</span>
              </Row>
            ))}
          </ul>
          <p className="kn-sub mono">History</p>
          {k.care.length === 0 && <p className="dim kn-empty">Shots, checkups, flea and heartworm doses land here.</p>}
          <ul className="kn-list kn-hist">
            {careHistory(k.care).map((c) => (
              <Row key={c.id} glyph={kindOf(c.kind).glyph} label={`Edit ${careLabel(c)}`} onOpen={() => setSheet({ kind: 'care', care: c })}>
                <span className="kn-t">{careLabel(c)} <span className="kn-who">{WHO_LABEL[c.who]}</span></span>
                {c.note && <span className="kn-note">{c.note}</span>}
                <span className="kn-m mono">{short(c.date)}{c.nextDue ? ` · next ${short(c.nextDue)}` : ''}</span>
              </Row>
            ))}
          </ul>
        </section>

        <WeightPanel data={k} today={today} onEdit={(weight) => setSheet({ kind: 'weight', weight })} />
        <NotesPanel data={k} today={today} onEdit={(note) => setSheet({ kind: 'note', note })} />
      </div>

      {sheet?.kind === 'walk' && <WalkSheet who={who} walk={sheet.walk} today={today} onClose={close} onSaved={() => { if (!sheet.walk) embers(heroRef.current, 10); }} />}
      {sheet?.kind === 'care' && <CareSheet care={sheet.care} today={today} onClose={close} />}
      {sheet?.kind === 'weight' && <WeightSheet weight={sheet.weight} today={today} onClose={close} />}
      {sheet?.kind === 'note' && <NoteSheet note={sheet.note} today={today} onClose={close} />}
    </div>
  );
}

function DogCard({ id, data, today, hour, delay }: { id: DogId; data: KennelData; today: string; hour: number; delay: number }) {
  const dog = DOGS.find((d) => d.id === id)!;
  const walked = walksOn(data.walks, today, id).length > 0;
  const pose = kennelPose(walked, hour);
  const wk = weekMinutes(data.walks, mondayOf(today), id);
  const lw = latestWeight(data.weights, id);
  const ch = weightChange(data.weights, id);
  const next = nextCareFor(data.care, id, today);
  const streak = walkStreak(data.walks, today, id);
  return (
    <article className={`kn-dog ${id} rise`} style={{ ...rise(delay), '--collar': dog.collar } as CSSProperties}>
      <div className="kn-portrait">
        <svg viewBox="-90 -135 180 145" aria-label={`${dog.name}, ${pose === 'sleep' ? 'asleep' : pose === 'proud' ? 'walked and proud' : 'resting'}`} role="img">
          <ellipse cx="0" cy="2" rx="74" ry="8" className="kn-shadow" />
          <g transform={id === 'shadow' ? 'scale(.86)' : undefined}><Dog who={id} pose={pose} /></g>
        </svg>
        {pose === 'sleep' && <span className="kn-zzz mono" aria-hidden>z<i>z</i><b>z</b></span>}
      </div>
      <div className="kn-dog-copy">
        <h2 className="kn-name">{dog.name}</h2>
        <p className="kn-line">{dog.line}</p>
        <dl className="kn-facts">
          <div><dt className="mono">This week</dt><dd>{fmtM(wk)}{streak > 1 && <small className="mono"> · {streak}d streak</small>}</dd></div>
          <div><dt className="mono">Weight</dt><dd>{lw ? <>{lw.lb} <small className="mono">lb{ch ? ` ${ch > 0 ? '+' : ''}${ch}` : ''}</small></> : <span className="faint">—</span>}<Spark data={data} dog={id} /></dd></div>
          <div className={next?.overdue ? 'late' : ''}><dt className="mono">Next care</dt><dd>{next ? <>{careLabel(next.care)} <small className="mono">{dueText(next)}</small></> : <span className="faint">nothing scheduled</span>}</dd></div>
        </dl>
      </div>
    </article>
  );
}

function Spark({ data, dog, w = 84, h = 22 }: { data: KennelData; dog: DogId; w?: number; h?: number }) {
  const p = sparkPoints(data.weights, dog, w, h);
  if (p.length < 2) return null;
  const line = p.map(([x, y]) => `${x},${y}`).join(' ');
  const last = p[p.length - 1];
  return (
    <svg className="kn-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <polyline points={`${p[0][0]},${h} ${line} ${last[0]},${h}`} className="kn-spark-fill" />
      <polyline points={line} className="kn-spark-line" />
      <circle cx={last[0]} cy={last[1]} r="2.4" className="kn-spark-dot" />
    </svg>
  );
}

function WeightPanel({ data, today, onEdit }: { data: KennelData; today: string; onEdit: (w: Weight) => void }) {
  const [dog, setDog] = useState<DogId>('cooper');
  const [lb, setLb] = useState('');
  const [date, setDate] = useState(today);
  const ok = Number(lb) > 0 && date;
  const hist = weightsOf(data.weights, dog).slice().reverse();
  return (
    <section className="panel kn-weight rise" style={rise(5)}>
      <div className="panel-h"><p className="panel-t">Weight</p>
        <div className="seg" role="radiogroup" aria-label="Which dog">
          {DOGS.map((d) => <button key={d.id} role="radio" aria-checked={dog === d.id} onClick={() => setDog(d.id)}>{d.name}</button>)}
        </div>
      </div>
      <div className="kn-wbig">
        <span className="kn-wv">{hist[0] ? hist[0].lb : '—'}<small className="mono"> lb</small></span>
        <Spark data={data} dog={dog} w={200} h={48} />
      </div>
      <form className="kn-add" onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        useKennel.getState().addWeight({ dog, lb: Number(lb), date });
        setLb(''); setDate(today);
      }}>
        <input inputMode="decimal" value={lb} onChange={(e) => setLb(e.target.value.replace(/[^\d.]/g, ''))} placeholder={`${DOGS.find((d) => d.id === dog)!.name}'s weight, lb`} aria-label="Weight in pounds" />
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Weighed on" />
        <button className="btn primary sm" disabled={!ok}>Log</button>
      </form>
      <ul className="kn-list kn-hist">
        {hist.slice(0, 6).map((w) => (
          <Row key={w.id} glyph="⚖" label={`Edit the ${w.lb} lb weigh-in`} onOpen={() => onEdit(w)}>
            <span className="kn-t">{w.lb} lb</span>
            <span className="kn-m mono">{short(w.date)}</span>
          </Row>
        ))}
      </ul>
    </section>
  );
}

function NotesPanel({ data, today, onEdit }: { data: KennelData; today: string; onEdit: (n: Note) => void }) {
  const [who, setWho] = useState<Who>('cooper');
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<DogId | null>(null);
  const shown = notesFor(data.notes, filter ?? undefined);
  return (
    <section className="panel kn-notes rise" style={rise(6)}>
      <div className="panel-h"><p className="panel-t">Moments</p>
        <div className="seg" role="radiogroup" aria-label="Show moments for">
          <button role="radio" aria-checked={filter === null} onClick={() => setFilter(null)}>All</button>
          {DOGS.map((d) => <button key={d.id} role="radio" aria-checked={filter === d.id} onClick={() => setFilter(d.id)}>{d.name}</button>)}
        </div>
      </div>
      <form className="kn-add kn-note-add" onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        useKennel.getState().addNote({ who, text, date: today });
        setText('');
      }}>
        <div className="seg" role="radiogroup" aria-label="About">
          {WHOS.map((w) => <button type="button" key={w} role="radio" aria-checked={who === w} onClick={() => setWho(w)}>{WHO_LABEL[w]}</button>)}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Cooper stole the pancake." aria-label="A moment worth keeping" />
        <button className="btn primary sm" disabled={!text.trim()}>Keep it</button>
      </form>
      {shown.length === 0 && <p className="dim kn-empty">The little things go here, before they're forgotten.</p>}
      <ul className="kn-list kn-moments">
        {shown.map((n) => (
          <Row key={n.id} glyph="❝" label="Edit this moment" onOpen={() => onEdit(n)}>
            <span className="kn-quote">{n.text}</span>
            <span className="kn-m mono">{WHO_LABEL[n.who]} · {short(n.date)}</span>
          </Row>
        ))}
      </ul>
    </section>
  );
}

/** A list row: the whole row opens its record to edit (Remove lives in there, two taps away from a stray thumb). */
function Row({ glyph, children, onOpen, label, className }: { glyph: string; children: ReactNode; onOpen: () => void; label: string; className?: string }) {
  return (
    <li className={className}>
      <button type="button" className="kn-row" onClick={onOpen} aria-label={label}>
        <span className="kn-glyph" aria-hidden>{glyph}</span>
        <span className="kn-b">{children}</span>
        <span className="kn-pen" aria-hidden>✎</span>
      </button>
    </li>
  );
}

function useSheet(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return { ref, close: () => { ref.current?.close(); onClose(); } };
}

/** The sheet's frame: eyebrow, title, fields, then Remove (when editing) on the left and Cancel/Save on the right. */
function KnSheet({ id, eyebrow, title, sub, children, onClose, onSave, ok, saveLabel, onRemove, what }: {
  id: string; eyebrow: string; title: string; sub?: string; children: ReactNode; onClose: () => void;
  onSave: () => void; ok: boolean; saveLabel: string; onRemove?: () => void; what?: string;
}) {
  const { ref, close } = useSheet(onClose);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(t);
  }, [sure]);
  return (
    <dialog ref={ref} className="sheet kn-sheet" onClose={onClose} aria-labelledby={id}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (ok) { onSave(); close(); } }}>
        <div className="page-eyebrow kn-eyebrow">{eyebrow}</div>
        <h2 className="sheet-title" id={id}>{title}</h2>
        {sub && <p className="sheet-src mono">{sub}</p>}
        <div className="kn-fields">{children}</div>
        <div className="sheet-actions kn-actions">
          {onRemove && (sure
            ? <button type="button" className="btn danger-solid kn-rm" onClick={() => { onRemove(); close(); }}>Remove {what ?? 'it'}</button>
            : <button type="button" className="btn danger kn-rm" onClick={() => setSure(true)}>Remove…</button>)}
          <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!ok}>{saveLabel}</button>
        </div>
      </form>
    </dialog>
  );
}

const WhoSeg = ({ value, onChange, label }: { value: Who; onChange: (w: Who) => void; label: string }) => (
  <div className="seg wide kn-seg" role="radiogroup" aria-label={label}>
    {WHOS.map((w) => <button type="button" key={w} role="radio" aria-checked={value === w} onClick={() => onChange(w)}>{WHO_LABEL[w]}</button>)}
  </div>
);

function WalkSheet({ who: initial, walk, today, onClose, onSaved }: { who: Who; walk?: Walk; today: string; onClose: () => void; onSaved: () => void }) {
  const [who, setWho] = useState<Who>(walk?.who ?? initial);
  const [minutes, setMinutes] = useState(String(walk?.minutes ?? 30));
  const [date, setDate] = useState(walk?.date ?? today);
  const [note, setNote] = useState(walk?.note ?? '');
  const ok = Number(minutes) > 0 && Boolean(date);
  const save = () => {
    const s = useKennel.getState();
    if (walk) s.update('walks', { ...walk, who, minutes: Number(minutes), date, note });
    else s.addWalk({ who, minutes: Number(minutes), date, note });
    onSaved();
  };
  return (
    <KnSheet id="kn-walk-t" eyebrow="The Kennel" title={walk ? 'Edit the walk' : 'Log a walk'} sub={walk ? longDate(walk.date) : undefined}
      onClose={onClose} onSave={save} ok={ok} saveLabel={walk ? 'Save' : 'Log the walk'} onRemove={walk ? () => useKennel.getState().remove('walks', walk.id) : undefined} what="walk">
      <WhoSeg value={who} onChange={setWho} label="Who went" />
      <div className="field-row two">
        <label className="field"><span>Minutes</span><input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} autoFocus={!walk} /></label>
        <label className="field"><span>Date</span><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <label className="field"><span>Note</span><textarea className="ruled" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The long loop by the creek; Shadow found a deer trail." /></label>
    </KnSheet>
  );
}

function CareSheet({ care, today, onClose }: { care?: Care; today: string; onClose: () => void }) {
  const [c, setC] = useState<Omit<Care, 'id'>>(() => (care ? { ...care } : { who: 'both', kind: 'vet', date: today }));
  const set = <K extends keyof Care>(key: K, v: Care[K]) => setC((x) => ({ ...x, [key]: v }));
  const problem = careProblem(c);
  const save = () => {
    const s = useKennel.getState();
    if (care) s.update('care', { ...c, id: care.id });
    else s.addCare(c);
  };
  return (
    <KnSheet id="kn-care-t" eyebrow="Vet & care" title={care ? `Edit ${careLabel(care)}` : 'Add a care record'}
      onClose={onClose} onSave={save} ok={!problem} saveLabel={care ? 'Save' : 'Add it'} onRemove={care ? () => useKennel.getState().remove('care', care.id) : undefined} what="record">
      <WhoSeg value={c.who} onChange={(w) => set('who', w)} label="Which dog" />
      <div className="kn-kinds" role="radiogroup" aria-label="Kind">
        {CARE_KINDS.map((x) => (
          <button type="button" key={x.k} role="radio" aria-checked={c.kind === x.k} className="kn-kind" onClick={() => set('kind', x.k)}>
            <span aria-hidden>{x.glyph}</span>{x.label}
          </button>
        ))}
      </div>
      <label className="field"><span>What (optional)</span><input value={c.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder={c.kind === 'vaccine' ? 'Rabies' : c.kind === 'vet' ? 'Annual checkup' : kindOf(c.kind).label} /></label>
      <div className="field-row two">
        <label className="field"><span>Done on</span><input type="date" value={c.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label className="field"><span>Next due</span><input type="date" value={c.nextDue ?? ''} min={c.date} onChange={(e) => set('nextDue', e.target.value || undefined)} /></label>
      </div>
      {problem && c.date && <p className="kn-warn mono">{problem}</p>}
      <label className="field"><span>Note</span><textarea className="ruled" rows={2} value={c.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="Dr. said Cooper's ears look clear." /></label>
    </KnSheet>
  );
}

function WeightSheet({ weight, today, onClose }: { weight: Weight; today: string; onClose: () => void }) {
  const [dog, setDog] = useState<DogId>(weight.dog);
  const [lb, setLb] = useState(String(weight.lb));
  const [date, setDate] = useState(weight.date);
  const ok = Number(lb) > 0 && Boolean(date);
  return (
    <KnSheet id="kn-weight-t" eyebrow="Weight" title="Edit the weigh-in" sub={longDate(weight.date)}
      onClose={onClose} onSave={() => useKennel.getState().update('weights', { ...weight, dog, lb: Number(lb), date })} ok={ok} saveLabel="Save"
      onRemove={() => useKennel.getState().remove('weights', weight.id)} what="weigh-in">
      <div className="seg wide kn-seg" role="radiogroup" aria-label="Which dog">
        {DOGS.map((d) => <button type="button" key={d.id} role="radio" aria-checked={dog === d.id} onClick={() => setDog(d.id)}>{d.name}</button>)}
      </div>
      <div className="field-row two">
        <label className="field"><span>Pounds</span><input inputMode="decimal" value={lb} onChange={(e) => setLb(e.target.value.replace(/[^\d.]/g, ''))} /></label>
        <label className="field"><span>Weighed on</span><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
    </KnSheet>
  );
}

function NoteSheet({ note, today, onClose }: { note: Note; today: string; onClose: () => void }) {
  const [who, setWho] = useState<Who>(note.who);
  const [text, setText] = useState(note.text);
  const [date, setDate] = useState(note.date);
  const ok = Boolean(text.trim()) && Boolean(date);
  return (
    <KnSheet id="kn-note-t" eyebrow="Moments" title="Edit the moment" sub={longDate(note.date)}
      onClose={onClose} onSave={() => useKennel.getState().update('notes', { ...note, who, text, date })} ok={ok} saveLabel="Save"
      onRemove={() => useKennel.getState().remove('notes', note.id)} what="moment">
      <WhoSeg value={who} onChange={setWho} label="About" />
      <label className="field"><span>The moment</span><textarea className="ruled kn-quote-in" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label className="field kn-half"><span>Day</span><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
    </KnSheet>
  );
}
