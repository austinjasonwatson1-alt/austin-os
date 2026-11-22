import { useEffect, useState } from 'react';
import '../styles/keeper.css';
import { SETUP_SQL } from '../core/cloudCrypto';
import { useSky } from '../core/skyStore';
import { CATS } from '../modules/ledger/types';
import { useCloud } from './cloud';
import { logLink } from './deepLink';
import { rise } from './lamp';
import { SkyPanel } from './SkyPanel';
import { DataSafety } from './DataSafety';
import { SetupChecklist } from './SetupChecklist';
import { FeedsSettings } from '../modules/feeds/FeedsUI';
import { useKeeper } from '../modules/keeper/store';
import type { Allow } from '../modules/keeper/logic';
import '../styles/cabin.css';
import '../styles/homestead.css';
import '../styles/settings.css';

/** Settings: reminders, quick-log links for Siri, encrypted cloud sync, sky & sound. */
export default function SettingsPage() {
  return (
    <div className="home settings">
      <section className="rise" style={{ ...rise(0), marginBottom: 18 }}>
        <div className="page-eyebrow">Settings</div>
        <h1 className="hero-title">The <em>workshop.</em></h1>
        <p className="hero-line">How Austin OS reaches you: reminders, quick-log links for Siri and your watch, and sync with your phone.</p>
      </section>
      <SetupChecklist />
      <div className="set-grid">
        <Reminders />
        <SkyPanel />
        <QuickLinks />
        <DataSafety />
        <CloudSync />
        <KeeperSettings />
        <FeedsSettings />
      </div>
    </div>
  );
}

function Reminders() {
  const s = useSky();
  const on = Boolean(s.prefs.reminders);
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const turnOn = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') s.setReminders(true);
  };
  return (
    <section id="set-reminders" className="panel rise" style={rise(1)}>
      <div className="panel-h"><p className="panel-t">Reminders</p></div>
      <label className="switch">
        <input type="checkbox" checked={on} disabled={perm === 'unsupported' || perm === 'denied'} onChange={(e) => (e.target.checked ? void turnOn() : s.setReminders(false))} />
        <span className="switch-ui" aria-hidden />
        <span><b>Gentle reminders</b><small>From 8pm if the streak’s at risk or the candle’s unlit; the Sunday review; query follow-ups; contest deadlines in three days. Each one at most once a day.</small></span>
      </label>
      <p className="set-note">
        {perm === 'unsupported' ? 'This browser can’t show notifications.'
          : perm === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser’s site settings, then come back.'
            : 'They arrive while Austin OS is open or installed and running in the background. Browsers can’t wake a closed web app on their own, so with the app fully closed they wait until you open it.'}
      </p>
    </section>
  );
}

function QuickLinks() {
  const base = window.location.href;
  const [copied, setCopied] = useState('');
  const links = [
    { label: '30 minutes of writing', href: logLink(base, 30, 'writing') },
    { label: '15 minutes of reading', href: logLink(base, 15, 'reading') },
    { label: '30 minutes of editing', href: logLink(base, 30, 'editing') },
    { label: '10 minutes of prayer', href: logLink(base, 10, 'prayer') },
    { label: 'Start lamp mode', href: `${base.replace(/#.*$/, '')}#/lamp` },
  ];
  const copy = async (h: string) => { try { await navigator.clipboard.writeText(h); setCopied(h); setTimeout(() => setCopied(''), 2000); } catch { /* fine */ } };
  return (
    <section id="set-siri" className="panel rise" style={rise(2)}>
      <div className="panel-h"><p className="panel-t">Quick-log links · Siri &amp; Apple Watch</p></div>
      <p className="set-note" style={{ marginTop: 0 }}>Opening one of these links logs the minutes and heads Home. To say “Hey Siri, log thirty minutes”:</p>
      <ol className="set-steps">
        <li>Copy a link below.</li>
        <li>On your iPhone, open <b>Shortcuts</b> → <b>+</b> → <b>Add Action</b> → <b>Open URLs</b>, and paste the link.</li>
        <li>Name the shortcut the phrase you’ll say, like “Log thirty minutes”. It also shows up on your Apple Watch.</li>
      </ol>
      <ul className="set-links">
        {links.map((l) => (
          <li key={l.href}>
            <span>{l.label}</span>
            <code className="mono">{l.href.replace(/^https?:\/\//, '')}</code>
            <button className="btn sm" onClick={() => void copy(l.href)}>{copied === l.href ? 'Copied ✓' : 'Copy'}</button>
          </li>
        ))}
      </ul>
      <p className="set-note"><b>“Hey Siri, new idea”:</b> in Shortcuts make a shortcut called <b>New idea</b> with <b>Dictate Text</b>, then <b>URL Encode</b> it, then <b>Open URLs</b> with <code className="mono">{base.replace(/#.*$/, '')}#/idea?t=</code> followed by the encoded text. Say “short story” or “novel” first and it lands in the right drawer of the Idea Vault.</p>
      <p className="set-note">Make your own: change <code className="mono">m=</code> to any number of minutes and <code className="mono">c=</code> to {CATS.map((c) => c.k).join(', ')}, prayer or scripture.</p>
    </section>
  );
}

function CloudSync() {
  const c = useCloud();
  useEffect(() => { void c.start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [url, setUrl] = useState('');
  const [anon, setAnon] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [showSql, setShowSql] = useState(false);
  const ok = /^https:\/\/.+/.test(url.trim()) && anon.trim().length > 20 && pass.length >= 12 && pass === pass2;
  return (
    <section id="set-cloud" className="panel cloud rise" style={rise(3)}>
      <div className="panel-h"><p className="panel-t">Cloud sync · phone and computers</p><span className={`mono ${c.configured ? 'g-good' : 'faint'}`} style={{ fontSize: 11 }}>{c.configured ? (c.busy ? 'syncing…' : 'on') : 'off'}</span></div>
      {c.configured ? (
        <>
          <p className="set-note" style={{ marginTop: 0 }}>
            On, and encrypted end to end: only devices with your passphrase can read it. {c.lastSync ? `Last synced ${new Date(c.lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.` : ''}
            {c.lastChanges.length ? ` Last brought in: ${c.lastChanges.join('; ')}.` : ''}
          </p>
          {c.error && <p className="sheet-warn">{c.error}</p>}
          <div className="rates-foot">
            <button className="btn primary sm" onClick={() => void c.syncNow()} disabled={c.busy}>Sync now</button>
            <button className="btn ghost sm" onClick={() => void c.disconnect()}>Turn off on this device</button>
          </div>
        </>
      ) : (
        <>
          <p className="set-note" style={{ marginTop: 0 }}>
            Keeps this device, your phone and your other computers in step automatically, deletions included. It uses a free Supabase project of your own; everything is encrypted on the device before it leaves, so Supabase only ever stores scrambled text.
          </p>
          <ol className="set-steps">
            <li>Create a free project at <b>supabase.com</b>.</li>
            <li>In its <b>SQL Editor</b>, run this once: <button className="btn ghost sm" onClick={() => setShowSql(!showSql)}>{showSql ? 'Hide' : 'Show'} the SQL</button></li>
            {showSql && <pre className="set-sql mono">{SETUP_SQL}</pre>}
            <li>From <b>Project Settings → API</b>, copy the <b>Project URL</b> and the <b>anon public</b> key below.</li>
            <li>Choose a long passphrase (12+ characters) and use the same one on every device. If it’s lost, the synced copy can’t be opened; your devices and backups still have everything.</li>
          </ol>
          <div className="book-fields">
            <div className="field-row two">
              <label className="field"><span>Project URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd.supabase.co" /></label>
              <label className="field"><span>anon public key</span><input value={anon} onChange={(e) => setAnon(e.target.value)} placeholder="eyJ…" /></label>
            </div>
            <div className="field-row two">
              <label className="field"><span>Passphrase</span><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></label>
              <label className="field"><span>Passphrase again</span><input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" /></label>
            </div>
          </div>
          {c.error && <p className="sheet-warn">{c.error}</p>}
          <div className="rates-foot" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={!ok || c.busy} onClick={() => void c.connect({ url: url.trim(), anonKey: anon.trim(), passphrase: pass })}>{c.busy ? 'Connecting…' : 'Turn on cloud sync'}</button>
            {pass && pass2 && pass !== pass2 && <span className="mono faint" style={{ fontSize: 11 }}>passphrases don’t match</span>}
          </div>
        </>
      )}
    </section>
  );
}

const ALLOW_LABEL: Record<keyof Allow, string> = {
  ledger: 'The Ledger (minutes, streak, day notes)', manuscripts: 'Manuscripts (titles, chapters, word counts)', chapterText: 'Chapter text (only the one you ask about)',
  reviews: 'Weekly reviews', shelf: 'The Shelf (books and craft notes)', publishing: 'Queries, contests and editorial notes', chapel: 'The Chapel (minutes only, never prayer text)',
  life: 'The rest of life (work, study, training, dog walks, family time, steps, sleep: minutes only)', calendar: 'Today\u2019s calendar', money: 'Money (monthly totals by category, never single purchases)',
};

function KeeperSettings() {
  const k = useKeeper();
  useEffect(() => { void k.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [key, setKey] = useState('');
  return (
    <section id="set-keeper" className="panel cloud rise" style={rise(4)}>
      <div className="panel-h"><p className="panel-t">The Keeper · AI mentor</p><span className={`mono ${k.enabled ? 'g-good' : 'faint'}`} style={{ fontSize: 11 }}>{k.enabled ? 'on' : 'off'}</span></div>
      <p className="set-note" style={{ marginTop: 0 }}>
        The Keeper uses Claude through your own Anthropic API key (console.anthropic.com → API keys). The key stays on this device only, never in backups or sync. Each question sends Anthropic a short briefing built only from what you allow below; typical use costs cents a day.
      </p>
      {!k.enabled ? (
        <div className="keeper-key">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API key" autoComplete="off" />
          <button className="btn primary sm" disabled={key.trim().length < 20} onClick={() => { void k.setKey(key); setKey(''); }}>Wake the Keeper</button>
        </div>
      ) : (
        <div className="rates-foot" style={{ marginTop: 10 }}><button className="btn ghost sm" onClick={() => void k.forget()}>Remove the key from this device</button></div>
      )}
      <p className="panel-t" style={{ margin: '16px 0 8px' }}>What it may read</p>
      <div className="sky-toggles">
        {(Object.keys(ALLOW_LABEL) as (keyof Allow)[]).map((a) => (
          <label key={a} className="switch">
            <input type="checkbox" checked={Boolean(k.allow[a])} onChange={(e) => void k.setAllow({ ...k.allow, [a]: e.target.checked })} />
            <span className="switch-ui" aria-hidden />
            <span><b>{ALLOW_LABEL[a]}</b></span>
          </label>
        ))}
      </div>
    </section>
  );
}
