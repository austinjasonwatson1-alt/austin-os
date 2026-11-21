/**
 * Links that do something when opened, for Siri Shortcuts, home-screen bookmarks or a watch:
 *   #/log?m=30&c=writing       log 30 minutes of writing today
 *   #/log?m=15&c=prayer        15 minutes in the Chapel (prayer or scripture)
 *   #/lamp                     start a lamp-mode session
 * Pure parsing only.
 */
import { CATS, type CatKey } from '../modules/ledger/types';

export type DeepLink =
  | { kind: 'log'; mins: number; cat: CatKey }
  | { kind: 'chapel'; mins: number; what: 'prayer' | 'scripture' }
  | { kind: 'lamp' }
  | { kind: 'bad'; reason: string };

export function parseDeepLink(route: string): DeepLink | null {
  const [path, query = ''] = route.split('?');
  if (path === '/lamp') return { kind: 'lamp' };
  if (path !== '/log') return null;
  const q = new URLSearchParams(query);
  const mins = Math.round(Number(q.get('m') ?? q.get('min') ?? q.get('minutes')));
  const c = (q.get('c') ?? q.get('cat') ?? 'writing').toLowerCase();
  if (!mins || mins < 1 || mins > 24 * 60) return { kind: 'bad', reason: 'The link needs a number of minutes, like m=30.' };
  if (c === 'prayer' || c === 'scripture') return { kind: 'chapel', mins, what: c };
  const cat = CATS.find((x) => x.k === c || x.name.toLowerCase() === c || x.name.toLowerCase().startsWith(c));
  if (!cat) return { kind: 'bad', reason: `"${c}" isn't one of the Ledger's categories.` };
  return { kind: 'log', mins, cat: cat.k };
}

/** The link for a quick-log shortcut, to copy into the Shortcuts app. */
export const logLink = (base: string, mins: number, cat: string) => `${base.replace(/#.*$/, '')}#/log?m=${mins}&c=${cat}`;
