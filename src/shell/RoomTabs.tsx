import { setOf } from './navLogic';
import { go } from './router';
import '../styles/roomtabs.css';

/** One room, several views: the strip at the top of each view in a family (see ROOM_SETS). */
export function RoomTabs({ route }: { route: string }) {
  const r = route.split('?')[0];
  const set = setOf(r);
  if (!set) return null;
  return (
    <nav className="lookback rise" aria-label={set.label}>
      <span className="lb-title mono">{set.label}</span>
      <div className="lb-tabs" role="tablist">
        {set.tabs.map((t) => (
          <button key={t.path} role="tab" aria-selected={r === t.path} className={r === t.path ? 'lb-tab on' : 'lb-tab'} onClick={() => go(t.path)}>
            <span aria-hidden>{t.glyph}</span>{t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
