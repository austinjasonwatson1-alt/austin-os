/**
 * Installable app + offline support. Registers the service worker (production builds only),
 * notices when a newer version has downloaded, and keeps the browser's install prompt so the
 * app can offer its own "Install" button. Nothing here touches user data.
 */
import { create } from 'zustand';

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

interface PwaState {
  updateReady: boolean;
  installable: boolean;
  installed: boolean;
  start: () => void;
  /** Swap in the new version and reload. */
  update: () => void;
  install: () => Promise<void>;
}

let waiting: ServiceWorker | null = null;
let promptEvent: InstallPrompt | null = null;

export const usePwa = create<PwaState>((set) => ({
  updateReady: false,
  installable: false,
  installed: typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches,

  start() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      promptEvent = e as InstallPrompt;
      set({ installable: true });
    });
    window.addEventListener('appinstalled', () => set({ installable: false, installed: true }));
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.register('./sw.js').then((reg) => {
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener('statechange', () => {
          // A new worker finished installing while an old one runs the page: an update is ready.
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = w;
            set({ updateReady: true });
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting;
        set({ updateReady: true });
      }
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // Look for a new version every hour while the app is open.
      setInterval(() => void reg.update(), 60 * 60_000);
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  },

  update() {
    if (waiting) waiting.postMessage('skip-waiting');
    else window.location.reload();
  },

  async install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = null;
    set({ installable: false });
  },
}));
