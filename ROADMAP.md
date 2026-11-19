# Roadmap

A few weeks of Claude Code practice. Each item is a good self-contained session: plan it, build it, test it, commit it.

## Done
- [x] App shell: starfield + treeline sky, rail nav, hash router, module registry
- [x] Storage layer: IndexedDB + snapshot ring + whole-OS backup
- [x] The Ledger migrated (history Jan–Aug seeded; import old Ledger JSON for Sept onward)

## Week 1 — foundations
- [x] First commit; set up a GitHub repo
- [ ] Import the old Ledger export (Sept → now) and verify totals against the old app
- [x] Auto-backup to a chosen file using the File System Access API (guards against cleared site data)
- [ ] Snapshot restore UI ("undo my last import")

## Week 2 — the library
- [ ] **The Shelf**: rebuild the library tracker (books, ratings, genre, notes, covers)
- [ ] Import the old Shelf's saved JSON
- [ ] Book analysis notes attached to each book (why it worked, craft takeaways)

## Week 3 — the manuscripts
- [ ] **Manuscripts**: chapter board for *The Life I Deserve* and *Silence Speaks*, word counts, status
- [ ] Writing session timer that logs minutes straight into the Ledger

## Week 4 — the business of writing
- [ ] **Query Tracker**, **Contests**, **Editorial Vault**, **Outreach**
- [ ] Command palette (⌘K) and global search across modules
- [ ] Weekly review screen
