import { go, useRoute } from './router';
import { AREAS, MODULES } from '../modules/registry';
import { AutoBackupFoot } from './AutoBackup';
import { AppStatus } from './AppStatus';
import { openPalette } from './CommandPalette';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { groupOf, mostUsed, recordVisit, roomOf, type NavGroup, type NavItem, type Visits } from './navLogic';
import { useTimer } from '../modules/timer/store';
import { elapsedMs, fmtClock } from '../modules/timer/logic';

/** Lamp Mode's rail entry: glows and shows the clock while a session runs. */
function TimerNav({ current }: { current: boolean }) {
  const run = useTimer((s) => s.running);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run]);
  return (
    <button className={run ? 'nav-item timer-on' : 'nav-item'} aria-current={current ? 'page' : undefined} onClick={() => go('/cabin/timer')}>
      <span className="glyph">◉</span>
      Lamp Mode
      {run && <span className="clock">{run.pausedAt ? '❚❚ ' : ''}{fmtClock(elapsedMs(run, now))}</span>}
    </button>
  );
}

/** Every room, grouped the way the homestead is laid out. */
export function navGroups(): NavGroup[] {
  const cabin = AREAS[0];
  const live = (a: (typeof AREAS)[number]): NavItem => ({ path: a.path, glyph: a.glyph, name: a.name, soon: !a.live });
  return [
    { id: 'cabin', label: "The Writer's Cabin", items: [{ path: cabin.path, glyph: cabin.glyph, name: 'The Cabin' }, ...MODULES.filter((m) => m.section === 'cabin').map((m) => ({ path: m.path, glyph: m.glyph, name: m.name, soon: !m.component }))] },
    { id: 'homestead', label: 'The Homestead', items: [...AREAS.filter((a) => a.id !== 'cabin').map(live), { path: '/kennel', glyph: '🐾', name: 'The Kennel' }, { path: '/money', glyph: '$', name: 'Money' }] },
    { id: 'time', label: 'Ahead & behind', items: [
      { path: '/life', glyph: '✧', name: 'The Compass' }, { path: '/goals', glyph: '⛰', name: 'Seasons of life' },
      { path: '/review', glyph: '◷', name: 'Looking back' }, { path: '/memories', glyph: '❀', name: 'Memories' },
    ] },
  ];
}
const TOP: NavItem[] = [{ path: '/home', glyph: '◈', name: 'Home' }, { path: '/day', glyph: '☼', name: 'The Day' }, { path: '/keeper', glyph: '♨', name: 'The Keeper' }];

/* Per-device conveniences (never user data): which groups are open, and which rooms get used. */
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine */ } };

export function Sidebar() {
  const route = useRoute();
  const groups = useMemo(navGroups, []);
  const all = useMemo(() => [...TOP, ...groups.flatMap((g) => g.items)], [groups]);
  const [visits, setVisits] = useState<Visits>(() => read('austin.visits', {}));
  const [open, setOpen] = useState<Record<string, boolean>>(() => read('austin.navOpen', {}));
  const [map, setMap] = useState(false);
  const here = groupOf(groups, route);
  const room = roomOf(all, route);
  useEffect(() => {
    if (!room) return;
    const t = setTimeout(() => { const v = recordVisit(read('austin.visits', {}), room, Date.now()); write('austin.visits', v); setVisits(v); }, 1500);
    return () => clearTimeout(t);
  }, [room]);
  useEffect(() => { setMap(false); }, [route]);
  const yours = useMemo(() => mostUsed(visits, groups.flatMap((g) => g.items), Date.now()), [visits, groups]);
  const isOpen = (id: string) => open[id] ?? id === here;
  const toggle = (id: string) => { const next = { ...open, [id]: !isOpen(id) }; setOpen(next); write('austin.navOpen', next); };

  const item = (i: NavItem, extra = '') => (
    i.path === '/cabin/timer' ? <TimerNav key={i.path + extra} current={room === i.path} /> : (
      <button key={i.path + extra} className={i.soon ? 'nav-item is-soon' : 'nav-item'} aria-current={room === i.path ? 'page' : undefined} onClick={() => go(i.path)}>
        <span className="glyph">{i.glyph}</span>
        {i.name}
        {i.soon && <span className="soon">soon</span>}
      </button>
    )
  );

  return (
    <nav className="rail" aria-label="Primary">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-name">Austin OS</div>
          <div className="brand-sub">the homestead</div>
        </div>
      </div>
      <button className="rail-search" onClick={openPalette} aria-label="Search and commands"><span aria-hidden>⌕</span><span>Search, go, log…</span><kbd>⌘K</kbd></button>
      {TOP.map((i) => item(i))}
      {yours.length > 0 && (
        <div className="nav-yours">
          <div className="nav-label">Your rooms</div>
          {yours.map((i) => item(i, '-y'))}
        </div>
      )}
      <button className="nav-item nav-all" onClick={() => setMap(true)} aria-haspopup="dialog"><span className="glyph">☷</span>All rooms</button>
      <div className="nav-groups">
        {groups.map((g) => (
          <div key={g.id} className={`nav-group${isOpen(g.id) ? ' open' : ''}${here === g.id ? ' here' : ''}`}>
            <button className="nav-gh" onClick={() => toggle(g.id)} aria-expanded={isOpen(g.id)}>
              <span>{g.label}</span><span className="nav-chev" aria-hidden>›</span>
            </button>
            {isOpen(g.id) && <div className="nav-gi">{g.items.map((i) => item(i))}</div>}
          </div>
        ))}
      </div>
      {item({ path: '/settings', glyph: '⚙', name: 'Settings' })}
      <div className="rail-foot"><AppStatus /><AutoBackupFoot /></div>
      {map && createPortal(<RoomMap groups={groups} current={room} onClose={() => setMap(false)} />, document.body)}
    </nav>
  );
}

/** Every room at once, laid out by building: the phone's way around, and a map on the desk. */
function RoomMap({ groups, current, onClose }: { groups: NavGroup[]; current: string | null; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="room-map" role="dialog" aria-modal="true" aria-label="All rooms" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rm-panel">
        <div className="rm-h"><span className="page-eyebrow">The homestead</span><button className="btn ghost sm" onClick={onClose}>Close</button></div>
        <div className="rm-top">{TOP.map((i) => <button key={i.path} className={current === i.path ? 'rm-room on' : 'rm-room'} onClick={() => go(i.path)}><span aria-hidden>{i.glyph}</span>{i.name}</button>)}</div>
        {groups.map((g) => (
          <section key={g.id} className="rm-group">
            <h3>{g.label}</h3>
            <div className="rm-rooms">
              {g.items.filter((i) => !i.soon).map((i) => <button key={i.path} className={current === i.path ? 'rm-room on' : 'rm-room'} onClick={() => go(i.path)}><span aria-hidden>{i.glyph}</span>{i.name}</button>)}
            </div>
          </section>
        ))}
        <button className="rm-room rm-set" onClick={() => go('/settings')}><span aria-hidden>⚙</span>Settings</button>
      </div>
    </div>
  );
}
