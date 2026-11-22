import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { audioRunning, outputLevel, playingLayers, setScene, setSoundscape, setVolume, suspendAudio, unlock } from '../core/ambient';
import { season, skyPhase } from '../core/skyLogic';
import { useSky } from '../core/skyStore';
import { sceneFor } from '../core/soundLogic';
import { go, useRoute } from './router';
import '../styles/sound.css';

/** What's playing, for the controls to show. */
export const useSoundLabel = create<{ label: string; waiting: boolean; layers: string }>(() => ({ label: '', waiting: false, layers: '' }));
const refreshLayers = () => setTimeout(() => useSoundLabel.setState({ layers: playingLayers().join(' ') }), 60);

/**
 * The soundscape, running for the whole app: picks the scene for the page you're on, the weather and
 * the hour, and crossfades to it. Sound can only start after a tap, so the first one starts it.
 */
if (typeof window !== 'undefined') (window as unknown as { __austinSound: unknown }).__austinSound = { level: outputLevel, layers: playingLayers };

export function Soundscape() {
  const route = useRoute();
  const on = useSky((s) => Boolean(s.prefs.roomSound));
  const vol = useSky((s) => s.prefs.volume ?? 0.6);
  const weather = useSky((s) => (s.weatherOn ? s.weather : null));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);
  useEffect(() => { void useSky.getState().load(); }, []);

  const sc = sceneFor(route, { weather, phase: skyPhase(now), season: season(now) });
  useEffect(() => { setScene(sc.mix); useSoundLabel.setState({ label: sc.label }); refreshLayers(); }, [JSON.stringify(sc.mix), sc.label]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setVolume(vol); }, [vol]);
  useEffect(() => {
    setSoundscape(on);
    refreshLayers();
    if (!on) { useSoundLabel.setState({ waiting: false }); return; }
    if (audioRunning()) return;
    // Wait for the first touch or key press, then start.
    useSoundLabel.setState({ waiting: true });
    const start = () => { if (unlock()) { useSoundLabel.setState({ waiting: false }); refreshLayers(); off(); } };
    const off = () => { window.removeEventListener('pointerdown', start, true); window.removeEventListener('keydown', start, true); };
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('keydown', start, true);
    return off;
  }, [on]);
  useEffect(() => {
    const vis = () => suspendAudio(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  return <SoundDial />;
}

/** The little dial in the corner: on/off, how loud, and what you're hearing. */
function SoundDial() {
  const route = useRoute();
  const on = useSky((s) => Boolean(s.prefs.roomSound));
  const vol = useSky((s) => s.prefs.volume ?? 0.6);
  const weatherOn = useSky((s) => s.weatherOn);
  const { label, waiting, layers } = useSoundLabel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  // The writing room is meant to be quiet to look at: the dial tucks in there.
  const tucked = route.startsWith('/cabin/write') || route === '/cabin/timer';

  const toggle = () => { const next = !on; useSky.getState().setRoomSound(next); if (next) { setSoundscape(true); unlock(); } };
  return (
    <div ref={ref} className={`sound-dial${on ? ' on' : ''}${tucked ? ' tucked' : ''}${route === '/keeper' ? ' raised' : ''}`} data-layers={layers}>
      {open && (
        <div className="sd-panel" role="dialog" aria-label="Sound">
          <div className="sd-row">
            <span className="mono sd-h">Soundscape</span>
            <label className="switch sm"><input type="checkbox" checked={on} onChange={toggle} /><span className="switch-ui" aria-hidden /></label>
          </div>
          <p className="sd-now">{on ? (waiting ? 'Tap anywhere to let the sound in.' : label) : 'Off. Turn it on for rain, birdsong, the fire and calm for writing.'}</p>
          <label className="sd-vol">
            <span className="mono" aria-hidden>quiet</span>
            <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => useSky.getState().setVolume(Number(e.target.value))} aria-label="Volume" disabled={!on} />
            <span className="mono" aria-hidden>full</span>
          </label>
          {!weatherOn && <button className="linkish" onClick={() => { setOpen(false); go('/settings'); }}>Turn on Real weather to hear it when it’s really raining →</button>}
        </div>
      )}
      <button className="sd-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={on ? `Sound: ${label}` : 'Sound off'} title={on ? label : 'Sound off'}>
        <span className="sd-bars" aria-hidden><i /><i /><i /><i /></span>
        {on && !tucked && <span className="sd-label">{waiting ? 'Tap to hear' : label}</span>}
      </button>
    </div>
  );
}
