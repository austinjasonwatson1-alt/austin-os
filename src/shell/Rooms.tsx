import { go } from './router';
import { tilt } from './fx';
import { MODULES, type ModuleDef } from '../modules/registry';

export function Room({ m }: { m: ModuleDef }) {
  const live = Boolean(m.component);
  return (
    <button className={live ? 'room tilt' : 'room'} disabled={!live} onClick={() => go(m.path)} {...(live ? tilt(5) : {})}>
      <span className={live ? 'chip live' : 'chip'}>{live ? 'Live' : 'Planned'}</span>
      <span className="room-glyph" style={{ color: 'var(--lamp)' }}>{m.glyph}</span>
      <span className="room-name">{m.name}</span>
      <span className="room-desc">{m.blurb}</span>
    </button>
  );
}

export const cabinRooms = () => MODULES.filter((m) => m.section === 'cabin');
