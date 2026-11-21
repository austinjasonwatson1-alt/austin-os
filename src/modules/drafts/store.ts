import { create } from 'zustand';
import { kvGet, saveWithSnapshot } from '../../core/storage';
import { useManuscripts } from '../manuscripts/store';
import { countWords, maybeVersion } from './logic';
import { DEFAULT_DRAFTS, type DraftsData } from './types';

export const KEY = 'drafts.v1';

interface DraftsState extends DraftsData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Save a chapter's text; also keeps the chapter's word count on the board in step. */
  setText: (ms: string, ch: string, text: string) => void;
  /** Keep a version now (e.g. on leaving the editor). */
  keepVersion: (ms: string, ch: string, label?: string) => void;
  /** Put an old version back. The current text is kept as a version first. */
  restoreVersion: (ms: string, ch: string, at: string) => void;
  setAuthor: (a: DraftsData['author']) => void;
}

export const useDrafts = create<DraftsState>((set, get) => {
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { drafts: get().drafts, versions: get().versions, author: get().author } satisfies DraftsData); };
  const syncWords = (ms: string, ch: string, text: string) => {
    const m = useManuscripts.getState();
    const c = m.manuscripts.find((x) => x.id === ms)?.chapters.find((x) => x.id === ch);
    const words = countWords(text);
    if (c && c.words !== words) m.saveChapter(ms, { ...c, words });
  };

  return {
    ...DEFAULT_DRAFTS,
    loaded: false,
    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<DraftsData>(KEY);
      set({ ...DEFAULT_DRAFTS, ...(saved ?? {}), author: { ...DEFAULT_DRAFTS.author, ...(saved?.author ?? {}) }, loaded: true });
    },
    setText(ms, ch, text) {
      const k = `${ms}/${ch}`;
      const now = new Date();
      set({
        drafts: { ...get().drafts, [k]: { text, updatedAt: now.toISOString() } },
        versions: { ...get().versions, [k]: maybeVersion(get().versions[k] ?? [], text, now) },
      });
      persist();
      syncWords(ms, ch, text);
    },
    keepVersion(ms, ch, label) {
      const k = `${ms}/${ch}`;
      const text = get().drafts[k]?.text;
      if (text === undefined) return;
      set({ versions: { ...get().versions, [k]: maybeVersion(get().versions[k] ?? [], text, new Date(), true, label) } });
      persist();
    },
    restoreVersion(ms, ch, at) {
      const k = `${ms}/${ch}`;
      const v = (get().versions[k] ?? []).find((x) => x.at === at);
      if (!v) return;
      get().keepVersion(ms, ch, 'Before restoring an older version');
      set({ drafts: { ...get().drafts, [k]: { text: v.text, updatedAt: new Date().toISOString() } } });
      persist();
      syncWords(ms, ch, v.text);
    },
    setAuthor(author) { set({ author }); persist(); },
  };
});
