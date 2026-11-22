# Austin OS

A local-first personal operating system. The first "area" is the **Writer's Cabin** — everything for the writing career (a debut domestic thriller, a first manuscript, short stories, queries, contests).

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm test` — Vitest (pure logic only; keep it fast)
- `npm run typecheck` / `npm run build` — must both pass before any change is "done"
- `npm run smoke` (after a build) — opens every room on desktop and phone, empty and lived-in, and fails on any page error. Run it before every push to `main`: pushes go live. A new route goes in its `ROUTES` list. Needs Playwright + Chromium installed (not a dependency).

## Stack
React 19 + TypeScript (strict) + Vite + Zustand. No router library (tiny hash router in `src/shell/router.ts`). No backend. Storage is IndexedDB via `src/core/storage.ts`.

## Architecture rules
- **One folder per module** under `src/modules/<name>/`: `types.ts`, `logic.ts` (pure functions, unit-tested), `store.ts` (Zustand + persistence), `<Name>Page.tsx` (UI).
- The OS is a **homestead**: each part of life is an area (`AREAS` in `src/modules/registry.ts`): the Writer's Cabin, the Chapel (faith), the Office (PM job), the Observatory (AI study). An area without `live` shows as a blueprint. The Office and the Observatory share one module (`src/modules/areas`, config in `types.ts`, data under `area.<id>`); their time never counts toward writing. Home (`src/shell/Home.tsx`) is the homestead scene; the writing dashboard lives on the Cabin page.
- Register every module in `src/modules/registry.ts`. Giving it a `component` makes it live; without one it shows as a "planned" room.
- Keep business logic out of components. If it can be a pure function in `logic.ts`, it must be, with a test in `logic.test.ts`.
- All dates are local-time `YYYY-MM-DD` strings via `src/core/dates.ts`. Never use `toISOString()` for a calendar date (it shifts across timezones).
- Persist with `saveWithSnapshot` so a bad save or import can be undone. Never write straight to IndexedDB from a component.
- Before any bulk change (import, load, restore), call `snapshotNow(key, currentValue, 'Before …')` so it shows up as a named restore point. Labelled points are kept separately from autosaves (`src/core/snapshots.ts`).
- Anything that adds user data must be included in the full backup (`dumpAll`) — it already is if it uses `kvSet`/`saveWithSnapshot`.
- New modules also plug into **Restore from backup** (`src/shell/RestoreBackup.tsx`): add a `Describer` for the module's key to `DESCRIBERS` (so the preview says "42 books", not "318 entries") and its store's `load()` to `reloadStores`.

## Data safety (important)
Browsers erase IndexedDB when the user clears "cookies and site data". Austin has lost tracker data this way before. Treat data loss as the worst possible bug: keep backup/export prominent, import must preview before it merges, and never overwrite existing data silently.

## Design bar
Dark, moody, space-and-cabin. Palette lives in CSS variables in `src/styles/global.css` (lamp amber `--lamp`, bone text, grade colors elite/good/warn/bad). Display type is Bodoni Moda, UI is Inter Tight, data/labels are JetBrains Mono. Austin will push back on anything that looks plain or templated — no default-looking forms, no flat grey boxes. Respect `prefers-reduced-motion`.

## Domain notes
- The Ledger counts writing-career minutes only: Writing, Editing, Reading, Research, Craft, Querying. Prayer/faith, AI study and PM job work are intentionally excluded.
- Day grades: elite ≥180m, good ≥80m, warning ≥30m, else slipping; 0 = zero day. Weekly: 700/450/250. "No zero days" is the personal rule.
- The Lounge (`src/modules/lounge`): points are never stored — they're recomputed from the Ledger (`earnings()`), minus what's been claimed. Rewards are real-world things Austin prices himself; a claim spends points, sits on "To buy" until he marks it bought, and can be refunded or undone.
- Sync (`src/core/syncLogic.ts`): devices share the auto-backup file; `syncMerge` adds (local wins on conflicts) and drops anything recorded as deleted. A new module whose data is a list of `{id}` items or per-day numbers must get a merger in `MERGERS` (or use an `area.*` key), with a test.
- The Shelf (`src/modules/shelf`): reading goals live in `shelf.v1` as `goals: { "2027": 30 }` (synced; local wins a clash). Covers are image URLs (Open Library, or an ISBN guess from a Goodreads import that may 404 and fall back to the drawn cover). `parseGoodreads` handles the Goodreads library export.
- The Hall of Records (`src/modules/records`) stores nothing: `hallOfRecords()` recomputes bests and trophies from the other stores. A new trophy goes in its `logic.ts` with a test.
- Word sprints live in `drafts.v1` as `sprints` (synced by id). Their Lounge points (`sprintPoints`) are added in `useWallet`, never stored.
- The year-end film (`src/modules/film`): `yearFilm()` picks the scenes from the stores, `render.ts` draws them on a 1080×1920 canvas, and the page records it with `MediaRecorder`. Anything drawn into it (covers) must load with CORS, or the recording breaks.
- The soundscape (`src/core/ambient.ts` engine, `src/core/soundLogic.ts` rules, `src/shell/Soundscape.tsx` + the corner dial): layered Web Audio, no files. `sceneFor(route, weather/phase/season)` decides each page's mix; a new page gets its sound there (with a test). `setAmbient(kind)` is an explicit choice (Lamp mode, the record player) that wins over the scene. The on/off pref is still named `roomSound`.
- The whole life: `src/modules/life` (the Compass: `balanceWeek`, `insights`, `lastTended` → dusty/cobwebbed buildings), `feeds` (Apple Health `#/health?…` into `body.v1` + the Forge; calendar `#/cal?e=…` or .ics, device-only `sys:calendar`), `kennel` (`kennel.v1`; walks count toward the body), `money` (`money.v1`, bank CSV import with preview/dedupe), `memories` (`memories.v1` + one `memories.photo.<id>` key per photo; sync skips deleted photo keys), `goals` (`goals.v1`, the Seasons road). `lifeGrowth` raises the doghouse, greenhouse, guesthouse and chapel bell.
- The Idea Vault (`src/modules/ideas`, `ideas.v1`): quick capture with `parseCapture` ("short: Title — premise #tag", or dictated "Short story …"), Siri `#/idea?t=…`; a novel idea can start a manuscript. Sync keeps the newest edit of an idea.
- Navigation (`src/shell/Sidebar.tsx`, `navLogic.ts`): the rail shows Home/The Day/The Keeper, "Your rooms" (most used, learned per device in localStorage), then collapsible groups from `navGroups()`; a new room goes in a group there. "All rooms" opens a full map (the phone's main way around). Buildings list rooms that live inside them (`ALSO` in `areas/AreaPage.tsx`).
- Data safety (`src/core/exportLogic.ts`, `src/shell/DataSafety.tsx`): "Download everything as files" zips CSV/Markdown/photos + the backup JSON; a new module's data should get a file in `exportFiles` (with a test). `backupHealth` drives the Settings panel and the Home nudge; the restore test only reads. Settings opens with the setup checklist (`setupLogic.ts`).
- Fonts are self-hosted (`@fontsource-variable/*`, imported in `main.tsx`); use the CSS vars `--display`, `--ui`, `--mono`, `--serif`, never a font name directly.
- Edits sync by time: hand edits stamp `edited` (ISO time) on the item and the merger uses `newerEdit`, so the newest edit wins across devices (Kennel, Money). Use the same for any new list a person edits in place.
- Each room renders inside `RoomGuard` (`src/shell/RoomGuard.tsx`): a crash shows a note in that room only.
- Deletions: stores call `markDeleted(storeKey, id)` when removing an item, so sync drops it everywhere (`sync.deleted`). Cloud sync (`src/shell/cloud.ts`) is end-to-end encrypted to the user's own Supabase project; its config is device-only (`sys:cloud`).
- Condensed buildings: the Office is **Job Search HQ** (`areas/jobLogic.ts`: the March 1 clock, the day's four moves stored as office days `{brief, apply, followup, referral}`; the doors to the Application Ledger and Recruiter Desk are office items in list `doors`, pasted by the user, never hard-coded since the repo is public). The Observatory is the **projects workbench** (`areas/projects.ts`, items in list `projects` with `link`/`stage`/`kind`; paste import previews and dedupes). The Forge logs no time; its numbers come from Health and the Kennel. Old minutes stay in storage.
- Compass areas carry `unit`: Job search and Projects count days, not minutes (`amount`, `migrateTargets` in `life/logic.ts`).
- Room families: `ROOM_SETS` in `navLogic.ts` makes several routes one room with tabs (Looking back; Road to publication = queries/contests/editorial/outreach; the Ledger + Lounge; the Ledger House + Money; the Hearth + Kennel + Memories). `RoomTabs` is drawn by `App` above any route in a family; the rail shows only the first tab (`tucked`, `railPath`). Lamp Mode is reached by buttons (`INSIDE`), not the rail. Routes never change, so old links and Siri shortcuts keep working.
- Polish lives in the "the finish" section at the end of `global.css` (grain, lit panel borders, buttons, unified fields). Build on it rather than restyling per page.
