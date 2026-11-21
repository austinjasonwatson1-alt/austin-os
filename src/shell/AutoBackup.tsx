import { useEffect, useState } from 'react';
import { useAutoBackup } from '../core/autoBackup';
import { autoBackupStatus, timeAgo } from '../core/autoBackupLogic';
import { daysSinceBackup, useBackup } from '../core/backup';
import { go } from './router';
import { RestoreButton } from './RestoreBackup';

/** Re-render every `ms` so "saved 2m ago" stays honest. */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function useStatus() {
  const ab = useAutoBackup();
  const now = useNow();
  return { ab, now, status: autoBackupStatus({ ...ab, now }) };
}

const GLYPH = { ok: '◉', warn: '◎', bad: '◬', off: '○' } as const;

export function AutoBackupPanel() {
  const { ab, now, status } = useStatus();
  const backup = useBackup();
  const age = daysSinceBackup(backup.lastBackupAt);
  const manualLine = !backup.loaded ? '' : age === null ? 'You have never backed up.' : `Last backup was ${age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}.`;

  const overwrite = () => {
    const r = ab.risk;
    const msg = r?.kind === 'shrink'
      ? `${ab.fileName} holds ${r.fileEntries} entries; this browser has ${r.nextEntries}.\n\nOverwriting replaces the file with the smaller copy. This can't be undone.`
      : `${ab.fileName} isn't an Austin OS backup. Overwriting replaces whatever is in it. This can't be undone.`;
    if (window.confirm(msg)) void ab.overwrite();
  };
  const turnOff = () => {
    if (window.confirm(`Stop writing to ${ab.fileName}? The file stays where it is.`)) void ab.turnOff();
  };

  let body: React.ReactNode;
  let actions: React.ReactNode;
  if (!ab.supported) {
    body = <>This browser can't keep a file up to date on its own — Chrome and Edge can. Until then, download a backup every week. {manualLine}</>;
    actions = (
      <>
        <button className="btn primary" onClick={() => void backup.exportAll()}>Back up now</button>
        <RestoreButton label="Bring in a file…" />
      </>
    );
  } else if (!ab.fileName) {
    body = <>Everything lives in this browser, and clearing site data erases it. Pick a backup file once — ideally in iCloud Drive, Dropbox or OneDrive — and every change is copied there automatically. Already using Austin OS on another computer? Join its file instead, and the two stay in sync. {manualLine}</>;
    actions = (
      <>
        <button className="btn primary" onClick={() => void ab.choose()}>Choose backup file</button>
        <button className="btn" onClick={() => void ab.connect()}>Join another device's file</button>
        <button className="btn ghost" onClick={() => void backup.exportAll()}>Download once</button>
        <RestoreButton label="Restore from a file…" />
      </>
    );
  } else if (ab.risk?.kind === 'shrink') {
    body = (
      <>
        <b>{ab.fileName}</b> holds more than this browser does ({ab.risk.fileEntries} entries vs {ab.risk.nextEntries}), so nothing was written to it.
        If your browser data was cleared, restore from that file — you'll see exactly what comes back before anything changes. Auto-backup carries on by itself afterwards.
      </>
    );
    actions = (
      <>
        <RestoreButton label="Restore from this file" primary fromAutoBackup />
        <button className="btn ghost" onClick={() => void ab.choose()}>Use a different file</button>
        <button className="btn ghost danger" onClick={overwrite}>Overwrite anyway</button>
      </>
    );
  } else if (ab.risk) {
    body = <><b>{ab.fileName}</b> isn't an Austin OS backup, so it was left untouched. Pick a new file for the auto-backup instead.</>;
    actions = (
      <>
        <button className="btn primary" onClick={() => void ab.choose()}>Choose a new file</button>
        <button className="btn ghost danger" onClick={overwrite}>Overwrite anyway</button>
      </>
    );
  } else if (ab.permission !== 'granted') {
    body = <>The browser asks again after a restart before it lets Austin OS write to <b>{ab.fileName}</b>. Changes made since then haven't been copied yet. If it offers “Allow on every visit”, pick that and you won't be asked again.</>;
    actions = <button className="btn primary" onClick={() => void ab.reconnect()}>Resume auto-backup</button>;
  } else if (ab.error) {
    body = <>Couldn't write to <b>{ab.fileName}</b>: {ab.error}. If you moved or renamed the file, choose it again.</>;
    actions = (
      <>
        <button className="btn primary" onClick={() => void ab.retry()}>Try again</button>
        <button className="btn ghost" onClick={() => void ab.choose()}>Choose file</button>
      </>
    );
  } else {
    body = (
      <>
        Every change is copied to <b>{ab.fileName}</b> a couple of seconds after you make it, and anything another computer added to it comes in when you open the app.
        {ab.lastSync ? <> Last brought in {timeAgo(ab.lastSync.at, now)}: {ab.lastSync.changes.join('; ')}.</> : null}
      </>
    );
    actions = (
      <>
        <button className="btn ghost" onClick={() => void ab.pull()}>Sync now</button>
        <button className="btn ghost" onClick={() => void ab.choose()}>Change file</button>
        <RestoreButton label="Restore…" />
        <button className="btn ghost" onClick={turnOff}>Turn off</button>
      </>
    );
  }

  return (
    <section className="panel ab" data-tone={status.tone} aria-live="polite">
      <div className="ab-lamp" aria-hidden>{GLYPH[status.tone]}</div>
      <div className="ab-body">
        <p className="panel-t">Auto-backup</p>
        <div className="ab-status">
          <span className={`dot ${status.tone}${ab.writing ? ' pulse' : ''}`} />
          {ab.writing ? 'Saving…' : status.label}
        </div>
        <p className="dim ab-text">{body}</p>
      </div>
      <div className="ab-actions">{actions}</div>
    </section>
  );
}

/** Compact status for the rail footer; click to get to the full panel on Home. */
export function AutoBackupFoot() {
  const { ab, status } = useStatus();
  const text = !ab.supported || !ab.fileName ? 'Auto-backup off · data lives in this browser' : `Auto-backup · ${status.label.toLowerCase()}`;
  return (
    <button className="foot-status" onClick={() => go('/home')} title={text} aria-label={text}>
      <span className={`dot ${status.tone}${ab.writing ? ' pulse' : ''}`} />
      <span className="foot-long">{ab.writing ? 'Auto-backup · saving…' : text}</span>
    </button>
  );
}
