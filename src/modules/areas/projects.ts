/** The Observatory's project gallery: pure parsing and grouping. */
import type { AreaItem } from './types';

export type Stage = 'idea' | 'building' | 'shipped';
export const STAGE_LABEL: Record<Stage, string> = { idea: 'Idea', building: 'Building', shipped: 'Shipped' };
export const KINDS = ['Game', 'Writing tool', 'Job search', 'Work', 'Life', 'Agent', 'Other'];

export interface ProjectDraft { text: string; link?: string; kind: string; stage: Stage; body?: string }

/**
 * A pasted list, one project per line: "Name | link | kind | stage | what it is" (only the name is
 * needed; a bare URL anywhere on the line is taken as the link). Lines starting with # are comments.
 */
export function parseProjectList(text: string): ProjectDraft[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((line) => {
    const parts = line.split('|').map((p) => p.trim());
    const url = line.match(/https?:\/\/\S+/)?.[0];
    const rest = parts.map((p) => p.replace(/https?:\/\/\S+/g, '').trim()).filter(Boolean);
    const [name = '', kindRaw = '', stageRaw = '', body = ''] = rest;
    const kind = KINDS.find((k) => k.toLowerCase() === kindRaw.toLowerCase()) ?? (kindRaw ? 'Other' : 'Other');
    const st = stageRaw.toLowerCase();
    const stage: Stage = st.startsWith('idea') || st.startsWith('plan') ? 'idea' : st.startsWith('build') || st.startsWith('wip') ? 'building' : 'shipped';
    return { text: name.replace(/https?:\/\/\S+/, '').trim(), link: url, kind, stage, ...(body ? { body } : {}) };
  }).filter((p) => p.text);
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** What an import would add: projects not already there (by name or link). */
export function previewProjects(existing: AreaItem[], incoming: ProjectDraft[]): { add: ProjectDraft[]; skip: number } {
  const names = new Set(existing.map((i) => key(i.text)));
  const links = new Set(existing.map((i) => i.link).filter(Boolean));
  const seen = new Set<string>();
  const add = incoming.filter((p) => { const k = key(p.text); if (names.has(k) || (p.link && links.has(p.link)) || seen.has(k)) return false; seen.add(k); return true; });
  return { add, skip: incoming.length - add.length };
}

/** Projects by kind, shipped first, newest first within each. */
export function groupProjects(items: AreaItem[]): { kind: string; items: AreaItem[] }[] {
  const order: Record<string, number> = { building: 0, shipped: 1, idea: 2 };
  const by = new Map<string, AreaItem[]>();
  for (const i of items) by.set(i.kind ?? 'Other', [...(by.get(i.kind ?? 'Other') ?? []), i]);
  return [...by].sort(([a], [b]) => KINDS.indexOf(a) - KINDS.indexOf(b))
    .map(([kind, list]) => ({ kind, items: list.sort((a, b) => (order[a.stage ?? 'shipped'] - order[b.stage ?? 'shipped']) || b.date.localeCompare(a.date)) }));
}

/** A project's cover is drawn, not uploaded: its kind picks the scene, its name seeds the colours. */
export function coverSeed(name: string): { hue: number; a: number; b: number; c: number } {
  let h = 2166136261;
  for (const ch of name.toLowerCase().trim()) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  const r = (shift: number) => (((h >>> shift) & 0xff) / 256);
  return { hue: (h >>> 0) % 360, a: r(3), b: r(11), c: r(19) };
}
