# Roadmap

A few weeks of Claude Code practice. Each item is a good self-contained session: plan it, build it, test it, commit it.

## Done
- [x] App shell: starfield + treeline sky, rail nav, hash router, module registry
- [x] Storage layer: IndexedDB + snapshot ring + whole-OS backup
- [x] The Ledger migrated (history Jan–Aug seeded; import old Ledger JSON for Sept onward)

## Week 1 — foundations
- [x] First commit; set up a GitHub repo
- [x] Import the old Ledger export (Sept → now) and verify totals against the old app — CSV import added; 270 days / 21,740 min match the old app month for month
- [x] Auto-backup to a chosen file using the File System Access API (guards against cleared site data)
- [x] Snapshot restore UI ("undo my last import")

## Done overnight (Nov 20)
- [x] **The homestead**: Home is a scene of the Writer's Cabin plus the Chapel, Office and Observatory (being built)
- [x] **The Writing Lounge**: points from writing, a shop of real rewards, To buy → Mark bought
- [x] **Lamp Mode**: full-screen focus timer that logs into the Ledger and pays points
- [x] Living sky (clock, moon, seasons, opt-in weather), constellations, Cooper and Shadow, the clickable Lounge room, the year galaxy

## Week 2 — the library
- [x] **The Shelf**: rebuild the library tracker (books, ratings, genre, notes, covers)
- [x] Import an old shelf (JSON, or a Goodreads-style CSV) — waiting on Austin's old Shelf file to try it for real
- [x] Book analysis notes attached to each book (why it worked, craft takeaways)

## Week 3 — the manuscripts
- [x] **Manuscripts**: chapter board for *The Life I Deserve* and *Silence Speaks*, word counts, status
- [x] Writing session timer that logs minutes straight into the Ledger (Lamp Mode)

## Online
- [x] GitHub Pages deploy workflow, installable app (PWA), offline, update notice — needs Pages switched on once in repo settings

## The homestead
- [x] **The Chapel**: prayer time (kept apart from writing minutes), prayer list, answered prayers
- [x] **The Office**: focus blocks, weekly wins, notes
- [x] **The Observatory**: AI study hours, courses, notes

## Week 4 — the business of writing
- [ ] **Query Tracker**, **Contests**, **Editorial Vault**, **Outreach**
- [x] Command palette (⌘K) with quick logging
- [x] Year in review
- [x] Two-computer sync through the shared backup file
- [x] Weekly review screen (Sundays)
