# Austin OS

A local-first personal operating system. The first "area" is the **Writer's Cabin** — everything for the writing career (a debut domestic thriller, a first manuscript, short stories, queries, contests).

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm test` — Vitest (pure logic only; keep it fast)
- `npm run typecheck` / `npm run build` — must both pass before any change is "done"

## Stack
React 19 + TypeScript (strict) + Vite + Zustand. No router library (tiny hash router in `src/shell/router.ts`). No backend. Storage is IndexedDB via `src/core/storage.ts`.

## Architecture rules
- **One folder per module** under `src/modules/<name>/`: `types.ts`, `logic.ts` (pure functions, unit-tested), `store.ts` (Zustand + persistence), `<Name>Page.tsx` (UI).
- Register every module in `src/modules/registry.ts`. Giving it a `component` makes it live; without one it shows as a "planned" room.
- Keep business logic out of components. If it can be a pure function in `logic.ts`, it must be, with a test in `logic.test.ts`.
- All dates are local-time `YYYY-MM-DD` strings via `src/core/dates.ts`. Never use `toISOString()` for a calendar date (it shifts across timezones).
- Persist with `saveWithSnapshot` so a bad save or import can be undone. Never write straight to IndexedDB from a component.
- Anything that adds user data must be included in the full backup (`dumpAll`) — it already is if it uses `kvSet`/`saveWithSnapshot`.

## Data safety (important)
Browsers erase IndexedDB when the user clears "cookies and site data". Austin has lost tracker data this way before. Treat data loss as the worst possible bug: keep backup/export prominent, import must preview before it merges, and never overwrite existing data silently.

## Design bar
Dark, moody, space-and-cabin. Palette lives in CSS variables in `src/styles/global.css` (lamp amber `--lamp`, bone text, grade colors elite/good/warn/bad). Display type is Bodoni Moda, UI is Inter Tight, data/labels are JetBrains Mono. Austin will push back on anything that looks plain or templated — no default-looking forms, no flat grey boxes. Respect `prefers-reduced-motion`.

## Domain notes
- The Ledger counts writing-career minutes only: Writing, Editing, Reading, Research, Craft, Querying. Prayer/faith, AI study and PM job work are intentionally excluded.
- Day grades: elite ≥180m, good ≥80m, warning ≥30m, else slipping; 0 = zero day. Weekly: 700/450/250. "No zero days" is the personal rule.
