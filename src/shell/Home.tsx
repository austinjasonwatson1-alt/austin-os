import { useEffect } from 'react';
import { OWNER } from '../config';
import { useBackup } from '../core/backup';
import { prettyDate, todayISO } from '../core/dates';
import { currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, mondayOf, weekTotal } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { AutoBackupPanel } from './AutoBackup';
import { Page } from './Page';
import { go } from './router';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const { loaded, load, days, thresholds, weekly } = useLedger();
  const backup = useBackup();
  useEffect(() => { void load(); void backup.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayISO();
  const mins = dayTotal(days[today]);
  const g = gradeOf(mins, thresholds);
  const wk = weekTotal(days, mondayOf(today));

  return (
    <Page eyebrow={prettyDate(today)} title={`${greeting()}, ${OWNER}.`} lede="Your home base. Start the lamp, put in the minutes.">
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="panel">
          <p className="panel-t">Today</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <span className="big" style={{ fontSize: 50 }}>{loaded ? fmtMins(mins) : '—'}</span>
            <span className={`mono g-${g}`} style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }}>{loaded ? GRADE_LABEL[g] : ''}</span>
          </div>
        </div>
        <div className="panel">
          <p className="panel-t">This week</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <span className="big" style={{ fontSize: 50 }}>{loaded ? fmtMins(wk) : '—'}</span>
            <span className="mono faint" style={{ fontSize: 11 }}>of {fmtMins(weekly.good)} on plan</span>
          </div>
        </div>
        <div className="panel">
          <p className="panel-t">Streak</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <span className="big" style={{ fontSize: 50 }}>{loaded ? currentStreak(days, today) : '—'}</span>
            <span className="mono faint" style={{ fontSize: 11 }}>days</span>
          </div>
        </div>
      </div>

      <button className="room" style={{ width: '100%', minHeight: 130 }} onClick={() => go('/cabin')}>
        <span className="chip live">Open</span>
        <span className="room-glyph" style={{ color: 'var(--lamp)' }}>⌂</span>
        <span className="room-name">The Writer's Cabin</span>
        <span className="room-desc">The Ledger, the Shelf, manuscripts, queries — all of the writing life in one place.</span>
      </button>

      <div style={{ marginTop: 16 }}>
        <AutoBackupPanel />
      </div>
    </Page>
  );
}
