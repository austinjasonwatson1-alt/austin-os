import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { mondayOf, parseISO, todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { RoomSound } from '../../shell/RoomSound';
import { go } from '../../shell/router';
import { HealthPanel } from '../feeds/FeedsUI';
import { AreaArt } from './AreaArt';
import { JobCountdown, JobHQ } from './JobHQ';
import { AppsPipeline } from './AppsPipeline';
import { BodyTally, ProjectsGallery, ProjectsTally } from './Projects';
import { MoneyPanel } from '../money/MoneyPage';
import { fmtMins } from '../ledger/logic';
import { areaMinutes, areaStreak, areaWeek, daysTo, hearthGlance, money, moneyYear, nextOccurrence } from './logic';
import { AREA_STORES } from './store';
import type { AreaConfig, AreaItem, AreaList } from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/areas.css';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const short = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** One homestead building with its own time and lists. Used for the Office and the Observatory. */
/** Rooms that live inside a building. */
const ALSO: Partial<Record<string, { path: string; glyph: string; name: string }[]>> = {
  forge: [{ path: '/kennel', glyph: '🐾', name: 'The Kennel · Cooper & Shadow' }],
};

export function AreaPage({ config }: { config: AreaConfig }) {
  const useArea = AREA_STORES[config.id];
  const a = useArea();
  useEffect(() => { void a.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const day = a.days[today] ?? {};
  const mins = areaMinutes(day);
  const week = areaWeek(a.days, mondayOf(today));
  const weekTotal = week.reduce((s, d) => s + d.total, 0);
  const top = Math.max(60, ...week.map((d) => d.total));
  const streak = areaStreak(a.days, today);
  const heroRef = useRef<HTMLDivElement>(null);

  if (!a.loaded) return null;
  return (
    <div className={`home area area-${config.id}`} style={{ '--ac': config.accent } as CSSProperties}>
      <section className="area-hero rise" style={rise(0)} ref={heroRef}>
        <AreaArt id={config.id} heat={Math.min(1, mins / config.fullDay)} />
        <div className="area-copy">
          <div className="page-eyebrow">The Homestead · {config.name}</div>
          <h1 className="hero-title">The<br /><em>{config.word}</em></h1>
          <p className="hero-line">{config.lede}</p>
          <div style={{ marginBottom: 14 }}><RoomSound kind={({ office: 'room', observatory: 'wind', forge: 'fire', bank: 'room', hearth: 'fire' } as const)[config.id]} label={({ office: 'a quiet office', observatory: 'wind on the dome', forge: 'the forge fire', bank: 'a quiet room', hearth: 'the hearth fire' } as const)[config.id]} /></div>
          {config.kinds.length > 0 && <div className="area-log">
            {config.kinds.map((k) => (
              <div key={k.k} className="clog" style={{ '--kc': k.color } as CSSProperties}>
                <span className="clog-n">{k.label}</span>
                <span className="clog-v"><b>{fmtMins(day[k.k] ?? 0)}</b></span>
                <span className="clog-b">
                  {[15, 30, 60].map((n) => (
                    <button key={n} onClick={() => { if (!mins) embers(heroRef.current, 8); a.setMinutes(today, k.k, (day[k.k] ?? 0) + n); }}>+{n}</button>
                  ))}
                  {(day[k.k] ?? 0) > 0 && <button className="clog-undo" aria-label={`Clear ${k.label} for today`} onClick={() => a.setMinutes(today, k.k, 0)}>↺</button>}
                </span>
              </div>
            ))}
          </div>}
        </div>
        {config.id === 'hearth' ? <HearthTally items={a.items} days={a.days} today={today} /> : config.kinds.length > 0 ? <div className="area-today">
          <span className="big">{mins ? <CountUp value={mins} format={fmtMins} /> : '—'}</span>
          <span className="mono">today</span>
          <span className="mono faint">{fmtMins(weekTotal)} this week{streak > 1 ? ` · ${streak}-day streak` : ''}</span>
        </div> : config.id === 'office' ? <JobCountdown /> : config.id === 'observatory' ? <ProjectsTally /> : config.id === 'forge' ? <BodyTally /> : <MoneySummary config={config} items={a.items} />}
      </section>

      {config.kinds.length > 0 && <section className="panel area-week rise" style={rise(1)}>
        <div className="panel-h"><p className="panel-t">This week</p>
          <span className="area-legend mono">{config.kinds.map((k) => <span key={k.k}><i style={{ background: k.color }} />{k.label}</span>)}</span>
        </div>
        <div className="aw">
          {week.map((d, i) => (
            <div key={d.date} className={`aw-d${d.date === today ? ' today' : ''}${d.date > today ? ' future' : ''}`} title={`${d.date}: ${fmtMins(d.total)}`}>
              <span className="aw-v mono">{d.total ? fmtMins(d.total) : ''}</span>
              <span className="aw-bar">
                {config.kinds.map((k) => d.byKind[k.k] ? <span key={k.k} style={{ height: `${(d.byKind[k.k] / top) * 100}%`, background: k.color }} /> : null)}
              </span>
              <span className="aw-n mono">{DOW[i]}</span>
            </div>
          ))}
        </div>
      </section>}

      {ALSO[config.id] && (
        <nav className="also-here rise" style={rise(1)} aria-label={`Also in ${config.name}`}>
          <span className="mono">Also here</span>
          {ALSO[config.id]!.map((r) => <button key={r.path} className="also-room" onClick={() => go(r.path)}><span aria-hidden>{r.glyph}</span>{r.name}<span aria-hidden>→</span></button>)}
        </nav>
      )}
      {config.id === 'office' && <><JobHQ /><AppsPipeline /></>}
      {config.id === 'observatory' && <ProjectsGallery />}
      {config.id === 'forge' && <HealthPanel />}
      {config.id === 'bank' && <MoneyPanel startIndex={2} />}
      <div className="area-lists">
        {config.lists.map((l, i) => <ListPanel key={l.id} list={l} items={a.items.filter((x) => x.list === l.id)} config={config} delay={2 + i} />)}
      </div>
    </div>
  );
}

function ListPanel({ list, items, config, delay }: { list: AreaList; items: AreaItem[]; config: AreaConfig; delay: number }) {
  const a = AREA_STORES[config.id].getState();
  const today = todayISO();
  const [text, setText] = useState('');
  const [body, setBody] = useState('');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState('');
  const ok = text.trim() && (!list.amount || Number(amount) > 0) && (!list.when || !list.yearly || when);
  // Dated lists sort by when they come round next; others newest first, done at the bottom.
  const sorted = list.when
    ? [...items].sort((x, y) => (x.when ? daysTo(nextOccurrence(x.when, today, Boolean(list.yearly)), today) : 9e9) - (y.when ? daysTo(nextOccurrence(y.when, today, Boolean(list.yearly)), today) : 9e9))
    : [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
  const total = list.amount ? items.filter((i) => (i.when ?? i.date).startsWith(today.slice(0, 4))).reduce((t, i) => t + (i.amount ?? 0), 0) : 0;
  return (
    <section className="panel area-list rise" style={rise(delay)}>
      <div className="panel-h">
        <p className="panel-t">{list.title}</p>
        <span className="mono faint" style={{ fontSize: 11 }}>{list.amount ? `${money(total)} this year` : items.length || ''}</span>
      </div>
      <form className="al-add" onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        a.addItem(list.id, text, { body, amount: list.amount ? Number(amount) : undefined, when: list.when && when ? when : undefined });
        setText(''); setBody(''); setAmount(''); setWhen('');
      }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={list.placeholder} aria-label={`Add to ${list.title}`} />
        {list.amount && <input className="al-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="$" aria-label="Amount" />}
        {list.when && <input className="al-when" type="date" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date" />}
        {list.body && text && <textarea className="ruled" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" />}
        <button className="btn primary sm" disabled={!ok}>Add</button>
      </form>
      {items.length === 0 && <p className="dim" style={{ fontSize: 13.5, margin: 0 }}>{list.empty}</p>}
      <ul className="al">
        {sorted.map((i) => <Item key={i.id} i={i} list={list} config={config} />)}
      </ul>
    </section>
  );
}

function Item({ i, list, config }: { i: AreaItem; list: AreaList; config: AreaConfig }) {
  const a = AREA_STORES[config.id].getState();
  const [sure, setSure] = useState(false);
  const today = todayISO();
  const check = list.check !== false;
  const next = i.when ? nextOccurrence(i.when, today, Boolean(list.yearly)) : null;
  const left = next ? daysTo(next, today) : null;
  return (
    <li className={`${i.done ? 'done' : ''}${check ? '' : ' nocheck'}`}>
      {check ? (
        <button className="al-check" aria-label={i.done ? 'Mark not done' : 'Mark done'} aria-pressed={Boolean(i.done)}
          onClick={(e) => { if (!i.done) embers(e.currentTarget, 8); a.patchItem(i.id, { done: !i.done, progress: !i.done && list.progress ? 100 : i.progress }); }}>{i.done ? '\u2713' : ''}</button>
      ) : <span className="al-bullet" aria-hidden>{list.amount ? (list.sign === 1 ? '+' : '\u2212') : list.yearly ? '\u2665' : '\u2726'}</span>}
      <div className="al-b">
        <span className="al-t">{i.text}{list.amount && i.amount ? <b className={`al-money ${list.sign === 1 ? 'in' : 'out'}`}>{money(i.amount)}</b> : null}</span>
        {i.body && <span className="al-body">{i.body}</span>}
        {list.progress && (
          <span className="al-prog">
            <input type="range" min={0} max={100} step={5} value={i.progress ?? 0} aria-label={`${i.text} progress`}
              onChange={(e) => a.patchItem(i.id, { progress: Number(e.target.value), done: Number(e.target.value) >= 100 })} style={{ '--p': `${i.progress ?? 0}%` } as CSSProperties} />
            <span className="mono">{i.progress ?? 0}%</span>
          </span>
        )}
        <span className="al-m mono">
          {next && left !== null ? (left === 0 ? 'today! ' : left > 0 ? `in ${left} day${left === 1 ? '' : 's'} \u00b7 ${short(next)} ` : `${short(next)} \u00b7 passed `) : `${short(i.date)} `}
        </span>
      </div>
      {sure
        ? <button className="btn danger sm" onClick={() => a.removeItem(i.id)}>Remove</button>
        : <button className="btn ghost sm" aria-label="Remove" onClick={() => setSure(true)}>✕</button>}
    </li>
  );
}

/** The Hearth's hero side: the next date that matters, time together, the last moment kept. */
function HearthTally({ items, days, today }: { items: AreaItem[]; days: Record<string, Record<string, number>>; today: string }) {
  const g = hearthGlance(items, days, today, mondayOf(today));
  const ago = (n: number) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);
  const together = `${g.weekMins ? fmtMins(g.weekMins) : 'No time'} together this week`;
  return (
    <div className="area-today pj-tally hearth-tally">
      {g.next ? (
        <>
          <span className="big">{g.next.in === 0 ? '♥' : <CountUp value={g.next.in} />}</span>
          <span className="mono">{g.next.in === 0 ? `Today: ${g.next.text}` : `${g.next.in === 1 ? 'day' : 'days'} to ${g.next.text}`}</span>
          <span className="mono faint">{g.next.also ? `${g.next.also} more this month · ` : ''}{together}</span>
        </>
      ) : (
        <>
          <span className="big">{g.weekMins ? <CountUp value={g.weekMins} format={fmtMins} /> : '—'}</span>
          <span className="mono">together this week</span>
          <span className="mono faint">Add a birthday below and the next one shows here</span>
        </>
      )}
      {g.lastMoment && <span className="hearth-moment">“{g.lastMoment.text}” <i className="mono">kept {ago(g.lastMoment.ago)}</i></span>}
    </div>
  );
}

function MoneySummary({ config, items }: { config: AreaConfig; items: AreaItem[] }) {
  const y = Number(todayISO().slice(0, 4));
  const signs = Object.fromEntries(config.lists.filter((l) => l.sign).map((l) => [l.id, l.sign!])) as Record<string, 1 | -1>;
  const m = moneyYear(items, signs, y);
  return (
    <div className="area-today money-sum">
      <span className={`big ${m.net >= 0 ? 'g-good' : ''}`}>{money(m.net)}</span>
      <span className="mono">net in {y}</span>
      <span className="mono faint">{money(m.in)} in · {money(m.out)} out</span>
    </div>
  );
}
