import { useEffect } from 'react';
import { go } from '../../shell/router';
import { useKeeper } from './store';
import '../../styles/keeper.css';

/** The morning note on Home: one short message a day, if the Keeper is on. */
export function KeeperNote() {
  const k = useKeeper();
  useEffect(() => { void k.load().then(() => useKeeper.getState().morning()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!k.enabled || !k.note) return null;
  return (
    <button className="keeper-note" onClick={() => go('/keeper')}>
      <span className="keeper-lantern sm" aria-hidden><i /></span>
      <span><span className="mono">The Keeper · this morning</span><p>{k.note.text}</p></span>
    </button>
  );
}
