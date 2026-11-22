import { go, useRoute } from './router';
import { AREAS, MODULES } from '../modules/registry';
import { AutoBackupFoot } from './AutoBackup';
import { AppStatus } from './AppStatus';
import { openPalette } from './CommandPalette';
import { useEffect, useState } from 'react';
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

export function Sidebar() {
  const route = useRoute();
  const item = (path: string, glyph: string, name: string, soon = false) => (
    <button key={path} className={soon ? 'nav-item is-soon' : 'nav-item'} aria-current={route === path ? 'page' : undefined} onClick={() => go(path)}>
      <span className="glyph">{glyph}</span>
      {name}
      {soon && <span className="soon">soon</span>}
    </button>
  );
  const cabin = AREAS[0];

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
      {item('/home', '◈', 'Home')}
      {item('/keeper', '♨', 'The Keeper')}
      {item('/review', '◷', 'Weekly review')}
      {item('/year', '◎', 'Year in review')}
      {item('/library', '❦', 'Library of You')}
      {item('/records', '♛', 'Hall of Records')}
      {item('/life', '✧', 'The Compass')}
      {item('/goals', '⛰', 'Seasons of life')}
      {item('/kennel', '🐾', 'The Kennel')}
      {item('/memories', '❀', 'Memories')}
      <div className="nav-label">Writer's Cabin</div>
      {item(cabin.path, cabin.glyph, 'The Cabin')}
      {MODULES.filter((m) => m.section === 'cabin').map((m) => (m.id === 'timer' ? <TimerNav key={m.id} current={route === m.path} /> : item(m.path, m.glyph, m.name, !m.component)))}
      <div className="nav-label">The Homestead</div>
      {AREAS.filter((a) => a.id !== 'cabin').map((a) => item(a.path, a.glyph, a.name, !a.live))}
      {item('/settings', '⚙', 'Settings')}
      <div className="rail-foot"><AppStatus /><AutoBackupFoot /></div>
    </nav>
  );
}
