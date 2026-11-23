/**
 * The gate before anything goes live: opens every room on a desktop and a phone, first with an
 * empty browser and then with a lived-in one, and fails if any page throws.
 *
 *   npm run build && npm run smoke
 *
 * Needs Playwright with Chromium (not a project dependency; run it where Playwright is installed).
 * Starts its own `vite preview` on port 4199.
 */
const { spawn } = require('child_process');
const { chromium, devices } = require('playwright');

const PORT = 4199;
const U = `http://localhost:${PORT}/`;
const ROUTES = [
  '/home', '/day', '/keeper', '/settings',
  '/cabin', '/cabin/ledger', '/cabin/timer', '/cabin/lounge', '/cabin/shelf', '/cabin/manuscripts', '/cabin/ideas',
  '/cabin/queries', '/cabin/contests', '/cabin/editorial', '/cabin/marketing',
  '/chapel', '/office', '/observatory', '/forge', '/bank', '/hearth', '/kennel', '/money', '/memories',
  '/life', '/goals', '/review', '/year', '/library', '/records', '/film',
  '/log?m=15&c=writing', '/idea?t=short%3A%20Smoke%20test', '/move?k=apply', '/walk?m=30', '/together?m=60',
];

/** A lived-in homestead: two months of days across the buildings, dogs, money, projects. */
async function seed(p) {
  await p.evaluate(async () => {
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const days = {}, chapel = {}, walks = [], txns = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); const k = iso(d);
      days[k] = { writing: 40 + (i % 5) * 30, reading: 20 };
      chapel[k] = { prayer: 15 };
      walks.push({ id: 'w' + i, date: k, who: 'both', minutes: 30 });
      txns.push({ id: 't' + i, date: k, desc: 'COFFEE SHOP', cents: -450, category: 'dining', fp: 'fp' + i, addedAt: '2026-01-01T00:00:00Z' });
    }
    const today = iso(new Date());
    const put = (db, k, v) => new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = rej; });
    const db = await new Promise((res, rej) => { const r = indexedDB.open('austin-os', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = rej; });
    await put(db, 'ledger.v3', { days, thresholds: { elite: 180, good: 80, warn: 30 }, weekly: { elite: 700, good: 450, warn: 250 }, deadlines: [] });
    await put(db, 'chapel.v1', { days: chapel, prayers: [{ id: 'p1', text: 'For the family', added: today }], verses: [] });
    await put(db, 'kennel.v1', { walks, care: [], weights: [], notes: [] });
    await put(db, 'money.v1', { txns, rules: [] });
    await put(db, 'area.office', { days: { [today]: { brief: 1, apply: 1 } }, items: [{ id: 'd1', list: 'doors', kind: 'ledger', text: 'Application Ledger', link: 'https://example.com', done: false, created: today }] });
    await put(db, 'area.observatory', { days: { [today]: { build: 1 } }, items: [{ id: 'o1', list: 'projects', text: 'A game', kind: 'Game', stage: 'shipped', done: false, created: today }] });
    db.close();
  });
}

async function walk(browser, label, ctxOpts, seeded) {
  const ctx = await browser.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  // Stay offline from the outside world: covers, weather and fonts from elsewhere just fail quietly.
  await ctx.route((url) => !url.href.startsWith(U), (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  let at = '';
  p.on('pageerror', (e) => errs.push(`${at}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(`${at}: ${m.text()}`); });
  await p.goto(`${U}#/home`); await p.waitForTimeout(1200);
  if (seeded) { await seed(p); await p.reload(); await p.waitForTimeout(1200); }
  for (const r of ROUTES) {
    at = r;
    await p.evaluate((h) => { location.hash = h; }, r);
    await p.waitForTimeout(700);
    const blank = await p.evaluate(() => (document.querySelector('#root')?.textContent ?? '').trim().length < 20);
    if (blank) errs.push(`${r}: the page rendered empty`);
  }
  await ctx.close();
  console.log(`${errs.length ? '✗' : '✓'} ${label}: ${ROUTES.length} rooms${errs.length ? `, ${errs.length} problem(s)` : ''}`);
  return errs;
}

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  let code = 1;
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(U)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }
    const browser = await chromium.launch();
    const desk = { viewport: { width: 1300, height: 900 } };
    const phone = devices['iPhone 13'];
    const errs = [
      ...(await walk(browser, 'desktop, empty', desk, false)),
      ...(await walk(browser, 'desktop, lived-in', desk, true)),
      ...(await walk(browser, 'phone, empty', phone, false)),
      ...(await walk(browser, 'phone, lived-in', phone, true)),
    ];
    await browser.close();
    for (const e of [...new Set(errs)]) console.log('  ', e);
    code = errs.length ? 1 : 0;
  } finally {
    try { process.kill(-server.pid); } catch { /* already gone */ }
  }
  process.exit(code);
})();
