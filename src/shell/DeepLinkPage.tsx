import { useEffect, useRef, useState } from 'react';
import { todayISO } from '../core/dates';
import { useChapel } from '../modules/chapel/store';
import { useFeeds } from '../modules/feeds/store';
import { AREA_STORES } from '../modules/areas/store';
import { dayTotal, fmtMins } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { CATS } from '../modules/ledger/types';
import { useTimer } from '../modules/timer/store';
import type { DeepLink } from './deepLink';
import { go } from './router';

/**
 * Runs a link from a Siri Shortcut (or a home-screen bookmark) once: logs the minutes or starts
 * lamp mode, says so, and heads Home (so a reload afterwards lands on Home, not on the link).
 */
export function DeepLinkPage({ link }: { link: DeepLink }) {
  const ledger = useLedger();
  const chapel = useChapel();
  const feeds = useFeeds();
  const forge = AREA_STORES.forge();
  const done = useRef(false);
  const [msg, setMsg] = useState<{ big: string; small: string; bad?: boolean } | null>(null);

  useEffect(() => { void ledger.load(); void chapel.load(); void useTimer.getState().load(); void feeds.load(); void forge.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (link.kind === 'health' || link.kind === 'cal') {
      if (!feeds.loaded || !forge.loaded) return;
      done.current = true;
      if (link.kind === 'health') {
        feeds.applyHealth(link.h);
        const bits = [link.h.steps !== undefined ? `${link.h.steps.toLocaleString('en-US')} steps` : '', link.h.sleep !== undefined ? `${link.h.sleep}h of sleep` : '', link.h.workout ? `${link.h.workout}m ${link.h.wkind === 'walk' ? 'walking' : link.h.wkind}` : ''].filter(Boolean);
        setMsg({ big: 'Health, brought in', small: `${bits.join(' · ')} for the Forge.` });
      } else {
        feeds.setEvents(link.events, [link.day]);
        setMsg({ big: `${link.events.length} event${link.events.length === 1 ? '' : 's'} today`, small: 'The calendar is on Home now.' });
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
  }, [link, ledger, chapel, feeds, forge]);

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
