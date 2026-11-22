import { useMemo, useState, type CSSProperties } from 'react';
import { addDays, mondayOf, todayISO } from '../../core/dates';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { CountUp } from '../../shell/fx';
import { useDrafts } from '../drafts/store';
import { balanceScore, balanceWeek, insights, LIFE_AREAS } from './logic';
import { BalanceWheel } from './Wheel';
import { useLife } from './store';
import { useLifeInput } from './useLifeInput';
import '../../styles/cabin.css';
import '../../styles/life.css';

const fm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/** The Compass: the week's balance across the whole life, and what the numbers say about how it fits together. */
export default function CompassPage() {
  const { ready, input } = useLifeInput();
  const life = useLife();
  const sprints = useDrafts((s) => s.sprints);
  const today = todayISO();
  const [monday, setMonday] = useState(mondayOf(today));
  const now = useMemo(() => balanceWeek(input, monday, life.targets, today), [input, monday, life.targets, today]);
  const prev = useMemo(() => balanceWeek(input, addDays(monday, -7), life.targets), [input, monday, life.targets]);
  const found = useMemo(() => insights(input, today, 120, sprints ?? []), [input, today, sprints]);
  const [editing, setEditing] = useState(false);
  if (!ready) return null;
  const score = balanceScore(now);
  const weakest = [...now].sort((a, b) => a.score - b.score)[0];
  const weakA = LIFE_AREAS.find((a) => a.id === weakest.area)!;
  const isThisWeek = monday === mondayOf(today);

  return (
    <div className="home life">
      <section className="hero life-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · The Compass</div>
          <h1 className="hero-title">The whole <em>life.</em></h1>
          <p className="hero-line">How the week fell across everything that matters: the book, faith, work, learning, the body and the people at the hearth. Not a score to win; a way to see what’s been left out in the cold.</p>
          <div className="wk-nav">
            <button className="brass" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>‹</button>
            <span className="mono">{isThisWeek ? 'This week' : `Week of ${new Date(`${monday}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</span>
            <button className="brass" aria-label="Next week" disabled={isThisWeek} onClick={() => setMonday(addDays(monday, 7))}>›</button>
          </div>
        </div>
        <div className="life-wheel-wrap">
          <BalanceWheel now={now} prev={prev} onPick={go} />
          <div className="life-score"><b><CountUp value={score} /></b><span className="mono">balance</span></div>
        </div>
      </section>

      <section className="panel life-areas rise" style={rise(1)}>
        <div className="panel-h">
          <p className="panel-t">The week, area by area</p>
          <button className="linkish" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Change the weekly targets'}</button>
        </div>
        <div className="la-grid">
          {now.map((s) => {
            const a = LIFE_AREAS.find((l) => l.id === s.area)!;
            const p = prev.find((x) => x.area === s.area)!;
            return (
              <div key={s.area} className="la" style={{ '--c': a.color } as CSSProperties}>
                <button className="la-h" onClick={() => go(a.path)}><span className="la-g" aria-hidden>{a.glyph}</span><b>{a.name}</b><span className="mono faint">{a.place}</span></button>
                <div className="la-bar"><i style={{ width: `${s.score * 100}%` }} /></div>
                <span className="mono la-n">{fm(s.mins)} <span className="faint">of {fm(s.target)}</span>{p.mins ? <span className={s.mins >= p.mins ? 'up' : 'down'}> · {s.mins >= p.mins ? '▲' : '▼'} {fm(Math.abs(s.mins - p.mins))}</span> : null}</span>
                {editing && (
                  <label className="la-target"><span className="mono">target a week</span>
                    <input inputMode="numeric" value={Math.round(s.target / 60 * 10) / 10} onChange={(e) => life.setTarget(s.area, (Number(e.target.value.replace(/[^\d.]/g, '')) || 0) * 60)} aria-label={`${a.name} weekly target in hours`} /><span className="mono">h</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {weakest.score < 0.35 && isThisWeek && (
          <p className="life-nudge">{weakA.place} has had the least of you this week{weakest.mins ? ` (${fm(weakest.mins)})` : ''}. <button className="linkish" onClick={() => go(weakA.path)}>Go there →</button></p>
        )}
      </section>

      <section className="rise" style={rise(2)}>
        <h2 className="section-h">What the numbers say</h2>
        {found.length === 0 ? (
          <p className="dim">Patterns show up once there are a few weeks of time logged across the homestead. Keep going, and the Compass will start to notice how one part of life feeds another.</p>
        ) : (
          <div className="insights">
            {found.slice(0, 6).map((f) => {
              const a = LIFE_AREAS.find((l) => l.id === f.area)!;
              return (
                <article key={f.id} className="insight" style={{ '--c': a.color } as CSSProperties}>
                  <span className="ins-g" aria-hidden>{a.glyph}</span>
                  <div><p className="ins-t">{f.title}</p><p className="mono ins-e">{f.evidence}</p></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
