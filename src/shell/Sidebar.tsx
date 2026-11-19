import { go, useRoute } from './router';
import { MODULES } from '../modules/registry';
import { AutoBackupFoot } from './AutoBackup';

export function Sidebar() {
  const route = useRoute();
  const item = (path: string, glyph: string, name: string, soon = false) => (
    <button key={path} className={soon ? 'nav-item is-soon' : 'nav-item'} aria-current={route === path ? 'page' : undefined} onClick={() => go(path)}>
      <span className="glyph">{glyph}</span>
      {name}
      {soon && <span className="soon">soon</span>}
    </button>
  );

  return (
    <nav className="rail" aria-label="Primary">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-name">Austin OS</div>
          <div className="brand-sub">personal system</div>
        </div>
      </div>
      {item('/home', '◈', 'Home')}
      <div className="nav-label">Writer's Cabin</div>
      {item('/cabin', '⌂', 'The Cabin')}
      {MODULES.filter((m) => m.section === 'cabin').map((m) => item(m.path, m.glyph, m.name, !m.component))}
      <div className="rail-foot"><AutoBackupFoot /></div>
    </nav>
  );
}
