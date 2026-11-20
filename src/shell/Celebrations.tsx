import { useEffect, useRef } from 'react';
import { chime } from '../core/ambient';
import { todayISO } from '../core/dates';
import { useSky } from '../core/skyStore';
import { dayTotal } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';

/**
 * Watches today's minutes. The moment they cross into an elite day (not on page load), a shooting
 * star crosses the sky — plus a soft bell if chimes are on.
 */
export function Celebrations() {
  const mins = useLedger((s) => (s.loaded ? dayTotal(s.days[todayISO()]) : null));
  const elite = useLedger((s) => s.thresholds.elite);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (mins === null) return;
    if (prev.current !== null && prev.current < elite && mins >= elite) {
      window.dispatchEvent(new Event('austin:celebrate'));
      if (useSky.getState().prefs.chime) chime();
    }
    prev.current = mins;
  }, [mins, elite]);
  return null;
}
