import { useEffect } from 'react';
import { OWNER } from '../config';
import { daysSinceBackup, useBackup } from '../core/backup';
import { prettyDate, todayISO } from '../core/dates';
import { currentStreak, dayTotal, fmtMins, gradeOf, GRADE_LABEL, mondayOf, weekTotal } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
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
  const age = daysSinceBackup(backup.lastBackupAt);
  const stale = backup.loaded && (age === null || age >= 7);

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

      {stale && (
        <div className="panel" style={{ marginTop: 16, borderColor: 'rgba(232,168,75,.35)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p className="panel-t" style={{ color: 'var(--lamp)' }}>Back up your data</p>
            <p className="dim" style={{ margin: '6px 0 0' }}>
              {age === null ? 'You have never backed up.' : `Last backup was ${age} days ago.`} Everything lives in this browser —
              clearing site data erases it. One click saves a copy.
            </p>
          </div>
          <button className="btn primary" onClick={() => void backup.exportAll()}>Back up now</button>
        </div>
      )}
    </Page>
  );
}
