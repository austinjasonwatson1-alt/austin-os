import type { Describer } from '../../core/restoreLogic';
import { KEEP_VERSIONS, VERSION_EVERY_MS, type DraftsData, type Version } from './types';

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
