/**
 * Two-device sync through the shared backup file. Merging only ever ADDS: anything on this
 * device stays exactly as it is, and things only the other device has are brought in.
 * (So a deletion on one device doesn't carry over — the other copy brings the item back.)
 * Pure functions; no browser APIs.
 */
import { mergeDays } from '../modules/ledger/logic';
import type { DayMap } from '../modules/ledger/types';

type Obj = Record<string, unknown>;
type WithId = { id: string } & Obj;

const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Keep every local item; add remote ones with ids we don't have. `pick` resolves a shared id. */
export function unionById<T extends WithId>(local: T[], remote: T[], pick: (l: T, r: T) => T = (l) => l): T[] {
  const byId = new Map(remote.map((r) => [r.id, r]));
  const out = local.map((l) => (byId.has(l.id) ? pick(l, byId.get(l.id)!) : l));
  const have = new Set(local.map((l) => l.id));
  for (const r of remote) if (!have.has(r.id)) out.push(r);
  return out;
}

/** Fill gaps in `l` from `r` field by field (local values always win). */
const fill = (l: Obj, r: Obj): Obj => {
  const out = { ...l };
  for (const [k, v] of Object.entries(r)) if (out[k] === undefined || out[k] === '' || out[k] === null) out[k] = v;
  return out;
};

const MERGERS: Record<string, (l: Obj, r: Obj) => Obj> = {
  'ledger.v3': (l, r) => ({
    ...l,
    days: mergeDays((l.days ?? {}) as DayMap, (r.days ?? {}) as DayMap).merged,
    deadlines: [...arr<Obj>(l.deadlines), ...arr<Obj>(r.deadlines).filter((d) => !arr<Obj>(l.deadlines).some((x) => x.n === d.n && x.d === d.d))],
  }),
  'lounge.v1': (l, r) => ({
    ...l,
    rewards: unionById(arr<WithId>(l.rewards), arr<WithId>(r.rewards)),
    // A claim marked bought on either device counts as bought.
    claims: unionById(arr<WithId>(l.claims), arr<WithId>(r.claims), (a, b) => (a.boughtAt || !b.boughtAt ? a : { ...a, boughtAt: b.boughtAt })),
  }),
  'timer.v1': (l, r) => ({
    ...l,
    sessions: unionById(arr<WithId>(l.sessions), arr<WithId>(r.sessions)).sort((a, b) => Number(b.startedAt) - Number(a.startedAt)),
  }),
  'shelf.v1': (l, r) => ({ ...l, books: unionById(arr<WithId>(l.books), arr<WithId>(r.books)) }),
  'manuscripts.v1': (l, r) => ({
    ...l,
    manuscripts: unionById(arr<WithId>(l.manuscripts), arr<WithId>(r.manuscripts), (a, b) => ({
      ...a,
      chapters: unionById(arr<WithId>(a.chapters), arr<WithId>(b.chapters)),
      history: { ...(isObj(b.history) ? b.history : {}), ...(isObj(a.history) ? a.history : {}) },
    })),
  }),
  'chapel.v1': (l, r) => {
    const days: Obj = { ...(isObj(r.days) ? r.days : {}) };
    for (const [d, v] of Object.entries(isObj(l.days) ? l.days : {})) {
      const o = isObj(days[d]) ? (days[d] as Obj) : {};
      const lv = v as Obj;
      days[d] = {
        ...o, ...lv,
        prayer: Math.max(Number(lv.prayer) || 0, Number(o.prayer) || 0) || undefined,
        scripture: Math.max(Number(lv.scripture) || 0, Number(o.scripture) || 0) || undefined,
        note: lv.note || o.note,
      };
    }
    return {
      ...l,
      days,
      prayers: unionById(arr<WithId>(l.prayers), arr<WithId>(r.prayers), (a, b) => (a.answeredOn || !b.answeredOn ? a : { ...a, answeredOn: b.answeredOn, answer: b.answer })),
      verses: unionById(arr<WithId>(l.verses), arr<WithId>(r.verses)),
    };
  },
  'review.v1': (l, r) => {
    const reviews: Obj = { ...(isObj(r.reviews) ? r.reviews : {}) };
    for (const [w, v] of Object.entries(isObj(l.reviews) ? l.reviews : {})) reviews[w] = fill(v as Obj, isObj(reviews[w]) ? (reviews[w] as Obj) : {});
    return { ...l, reviews };
  },
};

/** Settings and device-local keys are never synced. */
const SKIP = (k: string) => k.startsWith('snap:') || k.startsWith('sys:') || k === 'os.backupMeta';

/** Merge everything from the other device's backup into this device's data. Returns only keys that change. */
export function syncMerge(local: Record<string, unknown>, remote: Record<string, unknown>): Record<string, unknown> {
  const writes: Record<string, unknown> = {};
  for (const [key, rv] of Object.entries(remote)) {
    if (SKIP(key) || rv === undefined) continue;
    const lv = local[key];
    let next: unknown;
    if (lv === undefined) next = rv;
    else if (MERGERS[key] && isObj(lv) && isObj(rv)) next = MERGERS[key](lv, rv);
    else if (key.startsWith('area.') && isObj(lv) && isObj(rv)) next = mergeArea(lv, rv);
    else continue; // unknown or settings: this device's copy stands
    if (JSON.stringify(next) !== JSON.stringify(lv)) writes[key] = next;
  }
  return writes;
}

/** Office / Observatory style areas: minutes per day (bigger wins) and lists by id. */
function mergeArea(l: Obj, r: Obj): Obj {
  const days: Obj = { ...(isObj(r.days) ? r.days : {}) };
  for (const [d, v] of Object.entries(isObj(l.days) ? l.days : {})) {
    const o = isObj(days[d]) ? (days[d] as Obj) : {};
    const lv = v as Obj;
    const merged: Obj = { ...o };
    for (const [k, x] of Object.entries(lv)) merged[k] = typeof x === 'number' ? Math.max(x, Number(o[k]) || 0) : x || o[k];
    days[d] = merged;
  }
  const out: Obj = { ...l, days };
  for (const k of Object.keys({ ...l, ...r })) {
    if (k !== 'days' && (Array.isArray(l[k]) || Array.isArray(r[k]))) out[k] = unionById(arr<WithId>(l[k]), arr<WithId>(r[k]));
  }
  return out;
}
