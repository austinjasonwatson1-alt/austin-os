import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** Stamp the service worker with this build's files and a version, so it caches every room for offline use and updates are detected. */
function precache(): Plugin {
  let files: string[] = [];
  return {
    name: 'austin-precache',
    apply: 'build',
    generateBundle(_, bundle) {
      files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
    },
    writeBundle(opts) {
      const dir = opts.dir ?? 'dist';
      const statics = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png'];
      const list = [...files.filter((f) => f !== 'index.html'), ...statics].map((f) => `./${f}`);
      const version = createHash('sha256').update(list.join()).digest('hex').slice(0, 10);
      const sw = join(dir, 'sw.js');
      writeFileSync(sw, readFileSync(sw, 'utf8').replace("const VERSION = 'dev';", `const VERSION = '${version}';`).replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(list)};`));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), precache()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
