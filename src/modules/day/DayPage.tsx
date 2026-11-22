import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addDays, parseISO, prettyDate } from '../../core/dates';
import { CountUp, embers, tilt } from '../../shell/fx';
import { greeting, rise } from '../../shell/lamp';
import { LIFE_AREAS } from '../life/logic';
import { AREA, carryOver, closeable, dayScore, daysLabel, entryOf, habitChain, habitsFor, historyStrip, nextState, phase, unusedStarters, type Phase, type StripDay } from './logic';
import { AreaMark, Chain, Lantern, STATE_GLYPH, areaColor, stateTitle, useNow } from './parts';
import { useDay } from './store';
import { MorningBrief } from './Brief';
import { EVERY_DAY, STARTERS, STATE_LABEL, type DayEntry, type Habit, type IntentionState, type LifeArea } from './types';
import '../../styles/cabin.css';
import '../../styles/day.css';

const TITLE: Record<Phase, [string, string]> = { morning: ['Set the', 'day.'], day: ['Hold the', 'day.'], evening: ['Close the', 'day.'] };
const LINE: Record<Phase, string> = {
  morning: 'One intention for each part of life, if it wants one. Then the small things, done again.',
  day: 'What you meant to do, and the little lanterns that keep the chain lit.',
  evening: 'Mark what was kept, write two lines, and bank the fire for tomorrow.',
};
const PLACEHOLDER: Record<LifeArea, string> = {
  writing: 'Finish chapter 7',
  faith: 'Morning prayer, Psalm 23',
  work: 'Ship the roadmap draft',
  learning: 'One lecture on transformers',
  body: 'Walk Cooper & Shadow, 3 miles',
  family: 'Call Mom',
};
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const clock = (isoTs: string) => new Date(isoTs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function DayPage() {
  const s = useDay();
  useEffect(() => { void s.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { now, today } = useNow();
  const ph = phase(now);
  const entry = entryOf(s.days, today);
  const habits = habitsFor(s.habits, entry, today);
  const doneN = habits.filter((h) => entry.done.includes(h.id)).length;
  const kept = entry.intentions.filter((i) => i.state === 'kept').length;
  const [t1, t2] = entry.closedAt ? ['The day is', 'sealed.'] : TITLE[ph];

  if (!s.loaded) return null;
  return (
    <div className={`home dayp ph-${ph}`}>
      <section className="hero day-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · The Day</div>
          <h1 className="hero-title">{t1}<br /><em>{t2}</em></h1>
          <p className="hero-line"><span className="day-greet">{greeting(now.getHours())}.</span> {entry.closedAt ? 'Marked, written down, and banked. Rest; tomorrow lights itself.' : LINE[ph]}</p>
          <div className="day-date mono">{prettyDate(today)}</div>
        </div>
        <div className="day-dial" aria-label={`${doneN} of ${habits.length} habits done, ${kept} of ${entry.intentions.length} intentions kept`}>
          <div className={entry.closedAt ? 'day-dial-lamp sealed' : 'day-dial-lamp'}>
            <Lantern lit={doneN > 0 || kept > 0} size={58} />
          </div>
          <div className="day-dial-stats">
            <span><b><CountUp value={doneN} /></b><i className="mono">/{habits.length}</i><em className="mono">habits</em></span>
            <span><b><CountUp value={kept} /></b><i className="mono">/{entry.intentions.length}</i><em className="mono">kept</em></span>
          </div>
          {entry.closedAt && <span className="day-sealed-tag mono">Sealed {clock(entry.closedAt)}</span>}
        </div>
      </section>

      <MorningBrief today={today} />

      <div className="day-grid">
        <Intentions day={today} entry={entry} ph={ph} />
        <HabitsToday day={today} entry={entry} habits={habits} />
      </div>
      <EveningClose day={today} entry={entry} prominent={ph === 'evening'} />
      <History today={today} />
      <HabitManager today={today} />
    </div>
  );
}

/* ---------------- the morning: set the day / today's intentions ---------------- */

function Intentions({ day, entry, ph }: { day: string; entry: DayEntry; ph: Phase }) {
  const [editing, setEditing] = useState(false);
  const has = entry.intentions.length > 0;
  if (!has || editing) return <SetTheDay day={day} entry={entry} ph={ph} onDone={() => setEditing(false)} canCancel={has} />;
  const score = dayScore(entry) ?? 0;
  return (
    <section className="panel day-ints rise" style={rise(1)}>
      <div className="panel-h">
        <p className="panel-t">Today’s intentions</p>
        <button className="btn ghost sm" onClick={() => setEditing(true)} disabled={Boolean(entry.closedAt)}>Edit the day</button>
      </div>
      <div className="int-meter" role="img" aria-label={`${Math.round(score * 100)}% kept`}><span style={{ width: `${score * 100}%` }} /></div>
      <ul className="int-list">
        {entry.intentions.map((i) => <IntentionRow key={i.area} day={day} area={i.area} text={i.text} state={i.state} locked={Boolean(entry.closedAt)} />)}
      </ul>
      <p className="int-hint mono faint">Tap the mark to cycle · kept · partly · not</p>
    </section>
  );
}

function IntentionRow({ day, area, text, state, locked }: { day: string; area: LifeArea; text: string; state?: IntentionState; locked?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const cycle = () => {
    const next = nextState(state);
    if (next === 'kept') embers(ref.current, 8);
    useDay.getState().mark(day, area, next);
  };
  return (
    <li className={`int-row st-${state ?? 'open'}`} style={{ '--ac': AREA[area].color } as CSSProperties}>
      <AreaMark area={area} />
      <span className="int-text"><span className="int-place mono">{AREA[area].place}</span>{text}</span>
      <button ref={ref} className="int-mark" onClick={cycle} disabled={locked} title={stateTitle(state)} aria-label={`${text}: ${stateTitle(state)}. Tap to change.`}>
        <span aria-hidden>{state ? STATE_GLYPH[state] : '◌'}</span>
        <span className="int-mark-l mono">{state ? STATE_LABEL[state] : 'Mark'}</span>
      </button>
    </li>
  );
}

function SetTheDay({ day, entry, ph, onDone, canCancel }: { day: string; entry: DayEntry; ph: Phase; onDone: () => void; canCancel: boolean }) {
  const [lines, setLines] = useState<Partial<Record<LifeArea, string>>>(() => Object.fromEntries(entry.intentions.map((i) => [i.area, i.text])));
  const btn = useRef<HTMLButtonElement>(null);
  const filled = LIFE_AREAS.filter((a) => lines[a.id]?.trim()).length;
  const save = () => {
    useDay.getState().setDay(day, lines);
    if (filled) embers(btn.current, 14);
    onDone();
  };
  return (
    <section className={`panel setday rise${ph === 'morning' ? ' is-morning' : ''}`} style={rise(1)}>
      <div className="panel-h">
        <p className="panel-t">{ph === 'morning' ? 'This morning' : 'Today'} · set the day</p>
        <span className="mono faint">{filled}/6 · skip any</span>
      </div>
      <form className="setday-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {LIFE_AREAS.map((a, i) => (
          <label key={a.id} className={lines[a.id]?.trim() ? 'sd-card on' : 'sd-card'} style={{ '--ac': a.color, '--j': i } as CSSProperties} {...tilt(4)}>
            <span className="sd-top"><AreaMark area={a.id} /><span className="sd-place mono">{a.place}</span></span>
            <input value={lines[a.id] ?? ''} maxLength={120} placeholder={PLACEHOLDER[a.id]} aria-label={`${a.place}: today's intention`}
              onChange={(e) => setLines((l) => ({ ...l, [a.id]: e.target.value }))} />
          </label>
        ))}
        <div className="setday-actions">
          {canCancel && <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>}
          <button ref={btn} className="btn primary" disabled={!filled && !canCancel}>{canCancel ? 'Keep these' : 'Light the day'}</button>
        </div>
      </form>
    </section>
  );
}

/* ---------------- habits for today ---------------- */

function HabitsToday({ day, entry, habits }: { day: string; entry: DayEntry; habits: Habit[] }) {
  const all = useDay((s) => s.days);
  const n = useDay((s) => s.habits.length);
  return (
    <section className="panel day-habits rise" style={rise(2)}>
      <div className="panel-h">
        <p className="panel-t">The lanterns · today</p>
        <span className="mono faint">{habits.filter((h) => entry.done.includes(h.id)).length}/{habits.length} lit</span>
      </div>
      {habits.length === 0 && (
        <div className="habits-empty">
          <p>{n ? 'Nothing due today. Rest is a habit too.' : 'No habits yet.'}</p>
          {!n && <a className="mono linkish" href="#habit-manager" onClick={(e) => { e.preventDefault(); document.getElementById('habit-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Hang the first lantern ↓</a>}
        </div>
      )}
      <ul className="hab-list">
        {habits.map((h) => <HabitRow key={h.id} h={h} day={day} done={entry.done.includes(h.id)} days={all} />)}
      </ul>
    </section>
  );
}

function HabitRow({ h, day, done, days }: { h: Habit; day: string; done: boolean; days: Record<string, DayEntry> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const chain = useMemo(() => habitChain(h, days, day), [h, days, day]);
  const toggle = () => { if (useDay.getState().toggleHabit(day, h.id)) embers(ref.current, 12); };
  return (
    <li className={done ? 'hab-row done' : 'hab-row'} style={{ '--ac': areaColor(h.area) } as CSSProperties}>
      <button ref={ref} className="hab-check" onClick={toggle} aria-pressed={done} aria-label={`${h.name}: ${done ? 'done' : 'not done'}`}>
        <Lantern lit={done} color={h.area ? AREA[h.area].color : undefined} size={26} />
      </button>
      <div className="hab-body">
        <div className="hab-name">{h.name}</div>
        <Chain links={chain.last14} today={day} color={h.area ? AREA[h.area].color : undefined} />
      </div>
      <div className="hab-streak" title={`Best: ${chain.best}`}>
        <b><CountUp value={chain.current} ms={500} /></b>
        <span className="mono faint">best {chain.best}</span>
      </div>
    </li>
  );
}

/* ---------------- the evening close ---------------- */

function EveningClose({ day, entry, prominent }: { day: string; entry: DayEntry; prominent: boolean }) {
  const seal = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const st = useDay.getState();
  const carried = carryOver(entry);
  const tomorrow = entryOf(useDay((s) => s.days), addDays(day, 1));
  const ok = closeable(entry);
  const unmarked = entry.intentions.filter((i) => !i.state).length;
  const score = dayScore(entry);

  const close = () => {
    st.closeDay(day);
    embers(seal.current, 26);
    embers(box.current, 14);
  };
  const carry = () => {
    const n = st.carryToTomorrow(day);
    setNote(n ? `${n} carried to tomorrow.` : 'Tomorrow already has those areas set.');
  };
  const carryPending = carried.filter((c) => !tomorrow.intentions.some((t) => t.area === c.area)).length;

  if (entry.closedAt) {
    return (
      <section ref={box} className="panel eclose sealed rise" style={rise(3)}>
        <div className="eclose-embers" aria-hidden><i /><i /><i /><i /><i /></div>
        <div className="panel-h">
          <p className="panel-t">The day is sealed · {clock(entry.closedAt)}</p>
          <button className="btn ghost sm" onClick={() => st.reopenDay(day)}>Reopen</button>
        </div>
        <div className="sealed-body">
          {score !== null && <div className="sealed-score"><b>{Math.round(score * 100)}%</b><span className="mono faint">kept</span></div>}
          <div className="sealed-lines">
            {entry.well && <p><span className="mono">Went well</span>{entry.well}</p>}
            {entry.carry && <p><span className="mono">Carrying</span>{entry.carry}</p>}
            {!entry.well && !entry.carry && <p className="faint">Sealed without words. That’s allowed.</p>}
          </div>
        </div>
        {carryPending > 0 && <div className="eclose-carry"><button className="btn sm" onClick={carry}>Carry {carryPending} unkept to tomorrow →</button>{note && <span className="mono faint">{note}</span>}</div>}
      </section>
    );
  }

  return (
    <section ref={box} className={`panel eclose rise${prominent ? ' prominent' : ''}`} style={rise(3)}>
      <div className="panel-h">
        <p className="panel-t">The evening close</p>
        <span className="mono faint">{prominent ? 'Bank the fire' : 'Available any time'}</span>
      </div>
      {entry.intentions.length > 0 && (
        <ul className="ec-list">
          {entry.intentions.map((i) => (
            <li key={i.area} style={{ '--ac': AREA[i.area].color } as CSSProperties}>
              <AreaMark area={i.area} size="sm" />
              <span className="ec-text">{i.text}</span>
              <div className="seg ec-seg" role="radiogroup" aria-label={`How did “${i.text}” go?`}>
                {(['kept', 'partly', 'not'] as IntentionState[]).map((k) => (
                  <button key={k} role="radio" aria-checked={i.state === k} className={`ec-${k}`}
                    onClick={() => st.mark(day, i.area, i.state === k ? undefined : k)}>{STATE_LABEL[k]}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="ec-reflect">
        <label className="ec-line">
          <span className="mono">What went well</span>
          <input value={entry.well ?? ''} maxLength={200} placeholder="The chapter finally turned." onChange={(e) => st.reflect(day, { well: e.target.value })} />
        </label>
        <label className="ec-line">
          <span className="mono">What I’ll carry into tomorrow</span>
          <input value={entry.carry ?? ''} maxLength={200} placeholder="Start with the hard scene." onChange={(e) => st.reflect(day, { carry: e.target.value })} />
        </label>
      </div>
      <div className="ec-actions">
        {carryPending > 0 && <button className="btn sm" onClick={carry}>Carry {carryPending} unkept to tomorrow →</button>}
        {note && <span className="mono faint">{note}</span>}
        <span className="ec-why mono faint">{unmarked ? `Mark ${unmarked} more to close` : !ok ? 'Nothing in the day yet' : ''}</span>
        <button ref={seal} className="btn primary ec-seal" disabled={!ok} onClick={close}>Close the day</button>
      </div>
    </section>
  );
}

/* ---------------- history ---------------- */

function History({ today }: { today: string }) {
  const days = useDay((s) => s.days);
  const habits = useDay((s) => s.habits);
  const strip = useMemo(() => historyStrip({ days, habits }, today), [days, habits, today]);
  const [open, setOpen] = useState<string | null>(null);
  const closed = strip.filter((d) => d.closed).length;
  return (
    <section className="panel day-hist rise" style={rise(4)}>
      <div className="panel-h">
        <p className="panel-t">The last thirty days</p>
        <span className="mono faint">{closed} sealed</span>
      </div>
      <div className="hist" role="list">
        {strip.map((d) => <HistCell key={d.day} d={d} today={today} onOpen={() => setOpen(d.day)} />)}
      </div>
      <div className="hist-legend mono faint"><span><i className="hl-fill" />intentions kept</span><span><i className="hl-dot" />habit done</span><span><i className="hl-seal" />sealed</span></div>
      {open && <DaySheet day={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function HistCell({ d, today, onOpen }: { d: StripDay; today: string; onOpen: () => void }) {
  const date = parseISO(d.day);
  const label = `${prettyDate(d.day)}: ${d.score === null ? 'no intentions' : `${Math.round(d.score * 100)}% kept`}, ${d.done} habit${d.done === 1 ? '' : 's'}${d.closed ? ', sealed' : ''}`;
  const empty = d.score === null && !d.done && !d.closed;
  return (
    <button role="listitem" className={`hcell${d.day === today ? ' today' : ''}${empty ? ' empty' : ''}${d.closed ? ' closed' : ''}`} onClick={onOpen} title={label} aria-label={label}>
      <span className="hcell-wd mono">{WD[date.getDay()]}</span>
      <span className="hcell-jar"><span className="hcell-fill" style={{ height: `${(d.score ?? 0) * 100}%` }} /></span>
      <span className="hcell-dots">{Array.from({ length: Math.min(d.done, 4) }, (_, i) => <i key={i} />)}{d.done > 4 && <b>+</b>}</span>
      <span className="hcell-n mono">{date.getDate()}</span>
    </button>
  );
}

function DaySheet({ day, onClose }: { day: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const e = entryOf(useDay((s) => s.days), day);
  const habits = useDay((s) => s.habits);
  useEffect(() => { ref.current?.showModal(); }, []);
  const score = dayScore(e);
  const done = e.done.map((id) => habits.find((h) => h.id === id)).filter((h): h is Habit => Boolean(h));
  return (
    <dialog ref={ref} className="sheet day-sheet" onClose={onClose} aria-labelledby="day-sheet-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{e.closedAt ? `Sealed at ${clock(e.closedAt)}` : 'Read back'}</div>
      <h2 id="day-sheet-t" className="sheet-title">{prettyDate(day)}</h2>
      <p className="sheet-src mono">{score === null ? 'No intentions set' : `${Math.round(score * 100)}% of intentions kept`} · {done.length} habit{done.length === 1 ? '' : 's'} done</p>
      {e.intentions.length > 0 && (
        <ul className="ds-ints">
          {e.intentions.map((i) => (
            <li key={i.area} className={`st-${i.state ?? 'open'}`} style={{ '--ac': AREA[i.area].color } as CSSProperties}>
              <AreaMark area={i.area} size="sm" /><span>{i.text}</span><em className="mono">{i.state ? STATE_LABEL[i.state] : 'unmarked'}</em>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && <div className="ds-habs">{done.map((h) => <span key={h.id} className="hchip on" style={{ '--ac': areaColor(h.area) } as CSSProperties}><Lantern lit size={12} color={h.area ? AREA[h.area].color : undefined} />{h.name}</span>)}</div>}
      {(e.well || e.carry) && (
        <div className="sealed-lines ds-lines">
          {e.well && <p><span className="mono">Went well</span>{e.well}</p>}
          {e.carry && <p><span className="mono">Carrying</span>{e.carry}</p>}
        </div>
      )}
      {!e.intentions.length && !done.length && !e.well && !e.carry && <p className="dim">A quiet day: nothing written down.</p>}
      <div className="sheet-actions"><button className="btn ghost" onClick={() => ref.current?.close()}>Close</button></div>
    </dialog>
  );
}

/* ---------------- the habit manager ---------------- */

function HabitManager({ today }: { today: string }) {
  const habits = useDay((s) => s.habits);
  const days = useDay((s) => s.days);
  const [open, setOpen] = useState<Habit | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const starters = unusedStarters(STARTERS, habits);
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const add = (name: string, area?: LifeArea, el?: HTMLElement | null) => {
    // A double tap must not hang the same starter twice.
    if (!unusedStarters([{ name }], useDay.getState().habits).length) return;
    useDay.getState().saveHabit({ name, area, days: [...EVERY_DAY] });
    embers(el ?? null, 8);
  };
  return (
    <section id="habit-manager" className="panel day-mgr rise" style={rise(5)}>
      <div className="panel-h">
        <p className="panel-t">Habits · {active.length} hung</p>
        <button className="btn sm" onClick={() => setOpen('new')}>+ New habit</button>
      </div>
      {starters.length > 0 && (
        <div className="starters">
          <span className="mono faint">Starters · one tap</span>
          {starters.map((st) => (
            <button key={st.name} className="hchip" style={{ '--ac': areaColor(st.area) } as CSSProperties} onClick={(e) => add(st.name, st.area, e.currentTarget)}>
              <span aria-hidden>{st.area ? AREA[st.area].glyph : '+'}</span>{st.name}
            </button>
          ))}
        </div>
      )}
      <ul className="mgr-list">
        {active.map((h) => <MgrRow key={h.id} h={h} today={today} days={days} onEdit={() => setOpen(h)} />)}
        {!active.length && <li className="mgr-empty dim">Nothing hung yet. Tap a starter, or make your own.</li>}
      </ul>
      {archived.length > 0 && (
        <>
          <button className="btn ghost sm mgr-toggle" onClick={() => setShowArchived((x) => !x)} aria-expanded={showArchived}>
            {showArchived ? '▾' : '▸'} Put away · {archived.length}
          </button>
          {showArchived && <ul className="mgr-list archived">{archived.map((h) => <MgrRow key={h.id} h={h} today={today} days={days} onEdit={() => setOpen(h)} />)}</ul>}
        </>
      )}
      {open && <HabitSheet habit={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function MgrRow({ h, today, days, onEdit }: { h: Habit; today: string; days: Record<string, DayEntry>; onEdit: () => void }) {
  const c = useMemo(() => habitChain(h, days, today), [h, days, today]);
  return (
    <li className="mgr-row" style={{ '--ac': areaColor(h.area) } as CSSProperties}>
      <AreaMark area={h.area} size="sm" />
      <span className="mgr-name">{h.name}<span className="mono faint">{daysLabel(h.days)}{h.area ? ` · ${AREA[h.area].place}` : ''}</span></span>
      <span className="mgr-best mono faint">{h.archived ? 'put away' : `${c.current} now · best ${c.best}`}</span>
      <span className="mgr-btns">
        <button className="btn ghost sm" onClick={onEdit}>Edit</button>
        <button className="btn ghost sm" onClick={() => useDay.getState().setArchived(h.id, !h.archived)}>{h.archived ? 'Hang again' : 'Put away'}</button>
      </span>
    </li>
  );
}

function HabitSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(habit?.name ?? '');
  const [area, setArea] = useState<LifeArea | undefined>(habit?.area);
  const [wd, setWd] = useState<number[]>(habit?.days?.length ? habit.days : [...EVERY_DAY]);
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); };
  const ok = name.trim() && wd.length > 0;
  const save = () => {
    if (!ok) return;
    useDay.getState().saveHabit({ ...(habit ?? {}), name, area, days: [...wd].sort() });
    close();
  };
  const toggleDay = (d: number) => setWd((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  return (
    <dialog ref={ref} className="sheet habit-sheet" onClose={onClose} aria-labelledby="habit-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{habit ? 'A lantern on the line' : 'Hang a new lantern'}</div>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="hs-form">
        <label className="field"><span>Habit</span><input id="habit-t" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus={!habit} placeholder="Scripture reading" /></label>
        <div className="field">
          <span>Part of life</span>
          <div className="hs-areas" role="radiogroup" aria-label="Area">
            <button type="button" role="radio" aria-checked={!area} className="hchip" onClick={() => setArea(undefined)}>None</button>
            {LIFE_AREAS.map((a) => (
              <button type="button" key={a.id} role="radio" aria-checked={area === a.id} className="hchip" style={{ '--ac': a.color } as CSSProperties} onClick={() => setArea(a.id)}>
                <span aria-hidden>{a.glyph}</span>{a.place.replace('The ', '')}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Which days · {daysLabel(wd)}</span>
          <div className="hs-days">
            {WD.map((l, i) => (
              <button type="button" key={i} aria-pressed={wd.includes(i)} aria-label={WD_LONG[i]} onClick={() => toggleDay(i)}>{l}</button>
            ))}
            <button type="button" className="hs-preset mono" onClick={() => setWd([...EVERY_DAY])}>every day</button>
            <button type="button" className="hs-preset mono" onClick={() => setWd([1, 2, 3, 4, 5])}>weekdays</button>
          </div>
        </div>
        {habit && <p className="mono faint hs-note">Past days keep their record whatever you change here.</p>}
        <div className="sheet-actions">
          {habit && (sure
            ? <button type="button" className="btn danger" onClick={() => { useDay.getState().removeHabit(habit.id); close(); }}>Delete it (past days stay)</button>
            : <button type="button" className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Delete…</button>)}
          <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={!ok}>{habit ? 'Save' : 'Hang it'}</button>
        </div>
      </form>
    </dialog>
  );
}
