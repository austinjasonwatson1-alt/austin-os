import { useEffect } from 'react';
import { setAmbient, type AmbientKind } from '../core/ambient';
import { useSky } from '../core/skyStore';

/**
 * A room's own sound (fire in the Cabin, an organ hum in the Chapel, a quiet office…), playing
 * while you're in the room if room sounds are on. The speaker button turns them on or off everywhere.
 */
export function RoomSound({ kind, label }: { kind: AmbientKind; label: string }) {
  const on = useSky((s) => Boolean(s.prefs.roomSound));
  useEffect(() => {
    if (!on) return;
    setAmbient(kind);
    return () => setAmbient(null);
  }, [on, kind]);
  return (
    <button className={on ? 'room-sound on' : 'room-sound'} onClick={() => useSky.getState().setRoomSound(!on)} aria-pressed={on}
      title={on ? `Room sounds on: ${label}` : `Play this room's sound: ${label}`}>
      <span aria-hidden>{on ? '\u266a' : '\u266b'}</span> {on ? label : 'Sound off'}
    </button>
  );
}
