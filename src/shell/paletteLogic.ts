/** Pure helpers for the ⌘K command palette: fuzzy ranking and "log 30 writing" parsing. */
import { CATS, type CatKey } from '../modules/ledger/types';

export interface Command {
  id: string;
  title: string;
  hint?: string;
  keywords?: string;
  group: 'Go to' | 'Do' | 'Log';
}

/** Score how well `q` matches: all query letters in order; bonuses for word starts and runs. 0 = no match. */
export function fuzzyScore(q: string, text: string): number {
  const query = q.toLowerCase().replace(/\s+/g, '');
  const t = text.toLowerCase();
  if (!query) return 1;
  let score = 0, ti = 0, run = 0;
  for (const ch of query) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return 0;
    run = at === ti ? run + 1 : 1;
    score += 1 + run * 2 + (at === 0 || /[\s·\-/]/.test(t[at - 1]) ? 4 : 0);
    ti = at + 1;
  }
  return score + (t.startsWith(q.toLowerCase()) ? 10 : 0) - t.length * 0.01;
}

export function rank<T extends Command>(cmds: T[], q: string): T[] {
  return cmds
    .map((c) => ({ c, s: Math.max(fuzzyScore(q, c.title), fuzzyScore(q, `${c.title} ${c.keywords ?? ''}`) * 0.8) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

/**
 * Understand quick logging typed into the palette: "30 writing", "log 45m editing", "1h reading",
 * "w 20" (category by prefix). Returns null when it isn't a log.
 */
export function parseLog(q: string): { mins: number; cat: CatKey } | null {
  const s = q.toLowerCase().replace(/^log\s+/, '').trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)?\s+([a-z]+)$/) ?? s.match(/^([a-z]+)\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)?$/);
  if (!m) return null;
  const [num, unit, word] = /^\d/.test(m[1]) ? [m[1], m[2], m[3]] : [m[2], m[3], m[1]];
  const mins = Math.round(Number(num) * (unit && unit.startsWith('h') ? 60 : 1));
  const cat = CATS.find((c) => c.name.toLowerCase().startsWith(word) || c.k.startsWith(word));
  if (!cat || !mins || mins > 24 * 60) return null;
  return { mins, cat: cat.k };
}
