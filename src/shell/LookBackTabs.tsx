import { go, useRoute } from './router';
import '../styles/lookback.css';

const TABS = [
  { path: '/review', label: 'This week', glyph: '◷' },
  { path: '/year', label: 'The year', glyph: '◎' },
  { path: '/library', label: 'Library of You', glyph: '❦' },
  { path: '/records', label: 'Hall of Records', glyph: '♛' },
  { path: '/film', label: 'The film', glyph: '▶' },
];

/** Looking back: one room, five views. Sits at the top of each. */
export function LookBackTabs() {
  const route = useRoute();
  return (
    <nav className="lookback rise" aria-label="Looking back">
      <span className="lb-title mono">Looking back</span>
      <div className="lb-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.path} role="tab" aria-selected={route === t.path} className={route === t.path ? 'lb-tab on' : 'lb-tab'} onClick={() => go(t.path)}>
            <span aria-hidden>{t.glyph}</span>{t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
