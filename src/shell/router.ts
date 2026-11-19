import { useSyncExternalStore } from 'react';

/** Tiny hash router: '#/cabin/ledger' → '/cabin/ledger'. Works from any static host or file. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const snapshot = () => window.location.hash.replace(/^#/, '') || '/home';

export const useRoute = () => useSyncExternalStore(subscribe, snapshot);
export const go = (path: string) => { window.location.hash = path; };
