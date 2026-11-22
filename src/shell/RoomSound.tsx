import { setSoundscape, unlock, type AmbientKind } from '../core/ambient';
import { useSky } from '../core/skyStore';
import { useSoundLabel } from './Soundscape';

/**
 * A room's sound button: turns the soundscape on or off, and says what this room sounds like.
 * (What plays is decided in soundLogic.ts; `kind` is kept so the rooms read the same.)
 */
export function RoomSound(props: { kind: AmbientKind; label: string }) {
  const on = useSky((s) => Boolean(s.prefs.roomSound));
  const now = useSoundLabel((s) => s.label);
  return (
    <button className={on ? 'room-sound on' : 'room-sound'} aria-pressed={on}
      onClick={() => { useSky.getState().setRoomSound(!on); if (!on) { setSoundscape(true); unlock(); } }}
      title={on ? `Sound on: ${now || props.label}` : `Hear this room: ${props.label}`}>
      <span aria-hidden>{on ? '\u266a' : '\u266b'}</span> {on ? now || props.label : 'Sound off'}
    </button>
  );
}
