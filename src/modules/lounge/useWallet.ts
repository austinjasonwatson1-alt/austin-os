import { useEffect, useMemo } from 'react';
import { mondayOf, todayISO } from '../../core/dates';
import { useLedger } from '../ledger/store';
import { earnedBetween, earnings, spent } from './logic';
import { useLounge } from './store';

/** The wallet, computed live from the Ledger and what's been claimed. */
export function useWallet() {
  const ledger = useLedger();
  const lounge = useLounge();
  useEffect(() => { void ledger.load(); void lounge.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const e = useMemo(
    () => earnings(ledger.days, ledger.thresholds, ledger.weekly, lounge.rates, lounge.countFrom),
    [ledger.days, ledger.thresholds, ledger.weekly, lounge.rates, lounge.countFrom],
  );
  const out = spent(lounge.claims);
  const today = todayISO();
  return {
    loaded: ledger.loaded && lounge.loaded,
    earned: e,
    spent: out,
    balance: e.total - out,
    today: earnedBetween(e, today, today),
    week: earnedBetween(e, mondayOf(today), today),
  };
}
