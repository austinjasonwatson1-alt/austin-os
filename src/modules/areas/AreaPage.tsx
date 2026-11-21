import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { mondayOf, parseISO, todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { fmtMins } from '../ledger/logic';
import { areaMinutes, areaStreak, areaWeek } from './logic';
import { AREA_STORES } from './store';
import type { AreaConfig, AreaItem, AreaList } from './types';
import '../../styles/cabin.css';
import '../../styles/ledger.css';
import '../../styles/areas.css';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const short = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** One homestead building with its own time and lists. Used for the Office and the Observatory. */
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
          <div className="area-log">
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
          </div>
        </div>
        <div className="area-today">
          <span className="big">{mins ? <CountUp value={mins} format={fmtMins} /> : '—'}</span>
          <span className="mono">today</span>
          <span className="mono faint">{fmtMins(weekTotal)} this week{streak > 1 ? ` · ${streak}-day streak` : ''}</span>
        </div>
      </section>

      <section className="panel area-week rise" style={rise(1)}>
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
      </section>

      <div className="area-lists">
        {config.lists.map((l, i) => <ListPanel key={l.id} list={l} items={a.items.filter((x) => x.list === l.id)} config={config} delay={2 + i} />)}
      </div>
    </div>
  );
}

function ListPanel({ list, items, config, delay }: { list: AreaList; items: AreaItem[]; config: AreaConfig; delay: number }) {
  const a = AREA_STORES[config.id].getState();
  const [text, setText] = useState('');
  const [body, setBody] = useState('');
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  return (
    <section className="panel area-list rise" style={rise(delay)}>
      <div className="panel-h"><p className="panel-t">{list.title}</p><span className="mono faint" style={{ fontSize: 11 }}>{items.length || ''}</span></div>
      <form className="al-add" onSubmit={(e) => { e.preventDefault(); a.addItem(list.id, text, body); setText(''); setBody(''); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={list.placeholder} aria-label={`Add to ${list.title}`} />
        {list.body && text && <textarea className="ruled" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" />}
        <button className="btn primary sm" disabled={!text.trim()}>Add</button>
      </form>
      {items.length === 0 && <p className="dim" style={{ fontSize: 13.5, margin: 0 }}>{list.empty}</p>}
      <ul className="al">
        {[...open, ...done].map((i) => <Item key={i.id} i={i} list={list} config={config} />)}
      </ul>
    </section>
  );
}

function Item({ i, list, config }: { i: AreaItem; list: AreaList; config: AreaConfig }) {
  const a = AREA_STORES[config.id].getState();
  const [sure, setSure] = useState(false);
  return (
    <li className={i.done ? 'done' : ''}>
      <button className="al-check" aria-label={i.done ? 'Mark not done' : 'Mark done'} aria-pressed={Boolean(i.done)}
        onClick={(e) => { if (!i.done) embers(e.currentTarget, 8); a.patchItem(i.id, { done: !i.done, progress: !i.done && list.progress ? 100 : i.progress }); }}>{i.done ? '✓' : ''}</button>
      <div className="al-b">
        <span className="al-t">{i.text}</span>
        {i.body && <span className="al-body">{i.body}</span>}
        {list.progress && (
          <span className="al-prog">
            <input type="range" min={0} max={100} step={5} value={i.progress ?? 0} aria-label={`${i.text} progress`}
              onChange={(e) => a.patchItem(i.id, { progress: Number(e.target.value), done: Number(e.target.value) >= 100 })} style={{ '--p': `${i.progress ?? 0}%` } as CSSProperties} />
            <span className="mono">{i.progress ?? 0}%</span>
          </span>
        )}
        <span className="al-m mono">{short(i.date)}</span>
      </div>
      {sure
        ? <button className="btn danger sm" onClick={() => a.removeItem(i.id)}>Remove</button>
        : <button className="btn ghost sm" aria-label="Remove" onClick={() => setSure(true)}>✕</button>}
    </li>
  );
}

/** The building's own art: the Office's lit window grid, the Observatory's dome and telescope under the stars. */
function AreaArt({ id, heat }: { id: AreaConfig['id']; heat: number }) {
  return (
    <svg className="area-art" viewBox="0 0 300 220" aria-hidden style={{ '--heat': heat } as CSSProperties}>
      {id === 'office' ? (
        <g>
          <rect x="60" y="30" width="180" height="190" className="aa-wall" />
          <path d="M50 32 H250 L238 14 H62 Z" className="aa-wall" />
          {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
            <rect key={`${r}${c}`} x={78 + c * 40} y={48 + r * 40} width="26" height="26" className={(r * 4 + c) / 16 < heat ? 'aa-win lit' : 'aa-win'} />
          )))}
        </g>
      ) : (
        <g>
          {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 47) % 300} cy={(i * 29) % 120} r={i % 5 ? 0.9 : 1.6} className="aa-star" style={{ animationDelay: `${-i * 0.37}s` }} />)}
          <path d="M70 220 V140 A80 80 0 0 1 230 140 V220 Z" className="aa-wall" />
          <path d="M150 60 A80 80 0 0 1 230 140 H70 A80 80 0 0 1 150 60 Z" className="aa-dome" />
          <rect x="138" y="58" width="24" height="82" className="aa-slit" transform="rotate(24 150 140)" />
          <line x1="160" y1="110" x2="214" y2="44" className="aa-scope" />
          <circle cx="150" cy="140" r="90" className="aa-glow" />
        </g>
      )}
    </svg>
  );
}
