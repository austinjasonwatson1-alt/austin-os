/* Austin OS service worker: works offline, updates in the background.
   Your data is in IndexedDB and is never touched by this file. */
// Both lines are filled in at build time (vite.config.ts), so every release is a new worker.
const VERSION = 'dev';
const PRECACHE = [];
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './index.html', ...PRECACHE])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks the waiting worker to take over when the user clicks "Update".
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only the app itself and its fonts. Anything else (e.g. the weather service) goes straight to the network.
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return;

  // Pages: network first so updates arrive, cache when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html', { ignoreVary: true })),
    );
    return;
  }

  // Built assets have hashed names, so a cached copy is always right. Fonts: cache, refresh in background.
  e.respondWith(
    // ignoreVary: the server may send "Vary: Origin", which would otherwise miss precached copies.
    caches.match(req, { ignoreVary: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});

// Clicking a reminder opens Austin OS on the right page.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const path = (e.notification.data && e.notification.data.path) || '/home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(`./#${path}`); return c.focus(); } }
    return self.clients.openWindow(`./#${path}`);
  }));
});
