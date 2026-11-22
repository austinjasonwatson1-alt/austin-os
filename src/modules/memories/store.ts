import { create } from 'zustand';
import { kvDel, kvGet, kvKeys, kvSet, markDeleted, saveWithSnapshot } from '../../core/storage';
import { todayISO } from '../../core/dates';
import { orphanPhotoIds, type CapsuleDraft } from './logic';
import { DEFAULT_MEMORIES, KEY, PHOTO_PREFIX, photoKey, type Capsule, type Memory, type MemoriesData, type MemoryTag } from './types';

export { KEY };

export interface NewPhoto { full: string; thumb: string; day: string; caption: string; tag?: MemoryTag }

export type MemoriesView = 'memories' | 'capsule';

interface MemoriesState extends MemoriesData {
  loaded: boolean;
  /** Which half of the page is showing (UI only, never saved) — lets Home deep-link to the capsule. */
  view: MemoriesView;
  setView: (v: MemoriesView) => void;
  /** Read from storage once; `force` re-reads after a restore or sync. */
  load: (force?: boolean) => Promise<void>;
  /** Save the full photos (each under its own key) first, then list them. Returns what was added. */
  addPhotos: (photos: NewPhoto[]) => Promise<Memory[]>;
  update: (id: string, patch: Partial<Pick<Memory, 'caption' | 'day' | 'tag'>>) => void;
  remove: (id: string) => Promise<void>;
  /** The full-size photo (a JPEG data URL), if this device has it. */
  photo: (id: string) => Promise<string | undefined>;
  writeCapsule: (d: CapsuleDraft) => Capsule;
  /** Break the seal (dated letters once ready, event letters whenever he says). */
  openCapsule: (id: string) => void;
  removeCapsule: (id: string) => void;
}

const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useMemories = create<MemoriesState>((set, get) => {
  // Never write before the saved copy has been read: that would replace real data with an empty list.
  const persist = () => {
    if (get().loaded) void saveWithSnapshot(KEY, { items: get().items, capsules: get().capsules } satisfies MemoriesData);
  };

  return {
    ...DEFAULT_MEMORIES,
    loaded: false,
    view: 'memories',
    setView: (view) => set({ view }),

    async load(force = false) {
      if (get().loaded && !force) return;
      const saved = await kvGet<Partial<MemoriesData>>(KEY);
      const items = Array.isArray(saved?.items) ? saved.items : [];
      const capsules = Array.isArray(saved?.capsules) ? saved.capsules : [];
      set({ items, capsules, loaded: true });
      // Tidy away full photos whose memory was deleted here or on another device. Best effort.
      try {
        const dead = (await kvGet<Record<string, Record<string, string>>>('sync.deleted'))?.[KEY];
        for (const id of orphanPhotoIds(await kvKeys(), PHOTO_PREFIX, get().items, dead)) await kvDel(photoKey(id));
      } catch { /* leave them; they're harmless */ }
    },

    async addPhotos(photos) {
      if (!get().loaded) await get().load();
      const added: Memory[] = [];
      for (const p of photos) {
        const id = rid('m');
        // Bytes first: a listed memory should never point at a photo that wasn't saved.
        await kvSet(photoKey(id), p.full);
        added.push({ id, day: p.day, caption: p.caption.trim(), ...(p.tag ? { tag: p.tag } : {}), thumb: p.thumb, addedAt: new Date().toISOString() });
      }
      if (added.length) {
        set({ items: [...get().items, ...added] });
        persist();
      }
      return added;
    },

    update(id, patch) {
      set({
        items: get().items.map((m) => {
          if (m.id !== id) return m;
          const next: Memory = { ...m, ...patch, caption: (patch.caption ?? m.caption).trim() };
          if (!next.tag) delete next.tag;
          return next;
        }),
      });
      persist();
    },

    async remove(id) {
      await markDeleted(KEY, id);
      set({ items: get().items.filter((m) => m.id !== id) });
      persist();
      await kvDel(photoKey(id));
    },

    photo: (id) => kvGet<string>(photoKey(id)),

    writeCapsule(d) {
      const c: Capsule = {
        id: rid('c'), title: d.title.trim(), body: d.body, written: todayISO(),
        ...(d.opensOn ? { opensOn: d.opensOn } : {}),
        ...(d.event?.trim() ? { event: d.event.trim() } : {}),
      };
      set({ capsules: [...get().capsules, c] });
      persist();
      return c;
    },

    openCapsule(id) {
      set({ capsules: get().capsules.map((c) => (c.id === id && !c.openedOn ? { ...c, openedOn: todayISO() } : c)) });
      persist();
    },

    removeCapsule(id) {
      void markDeleted(KEY, id);
      set({ capsules: get().capsules.filter((c) => c.id !== id) });
      persist();
    },
  };
});
