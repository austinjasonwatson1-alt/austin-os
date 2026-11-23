import { useEffect } from 'react';
import { mondayOf, todayISO } from '../core/dates';
import { dueReminders } from '../core/remindersLogic';
import { useSky } from '../core/skyStore';
import { chapelMinutes } from '../modules/chapel/logic';
import { useChapel } from '../modules/chapel/store';
import { currentStreak, dayTotal } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { queryStats, upcomingContests } from '../modules/pub/logic';
import { usePub } from '../modules/pub/store';
import { reviewWeek } from '../modules/review/logic';
import { useReview } from '../modules/review/store';
import { go } from './router';
import { AREA_STORES } from '../modules/areas/store';
import { jobClock, movesOn, upcomingInterviews } from '../modules/areas/jobLogic';
import { hearthGlance } from '../modules/areas/logic';
import { useKennel } from '../modules/kennel/store';
import { kennelWalkMinutes } from '../modules/kennel/logic';
import { lifeStreak, type LifeInput } from '../modules/life/logic';
import { useDay } from '../modules/day/store';

/** The morning brief and the evening guard need the whole life, read straight from the stores. */
function wholeLife(today: string) {
  const office = AREA_STORES.office.getState(), hearth = AREA_STORES.hearth.getState(), k = useKennel.getState();
  const walks: Record<string, number> = {};
  for (const w of k.walks) walks[w.date] = kennelWalkMinutes(k, w.date);
  const x: LifeInput = { ledger: useLedger.getState().days, chapel: useChapel.getState().days, office: office.days, observatory: AREA_STORES.observatory.getState().days, forge: AREA_STORES.forge.getState().days, hearth: hearth.days, walks };
  const s = lifeStreak(x, today);
  const g = hearthGlance(hearth.items, hearth.days, today, mondayOf(today));
  const day = useDay.getState();
  return {
    jobDaysLeft: jobClock(today).left, movesToday: movesOn(office.days, today), nextDate: g.next, interview: upcomingInterviews(office.items, today)[0] ?? null,
    tendedToday: s.today.length, lifeStreak: s.current,
    dayClosed: day.loaded ? Boolean(day.days[today]?.closedAt) : undefined,
  };
}

/** Shows due reminders as system notifications (if turned on), each at most once a day. */
export function Notifier() {
  const on = useSky((s) => Boolean(s.prefs.reminders));
  useEffect(() => {
    if (!on || typeof Notification === 'undefined') return;
    void useKennel.getState().load(); void useDay.getState().load();
    const check = async () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const today = todayISO();
      const l = useLedger.getState();
      if (!l.loaded) return;
      const p = usePub.getState();
      const list = dueReminders({
        hour: now.getHours(), weekday: now.getDay(),
        writingToday: dayTotal(l.days[today]), streak: currentStreak(l.days, today),
        chapelToday: chapelMinutes(useChapel.getState().days[today]),
        reviewSealed: Boolean(useReview.getState().reviews[reviewWeek(now, mondayOf(today))]?.sealedAt),
        followUps: queryStats(p.queries, today).followUps.length,
        contestsIn3Days: upcomingContests(p.contests, today).filter((c) => c.left <= 3).map((c) => c.name),
        ...wholeLife(today),
      });
      for (const r of list) {
        const k = `reminded:${r.id}`;
        try { if (localStorage.getItem(k) === today) continue; localStorage.setItem(k, today); } catch { /* fine */ }
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        const opts = { body: r.body, icon: './icon-192.png', tag: r.id, data: { path: r.path } };
        if (reg) await reg.showNotification(r.title, opts);
        else new Notification(r.title, opts).onclick = () => { window.focus(); go(r.path); };
      }
    };
    void check();
    const id = setInterval(() => void check(), 10 * 60_000);
    return () => clearInterval(id);
  }, [on]);
  return null;
}
