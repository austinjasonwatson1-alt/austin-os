import { create } from 'zustand';
import { kvGet, markDeleted, saveWithSnapshot } from '../../core/storage';
import { useManuscripts } from '../manuscripts/store';
import { DEFAULT_IDEAS, type Idea, type IdeaKind, type IdeasData } from './logic';

export const KEY = 'ideas.v1';

interface IdeasState extends IdeasData {
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  add: (p: { kind: IdeaKind; title: string; spark: string; tags: string[] }) => Idea;
  save: (i: Idea) => void;
  remove: (id: string) => void;
  /** Start a novel idea as a manuscript: the title, with the spark as its logline. */
  startManuscript: (id: string) => string | null;
}

const newId = () => `idea-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useIdeas = create<IdeasState>((set, get) => {
  const persist = () => { if (get().loaded) void saveWithSnapshot(KEY, { ideas: get().ideas } satisfies IdeasData); };
  return {
    ...DEFAULT_IDEAS,
    loaded: false,
    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<IdeasData>(KEY);
      set({ ideas: saved?.ideas ?? [], loaded: true });
    },
    add(p) {
      const now = new Date().toISOString();
      const idea: Idea = { id: newId(), kind: p.kind, title: p.title.trim(), spark: p.spark.trim(), tags: p.tags, heat: 2, stage: 'spark', created: now, updated: now };
      set({ ideas: [idea, ...get().ideas] });
      persist();
      return idea;
    },
    save(i) {
      const next = { ...i, title: i.title.trim(), spark: i.spark.trim(), updated: new Date().toISOString() };
      set({ ideas: get().ideas.some((x) => x.id === i.id) ? get().ideas.map((x) => (x.id === i.id ? next : x)) : [next, ...get().ideas] });
      persist();
    },
    remove(id) {
      void markDeleted(KEY, id);
      set({ ideas: get().ideas.filter((x) => x.id !== id) });
      persist();
    },
    startManuscript(id) {
      const i = get().ideas.find((x) => x.id === id);
      if (!i) return null;
      const m = useManuscripts.getState();
      const ms = m.addManuscript(i.title || i.spark.split(/[.!?]/)[0].slice(0, 60));
      m.updateManuscript(ms, { logline: i.spark });
      get().save({ ...i, ms, stage: 'written' });
      return ms;
    },
  };
});
