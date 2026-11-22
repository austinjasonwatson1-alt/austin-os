/** The Idea Vault: every book, story and scene idea, caught before it's gone. Pure. */
import type { Describer } from '../../core/restoreLogic';

export type IdeaKind = 'novel' | 'short' | 'flash' | 'scene' | 'character' | 'title' | 'nonfiction' | 'other';
export type IdeaStage = 'spark' | 'growing' | 'ready' | 'written' | 'shelved';

export interface Idea {
  id: string;
  kind: IdeaKind;
  /** A working title (can be blank: the spark is enough). */
  title: string;
  /** The idea in a line: the hook, the what-if. */
  spark: string;
  notes?: string;
  /** Books it would sit beside on a shelf. */
  comps?: string;
  tags: string[];
  /** How alive it feels right now, 1–3. */
  heat: 1 | 2 | 3;
  stage: IdeaStage;
  created: string;
  updated: string;
  /** The manuscript it became, once started. */
  ms?: string;
}

export interface IdeasData { ideas: Idea[] }
export const DEFAULT_IDEAS: IdeasData = { ideas: [] };

export const KINDS: { k: IdeaKind; label: string; plural: string; glyph: string; color: string }[] = [
  { k: 'novel', label: 'Novel', plural: 'Novels', glyph: '❡', color: '#E8A84B' },
  { k: 'short', label: 'Short story', plural: 'Short stories', glyph: '✧', color: '#8EC5E8' },
  { k: 'flash', label: 'Flash', plural: 'Flash', glyph: 'ϟ', color: '#E07A3F' },
  { k: 'scene', label: 'Scene', plural: 'Scenes', glyph: '❖', color: '#9FD3A8' },
  { k: 'character', label: 'Character', plural: 'Characters', glyph: '☺', color: '#D97BA4' },
  { k: 'title', label: 'Title', plural: 'Titles', glyph: '“', color: '#F2D58A' },
  { k: 'nonfiction', label: 'Nonfiction', plural: 'Nonfiction', glyph: '✎', color: '#8E7CF0' },
  { k: 'other', label: 'Other', plural: 'Other', glyph: '✦', color: '#B9B2A2' },
];
export const STAGES: { k: IdeaStage; label: string }[] = [
  { k: 'spark', label: 'Spark' }, { k: 'growing', label: 'Growing' }, { k: 'ready', label: 'Ready to write' }, { k: 'written', label: 'Written' }, { k: 'shelved', label: 'Shelved' },
];

const ALIASES: Record<string, IdeaKind> = {
  novel: 'novel', book: 'novel', short: 'short', story: 'short', ss: 'short', flash: 'flash', scene: 'scene', character: 'character', char: 'character',
  title: 'title', nonfiction: 'nonfiction', essay: 'nonfiction', nf: 'nonfiction', other: 'other',
};

/**
 * Quick capture: "short: A lighthouse keeper's wife…", "#novel The second phone", or plain text
 * (kind as chosen). A "Title — premise" or "Title: premise" splits into title and spark when the
 * title part is short. #words become tags.
 */
export function parseCapture(raw: string, fallback: IdeaKind): { kind: IdeaKind; title: string; spark: string; tags: string[] } {
  let text = raw.trim();
  let kind = fallback;
  // "short:", "#flash", "short story:", or (as Siri dictates it, with no colon) "Short story the last ferry…".
  const pre = text.match(/^#?([a-z]+(?:[ -][a-z]+)?)\s*:\s*/i) ?? text.match(/^#([a-z]+)\s+/i) ?? text.match(/^(short story|flash fiction|novel idea|book idea|story idea|scene idea|title idea|character idea)[,.]?\s+/i);
  const key = pre?.[1].toLowerCase().replace(/[ -]+(idea|fiction)$/, '').replace(/^short[ -]story$/, 'short');
  if (pre && key && ALIASES[key]) { kind = ALIASES[key]; text = text.slice(pre[0].length); }
  const tags: string[] = [];
  const take = (t: string) => { const k = ALIASES[t.toLowerCase()]; if (k && kind === fallback) kind = k; else tags.push(t.toLowerCase()); };
  // A run of #tags at the end comes off the text; a #word mid-sentence stays as a word.
  const tail = text.match(/(?:\s*#[\p{L}\p{N}-]+)+\s*$/u);
  if (tail) { for (const m of tail[0].matchAll(/#([\p{L}\p{N}-]+)/gu)) take(m[1]); text = text.slice(0, tail.index); }
  text = text.replace(/(^|\s)#([\p{L}\p{N}-]+)/gu, (_, sp: string, t: string) => { take(t); return sp + t; }).replace(/\s{2,}/g, ' ').trim();
  const split = text.match(/^(.{2,60}?)\s+[—–-]{1,2}\s+(.+)$/) ?? text.match(/^([^:]{2,60}):\s+(.+)$/);
  if (split && split[1].split(' ').length <= 8) return { kind, title: split[1].trim(), spark: split[2].trim(), tags };
  return { kind, title: '', spark: text, tags };
}

export interface IdeaFilter { q?: string; kind?: IdeaKind | null; stage?: IdeaStage | 'open' | null; tag?: string | null }

/** Open ideas (not written or shelved) by default; hottest and newest first. */
export function filterIdeas(ideas: Idea[], f: IdeaFilter): Idea[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return ideas
    .filter((i) => !f.kind || i.kind === f.kind)
    .filter((i) => (f.stage === 'open' || f.stage === undefined ? i.stage !== 'written' && i.stage !== 'shelved' : !f.stage || i.stage === f.stage))
    .filter((i) => !f.tag || i.tags.includes(f.tag))
    .filter((i) => !q || [i.title, i.spark, i.notes ?? '', i.comps ?? '', i.tags.join(' ')].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.heat - a.heat || b.updated.localeCompare(a.updated));
}

export const kindCounts = (ideas: Idea[]) => Object.fromEntries(KINDS.map(({ k }) => [k, ideas.filter((i) => i.kind === k && i.stage !== 'shelved').length])) as Record<IdeaKind, number>;

export function allTags(ideas: Idea[]): { tag: string; n: number }[] {
  const m = new Map<string, number>();
  for (const i of ideas) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

/** An idea worth another look: open, untouched the longest (a seed makes it change day to day, not on every render). */
export function revisit(ideas: Idea[], today: string, seed = 0): Idea | null {
  const open = ideas.filter((i) => i.stage !== 'written' && i.stage !== 'shelved');
  if (!open.length) return null;
  const old = [...open].sort((a, b) => a.updated.localeCompare(b.updated)).slice(0, Math.max(3, Math.ceil(open.length / 3)));
  const h = [...`${today}${seed}`].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  return old[h % old.length];
}

export const daysSince = (iso: string, today: string) => Math.max(0, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${iso.slice(0, 10)}T12:00:00`)) / 86_400_000));

export const describeIdeas: Describer = {
  name: 'The Idea Vault',
  size: (v) => (v as Partial<IdeasData>)?.ideas?.length ?? 0,
  detail: (v) => {
    const i = (v as Partial<IdeasData>)?.ideas ?? [];
    const novels = i.filter((x) => x.kind === 'novel').length, shorts = i.filter((x) => x.kind === 'short' || x.kind === 'flash').length;
    return `${i.length} idea${i.length === 1 ? '' : 's'}${i.length ? ` · ${novels} novel${novels === 1 ? '' : 's'}, ${shorts} short` : ''}`;
  },
};
