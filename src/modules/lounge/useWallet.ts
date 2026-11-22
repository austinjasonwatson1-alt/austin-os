import { useEffect, useMemo } from 'react';
import { mondayOf, todayISO } from '../../core/dates';
import { useLedger } from '../ledger/store';
import { earnedBetween, earnings, spent } from './logic';
import { useLounge } from './store';
import { useDrafts } from '../drafts/store';
import { sprintPoints } from '../drafts/logic';

/** The wallet, computed live from the Ledger and what's been claimed. */
export function useWallet() {
  const ledger = useLedger();
  const lounge = useLounge();
  const sprints = useDrafts((s) => s.sprints);
  useEffect(() => { void ledger.load(); void lounge.load(); void useDrafts.getState().load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(
    () => earnings(ledger.days, ledger.thresholds, ledger.weekly, lounge.rates, lounge.countFrom),
    [ledger.days, ledger.thresholds, ledger.weekly, lounge.rates, lounge.countFrom],
  );
  // Word sprints pay too (counted from when the Lounge started counting).
  const sp = useMemo(() => sprintPoints((sprints ?? []).filter((x) => !lounge.countFrom || x.day >= lounge.countFrom)), [sprints, lounge.countFrom]);
  const e = useMemo(() => ({ ...base, sprints: sp.total, total: base.total + sp.total }), [base, sp]);
  const out = spent(lounge.claims);
  // Sprint points earned from a day on: everything so far minus what came before it.
  const counted = (sprints ?? []).filter((x) => !lounge.countFrom || x.day >= lounge.countFrom);
  const sprintSince = (day: string) => sp.total - sprintPoints(counted.filter((x) => x.day < day)).total;
  const today = todayISO();
  return {
    loaded: ledger.loaded && lounge.loaded,
    earned: e,
    spent: out,
    balance: e.total - out,
    today: earnedBetween(e, today, today) + sprintSince(today),
    week: earnedBetween(e, mondayOf(today), today) + sprintSince(mondayOf(today)),
  };
}
