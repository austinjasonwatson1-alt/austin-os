/**
 * "Take it all with you": everything in Austin OS as plain files anyone can open (CSV for the
 * spreadsheets, Markdown for the writing and notes, the photos as JPEGs), plus the full backup
 * JSON that Austin OS itself restores from. Pure: builds the file list; the shell zips it.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const arr = <T = Obj>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/** One CSV cell, quoted when it needs to be. */
export const cell = (v: unknown) => { const s = str(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (head: string[], rows: unknown[][]) => [head, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
/** Safe file names: letters, numbers and a few marks only. */
export const slug = (s: string, max = 60) => (s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, max) || 'untitled');

const sum = (o: unknown) => Object.values(obj(o)).reduce<number>((n, v) => n + (typeof v === 'number' ? v : 0), 0);

/** A data: URL's bytes (for photos). */
export function dataUrlBytes(url: string): Uint8Array | null {
  const m = url.match(/^data:[^;,]*;base64,(.*)$/);
  if (!m) return null;
  const bin = atob(m[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function exportFiles(dump: Obj, backupJson: string, exportedOn: string): Record<string, string | Uint8Array> {
  const f: Record<string, string | Uint8Array> = {};
  const has = (k: string) => dump[k] !== undefined;

  f['README.txt'] = `Austin OS — everything, as plain files (${exportedOn})

backup/austin-os-backup.json   The full backup. Austin OS restores from this (Settings or Home → Restore from a file).
writing/                       The Ledger (minutes per day), manuscripts chapter by chapter, the Idea Vault, reviews.
reading/                       The Shelf.
publishing/                    Queries, contests, editorial notes.
life/                          The Chapel, the buildings (work, study, body, family), the Kennel, health, goals, the day.
money/                         Bank transactions.
memories/                      Photos (JPEG) with their captions, and the time-capsule letters.

CSV files open in Excel, Numbers or Google Sheets. Markdown (.md) files are plain text.
`;
  f['backup/austin-os-backup.json'] = backupJson;

  /* ---- writing ---- */
  if (has('ledger.v3')) {
    const days = obj(obj(dump['ledger.v3']).days);
    const cats = ['writing', 'editing', 'reading', 'research', 'learning', 'querying'];
    f['writing/ledger.csv'] = csv(['date', 'writing', 'editing', 'reading', 'research', 'craft', 'querying', 'total', 'note'],
      Object.keys(days).sort().map((d) => { const e = obj(days[d]); return [d, ...cats.map((c) => e[c] ?? ''), cats.reduce((n, c) => n + (Number(e[c]) || 0), 0), e.note ?? '']; }));
  }
  if (has('manuscripts.v1')) {
    const drafts = obj(obj(dump['drafts.v1']).drafts);
    const ms = arr(obj(dump['manuscripts.v1']).manuscripts);
    f['writing/manuscripts.csv'] = csv(['manuscript', 'chapter', 'title', 'status', 'words', 'pov'], ms.flatMap((m) => arr(m.chapters).map((c, i) => [m.title, i + 1, c.title, c.status, c.words, c.pov ?? ''])));
    for (const m of ms) {
      const dir = `writing/manuscripts/${slug(str(m.title))}`;
      arr(m.chapters).forEach((c, i) => {
        const text = str(obj(drafts[`${m.id}/${c.id}`]).text);
        f[`${dir}/${String(i + 1).padStart(2, '0')}-${slug(str(c.title))}.md`] = `# ${i + 1}. ${str(c.title)}\n\n${text || '_(no text written here yet)_'}\n`;
      });
    }
  }
  if (has('ideas.v1')) {
    const ideas = arr(obj(dump['ideas.v1']).ideas);
    const kinds = [...new Set(ideas.map((i) => str(i.kind)))];
    f['writing/idea-vault.md'] = `# The Idea Vault\n\n${kinds.map((k) => `## ${k}\n\n${ideas.filter((i) => i.kind === k).map((i) => `### ${str(i.title) || '(untitled)'}\n\n${str(i.spark)}\n\n${i.notes ? `${str(i.notes)}\n\n` : ''}${i.comps ? `Comps: ${str(i.comps)}\n\n` : ''}Stage: ${str(i.stage)}${arr<string>(i.tags).length ? ` · ${arr<string>(i.tags).map((t) => `#${t}`).join(' ')}` : ''}\n`).join('\n')}`).join('\n')}`;
  }
  if (has('review.v1')) {
    const rv = obj(obj(dump['review.v1']).reviews);
    f['writing/weekly-reviews.md'] = `# Weekly reviews\n\n${Object.keys(rv).sort().reverse().map((w) => { const r = obj(rv[w]); return `## Week of ${w}\n\n**What worked:** ${str(r.worked)}\n\n**What got in the way:** ${str(r.didnt)}\n\n**Intention:** ${str(r.intention)}\n`; }).join('\n')}`;
  }
  if (has('drafts.v1') && arr(obj(dump['drafts.v1']).sprints).length) {
    f['writing/sprints.csv'] = csv(['day', 'minutes', 'words', 'finished', 'manuscript', 'chapter'], arr(obj(dump['drafts.v1']).sprints).map((s) => [s.day, s.minutes, s.words, s.completed ? 'yes' : 'no', s.ms, s.ch]));
  }

  /* ---- reading & publishing ---- */
  if (has('shelf.v1')) {
    const books = arr(obj(dump['shelf.v1']).books);
    f['reading/shelf.csv'] = csv(['title', 'author', 'status', 'rating', 'started', 'finished', 'pages', 'genre'], books.map((b) => [b.title, b.author, b.status, b.rating || '', b.started ?? '', b.finished ?? '', b.pages ?? '', b.genre]));
    const noted = books.filter((b) => b.notes || arr(b.craft).length);
    if (noted.length) f['reading/reading-notes.md'] = `# Reading notes\n\n${noted.map((b) => `## ${str(b.title)} — ${str(b.author)}\n\n${b.notes ? `${str(b.notes)}\n\n` : ''}${arr<string>(b.craft).map((c) => `- ${c}`).join('\n')}\n`).join('\n')}`;
  }
  if (has('pub.v1')) {
    const p = obj(dump['pub.v1']);
    f['publishing/queries.csv'] = csv(['agent', 'agency', 'status', 'sent', 'responded', 'materials', 'notes'], arr(p.queries).map((q) => [q.agent, q.agency ?? '', q.status, q.sentOn ?? '', q.respondedOn ?? '', q.materials ?? '', q.notes ?? '']));
    f['publishing/contests.csv'] = csv(['contest', 'deadline', 'status', 'fee', 'word limit', 'piece', 'notes'], arr(p.contests).map((c) => [c.name, c.deadline, c.status, c.fee ?? '', c.wordLimit ?? '', c.piece ?? '', c.notes ?? '']));
    const fb = arr(p.feedback);
    if (fb.length) f['publishing/editorial-notes.md'] = `# Editorial notes\n\n${fb.map((n) => `## ${str(n.from)} (${str(n.kind)}, ${str(n.date)})${n.resolved ? ' ✓' : ''}\n\n${str(n.text)}\n`).join('\n')}`;
  }

  /* ---- the rest of life ---- */
  if (has('chapel.v1')) {
    const c = obj(dump['chapel.v1']);
    f['life/chapel.csv'] = csv(['date', 'prayer', 'scripture', 'note'], Object.keys(obj(c.days)).sort().map((d) => { const e = obj(obj(c.days)[d]); return [d, e.prayer ?? '', e.scripture ?? '', e.note ?? '']; }));
    const pr = arr(c.prayers);
    if (pr.length) f['life/prayers.md'] = `# Prayers\n\n${pr.map((p) => `- ${str(p.text)}${p.for ? ` (for ${str(p.for)})` : ''} — added ${str(p.added)}${p.answeredOn ? `; answered ${str(p.answeredOn)}${p.answer ? `: ${str(p.answer)}` : ''}` : ''}`).join('\n')}\n`;
  }
  for (const [key, name] of [['area.office', 'office'], ['area.observatory', 'observatory'], ['area.forge', 'forge'], ['area.hearth', 'hearth'], ['area.bank', 'ledger-house']] as const) {
    if (!has(key)) continue;
    const a = obj(dump[key]);
    const days = obj(a.days);
    if (Object.keys(days).length) f[`life/${name}-time.csv`] = csv(['date', 'minutes', 'detail'], Object.keys(days).sort().map((d) => [d, sum(days[d]), Object.entries(obj(days[d])).map(([k, v]) => `${k} ${str(v)}`).join('; ')]));
    const items = arr(a.items);
    if (items.length) f[`life/${name}-lists.csv`] = csv(['list', 'text', 'details', 'date', 'when', 'amount', 'done', 'progress', 'link', 'stage', 'kind', 'status'], items.map((i) => [i.list, i.text, i.body ?? '', i.date, i.when ?? '', i.amount ?? '', i.done ? 'yes' : '', i.progress ?? '', i.link ?? '', i.stage ?? '', i.kind ?? '', i.status ?? '']));
  }
  if (has('kennel.v1')) {
    const k = obj(dump['kennel.v1']);
    f['life/kennel-walks.csv'] = csv(['date', 'who', 'minutes', 'note'], arr(k.walks).map((w) => [w.date, w.who, w.minutes, w.note ?? '']));
    f['life/kennel-care.csv'] = csv(['date', 'who', 'kind', 'title', 'next due', 'note'], arr(k.care).map((c) => [c.date, c.who, c.kind, c.title ?? '', c.nextDue ?? '', c.note ?? '']));
    f['life/kennel-weights.csv'] = csv(['date', 'dog', 'lb'], arr(k.weights).map((w) => [w.date, w.dog, w.lb]));
  }
  if (has('body.v1')) f['life/health.csv'] = csv(['date', 'steps', 'sleep hours'], Object.keys(obj(obj(dump['body.v1']).days)).sort().map((d) => { const e = obj(obj(obj(dump['body.v1']).days)[d]); return [d, e.steps ?? '', e.sleep ?? '']; }));
  if (has('goals.v1')) {
    const g = obj(dump['goals.v1']);
    f['life/goals.md'] = `# Seasons of life\n\n${arr(g.goals).map((x) => `## ${str(x.title)} (${str(x.horizon)}, ${str(x.area)}, by ${str(x.by)})${x.done ? ' ✓' : ''}\n\n${x.why ? `${str(x.why)}\n\n` : ''}${arr(g.milestones).filter((m) => m.goal === x.id).map((m) => `- [${m.done ? 'x' : ' '}] ${str(m.quarter)}: ${str(m.title)}`).join('\n')}\n`).join('\n')}`;
  }
  if (has('day.v1')) {
    const d = obj(dump['day.v1']);
    const days = obj(d.days);
    f['life/the-day.md'] = `# The Day\n\n${Object.keys(days).sort().reverse().map((k) => { const e = obj(days[k]); return `## ${k}\n\n${arr(e.intentions).map((i) => `- ${str(i.area)}: ${str(i.text)}${i.state ? ` (${str(i.state)})` : ''}`).join('\n')}${e.well ? `\n\nWent well: ${str(e.well)}` : ''}${e.carry ? `\n\nCarrying: ${str(e.carry)}` : ''}\n`; }).join('\n')}`;
  }

  /* ---- money ---- */
  if (has('money.v1')) {
    f['money/transactions.csv'] = csv(['date', 'description', 'amount', 'category'], arr(obj(dump['money.v1']).txns).sort((a, b) => str(a.date).localeCompare(str(b.date))).map((t) => [t.date, t.desc, (Number(t.cents) / 100).toFixed(2), t.category]));
  }

  /* ---- memories ---- */
  if (has('memories.v1')) {
    const m = obj(dump['memories.v1']);
    const items = arr(m.items);
    const names = new Set<string>();
    const rows: unknown[][] = [];
    for (const it of items) {
      const bytes = dataUrlBytes(str(dump[`memories.photo.${str(it.id)}`]) || str(it.thumb));
      let name = `${str(it.day)}-${slug(str(it.caption) || 'photo', 40)}.jpg`;
      for (let n = 2; names.has(name); n++) name = `${str(it.day)}-${slug(str(it.caption) || 'photo', 40)}-${n}.jpg`;
      names.add(name);
      if (bytes) f[`memories/photos/${name}`] = bytes;
      rows.push([it.day, it.caption, it.tag ?? '', bytes ? `photos/${name}` : '']);
    }
    if (items.length) f['memories/photos.csv'] = csv(['day', 'caption', 'tag', 'file'], rows);
    const caps = arr(m.capsules);
    if (caps.length) f['memories/time-capsule.md'] = `# The time capsule\n\n${caps.map((c) => `## ${str(c.title)}\n\nWritten ${str(c.written)}${c.opensOn ? ` · opens ${str(c.opensOn)}` : ''}${c.event ? ` · opens on: ${str(c.event)}` : ''}${c.openedOn ? ` · opened ${str(c.openedOn)}` : ' · still sealed'}\n\n${str(c.body)}\n`).join('\n')}`;
  }
  return f;
}

/* ---------------- backup health ---------------- */

export interface BackupHealth { level: 'ok' | 'warn' | 'bad'; title: string; detail: string; action: 'none' | 'choose' | 'reconnect' | 'drill' | 'export' }

/** How safe the data is right now, in one line, and the one thing to do about it. */
export function backupHealth(x: { fileName: string | null; permission: string | null; lastWriteAt: string | null; lastDrill: string | null; now: number }): BackupHealth {
  const days = (iso: string | null) => (iso ? Math.floor((x.now - Date.parse(iso)) / 86_400_000) : null);
  if (!x.fileName) return { level: 'bad', title: 'No automatic backup yet', detail: 'Everything lives only in this browser. Pick a backup file once (iCloud Drive is ideal) and every change is copied there.', action: 'choose' };
  if (x.permission !== 'granted') return { level: 'warn', title: 'The backup needs a tap', detail: `The browser paused writing to ${x.fileName}. One tap lets it keep going.`, action: 'reconnect' };
  const quiet = days(x.lastWriteAt);
  if (quiet === null || quiet >= 7) return { level: 'warn', title: quiet === null ? 'The backup hasn’t been written yet' : `The backup has been quiet for ${quiet} days`, detail: 'Nothing has been copied to the backup file lately. Open it once, or check the file is still where it was.', action: 'reconnect' };
  const drill = days(x.lastDrill);
  if (drill === null || drill >= 30) return { level: 'warn', title: drill === null ? 'The backup has never been test-opened' : `Last tested ${drill} days ago`, detail: 'A backup only counts if it opens. A test reads the file and checks it, without changing anything.', action: 'drill' };
  return { level: 'ok', title: 'Backed up and tested', detail: `Copied to ${x.fileName} ${quiet === 0 ? 'today' : `${quiet} day${quiet === 1 ? '' : 's'} ago`}; it opened fine ${drill === 0 ? 'today' : `${drill} days ago`}.`, action: 'none' };
}
