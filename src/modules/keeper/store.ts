/**
 * The Keeper: an AI companion that reads the homestead and answers in a mentor's voice.
 * Off until an Anthropic API key is added in Settings. The key and the permissions live only on
 * this device (a `sys:` key, never in backups or sync); requests go straight from this browser to
 * Anthropic, carrying only the areas allowed.
 */
import { create } from 'zustand';
import type SDK from '@anthropic-ai/sdk';
import { todayISO } from '../../core/dates';
import { kvDel, kvGet, kvSet, SYS_PREFIX } from '../../core/storage';
import { useChapel } from '../chapel/store';
import { useLedger } from '../ledger/store';
import { useManuscripts } from '../manuscripts/store';
import { usePub } from '../pub/store';
import { useReview } from '../review/store';
import { useShelf } from '../shelf/store';
import { useRefs } from '../refs/store';
import { askPrompt, briefing, DEFAULT_ALLOW, fallbackRejected, keeperError, KEEPER_SYSTEM, type Allow, type Ask, type KeeperData } from './logic';
import { AREA_STORES } from '../areas/store';
import { areaMinutes } from '../areas/logic';
import { useFeeds } from '../feeds/store';
import { useKennel } from '../kennel/store';
import { kennelWalkMinutes } from '../kennel/logic';
import { useMoney } from '../money/store';
import { moneyBrief } from '../money/logic';

const KEY = SYS_PREFIX + 'keeper';
const NOTE = SYS_PREFIX + 'keeper.note';
const MODEL = 'claude-opus-5-5';

interface Saved { apiKey: string; allow: Allow }

interface KeeperState {
  loaded: boolean;
  enabled: boolean;
  allow: Allow;
  note: { date: string; text: string } | null;
  error: string | null;
  load: () => Promise<void>;
  setKey: (apiKey: string) => Promise<void>;
  forget: () => Promise<void>;
  setAllow: (a: Allow) => Promise<void>;
  /** Ask the Keeper something. Resolves to its reply text. */
  ask: (kind: Ask, extra?: { chapterTitle?: string; chapterText?: string; query?: string; question?: string }) => Promise<string>;
  /** Today's morning note, written once a day. */
  morning: () => Promise<void>;
}

let apiKey = '';

export const useKeeper = create<KeeperState>((set, get) => ({
  loaded: false,
  enabled: false,
  allow: DEFAULT_ALLOW,
  note: null,
  error: null,

  async load() {
    if (get().loaded) return;
    const s = await kvGet<Saved>(KEY);
    const note = await kvGet<{ date: string; text: string }>(NOTE);
    if (s?.apiKey) apiKey = s.apiKey;
    set({ loaded: true, enabled: Boolean(s?.apiKey), allow: { ...DEFAULT_ALLOW, ...(s?.allow ?? {}) }, note: note ?? null });
  },

  async setKey(k) {
    apiKey = k.trim();
    await kvSet(KEY, { apiKey, allow: get().allow } satisfies Saved);
    set({ enabled: true, error: null });
  },

  async forget() {
    apiKey = '';
    await kvDel(KEY);
    await kvDel(NOTE);
    set({ enabled: false, note: null });
  },

  async setAllow(allow) {
    set({ allow });
    if (apiKey) await kvSet(KEY, { apiKey, allow } satisfies Saved);
  },

  async ask(kind, extra = {}) {
    if (!apiKey) throw new Error('The Keeper is off. Add an Anthropic API key in Settings.');
    await Promise.all([useLedger.getState().load(), useManuscripts.getState().load(), useReview.getState().load(), useShelf.getState().load(), usePub.getState().load(), useChapel.getState().load(), useRefs.getState().load()]);
    const l = useLedger.getState();
    const allow = get().allow;
    const brief = briefing({
      today: todayISO(), days: l.days, manuscripts: useManuscripts.getState().manuscripts, reviews: useReview.getState().reviews,
      books: useShelf.getState().books, pub: usePub.getState(), chapel: useChapel.getState(), scenes: useRefs.getState().scenes,
      ...(await lifeContext(allow)),
    }, allow);
    // The SDK is only loaded when the Keeper is actually used.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const system: SDK.TextBlockParam[] = [{ type: 'text', text: KEEPER_SYSTEM, cache_control: { type: 'ephemeral' } }];
    const messages: SDK.MessageParam[] = [{ role: 'user', content: `Here is what's in the homestead right now:\n\n${brief}\n\n${askPrompt(kind, { ...extra, chapterText: get().allow.chapterText ? extra.chapterText : undefined })}` }];
    const effort = kind === 'morning' ? 'low' : 'medium';
    const textOf = (content: { type: string; text?: string }[]) => content.flatMap((b) => (b.type === 'text' && b.text ? [b.text] : [])).join('\n').trim();
    try {
      let res: { stop_reason: string | null; content: { type: string; text?: string }[] };
      try {
        // With refusal fallbacks on: a declined request is re-run on another model inside the same call.
        res = await client.beta.messages.create({
          model: MODEL, max_tokens: 16000, output_config: { effort },
          betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          system, messages,
        });
      } catch (e) {
        // If this account doesn't take the fallback setting, ask again plainly rather than fail.
        if (!(e instanceof Anthropic.BadRequestError && fallbackRejected(e.message))) throw e;
        res = await client.messages.create({ model: MODEL, max_tokens: 16000, output_config: { effort }, system, messages });
      }
      if (res.stop_reason === 'refusal') throw new Error('The Keeper couldn’t answer that one.');
      const text = textOf(res.content);
      if (!text) throw new Error('The Keeper went quiet; try asking again.');
      set({ error: null });
      return text;
    } catch (e) {
      const body = e instanceof Anthropic.APIError ? (e.error as { error?: { type?: string; message?: string } } | undefined)?.error : undefined;
      const msg = e instanceof Anthropic.APIConnectionError ? keeperError(0, '', '')
        : e instanceof Anthropic.APIError ? keeperError(e.status ?? 0, body?.type ?? '', body?.message ?? e.message)
          : e instanceof Error ? e.message : String(e);
      console.error('The Keeper:', e);
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async morning() {
    const today = todayISO();
    if (!get().enabled || get().note?.date === today) return;
    try {
      const text = await get().ask('morning');
      const note = { date: today, text };
      await kvSet(NOTE, note);
      set({ note });
    } catch { /* error is in state */ }
  },
}));

/** The rest of life for the briefing, loaded only for what the Keeper is allowed to read. */
async function lifeContext(allow: Allow): Promise<Partial<KeeperData>> {
  const out: Partial<KeeperData> = {};
  if (allow.life || allow.calendar) await useFeeds.getState().load();
  if (allow.life) {
    const a = AREA_STORES;
    await Promise.all([a.office.getState().load(), a.observatory.getState().load(), a.forge.getState().load(), a.hearth.getState().load(), useKennel.getState().load()]);
    const per = (days: Record<string, Record<string, number>>) => Object.fromEntries(Object.entries(days).map(([k, v]) => [k, areaMinutes(v)]));
    const k = useKennel.getState(); const f = useFeeds.getState();
    out.life = {
      work: per(a.office.getState().days), learning: per(a.observatory.getState().days), body: per(a.forge.getState().days), family: per(a.hearth.getState().days),
      walks: Object.fromEntries(k.walks.map((w) => [w.date, kennelWalkMinutes(k, w.date)])),
      steps: Object.fromEntries(Object.entries(f.days).filter(([, v]) => v.steps).map(([d, v]) => [d, v.steps!])),
      sleep: Object.fromEntries(Object.entries(f.days).filter(([, v]) => v.sleep).map(([d, v]) => [d, v.sleep!])),
    };
  }
  if (allow.calendar) out.events = useFeeds.getState().events;
  if (allow.money) {
    await useMoney.getState().load();
    const txns = useMoney.getState().txns; const today = todayISO();
    const d = new Date(`${today}T12:00:00`); d.setMonth(d.getMonth() - 1);
    const months = [today.slice(0, 7), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`];
    out.money = months.map((ym) => moneyBrief(txns, ym));
  }
  return out;
}
