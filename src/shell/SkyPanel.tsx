import { chime } from '../core/ambient';
import { moonName, moonPhase, season, skyPhase } from '../core/skyLogic';
import { useSky } from '../core/skyStore';
import { useMinuteClock } from './lamp';

const PHASE: Record<string, string> = { night: 'Night', dawn: 'Dawn', day: 'Daylight', golden: 'Golden hour', dusk: 'Dusk' };
const SEASON: Record<string, string> = { winter: 'Winter · snow on the pines', spring: 'Spring · blossoms on the wind', summer: 'Summer · fireflies', autumn: 'Autumn · falling leaves' };
const WX: Record<string, string> = { clear: 'Clear', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' };

/** Home's "Sky & sound" settings: what the sky is doing, chimes, and opt-in local weather. */
export function SkyPanel() {
  const now = useMinuteClock();
  const s = useSky();
  const p = moonPhase(now);
  return (
    <section className="panel skypanel">
      <div className="panel-h"><p className="panel-t">Sky &amp; sound</p></div>
      <ul className="sky-facts">
        <li><span>Light</span><b>{PHASE[skyPhase(now)]}</b></li>
        <li><span>Moon</span><b>{moonName(p)}</b></li>
        <li><span>Season</span><b>{SEASON[season(now)]}</b></li>
        <li><span>Weather</span><b>{s.weatherOn ? (s.weather ? `${WX[s.weather]}${s.temp !== null ? ` · ${s.temp}°F` : ''}` : 'Checking…') : 'Off'}</b></li>
      </ul>
      <div className="sky-toggles">
        <label className="switch">
          <input type="checkbox" checked={s.prefs.chime} onChange={(e) => { s.setChime(e.target.checked); if (e.target.checked) chime(); }} />
          <span className="switch-ui" aria-hidden />
          <span><b>Chimes</b><small>A soft bell on an elite day and when a lamp-mode goal is reached.</small></span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={Boolean(s.prefs.roomSound)} onChange={(e) => s.setRoomSound(e.target.checked)} />
          <span className="switch-ui" aria-hidden />
          <span><b>Soundscape</b><small>Calm sound wherever you are: rain when it's really raining (with Real weather on), birdsong by day and crickets at night on the homestead, the fire in the cabin, soft keys for writing, the organ in the Chapel.</small></span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={s.weatherOn} onChange={(e) => void (e.target.checked ? s.enableWeather() : s.disableWeather())} />
          <span className="switch-ui" aria-hidden />
          <span><b>Real weather</b><small>Rain, snow and storms in the sky when they're outside. Uses a rough location (about 10 km), kept on this device.</small></span>
        </label>
      </div>
      {s.weatherErr && <p className="sky-err mono">{s.weatherErr}</p>}
    </section>
  );
}
