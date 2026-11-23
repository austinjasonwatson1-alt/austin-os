/** The Scene Library: pure parsing, searching and sorting. */
import type { Describer } from '../../core/restoreLogic';
import type { SceneRef } from './types';

/** Scene types for a thriller writer, each with the words that point to it. */
export const SCENE_KINDS: { k: string; label: string; glyph: string; words: string[] }[] = [
  { k: 'interrogation', label: 'Interrogation', glyph: '◉', words: ['interrogation', 'interview', 'questioning', 'questioned', 'detective', 'police', 'confession'] },
  { k: 'opening', label: 'Opening', glyph: '❝', words: ['opening', 'first line', 'first page', 'first chapter', 'prologue', 'hook'] },
  { k: 'reveal', label: 'Reveal & twist', glyph: '✦', words: ['reveal', 'twist', 'revelation', 'turn', 'secret out'] },
  { k: 'lie', label: 'The lie', glyph: '◐', words: ['lie', 'lies', 'liar', 'unreliable', 'deception', 'cover-up', 'cover up', 'alibi'] },
  { k: 'discovery', label: 'Discovery', glyph: '⌕', words: ['discovery', 'body', 'found', 'evidence', 'clue', 'crime scene'] },
  { k: 'confrontation', label: 'Confrontation', glyph: '⚡', words: ['confrontation', 'argument', 'fight', 'row', 'showdown', 'accusation'] },
  { k: 'dread', label: 'Dread & suspense', glyph: '☾', words: ['dread', 'suspense', 'tension', 'menace', 'stalking', 'creepy', 'fear'] },
  { k: 'action', label: 'Action & chase', glyph: '➶', words: ['action', 'chase', 'escape', 'violence', 'attack', 'struggle'] },
  { k: 'cliffhanger', label: 'Chapter ending', glyph: '⤓', words: ['cliffhanger', 'chapter ending', 'end of chapter', 'chapter end'] },
  { k: 'dialogue', label: 'Dialogue', glyph: '❞', words: ['dialogue', 'conversation', 'banter', 'subtext'] },
  { k: 'character', label: 'Character entrance', glyph: '☉', words: ['character', 'entrance', 'introduction', 'introduces', 'villain'] },
  { k: 'marriage', label: 'Marriage & home', glyph: '⌂', words: ['marriage', 'husband', 'wife', 'domestic', 'family', 'kitchen', 'home'] },
  { k: 'grief', label: 'Grief & aftermath', glyph: '❦', words: ['grief', 'loss', 'funeral', 'mourning', 'aftermath'] },
  { k: 'setting', label: 'Setting & place', glyph: '▲', words: ['setting', 'description', 'atmosphere', 'place', 'landscape', 'weather'] },
  { k: 'backstory', label: 'Backstory & flashback', glyph: '↺', words: ['backstory', 'flashback', 'memory', 'the past'] },
  { k: 'ending', label: 'Ending', glyph: '◼', words: ['ending', 'final chapter', 'last line', 'epilogue', 'climax'] },
];
export const OTHER = { k: 'other', label: 'Other', glyph: '◇' };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/** A kind's label and glyph; Austin's own kinds show as he wrote them. */
export function kindOf(k: string): { k: string; label: string; glyph: string } {
  const b = SCENE_KINDS.find((x) => x.k === k);
  if (b) return b;
  if (!k || k === 'other') return OTHER;
  return { k, label: k.charAt(0).toUpperCase() + k.slice(1), glyph: '◇' };
}

/** The kind a word (or phrase) means: "interview" → interrogation; anything else stays his own. */
export function matchKind(word: string): string {
  const w = norm(word).replace(/^(?:the|a|an) /, '');
  if (!w) return 'other';
  const hit = SCENE_KINDS.find((x) => x.k === w || norm(x.label) === w || x.words.includes(w));
  return hit ? hit.k : w;
}

/** Kinds a chapter's title or text suggests, so the writing desk can open on the right scenes. */
export function suggestKinds(text: string): string[] {
  const t = ` ${norm(text).replace(/[^a-z0-9' -]/g, ' ')} `;
  return SCENE_KINDS.filter((x) => x.words.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `))).map((x) => x.k);
}

const WHERE = /\bp(?:age|g)?\.?\s*\d+(?:\s*[-–]\s*\d+)?\b|\bch(?:apter|\.)?\s*\d+\b|\b\d{1,3}\s*%|\bloc(?:ation)?\.?\s*\d+\b/i;

/**
 * A quick capture: "interrogation: Gone Girl p. 212 — the detective lets the silence do the work".
 * The kind comes before the colon; a shelf book named after it is linked; a page, chapter or
 * percent is picked out; what follows the dash is why it works. Only the kind and source are needed.
 */
export function parseSceneCapture(text: string, books: { id: string; title: string; author?: string }[]): Omit<SceneRef, 'id' | 'added'> | null {
  const raw = text.trim();
  if (!raw) return null;
  // The kind: before a colon, or (dictated, no colon) the first one to three words if they name a kind.
  let kind = 'other';
  let rest = raw;
  const colon = raw.indexOf(':');
  if (colon > 0 && colon < 40) { kind = matchKind(raw.slice(0, colon)); rest = raw.slice(colon + 1); } else {
    const words = raw.split(/\s+/);
    for (const n of [3, 2, 1]) {
      const k = matchKind(words.slice(0, n).join(' ').replace(/[,.;]+$/, ''));
      if (SCENE_KINDS.some((x) => x.k === k)) { kind = k; rest = words.slice(n).join(' '); break; }
    }
  }
  rest = rest.trim().replace(/^[,;:]\s*/, '');
  // Why it works: after a dash; or (dictated) whatever follows the page; or whatever follows a shelf book's title.
  let why = '';
  const dash = rest.search(/\s[—–-]\s|\s--\s/);
  if (dash >= 0) { why = rest.slice(dash).replace(/^\s*(?:—|–|--|-)\s*/, '').trim(); rest = rest.slice(0, dash).trim(); }
  const w = rest.match(WHERE);
  const where = w ? w[0].replace(/\s+/g, ' ').trim() : undefined;
  let source = rest;
  if (w) {
    const at = rest.indexOf(w[0]);
    if (!why) why = rest.slice(at + w[0].length).replace(/^[\s,;.]+/, '').trim();
    source = rest.slice(0, at);
  }
  source = source.replace(/[,;·\s]+$/, '').replace(/\s{2,}/g, ' ').trim();
  const book = matchBook(source, books);
  if (book && !why && !w) {
    // Dictated, "interrogation Gone Girl the silence does the work": after the shelf title comes why.
    const t = norm(book.title).replace(/^the /, '');
    const at = source.toLowerCase().indexOf(t);
    const after = at >= 0 ? source.slice(at + t.length).replace(/^[\s,;.]+/, '').trim() : '';
    if (after) { why = after; source = book.title; }
  }
  if (!source && !why) return null;
  return {
    kind, label: why ? firstWords(why) : `${kindOf(kind).label} in ${book?.title ?? source}`,
    source: book ? `${book.title}${book.author ? ` · ${book.author}` : ''}` : source, bookId: book?.id, where, why: why || undefined, tags: [],
  };
}

const firstWords = (s: string, n = 8) => { const w = s.split(/\s+/); return w.length > n ? `${w.slice(0, n).join(' ')}…` : s; };

/** The shelf book a source names, by title (case and "The" don't matter). */
export function matchBook<B extends { title: string }>(source: string, books: B[]): B | undefined {
  const s = norm(source).replace(/^the /, '');
  if (!s) return undefined;
  return books.find((b) => { const t = norm(b.title).replace(/^the /, ''); return t === s || (t.length > 3 && s.startsWith(t)); });
}

/** Scenes matching a search (any field) and, optionally, kinds; newest first. */
export function findScenes(scenes: SceneRef[], q: string, kinds: string[] = []): SceneRef[] {
  const words = norm(q).split(' ').filter(Boolean);
  return scenes
    .filter((s) => !kinds.length || kinds.includes(s.kind))
    .filter((s) => { const hay = norm([s.label, s.source, s.where, s.passage, s.why, kindOf(s.kind).label, ...s.tags].filter(Boolean).join(' ')); return words.every((w) => hay.includes(w)); })
    .sort((a, b) => b.added.localeCompare(a.added) || b.id.localeCompare(a.id));
}

/** How many scenes of each kind, in the library's order (his own kinds after the built-ins). */
export function kindCounts(scenes: SceneRef[]): { k: string; label: string; glyph: string; n: number }[] {
  const n = new Map<string, number>();
  for (const s of scenes) n.set(s.kind, (n.get(s.kind) ?? 0) + 1);
  const own = [...n.keys()].filter((k) => !SCENE_KINDS.some((x) => x.k === k) && k !== 'other').sort();
  return [...SCENE_KINDS.map((x) => x.k), ...own, 'other'].filter((k) => n.has(k)).map((k) => ({ ...kindOf(k), n: n.get(k)! }));
}

/** Tidy a scene before saving: trimmed text, tags without "#" or repeats. */
export function cleanScene<T extends Omit<SceneRef, 'id' | 'added'>>(s: T): T {
  const t = (v?: string) => v?.trim() || undefined;
  return { ...s, kind: s.kind.trim() || 'other', label: s.label.trim(), source: s.source.trim(), where: t(s.where), passage: t(s.passage), why: t(s.why),
    tags: [...new Set(s.tags.map((x) => x.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))] };
}

export const describeRefs: Describer = {
  name: 'The Scene Library',
  size: (v) => ((v as { scenes?: unknown[] })?.scenes ?? []).length,
  detail: (v) => { const n = ((v as { scenes?: unknown[] })?.scenes ?? []).length; return `${n} scene${n === 1 ? '' : 's'} marked`; },
};
