/** Which sounds play where: pure rules, from the page you're on, the weather and the time. */
import type { Mix } from './ambient';
import type { Phase, Season, Weather } from './skyLogic';

export interface SoundWorld { weather: Weather | null; phase: Phase; season: Season }
export interface Scene { mix: Mix; label: string }

const wet = (w: Weather | null) => w === 'rain' || w === 'storm';

/** Outside, on the homestead: the real weather if we know it, otherwise the time of day and the season. */
export function outdoors(x: SoundWorld): Scene {
  if (x.weather === 'storm') return { mix: { rain: 1, thunder: 0.9, wind: 0.3 }, label: 'A storm over the homestead' };
  if (x.weather === 'rain') return { mix: { rain: 0.9, wind: 0.15, brook: 0.2 }, label: 'Rain on the homestead' };
  if (x.weather === 'snow') return { mix: { hush: 0.6, wind: 0.35 }, label: 'Snow falling, and the hush' };
  if (x.weather === 'fog') return { mix: { wind: 0.25, brook: 0.35, hush: 0.25 }, label: 'Fog, and the brook somewhere in it' };
  const winter = x.season === 'winter';
  switch (x.phase) {
    case 'night':
      return winter ? { mix: { wind: 0.4, owl: 0.5, hush: 0.25 }, label: 'A winter night, an owl in the pines' }
        : { mix: { crickets: 0.7, owl: 0.3, brook: 0.2 }, label: 'Crickets under the stars' };
    case 'dawn':
      return { mix: { birds: winter ? 0.4 : 1, brook: 0.3, wind: winter ? 0.25 : 0 }, label: 'The dawn chorus' };
    case 'day':
      return winter ? { mix: { birds: 0.2, wind: 0.4, brook: 0.15 }, label: 'A cold bright day' }
        : { mix: { birds: 0.6, brook: 0.4, wind: 0.15 }, label: 'Birdsong and the brook' };
    default:
      return { mix: { birds: 0.3, crickets: winter ? 0 : 0.3, brook: 0.3, chimes: 0.2 }, label: 'Evening on the porch' };
  }
}

/** What you hear indoors of the weather outside: rain on the roof, thunder far off, wind at the eaves. */
function throughTheWalls(x: SoundWorld): Mix {
  if (x.weather === 'storm') return { rain: 0.5, thunder: 0.6 };
  if (x.weather === 'rain') return { rain: 0.45 };
  if (x.weather === 'snow' || x.season === 'winter') return { wind: 0.18 };
  return {};
}

/** The scene for a page. */
export function sceneFor(route: string, x: SoundWorld): Scene {
  const r = route.replace(/\/+$/, '') || '/home';
  const roof = throughTheWalls(x);
  const raining = wet(x.weather);
  if (r.startsWith('/cabin/write') || r === '/cabin/timer') {
    return { mix: { calm: 0.8, rain: raining ? 0.6 : 0.35, fire: 0.3 }, label: raining ? 'Calm for writing, and real rain on the roof' : 'Calm for writing: soft keys, gentle rain, the fire' };
  }
  if (r === '/cabin/lounge') return { mix: { fire: 0.9, calm: 0.25, ...roof }, label: raining ? 'The lounge fire, rain on the windows' : 'The lounge fire' };
  if (r === '/cabin' || r.startsWith('/cabin/')) return { mix: { fire: 0.8, ...roof }, label: raining ? 'The cabin fire, rain on the roof' : 'The cabin fire' };
  if (r === '/chapel') return { mix: { organ: 0.8, hush: 0.2, ...(raining ? { rain: 0.3 } : {}) }, label: 'The chapel at rest' };
  if (r === '/office' || r === '/bank' || r === '/money') return { mix: { room: 0.8, ...roof }, label: r === '/office' ? 'A quiet office' : 'A quiet counting room' };
  if (r === '/observatory') return { mix: { wind: 0.6, ...(x.phase === 'night' && x.season !== 'winter' ? { crickets: 0.4 } : {}) }, label: 'Wind on the dome' };
  if (r === '/kennel') return { mix: { ...outdoors(x).mix, fire: 0.45, ...roof }, label: 'The kennel porch' };
  if (r === '/forge') return { mix: { fire: 0.9, wind: 0.2 }, label: 'The forge fire' };
  if (r === '/hearth') return { mix: { fire: 0.7, chimes: 0.4, ...roof }, label: 'The hearth, and chimes on the porch' };
  if (r === '/keeper') return { mix: { fire: 0.5, calm: 0.45, ...roof }, label: 'By the fire with the Keeper' };
  if (['/records', '/library', '/year', '/film', '/review', '/settings', '/memories', '/life', '/goals', '/day'].includes(r)) return { mix: { calm: 0.65, fire: 0.2, ...roof }, label: 'A calm room' };
  return outdoors(x);
}
