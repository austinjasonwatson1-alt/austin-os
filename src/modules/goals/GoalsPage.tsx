import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { parseISO, todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import {
  areaOfMilestone, dayT, defaultBy, goalProgress, groupByArea, lanternTs, milestonesIn, nextQuarter, planningSeason, quarterLabel,
  quarterOf, quarterSpans, roadLine, roadOutline, roadPoint, ROAD, seasonProgress, seasonReview, signpostSlots,
} from './logic';
import { useGoals } from './store';
import { AREA_INFO, HORIZONS, LIFE_AREAS, type Goal, type Horizon, type LifeArea, type Milestone, type Quarter } from './types';
import '../../styles/cabin.css';
import '../../styles/goals.css';

export { SeasonStrip } from './SeasonStrip';

type Editing =
  | { kind: 'goal'; goal?: Goal; horizon?: Horizon; parent?: string }
  | { kind: 'ms'; ms?: Milestone; goal?: string; quarter?: Quarter }
  | null;

const monthYear = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const ac = (a: LifeArea) => ({ '--ac': AREA_INFO[a].color } as CSSProperties);

/** Seasons of Life: the long view across the homestead, walked one quarter at a time. */
export default function GoalsPage() {
  const s = useGoals();
  useEffect(() => { void s.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const quarter = quarterOf(today);
  const season = seasonProgress(s.milestones, today);
  const [editing, setEditing] = useState<Editing>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const showPlan = planOpen || planningSeason(today);

  if (!s.loaded) return null;
  const edit = setEditing;
  return (
    <div className="home goals">
      <section className="hero gl-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · Seasons of Life</div>
          <h1 className="hero-title">Seasons<br /><em>of Life.</em></h1>
          <p className="hero-line">Ten years out on the ridge, three in the town below it, this year as the road — and the season you’re standing in, one lantern at a time.</p>
          <div className="gl-hero-act">
            <button className="btn primary" onClick={() => edit({ kind: 'goal' })}>A new goal</button>
            <button className="btn" onClick={() => (s.goals.length ? edit({ kind: 'ms', quarter }) : edit({ kind: 'goal', horizon: '1y' }))}>A milestone for {quarterLabel(quarter, year)}</button>
            <button className="btn ghost" onClick={() => setPlanOpen((v) => !v || planningSeason(today))} aria-expanded={showPlan}>Plan next season</button>
          </div>
        </div>
        <SeasonDial q={quarter} done={season.done} total={season.total} left={season.daysLeft} />
      </section>

      <TheRoad goals={s.goals} milestones={s.milestones} today={today} onEdit={edit} />

      {showPlan && <PlanPanel today={today} onEdit={edit} onClose={planningSeason(today) ? undefined : () => setPlanOpen(false)} />}

      <div className="gl-grid">
        <SeasonPanel today={today} onEdit={edit} />
        <HorizonsPanel today={today} onEdit={edit} />
      </div>

      {editing?.kind === 'goal' && <GoalSheet key="g" init={editing} today={today} onClose={() => setEditing(null)} />}
      {editing?.kind === 'ms' && <MilestoneSheet key="m" init={editing} today={today} onClose={() => setEditing(null)} onNewGoal={() => setEditing({ kind: 'goal', horizon: '1y' })} />}
    </div>
  );
}

/* ---------------- hero dial ---------------- */

function SeasonDial({ q, done, total, left }: { q: Quarter; done: number; total: number; left: number }) {
  const R = 64, C = 2 * Math.PI * R;
  const f = total ? done / total : 0;
  return (
    <div className="gl-dial" role="img" aria-label={`${q.slice(5)}: ${done} of ${total} milestones, ${left} days left`}>
      <svg viewBox="0 0 160 160" aria-hidden>
        <circle cx="80" cy="80" r={R} className="gd-track" />
        <circle cx="80" cy="80" r={R} className="gd-arc" style={{ strokeDasharray: `${C * f} ${C}` }} transform="rotate(-90 80 80)" />
      </svg>
      <div className="gd-in">
        <span className="gd-q">{q.slice(5)}</span>
        <span className="mono">{total ? <><CountUp value={done} /> of {total}</> : 'unplanned'}</span>
        <span className="mono faint">{left === 0 ? 'last day' : <><CountUp value={left} /> days left</>}</span>
      </div>
    </div>
  );
}

/* ---------------- the road ---------------- */

/** Small seeded random so the stars and pines stay put between renders. */
function seeded(seed: number) {
  let a = seed;
  return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
}

function TheRoad({ goals, milestones, today, onEdit }: { goals: Goal[]; milestones: Milestone[]; today: string; onEdit: (e: Editing) => void }) {
  const year = Number(today.slice(0, 4));
  const current = quarterOf(today);
  const spans = useMemo(() => quarterSpans(year, current), [year, current]);
  const outline = useMemo(() => roadOutline(), []);
  const centre = useMemo(() => roadLine(0, 1, 90), []);
  const nowT = dayT(today, spans);
  const walked = useMemo(() => roadLine(0, nowT, 60), [nowT]);
  const nowP = roadPoint(nowT);
  const { W, H, horizon: HY } = ROAD;

  const scenery = useMemo(() => {
    const r = seeded(7);
    const stars = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * (HY - 40), s: 0.4 + r() * 1.1, d: r() * 6 }));
    const pines: { x: number; y: number; h: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const t = 0.04 + r() * 0.82;
      const p = roadPoint(t);
      const side = r() < 0.5 ? -1 : 1;
      const x = p.x + side * (p.w + 70 * p.scale + r() * 160 * p.scale);
      if (x > 10 && x < W - 10) pines.push({ x, y: p.y + 4, h: (26 + r() * 30) * p.scale });
    }
    return { stars, pines: pines.sort((a, b) => a.y - b.y) };
  }, [W, HY]);

  const far = goals.filter((g) => g.horizon === '10y');
  const town = goals.filter((g) => g.horizon === '3y');
  const posts = goals.filter((g) => g.horizon === '1y');

  // Ten-year peaks along the far ridge; the ridge always has a shape even with no vision written yet.
  const peaks = far.length ? far.slice(0, 4).map((g, i, a) => ({ g, x: 140 + ((i + 0.5) / a.length) * (W - 280) + (i % 2 ? 40 : -40) * (a.length > 1 ? 1 : 0), y: 52 + (i % 2) * 22 })) : [];
  const ridgePts = [{ x: 0, y: HY - 22 }, ...(peaks.length ? peaks : [{ x: 300, y: 70 }, { x: 720, y: 86 }]).flatMap((p) => [{ x: p.x - 90, y: p.y + 70 }, { x: p.x, y: p.y }, { x: p.x + 80, y: p.y + 60 }]), { x: W, y: HY - 30 }];
  const ridge = `M0,${HY} ${ridgePts.map((p) => `L${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ')} L${W},${HY} Z`;

  const lanterns = spans.flatMap((sp) => {
    const ms = milestonesIn(milestones, sp.quarter);
    return lanternTs(ms.length, sp).map((t, i) => ({ m: ms[i], t, q: sp.quarter, side: i % 2 ? 1 : -1 }));
  });

  return (
    <section className="panel gl-road rise" style={rise(1)}>
      <div className="panel-h">
        <p className="panel-t">The road · {year}</p>
        <span className="mono faint" style={{ fontSize: 11 }}>
          {lanterns.filter((l) => l.m.done).length} of {lanterns.length} lanterns lit this year
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="gr-svg" role="group" aria-label={`The road through ${year}, from today toward the horizon`}>
        <defs>
          <linearGradient id="gr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05070d" />
            <stop offset="0.75" stopColor="#0d1426" />
            <stop offset="1" stopColor="#2a2030" />
          </linearGradient>
          <radialGradient id="gr-glow" cx="0.5" cy="1" r="0.6">
            <stop offset="0" stopColor="rgba(232,168,75,0.32)" />
            <stop offset="1" stopColor="rgba(232,168,75,0)" />
          </radialGradient>
          <linearGradient id="gr-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c1019" />
            <stop offset="1" stopColor="#05070b" />
          </linearGradient>
          <linearGradient id="gr-roadfill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="rgba(233,228,216,0.13)" />
            <stop offset="1" stopColor="rgba(233,228,216,0.03)" />
          </linearGradient>
          <radialGradient id="gr-lamp">
            <stop offset="0" stopColor="rgba(255,214,140,0.95)" />
            <stop offset="0.35" stopColor="rgba(232,168,75,0.45)" />
            <stop offset="1" stopColor="rgba(232,168,75,0)" />
          </radialGradient>
        </defs>

        <rect width={W} height={HY + 2} fill="url(#gr-sky)" />
        <g className="gr-stars">
          {scenery.stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.s} style={{ animationDelay: `${-st.d}s` }} />)}
        </g>
        <g className="gr-moon" transform={`translate(${W - 58} 40)`}>
          <circle r="34" className="gr-moon-halo" />
          <circle r="15" className="gr-moon-disc" />
          <circle r="14" cx="6" cy="-4" className="gr-moon-bite" />
        </g>
        <ellipse cx={ROAD.cx} cy={HY} rx="360" ry="70" fill="url(#gr-glow)" />

        {/* the ten-year ridge */}
        <path d={ridge} className="gr-ridge" />
        <path d={`M0,${HY} L${W * 0.18},${HY - 34} L${W * 0.36},${HY - 12} L${W * 0.6},${HY - 40} L${W * 0.82},${HY - 16} L${W},${HY - 28} L${W},${HY} Z`} className="gr-ridge near" />
        {peaks.map(({ g, x, y }) => (
          <g key={g.id} className={`gr-peak${g.done ? ' done' : ''}`} transform={`translate(${x} ${y})`} style={ac(g.area)}
            role="button" tabIndex={0} aria-label={`Ten-year vision: ${g.title}`} onClick={() => onEdit({ kind: 'goal', goal: g })} onKeyDown={(e) => { if (e.key === 'Enter') onEdit({ kind: 'goal', goal: g }); }}>
            <circle r="3.2" className="gr-beacon" />
            <text y="-12" textAnchor="middle" className="gr-far-k">10 YEARS</text>
            <text y="-26" textAnchor="middle" className="gr-far-t">{clip(g.title, 26)}</text>
          </g>
        ))}
        {!far.length && (
          <g className="gr-peak ghost" transform="translate(300 70)" role="button" tabIndex={0} aria-label="Write a ten-year vision"
            onClick={() => onEdit({ kind: 'goal', horizon: '10y' })} onKeyDown={(e) => { if (e.key === 'Enter') onEdit({ kind: 'goal', horizon: '10y' }); }}>
            <circle r="3" className="gr-beacon" />
            <text y="-14" textAnchor="middle" className="gr-far-t">+ a ten-year vision</text>
          </g>
        )}
        {far.length > 4 && <text x={W - 20} y={HY - 40} textAnchor="end" className="gr-far-k">+{far.length - 4} more visions</text>}

        <rect y={HY} width={W} height={H - HY} fill="url(#gr-ground)" />

        {/* the three-year town where the road meets the horizon */}
        <g className="gr-town">
          {town.slice(0, 5).map((g, i, a) => {
            const x = ROAD.cx + (i - (a.length - 1) / 2) * 46 + (i % 2 ? 6 : -6);
            const h = 14 + (i % 3) * 5;
            return (
              <g key={g.id} transform={`translate(${x} ${HY + 1})`} className={`gr-house${g.done ? ' done' : ''}`} style={ac(g.area)}
                role="button" tabIndex={0} aria-label={`Three-year goal: ${g.title}`} onClick={() => onEdit({ kind: 'goal', goal: g })} onKeyDown={(e) => { if (e.key === 'Enter') onEdit({ kind: 'goal', goal: g }); }}>
                <path d={`M-9 0 V${-h} L0 ${-h - 9} L9 ${-h} V0 Z`} className="gr-house-b" />
                <rect x="-3" y={-h + 4} width="6" height="6" className="gr-house-w" />
                <line x1="0" y1={-h - 12} x2="0" y2={-38 - (i % 2) * 18} className="gr-tether" />
                <text y={-42 - (i % 2) * 18} textAnchor="middle" className="gr-town-t">{clip(g.title, 22)}</text>
              </g>
            );
          })}
          {town.length > 5 && <text x={ROAD.cx} y={HY + 16} textAnchor="middle" className="gr-far-k">+{town.length - 5} more in town</text>}
          {town.length > 0 && <text x={ROAD.cx + Math.max(60, town.slice(0, 5).length * 26)} y={HY - 4} className="gr-far-k">3 YEARS</text>}
        </g>

        {/* the pines, back to front */}
        {scenery.pines.map((p, i) => (
          <path key={i} className="gr-pine" d={`M${p.x.toFixed(1)},${(p.y - p.h).toFixed(1)} L${(p.x + p.h * 0.28).toFixed(1)},${p.y.toFixed(1)} L${(p.x - p.h * 0.28).toFixed(1)},${p.y.toFixed(1)} Z`} />
        ))}

        {/* the road itself */}
        <path d={outline} className="gr-road" fill="url(#gr-roadfill)" />
        <path d={centre} className="gr-centre" />
        <path d={walked} className="gr-walked" />

        {/* quarter stones */}
        {spans.map((sp) => {
          const p = roadPoint(Math.max(0.045, sp.t0 + 0.004));
          const now = sp.quarter === current;
          return (
            <g key={sp.quarter} className={`gr-qstone${now ? ' now' : ''}${sp.quarter < current ? ' past' : ''}`} transform={`translate(${p.x - p.w - 12 * p.scale} ${p.y})`}>
              <line x1="0" y1="0" x2={p.w * 2 + 24 * p.scale} y2="0" className="gr-qline" />
              <text x={-6} y={-4} textAnchor="end" style={{ fontSize: 10 + 6 * p.scale }}>{sp.quarter.slice(5)}{now ? ' · now' : ''}</text>
            </g>
          );
        })}
        {(() => {
          const p = roadPoint(spans[3].t1);
          return <text x={p.x + p.w + 10} y={p.y - 2} className="gr-yearend">{year + 1} →</text>;
        })()}

        {/* one-year signposts, by their target day */}
        {signpostSlots(posts.map((g) => ({ id: g.id, t: Math.max(0.03, dayT(g.by, spans)) }))).map(({ id, t, side, lift }) => {
          const g = posts.find((x) => x.id === id)!;
          const p = roadPoint(t);
          const x = p.x + side * (p.w + 34 * p.scale);
          const s = 0.55 + p.scale * 0.6;
          return (
            <g key={g.id} transform={`translate(${x} ${p.y - lift}) scale(${s})`} className={`gr-post${g.done ? ' done' : ''}`} style={ac(g.area)}
              role="button" tabIndex={0} aria-label={`One-year goal: ${g.title}, by ${monthYear(g.by)}`}
              onClick={() => onEdit({ kind: 'goal', goal: g })} onKeyDown={(e) => { if (e.key === 'Enter') onEdit({ kind: 'goal', goal: g }); }}>
              <line x1="0" y1={lift / s} x2="0" y2="-46" className="gr-post-pole" />
              <path d={side < 0 ? 'M4 -50 H-120 L-128 -41 L-120 -32 H4 Z' : 'M-4 -50 H120 L128 -41 L120 -32 H-4 Z'} className="gr-post-board" />
              <text x={side < 0 ? -62 : 62} y="-37.5" textAnchor="middle" className="gr-post-t">{clip(g.title, 20)}</text>
              <text x={side < 0 ? -62 : 62} y="-55" textAnchor="middle" className="gr-post-k">{g.done ? 'REACHED' : `BY ${monthYear(g.by).toUpperCase()}`}</text>
            </g>
          );
        })}

        {/* you are here */}
        <g className="gr-today" transform={`translate(${nowP.x} ${nowP.y})`}>
          <circle r={40 * nowP.scale} fill="url(#gr-lamp)" className="gr-today-glow" />
          <circle r="4.5" className="gr-today-dot" />
          <text y={22 + 6 * nowP.scale} textAnchor="middle" className="gr-today-t">TODAY</text>
        </g>

        {/* the season's lanterns */}
        {lanterns.map(({ m, t, q, side }) => {
          const p = roadPoint(t);
          const x = p.x + side * (p.w + 14 * p.scale);
          const k = 0.6 + p.scale * 0.65;
          const g = goals.find((x) => x.id === m.goal);
          const state = m.done ? 'lit' : q === current ? 'now' : q < current ? 'dim past' : 'dim';
          return (
            <g key={m.id} transform={`translate(${x} ${p.y}) scale(${k})`} className={`gr-lantern ${state}`} style={ac(g?.area ?? 'writing')}
              role="button" tabIndex={0} aria-label={`${m.title} — ${quarterLabel(q, year)}, ${m.done ? 'done' : 'open'}`}
              onClick={() => onEdit({ kind: 'ms', ms: m })} onKeyDown={(e) => { if (e.key === 'Enter') onEdit({ kind: 'ms', ms: m }); }}>
              <title>{m.title}</title>
              {(m.done || q === current) && <circle cy="-30" r="22" fill="url(#gr-lamp)" className="gr-lantern-glow" />}
              <line x1="0" y1="0" x2="0" y2="-22" className="gr-lantern-pole" />
              <path d="M-5 -24 H5 L6 -36 H-6 Z" className="gr-lantern-body" />
              <path d="M-7 -36 H7 L0 -42 Z" className="gr-lantern-cap" />
              <circle cy="-30" r="2.4" className="gr-lantern-flame" />
            </g>
          );
        })}

        {lanterns.length === 0 && (
          <text x={ROAD.cx} y={H - 26} textAnchor="middle" className="gr-empty">No lanterns on the road yet — give this season a milestone and one will be hung.</text>
        )}
      </svg>
      <div className="gr-legend mono">
        <span><i className="lg-lit" />done</span>
        <span><i className="lg-now" />this season</span>
        <span><i className="lg-dim" />open</span>
        <span><i className="lg-post" />one-year signpost</span>
      </div>
    </section>
  );
}

/* ---------------- this season ---------------- */

function SeasonPanel({ today, onEdit }: { today: string; onEdit: (e: Editing) => void }) {
  const { goals, milestones, toggleMilestone } = useGoals();
  const q = quarterOf(today);
  const year = Number(today.slice(0, 4));
  const s = seasonProgress(milestones, today);
  const groups = groupByArea(goals, milestonesIn(milestones, q));
  return (
    <section className="panel gl-season rise" style={rise(2)}>
      <div className="panel-h">
        <p className="panel-t">This season · {quarterLabel(q, year)}</p>
        <span className="mono faint" style={{ fontSize: 11 }}>{s.daysLeft === 0 ? 'last day' : `${s.daysLeft} days left`}</span>
      </div>
      {s.total > 0 && (
        <div className="gs-prog">
          <span className="gs-big"><CountUp value={s.done} /></span>
          <span className="gs-of">of {s.total} this season</span>
          <span className="gs-bar" style={{ '--p': `${(s.done / s.total) * 100}%` } as CSSProperties}><i /></span>
        </div>
      )}
      {groups.length === 0 && (
        <div className="gl-empty">
          <p>Nothing hung on the road for {quarterLabel(q, year)} yet. A milestone is one concrete thing that would move a goal this season.</p>
          <button className="btn primary sm" onClick={() => (goals.length ? onEdit({ kind: 'ms', quarter: q }) : onEdit({ kind: 'goal', horizon: '1y' }))}>{goals.length ? 'Hang the first lantern' : 'Start with a goal'}</button>
        </div>
      )}
      {groups.map(({ area, items }) => (
        <div key={area} className="gs-area" style={ac(area)}>
          <div className="gs-area-h"><span className="gs-glyph">{AREA_INFO[area].glyph}</span>{AREA_INFO[area].name}<span className="mono faint">{items.filter((m) => m.done).length}/{items.length}</span></div>
          <ul className="gs-list">
            {items.map((m) => (
              <li key={m.id} className={m.done ? 'done' : ''}>
                <button className="gs-check" aria-pressed={Boolean(m.done)} aria-label={m.done ? `Mark “${m.title}” open` : `Mark “${m.title}” done`}
                  onClick={(e) => { if (!m.done) embers(e.currentTarget, 12); toggleMilestone(m.id, today); }}><span /></button>
                <button className="gs-body" onClick={() => onEdit({ kind: 'ms', ms: m })}>
                  <span className="gs-t">{m.title}</span>
                  <span className="gs-m mono">
                    {goals.find((g) => g.id === m.goal)?.title ?? 'a goal no longer here'}
                    {m.carriedFrom && <b className="gs-carried"> · carried from {quarterLabel(m.carriedFrom, year)}</b>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length > 0 && <button className="btn ghost sm gs-add" onClick={() => onEdit({ kind: 'ms', quarter: q })}>+ a milestone</button>}
    </section>
  );
}

/* ---------------- the horizons ---------------- */

function HorizonsPanel({ today, onEdit }: { today: string; onEdit: (e: Editing) => void }) {
  const { goals, milestones, toggleGoal } = useGoals();
  return (
    <section className="panel gl-horizons rise" style={rise(3)}>
      <div className="panel-h">
        <p className="panel-t">The horizons</p>
        <button className="btn ghost sm" onClick={() => onEdit({ kind: 'goal' })}>+ a goal</button>
      </div>
      {HORIZONS.map((h) => {
        const list = goals.filter((g) => g.horizon === h.id).sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)) || a.by.localeCompare(b.by));
        return (
          <div key={h.id} className={`gh-tier t-${h.id}`}>
            <div className="gh-tier-h"><span className="gh-k mono">{h.label}</span><span className="gh-long">{h.long}</span></div>
            {list.length === 0 && <button className="gh-ghost" onClick={() => onEdit({ kind: 'goal', horizon: h.id })}>+ {h.id === '10y' ? 'Write the vision' : h.id === '3y' ? 'A three-year goal' : 'A goal for this year'}</button>}
            <ul className="gh-list">
              {list.map((g) => {
                const p = goalProgress(goals, milestones, g.id);
                const parent = g.parent ? goals.find((x) => x.id === g.parent) : undefined;
                return (
                  <li key={g.id} className={g.done ? 'done' : ''} style={ac(g.area)}>
                    <button className="gh-check" aria-pressed={Boolean(g.done)} aria-label={g.done ? `Mark “${g.title}” not reached` : `Mark “${g.title}” reached`}
                      onClick={(e) => { if (!g.done) { embers(e.currentTarget, 22); window.dispatchEvent(new Event('austin:celebrate')); } toggleGoal(g.id, today); }}>{g.done ? '✓' : AREA_INFO[g.area].glyph}</button>
                    <button className="gh-body" onClick={() => onEdit({ kind: 'goal', goal: g })}>
                      <span className="gh-t">{g.title}</span>
                      {g.why && <span className="gh-why">{g.why}</span>}
                      <span className="gh-m mono">
                        {AREA_INFO[g.area].name} · {g.done ? `reached ${monthYear(g.done)}` : `by ${monthYear(g.by)}`}
                        {p.total > 0 && ` · ${p.done} of ${p.total} milestones`}
                        {parent && <> · <span className="gh-up">↑ {clip(parent.title, 28)}</span></>}
                      </span>
                      {p.total > 0 && <span className="gh-bar" style={{ '--p': `${p.pct * 100}%` } as CSSProperties}><i /></span>}
                    </button>
                    {h.id !== '1y' && <button className="btn ghost sm gh-sub" aria-label={`Add a goal under “${g.title}”`} onClick={() => onEdit({ kind: 'goal', horizon: h.id === '10y' ? '3y' : '1y', parent: g.id })}>+</button>}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- plan next season ---------------- */

function PlanPanel({ today, onEdit, onClose }: { today: string; onEdit: (e: Editing) => void; onClose?: () => void }) {
  const { goals, milestones, carry, letGo } = useGoals();
  const q = quarterOf(today);
  const next = nextQuarter(q);
  const year = Number(today.slice(0, 4));
  const r = seasonReview(goals, milestones, q);
  const ahead = seasonReview(goals, milestones, next);
  const toDecide = [...r.behind, ...r.open];
  return (
    <section className="panel gl-plan rise" style={rise(2)}>
      <div className="panel-h">
        <p className="panel-t">Plan next season · {quarterLabel(next, year)}</p>
        {onClose && <button className="btn ghost sm" onClick={onClose}>Close</button>}
      </div>
      <div className="gp-areas">
        {r.byArea.length === 0 && <span className="dim" style={{ fontSize: 13.5 }}>No milestones this season to look back on.</span>}
        {r.byArea.map((a) => (
          <span key={a.area} className="gp-chip" style={ac(a.area)}><i />{AREA_INFO[a.area].name}<b className="mono">{a.done}</b><span className="mono faint">/ {a.done + a.open}</span></span>
        ))}
        {r.carried.length > 0 && <span className="gp-chip carried mono">{r.carried.length} carried in</span>}
      </div>
      <div className="gp-cols">
        <div>
          <h3 className="gp-h">Still open</h3>
          {toDecide.length === 0 && <p className="dim gp-none">Everything this season is lit. Well walked.</p>}
          <ul className="gp-list">
            {toDecide.map((m) => (
              <li key={m.id} style={ac(areaOfMilestone(goals, m))}>
                <span className="gp-dot" />
                <span className="gp-t">{m.title}<span className="mono faint"> · {quarterLabel(m.quarter, year)}{m.carriedFrom ? `, from ${quarterLabel(m.carriedFrom, year)}` : ''}</span></span>
                <span className="gp-act">
                  <button className="btn sm" onClick={() => carry(m.id, next)}>Carry to {quarterLabel(next, year)}</button>
                  <button className="btn ghost sm" onClick={() => letGo(m.id, today)}>Let it go</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="gp-h">Goals with nothing planned for {quarterLabel(next, year)}</h3>
          {ahead.unplanned.length === 0 && <p className="dim gp-none">Every goal for the year has a lantern waiting in {quarterLabel(next, year)}.</p>}
          <ul className="gp-list">
            {ahead.unplanned.map((g) => (
              <li key={g.id} style={ac(g.area)}>
                <span className="gp-dot" />
                <span className="gp-t">{g.title}<span className="mono faint"> · {AREA_INFO[g.area].name}</span></span>
                <span className="gp-act"><button className="btn primary sm" onClick={() => onEdit({ kind: 'ms', goal: g.id, quarter: next })}>Plan a milestone</button></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- sheets ---------------- */

function Sheet({ eyebrow, title, onClose, onSave, ok, onRemove, removeLabel, children }: {
  eyebrow: string; title: string; onClose: () => void; onSave: () => void; ok: boolean; onRemove?: () => void; removeLabel?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sure, setSure] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { ref.current?.close(); onClose(); };
  return (
    <dialog ref={ref} className="sheet gl-sheet" onClose={onClose} aria-label={title}>
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>{eyebrow}</div>
      <h2 className="sheet-title">{title}</h2>
      <form className="book-fields gl-fields" onSubmit={(e) => { e.preventDefault(); if (ok) { onSave(); close(); } }}>
        {children}
        <div className="sheet-actions">
          {onRemove && (sure
            ? <button type="button" className="btn danger" onClick={() => { onRemove(); close(); }}>{removeLabel ?? 'Remove it'}</button>
            : <button type="button" className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => setSure(true)}>Remove…</button>)}
          <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!ok}>Save</button>
        </div>
      </form>
    </dialog>
  );
}

function AreaChooser({ value, onPick }: { value: LifeArea; onPick: (a: LifeArea) => void }) {
  return (
    <div className="gl-areas" role="radiogroup" aria-label="Area of life">
      {LIFE_AREAS.map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={value === a.id} className="gl-area" style={ac(a.id)} onClick={() => onPick(a.id)} title={a.place}>
          <span className="gl-area-g">{a.glyph}</span>{a.name}
        </button>
      ))}
    </div>
  );
}

function GoalSheet({ init, today, onClose }: { init: Extract<Editing, { kind: 'goal' }>; today: string; onClose: () => void }) {
  const { goals, milestones, saveGoal, removeGoal } = useGoals();
  const g0 = init.goal;
  const parent0 = init.parent ? goals.find((x) => x.id === init.parent) : undefined;
  const h0: Horizon = g0?.horizon ?? init.horizon ?? '1y';
  const [area, setArea] = useState<LifeArea>(g0?.area ?? parent0?.area ?? 'writing');
  const [horizon, setHorizon] = useState<Horizon>(h0);
  const [title, setTitle] = useState(g0?.title ?? '');
  const [why, setWhy] = useState(g0?.why ?? '');
  const [by, setBy] = useState(g0?.by ?? defaultBy(h0, today));
  const [byTouched, setByTouched] = useState(Boolean(g0));
  const [parent, setParent] = useState(g0?.parent ?? init.parent ?? '');
  const longer = HORIZONS.slice(0, HORIZONS.findIndex((h) => h.id === horizon)).map((h) => h.id);
  const parents = goals.filter((x) => longer.includes(x.horizon) && x.id !== g0?.id);
  const ms = g0 ? milestones.filter((m) => m.goal === g0.id).length : 0;
  const pickHorizon = (h: Horizon) => {
    setHorizon(h);
    if (!byTouched) setBy(defaultBy(h, today));
    const allowed = HORIZONS.slice(0, HORIZONS.findIndex((x) => x.id === h)).map((x) => x.id);
    if (parent && !goals.some((x) => x.id === parent && allowed.includes(x.horizon))) setParent('');
  };
  return (
    <Sheet eyebrow={g0 ? `${HORIZONS.find((h) => h.id === g0.horizon)!.label} · ${AREA_INFO[g0.area].place}` : 'A new goal'} title={g0 ? 'The goal' : 'Somewhere to walk toward'}
      onClose={onClose} ok={Boolean(title.trim() && by)}
      onSave={() => saveGoal({ id: g0?.id, area, horizon, title, why, by, done: g0?.done, parent: parent || undefined })}
      onRemove={g0 ? () => removeGoal(g0.id) : undefined}
      removeLabel={ms ? `Remove it and its ${ms} milestone${ms === 1 ? '' : 's'}` : 'Remove it'}>
      <AreaChooser value={area} onPick={setArea} />
      <div className="seg wide" role="radiogroup" aria-label="Horizon">
        {HORIZONS.map((h) => <button key={h.id} type="button" role="radio" aria-checked={horizon === h.id} onClick={() => pickHorizon(h.id)}>{h.label}</button>)}
      </div>
      <label className="field"><span>The goal</span><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!g0}
        placeholder={horizon === '10y' ? 'A shelf of my own novels in a bookstore' : horizon === '3y' ? 'Three thrillers published' : 'Sign with an agent'} /></label>
      <label className="field"><span>Why it matters</span><textarea className="ruled" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="So that…" /></label>
      <div className="field-row two">
        <label className="field"><span>By</span><input type="date" value={by} onChange={(e) => { setBy(e.target.value); setByTouched(true); }} /></label>
        <label className="field"><span>Ladders up to</span>
          <select className="gl-select" value={parent} onChange={(e) => setParent(e.target.value)} disabled={!parents.length}>
            <option value="">{parents.length ? 'Nothing above it' : horizon === '10y' ? 'It is the top of the mountain' : 'No longer goal yet'}</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{HORIZONS.find((h) => h.id === p.horizon)!.label} · {p.title}</option>)}
          </select>
        </label>
      </div>
    </Sheet>
  );
}

function MilestoneSheet({ init, today, onClose, onNewGoal }: { init: Extract<Editing, { kind: 'ms' }>; today: string; onClose: () => void; onNewGoal: () => void }) {
  const { goals, saveMilestone, removeMilestone } = useGoals();
  const m0 = init.ms;
  const year = Number(today.slice(0, 4));
  const cur = quarterOf(today);
  const choices: Quarter[] = [cur];
  while (choices.length < 5) choices.push(nextQuarter(choices[choices.length - 1]));
  if (m0 && !choices.includes(m0.quarter)) choices.unshift(m0.quarter);
  const open = goals.filter((g) => !g.done || g.id === (m0?.goal ?? init.goal));
  const order = (g: Goal) => (g.horizon === '1y' ? 0 : g.horizon === '3y' ? 1 : 2);
  const sorted = [...open].sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title));
  const [goal, setGoal] = useState(m0?.goal ?? init.goal ?? sorted[0]?.id ?? '');
  const [quarter, setQuarter] = useState<Quarter>(m0?.quarter ?? init.quarter ?? cur);
  const [title, setTitle] = useState(m0?.title ?? '');
  const [done, setDone] = useState(Boolean(m0?.done));
  const g = goals.find((x) => x.id === goal);

  if (!goals.length) {
    return (
      <Sheet eyebrow="A milestone" title="First, a goal" onClose={onClose} ok onSave={onNewGoal}>
        <p className="dim" style={{ margin: 0 }}>A milestone is a step toward something. Name the goal it serves first, then hang its lanterns along the road.</p>
      </Sheet>
    );
  }
  return (
    <Sheet eyebrow={g ? `${AREA_INFO[g.area].place} · ${quarterLabel(quarter, year)}` : 'A milestone'} title={m0 ? 'The milestone' : 'A lantern for the road'}
      onClose={onClose} ok={Boolean(title.trim() && goal)}
      onSave={() => saveMilestone({ ...(m0 ?? {}), id: m0?.id, goal, quarter, title, done: done ? m0?.done ?? today : undefined, dropped: done ? undefined : m0?.dropped })}
      onRemove={m0 ? () => removeMilestone(m0.id) : undefined}>
      <label className="field"><span>Milestone</span><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!m0} placeholder="Finish the second-draft read-through" /></label>
      <label className="field" style={g ? ac(g.area) : undefined}><span>Toward</span>
        <select className="gl-select tinted" value={goal} onChange={(e) => setGoal(e.target.value)}>
          {sorted.map((x) => <option key={x.id} value={x.id}>{AREA_INFO[x.area].glyph} {x.title} ({HORIZONS.find((h) => h.id === x.horizon)!.label})</option>)}
        </select>
      </label>
      <div className="field"><span>Season</span>
        <div className="seg wide" role="radiogroup" aria-label="Quarter">
          {choices.map((q) => <button key={q} type="button" role="radio" aria-checked={quarter === q} onClick={() => setQuarter(q)}>{quarterLabel(q, year)}</button>)}
        </div>
      </div>
      {m0?.dropped && !done && <p className="mono faint" style={{ fontSize: 11, margin: 0 }}>Let go on {monthYear(m0.dropped)}. Saving keeps it that way; mark it done to bring it back.</p>}
      <button type="button" className={`gl-lit${done ? ' on' : ''}`} aria-pressed={done} onClick={(e) => { if (!done) embers(e.currentTarget, 10); setDone(!done); }}>
        <span className="gl-lit-l" />{done ? 'Lit — it’s done' : 'Not yet lit'}
      </button>
    </Sheet>
  );
}
