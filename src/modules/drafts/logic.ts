import type { Describer } from '../../core/restoreLogic';
import { KEEP_VERSIONS, VERSION_EVERY_MS, type DraftsData, type Sprint, type Version } from './types';

/** Words the way publishers count them: runs of letters/digits, with apostrophes and hyphens inside words. */
export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

/** Paragraphs from plain text: blank lines (or single newlines) separate them; a line that's just "#" or "***" is a scene break. */
export function paragraphs(text: string): ({ kind: 'p'; text: string } | { kind: 'break' })[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^(#|\*\s*\*\s*\*|\*{3})$/.test(l) ? { kind: 'break' as const } : { kind: 'p' as const, text: l }));
}

/** Add a version if enough time has passed (or forced), newest first, capped. Unchanged text never adds one. */
export function maybeVersion(list: Version[], text: string, now: Date, force = false, label?: string): Version[] {
  const last = list[0];
  if (last && last.text === text) return list;
  if (!force && last && now.getTime() - Date.parse(last.at) < VERSION_EVERY_MS) return list;
  return [{ at: now.toISOString(), text, words: countWords(text), label }, ...list].slice(0, KEEP_VERSIONS);
}

/** Standard manuscript format rounds the title-page count: to the nearest 100 (or 1,000 for long works). */
export function roundedCount(words: number): string {
  const r = words >= 20000 ? Math.round(words / 1000) * 1000 : Math.max(100, Math.round(words / 100) * 100);
  return `about ${r.toLocaleString('en-US')} words`;
}

export const describeDrafts: Describer = {
  name: 'Chapter drafts',
  size: (v) => Object.keys((v as Partial<DraftsData>).drafts ?? {}).length,
  detail: (v) => {
    const d = (v as Partial<DraftsData>).drafts ?? {};
    const words = Object.values(d).reduce((s, x) => s + countWords(x.text), 0);
    return `${Object.keys(d).length} chapter${Object.keys(d).length === 1 ? '' : 's'} · ${words.toLocaleString('en-US')} words`;
  },
};

/* ---------------- word sprints ---------------- */

/** Words a minute, to one decimal. */
export const wpm = (words: number, minutes: number) => (minutes > 0 ? Math.round((words / minutes) * 10) / 10 : 0);

/** The best sprint so far: most words in a completed sprint. */
export function bestSprint(sprints: Sprint[]): Sprint | null {
  return sprints.filter((s) => s.completed).reduce<Sprint | null>((a, b) => (!a || b.words > a.words ? b : a), null);
}

/** Lounge points for sprints: 5 for each completed sprint, 10 more each time one beats the best before it. */
export const SPRINT_POINTS = { done: 5, best: 10 };
export function sprintPoints(sprints: Sprint[]): { total: number; done: number; bests: number } {
  let best = 0, done = 0, bests = 0;
  for (const s of [...sprints].sort((a, b) => a.at.localeCompare(b.at))) {
    if (!s.completed || s.words <= 0) continue;
    done++;
    if (s.words > best) { if (best > 0) bests++; best = s.words; }
  }
  return { total: done * SPRINT_POINTS.done + bests * SPRINT_POINTS.best, done, bests };
}

/** How a finished sprint went, against the ones before it. */
export function sprintVerdict(s: Pick<Sprint, 'words' | 'minutes' | 'completed'>, before: Sprint[]): { pace: number; best: boolean; prevBest: number } {
  const prev = bestSprint(before)?.words ?? 0;
  return { pace: wpm(s.words, s.minutes), best: s.completed && s.words > prev && s.words > 0, prevBest: prev };
}
