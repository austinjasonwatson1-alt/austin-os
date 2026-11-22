import { useEffect, useState } from 'react';
import { useAutoBackup } from '../core/autoBackup';
import { useSky } from '../core/skyStore';
import { kvGet, SYS_PREFIX } from '../core/storage';
import { setupProgress, setupSteps } from '../core/setupLogic';
import { useFeeds } from '../modules/feeds/store';
import { useKeeper } from '../modules/keeper/store';
import { useCloud } from './cloud';
import '../styles/safety.css';

/** The top of Settings: what's on, what's left, and a jump to each. */
export function SetupChecklist() {
  const ab = useAutoBackup(); const cloud = useCloud(); const keeper = useKeeper(); const sky = useSky(); const feeds = useFeeds();
  const [links, setLinks] = useState<{ health: string | null; idea: string | null }>({ health: null, idea: null });
  useEffect(() => {
    void ab.start(); void keeper.load(); void sky.load(); void feeds.load();
    void Promise.all([kvGet<string>(`${SYS_PREFIX}link.health`), kvGet<string>(`${SYS_PREFIX}link.idea`)]).then(([health, idea]) => setLinks({ health: health ?? null, idea: idea ?? null }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const installed = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const steps = setupSteps({
    backupFile: Boolean(ab.fileName), cloud: cloud.configured, keeper: keeper.enabled, weather: sky.weatherOn, sound: Boolean(sky.prefs.roomSound), reminders: Boolean(sky.prefs.reminders),
    healthAt: links.health, calendarAt: feeds.calAt, ideaLinkAt: links.idea, installed, now: Date.now(),
  });
  const pr = setupProgress(steps);
  const [open, setOpen] = useState(pr.done < pr.total);
  const jump = (id: string) => { const el = document.getElementById(id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); } };
  return (
    <section className="panel setup rise">
      <button className="setup-h" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="setup-ring" style={{ ['--p' as string]: pr.done / pr.total }} aria-hidden><b>{pr.done}</b></span>
        <span><span className="panel-t">Getting set up</span><span className="setup-sub">{pr.done} of {pr.total} done{pr.essentialsLeft ? ` · ${pr.essentialsLeft} essential${pr.essentialsLeft === 1 ? '' : 's'} left` : ' · the essentials are all in place'}</span></span>
        <span className="nav-chev" aria-hidden>›</span>
      </button>
      {open && (
        <ol className="setup-list">
          {steps.map((x) => (
            <li key={x.id} className={x.done ? 'done' : ''}>
              <span className="setup-tick" aria-hidden>{x.done ? '✓' : ''}</span>
              <div><b>{x.label}</b>{x.essential && !x.done && <span className="setup-ess mono">essential</span>}<span className="setup-why">{x.why}</span></div>
              {!x.done && x.target && <button className="btn sm" onClick={() => jump(x.target)}>Set it up</button>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
