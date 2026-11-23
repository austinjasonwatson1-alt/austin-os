import { useEffect, useRef, useState } from 'react';
import { todayISO } from '../core/dates';
import { useChapel } from '../modules/chapel/store';
import { useFeeds } from '../modules/feeds/store';
import { kvSet, SYS_PREFIX } from '../core/storage';
import { useIdeas } from '../modules/ideas/store';
import { parseCapture } from '../modules/ideas/logic';
import { AREA_STORES } from '../modules/areas/store';
import { dayTotal, fmtMins } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { CATS } from '../modules/ledger/types';
import { useTimer } from '../modules/timer/store';
import type { DeepLink, Move } from './deepLink';
import { useKennel } from '../modules/kennel/store';
import { jobClock, movesOn } from '../modules/areas/jobLogic';

const MOVE_DONE: Record<Move, (n: number) => string> = {
  brief: () => 'Brief read.',
  apply: (n) => (n > 1 ? `${n} applications out today.` : 'Application out.'),
  followup: (n) => (n > 1 ? `${n} follow-ups sent today.` : 'Follow-up sent.'),
  referral: (n) => (n > 1 ? `${n} referral asks today.` : 'Referral asked.'),
};
import { go } from './router';

/**
 * Runs a link from a Siri Shortcut (or a home-screen bookmark) once: logs the minutes or starts
 * lamp mode, says so, and heads Home (so a reload afterwards lands on Home, not on the link).
 */
export function DeepLinkPage({ link }: { link: DeepLink }) {
  const ledger = useLedger();
  const chapel = useChapel();
  const feeds = useFeeds();
  const ideas = useIdeas();
  const forge = AREA_STORES.forge();
  const done = useRef(false);
  const [msg, setMsg] = useState<{ big: string; small: string; bad?: boolean } | null>(null);

  const office = AREA_STORES.office();
  const hearth = AREA_STORES.hearth();
  const kennel = useKennel();
  useEffect(() => { void ledger.load(); void chapel.load(); void useTimer.getState().load(); void feeds.load(); void forge.load(); void ideas.load(); void office.load(); void hearth.load(); void kennel.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done.current) return;
    if (link.kind === 'bad') { done.current = true; setMsg({ big: 'That link didn’t work.', small: link.reason, bad: true }); return; }
    if (link.kind === 'lamp') {
      done.current = true;
      const t = useTimer.getState();
      if (!t.running) t.start(t.lastCat, t.lastGoal);
      go('/cabin/timer');
      return;
    }
    if (link.kind === 'idea') {
      if (!ideas.loaded) return;
      done.current = true;
      const pc = parseCapture(link.text, 'novel');
      ideas.add(pc);
      void kvSet(`${SYS_PREFIX}link.idea`, new Date().toISOString());
      setMsg({ big: 'Into the vault.', small: `${pc.title ? `“${pc.title}”: ` : ''}${pc.spark.slice(0, 120)}` });
      return;
    }
    if (link.kind === 'health' || link.kind === 'cal') {
      if (!feeds.loaded || !forge.loaded) return;
      done.current = true;
      if (link.kind === 'health') {
        feeds.applyHealth(link.h);
        void kvSet(`${SYS_PREFIX}link.health`, new Date().toISOString());
        const bits = [link.h.steps !== undefined ? `${link.h.steps.toLocaleString('en-US')} steps` : '', link.h.sleep !== undefined ? `${link.h.sleep}h of sleep` : '', link.h.workout ? `${link.h.workout}m ${link.h.wkind === 'walk' ? 'walking' : link.h.wkind}` : ''].filter(Boolean);
        setMsg({ big: 'Health, brought in', small: `${bits.join(' · ')} for the Forge.` });
      } else {
        feeds.setEvents(link.events, [link.day]);
        setMsg({ big: `${link.events.length} event${link.events.length === 1 ? '' : 's'} today`, small: 'The calendar is on Home now.' });
      }
      return;
    }
    if (link.kind === 'move' || link.kind === 'walk' || link.kind === 'together') {
      const office = AREA_STORES.office.getState(), hearth = AREA_STORES.hearth.getState(), kennel = useKennel.getState();
      if (!office.loaded || !hearth.loaded || !kennel.loaded) return;
      done.current = true;
      const day = todayISO();
      if (link.kind === 'move') {
        const cur = office.days[day]?.[link.move] ?? 0;
        office.setMinutes(day, link.move, cur + link.n);
        const made = movesOn(AREA_STORES.office.getState().days, day);
        setMsg({ big: MOVE_DONE[link.move](cur + link.n), small: `${made} of 4 moves today · ${Math.max(0, jobClock(day).left)} days to March 1.` });
      } else if (link.kind === 'walk') {
        kennel.addWalk({ date: day, who: link.who, minutes: link.mins });
        setMsg({ big: `+${fmtMins(link.mins)} walking ${link.who === 'both' ? 'Cooper and Shadow' : link.who === 'cooper' ? 'Cooper' : 'Shadow'}`, small: 'Counted for the body too.' });
      } else {
        const cur = hearth.days[day]?.together ?? 0;
        hearth.setMinutes(day, 'together', cur + link.mins);
        setMsg({ big: `+${fmtMins(link.mins)} together`, small: 'Kept at the Hearth.' });
      }
      return;
    }
    if (!ledger.loaded || !chapel.loaded) return;
    done.current = true;
    const day = todayISO();
    if (link.kind === 'log') {
      const cur = Number(ledger.days[day]?.[link.cat]) || 0;
      ledger.setMinutes(day, link.cat, cur + link.mins);
      const name = CATS.find((c) => c.k === link.cat)!.name;
      setMsg({ big: `+${fmtMins(link.mins)} of ${name}`, small: `Today is now ${fmtMins(dayTotal(useLedger.getState().days[day]))}.` });
    } else {
      const cur = chapel.days[day]?.[link.what] ?? 0;
      chapel.setMinutes(day, link.what, cur + link.mins);
      setMsg({ big: `+${fmtMins(link.mins)} in the Chapel`, small: link.what === 'prayer' ? 'Prayer, kept apart from the writing.' : 'Scripture, kept apart from the writing.' });
    }
  }, [link, ledger, chapel, feeds, forge, ideas, office, hearth, kennel]);

  useEffect(() => {
    if (!msg || msg.bad) return;
    const t = setTimeout(() => go('/home'), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className="deeplink">
      <span className={msg?.bad ? 'dl-mark bad' : 'dl-mark'} aria-hidden>{msg?.bad ? '!' : '✦'}</span>
      <h1>{msg?.big ?? 'Logging…'}</h1>
      <p className="dim">{msg?.small ?? ''}</p>
      <button className="btn ghost" onClick={() => go('/home')}>Go Home</button>
    </div>
  );
}
