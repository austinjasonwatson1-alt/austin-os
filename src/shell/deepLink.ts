/**
 * Links that do something when opened, for Siri Shortcuts, home-screen bookmarks or a watch:
 *   #/log?m=30&c=writing       log 30 minutes of writing today
 *   #/log?m=15&c=prayer        15 minutes in the Chapel (prayer or scripture)
 *   #/lamp                     start a lamp-mode session
 *   #/health?steps=8412&sleep=7.4&workout=35&kind=cardio   Apple Health, nightly
 *   #/cal?d=2026-11-23&e=09:00-10:00 Standup%0A…            today's calendar
 *   #/idea?t=short: The Lighthouse Wife — she keeps the light   an idea, into the vault
 *   #/move?k=apply             a job-search move (brief, apply, followup, referral); n=2 for two
 *   #/walk?m=30&who=both       walked the dogs (who = both, cooper or shadow)
 *   #/together?m=60            time together, at the Hearth
 *   #/scene?t=interrogation: Gone Girl p. 212 — the silence does the work   a scene, into the Scene Library
 * Pure parsing only.
 */
import { CATS, type CatKey } from '../modules/ledger/types';
import { parseHealth, parseShortcutEvents, type CalEvent, type HealthLink } from '../modules/feeds/logic';

export type DeepLink =
  | { kind: 'log'; mins: number; cat: CatKey }
  | { kind: 'chapel'; mins: number; what: 'prayer' | 'scripture' }
  | { kind: 'lamp' }
  | { kind: 'health'; h: HealthLink }
  | { kind: 'cal'; day: string; events: CalEvent[] }
  | { kind: 'idea'; text: string }
  | { kind: 'move'; move: Move; n: number }
  | { kind: 'walk'; mins: number; who: 'both' | 'cooper' | 'shadow' }
  | { kind: 'together'; mins: number }
  | { kind: 'scene'; text: string }
  | { kind: 'bad'; reason: string };

export type Move = 'brief' | 'apply' | 'followup' | 'referral';
const MOVE_WORDS: Record<string, Move> = { brief: 'brief', apply: 'apply', application: 'apply', applied: 'apply', followup: 'followup', 'follow-up': 'followup', follow: 'followup', referral: 'referral', refer: 'referral', ask: 'referral' };
const minutesIn = (q: URLSearchParams) => Math.round(Number(q.get('m') ?? q.get('min') ?? q.get('minutes')));

export function parseDeepLink(route: string, today = ''): DeepLink | null {
  const [path, query = ''] = route.split('?');
  if (path === '/move') {
    const q = new URLSearchParams(query);
    const move = MOVE_WORDS[(q.get('k') ?? q.get('move') ?? '').toLowerCase()];
    const n = Math.round(Number(q.get('n') ?? 1));
    if (!move) return { kind: 'bad', reason: 'The link needs a move: k=brief, apply, followup or referral.' };
    return { kind: 'move', move, n: n >= 1 && n <= 50 ? n : 1 };
  }
  if (path === '/walk' || path === '/together') {
    const q = new URLSearchParams(query);
    const mins = minutesIn(q);
    if (!mins || mins < 1 || mins > 24 * 60) return { kind: 'bad', reason: 'The link needs a number of minutes, like m=30.' };
    if (path === '/together') return { kind: 'together', mins };
    const w = (q.get('who') ?? 'both').toLowerCase();
    return { kind: 'walk', mins, who: w === 'cooper' || w === 'shadow' ? w : 'both' };
  }
  if (path === '/lamp') return { kind: 'lamp' };
  if (path === '/health') {
    const h = parseHealth(query, today);
    return h ? { kind: 'health', h } : { kind: 'bad', reason: 'The link needs steps, sleep or workout, like steps=8000.' };
  }
  if (path === '/scene') {
    const t = (new URLSearchParams(query).get('t') ?? '').trim();
    return t ? { kind: 'scene', text: t } : { kind: 'bad', reason: 'The link needs the scene, like t=interrogation: Gone Girl p. 212.' };
  }
  if (path === '/idea') {
    const t = (new URLSearchParams(query).get('t') ?? '').trim();
    return t ? { kind: 'idea', text: t } : { kind: 'bad', reason: 'The link needs the idea, like t=What if….' };
  }
  if (path === '/cal') {
    const q = new URLSearchParams(query);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(q.get('d') ?? '') ? q.get('d')! : today;
    return { kind: 'cal', day, events: parseShortcutEvents(q.get('e') ?? '', day) };
  }
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

/** The nightly Apple Health link, with the Shortcut's variables written in brackets. */
export const healthLink = (base: string) => `${base.replace(/#.*$/, '')}#/health?steps=[Steps]&sleep=[Sleep]&workout=[Workout minutes]`;
export const calLink = (base: string) => `${base.replace(/#.*$/, '')}#/cal?e=[Events]`;
export const moveLink = (base: string, k: Move) => `${base.replace(/#.*$/, '')}#/move?k=${k}`;
export const walkLink = (base: string, m: number) => `${base.replace(/#.*$/, '')}#/walk?m=${m}&who=both`;
export const togetherLink = (base: string, m: number) => `${base.replace(/#.*$/, '')}#/together?m=${m}`;
export const sceneLink = (base: string) => `${base.replace(/#.*$/, '')}#/scene?t=[Dictated Text]`;
export const ideaLink = (base: string) => `${base.replace(/#.*$/, '')}#/idea?t=[Dictated Text]`;
