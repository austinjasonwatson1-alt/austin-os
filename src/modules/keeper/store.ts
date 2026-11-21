/**
 * The Keeper: an AI companion that reads the homestead and answers in a mentor's voice.
 * Off until an Anthropic API key is added in Settings. The key and the permissions live only on
 * this device (a `sys:` key, never in backups or sync); requests go straight from this browser to
 * Anthropic, carrying only the areas allowed.
 */
import { create } from 'zustand';
import { todayISO } from '../../core/dates';
import { kvDel, kvGet, kvSet, SYS_PREFIX } from '../../core/storage';
import { useChapel } from '../chapel/store';
import { useLedger } from '../ledger/store';
import { useManuscripts } from '../manuscripts/store';
import { usePub } from '../pub/store';
import { useReview } from '../review/store';
import { useShelf } from '../shelf/store';
import { askPrompt, briefing, DEFAULT_ALLOW, KEEPER_SYSTEM, type Allow, type Ask } from './logic';

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
    await Promise.all([useLedger.getState().load(), useManuscripts.getState().load(), useReview.getState().load(), useShelf.getState().load(), usePub.getState().load(), useChapel.getState().load()]);
    const l = useLedger.getState();
    const brief = briefing({
      today: todayISO(), days: l.days, manuscripts: useManuscripts.getState().manuscripts, reviews: useReview.getState().reviews,
      books: useShelf.getState().books, pub: usePub.getState(), chapel: useChapel.getState(),
    }, get().allow);
    // The SDK is only loaded when the Keeper is actually used.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    try {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: kind === 'morning' ? 'low' : 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: KEEPER_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Here is what's in the homestead right now:\n\n${brief}\n\n${askPrompt(kind, { ...extra, chapterText: get().allow.chapterText ? extra.chapterText : undefined })}` }],
      });
      if (res.stop_reason === 'refusal') throw new Error('The Keeper couldn’t answer that one.');
      const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
      set({ error: null });
      return text;
    } catch (e) {
      const msg = e instanceof Anthropic.AuthenticationError ? 'That API key wasn’t accepted. Check it in Settings.'
        : e instanceof Anthropic.RateLimitError ? 'Too many requests right now; try again in a minute.'
          : e instanceof Anthropic.APIConnectionError ? 'Couldn’t reach Anthropic. Are you online?'
            : e instanceof Error ? e.message : String(e);
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
