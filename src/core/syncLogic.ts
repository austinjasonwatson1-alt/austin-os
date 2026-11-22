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

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

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
  'pub.v1': (l, r) => ({
    ...l,
    queries: unionById(arr<WithId>(l.queries), arr<WithId>(r.queries)),
    contests: unionById(arr<WithId>(l.contests), arr<WithId>(r.contests)),
    feedback: unionById(arr<WithId>(l.feedback), arr<WithId>(r.feedback)),
    outreach: unionById(arr<WithId>(l.outreach), arr<WithId>(r.outreach)),
    road: fill(isObj(l.road) ? l.road : {}, isObj(r.road) ? r.road : {}),
  }),
  'shelf.v1': (l, r) => ({
    ...l,
    books: unionById(arr<WithId>(l.books), arr<WithId>(r.books)),
    ...(l.goals || r.goals ? { goals: { ...obj(r.goals), ...obj(l.goals) } } : {}),
  }),
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
  // Chapter text: the most recently edited copy of each chapter wins; versions from both are kept.
  'drafts.v1': (l, r) => {
    const drafts: Obj = { ...(isObj(r.drafts) ? r.drafts : {}) };
    for (const [k, v] of Object.entries(isObj(l.drafts) ? l.drafts : {})) {
      const o = drafts[k] as Obj | undefined;
      if (!o || String((v as Obj).updatedAt) >= String(o.updatedAt)) drafts[k] = v;
    }
    const versions: Obj = { ...(isObj(r.versions) ? r.versions : {}) };
    for (const [k, v] of Object.entries(isObj(l.versions) ? l.versions : {})) {
      const all = [...arr<Obj>(v), ...arr<Obj>(versions[k])];
      const seen = new Set<string>();
      versions[k] = all.filter((x) => (seen.has(String(x.at)) ? false : (seen.add(String(x.at)), true))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30);
    }
    return { ...l, drafts, versions, ...(l.sprints || r.sprints ? { sprints: unionById(arr<WithId>(l.sprints), arr<WithId>(r.sprints)) } : {}) };
  },
  'life.v1': (l, r) => ({ ...r, ...l, targets: { ...(isObj(r.targets) ? r.targets : {}), ...(isObj(l.targets) ? l.targets : {}) } }),
  'kennel.v1': (l, r) => ({ ...l, walks: unionById(arr<WithId>(l.walks), arr<WithId>(r.walks)), care: unionById(arr<WithId>(l.care), arr<WithId>(r.care)), weights: unionById(arr<WithId>(l.weights), arr<WithId>(r.weights)), notes: unionById(arr<WithId>(l.notes), arr<WithId>(r.notes)) }),
  'body.v1': (l, r) => { const days: Obj = { ...(isObj(r.days) ? r.days : {}) }; for (const [k, v] of Object.entries(isObj(l.days) ? l.days : {})) days[k] = { ...(isObj(days[k]) ? (days[k] as Obj) : {}), ...(v as Obj) }; return { ...l, days }; },
  'money.v1': (l, r) => ({ ...l, txns: unionById(arr<WithId>(l.txns), arr<WithId>(r.txns)), rules: unionById(arr<WithId>(l.rules), arr<WithId>(r.rules)) }),
  'memories.v1': (l, r) => ({ ...l, items: unionById(arr<WithId>(l.items), arr<WithId>(r.items)), capsules: unionById(arr<WithId>(l.capsules), arr<WithId>(r.capsules), (a, b) => (a.openedOn || !b.openedOn ? a : { ...a, openedOn: b.openedOn })) }),
  'goals.v1': (l, r) => ({ ...l, goals: unionById(arr<WithId>(l.goals), arr<WithId>(r.goals)), milestones: unionById(arr<WithId>(l.milestones), arr<WithId>(r.milestones)) }),
  'review.v1': (l, r) => {
    const reviews: Obj = { ...(isObj(r.reviews) ? r.reviews : {}) };
    for (const [w, v] of Object.entries(isObj(l.reviews) ? l.reviews : {})) reviews[w] = fill(v as Obj, isObj(reviews[w]) ? (reviews[w] as Obj) : {});
    return { ...l, reviews };
  },
};

/** Settings and device-local keys are never synced. */
const SKIP = (k: string) => k.startsWith('snap:') || k.startsWith('sys:') || k === 'os.backupMeta' || k === DELETED;

/** Deletions: { storeKey: { itemId: deletedAt } }. Shared between devices so a delete on one sticks on the other. */
export const DELETED = 'sync.deleted';
export type Tombstones = Record<string, Record<string, string>>;

export function mergeTombstones(a: unknown, b: unknown): Tombstones {
  const out: Tombstones = {};
  for (const t of [a, b]) {
    if (!isObj(t)) continue;
    for (const [k, ids] of Object.entries(t)) if (isObj(ids)) out[k] = { ...(out[k] ?? {}), ...(ids as Record<string, string>) };
  }
  return out;
}

/** Remove deleted items (by id) anywhere inside a value, a few levels deep (e.g. manuscripts → chapters). */
export function prune(v: unknown, dead: Record<string, string> | undefined, depth = 0): unknown {
  if (!dead || depth > 4) return v;
  if (Array.isArray(v)) return v.filter((x) => !(isObj(x) && typeof x.id === 'string' && dead[x.id])).map((x) => prune(x, dead, depth + 1));
  if (isObj(v)) {
    const out: Obj = {};
    for (const [k, x] of Object.entries(v)) out[k] = prune(x, dead, depth + 1);
    return out;
  }
  return v;
}

/** Merge everything from the other device's backup into this device's data. Returns only keys that change. */
export function syncMerge(local: Record<string, unknown>, remote: Record<string, unknown>): Record<string, unknown> {
  const writes: Record<string, unknown> = {};
  const tomb = mergeTombstones(local[DELETED], remote[DELETED]);
  const keys = new Set([...Object.keys(remote), ...Object.keys(tomb)]);
  for (const key of keys) {
    if (SKIP(key)) continue;
    // A photo whose memory was deleted on either device stays gone (photos live under their own keys).
    if (key.startsWith('memories.photo.') && tomb['memories.v1']?.[key.slice('memories.photo.'.length)]) continue;
    const rv = remote[key];
    const lv = local[key];
    let next: unknown;
    if (rv === undefined) next = lv;
    else if (lv === undefined) next = rv;
    else if (MERGERS[key] && isObj(lv) && isObj(rv)) next = MERGERS[key](lv, rv);
    else if (key.startsWith('area.') && isObj(lv) && isObj(rv)) next = mergeArea(lv, rv);
    else next = lv; // unknown or settings: this device's copy stands
    if (next === undefined) continue;
    next = prune(next, tomb[key]);
    if (JSON.stringify(next) !== JSON.stringify(lv)) writes[key] = next;
  }
  if (Object.keys(tomb).length && JSON.stringify(tomb) !== JSON.stringify(local[DELETED] ?? {})) writes[DELETED] = tomb;
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
