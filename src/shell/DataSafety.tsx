import { useEffect, useRef, useState } from 'react';
import { useAutoBackup } from '../core/autoBackup';
import { buildBackupPayload } from '../core/autoBackupLogic';
import { todayISO } from '../core/dates';
import { backupHealth, exportFiles } from '../core/exportLogic';
import { planRestore, type RestorePlan } from '../core/restoreLogic';
import { dumpAll, kvGet, kvSet, SYS_PREFIX } from '../core/storage';
import { DESCRIBERS } from './RestoreBackup';
import { go } from './router';
import '../styles/safety.css';

const DRILL = SYS_PREFIX + 'backupDrill';
interface Drill { at: string; ok: boolean; file: string; summary: string }

/** Everything as plain files in one zip: CSV, Markdown, the photos, and the full backup. */
export async function downloadEverything() {
  const dump = await dumpAll();
  const backup = JSON.stringify(buildBackupPayload(dump, new Date()));
  const files = exportFiles(dump, backup, todayISO());
  // The zip library only loads when it's needed.
  const { strToU8, zipSync } = await import('fflate');
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [`austin-os-${todayISO()}/${k}`, typeof v === 'string' ? strToU8(v) : v])), { level: 6 });
  const url = URL.createObjectURL(new Blob([new Uint8Array(zip)], { type: "application/zip" }));
  const a = document.createElement('a');
  a.href = url; a.download = `austin-os-${todayISO()}.zip`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return Object.keys(files).length;
}

function useHealth() {
  const ab = useAutoBackup();
  const [drill, setDrill] = useState<Drill | null>(null);
  useEffect(() => { void ab.start(); void kvGet<Drill>(DRILL).then((d) => setDrill(d ?? null)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const h = backupHealth({ fileName: ab.fileName, permission: ab.permission, lastWriteAt: ab.lastWriteAt, lastDrill: drill?.ok ? drill.at : null, now: Date.now() });
  return { ab, drill, setDrill, h };
}

/** The full panel (Settings): how safe things are, a restore test, and the plain-file export. */
export function DataSafety() {
  const { ab, drill, setDrill, h } = useHealth();
  const [busy, setBusy] = useState<'' | 'drill' | 'zip'>('');
  const [plan, setPlan] = useState<RestorePlan | { error: string } | null>(null);
  const [zipped, setZipped] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const check = async (text: string, name: string) => {
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* handled below */ }
    const p = parsed === null ? { error: 'That file isn’t readable as a backup (it may be damaged or not a backup at all).' } : planRestore(await dumpAll(), parsed, DESCRIBERS);
    setPlan(p);
    const ok = !('error' in p);
    const summary = ok ? `${p.items.length} areas, from ${p.exportedAt ? new Date(p.exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'an unknown date'}` : p.error;
    const d: Drill = { at: new Date().toISOString(), ok, file: name, summary };
    await kvSet(DRILL, d); setDrill(d);
  };
  const drillAuto = async () => {
    setBusy('drill');
    try { const f = await ab.readFile(); if (f) await check(f.text, f.name); else file.current?.click(); } finally { setBusy(''); }
  };

  return (
    <section id="set-safety" className={`panel cloud safety lvl-${h.level}`}>
      <div className="panel-h"><p className="panel-t">Your data, kept safe</p><span className={`safe-dot ${h.level}`} aria-hidden /></div>
      <div className="safe-head">
        <span className={`safe-seal ${h.level}`} aria-hidden>{h.level === 'ok' ? '✓' : '!'}</span>
        <div><p className="safe-t">{h.title}</p><p className="safe-d">{h.detail}</p></div>
      </div>
      <div className="safe-actions">
        {h.action === 'choose' && <button className="btn primary sm" onClick={() => void ab.choose()}>Choose a backup file</button>}
        {h.action === 'reconnect' && ab.fileName && <button className="btn primary sm" onClick={() => void ab.reconnect()}>Let it keep backing up</button>}
        <button className={h.action === 'drill' ? 'btn primary sm' : 'btn sm'} disabled={busy === 'drill'} onClick={() => void drillAuto()}>{busy === 'drill' ? 'Opening the backup…' : 'Test that my backup opens'}</button>
        <button className="btn sm" disabled={busy === 'zip'} onClick={async () => { setBusy('zip'); try { setZipped(await downloadEverything()); } finally { setBusy(''); } }}>{busy === 'zip' ? 'Packing…' : 'Download everything as files'}</button>
        <input ref={file} type="file" hidden accept=".json,application/json" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await check(await f.text(), f.name); }} />
      </div>
      {zipped !== null && <p className="mono g-good safe-note">A zip with {zipped} files is in your downloads: spreadsheets (CSV), your chapters and notes (Markdown), your photos, and the full backup. Every file opens without Austin OS.</p>}
      {plan && ('error' in plan ? <p className="safe-bad">{plan.error}</p> : (
        <div className="safe-plan">
          <p className="mono g-good">✓ The backup opens. {drill?.file}: {plan.items.length} areas, written {plan.exportedAt ? new Date(plan.exportedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'at an unknown time'}. Nothing was changed.</p>
          <ul>{plan.items.slice(0, 40).map((i) => <li key={i.key}><span>{i.name}</span><span className="mono faint">{i.file}</span></li>)}</ul>
        </div>
      ))}
      {!plan && drill && <p className="mono faint safe-note">Last test: {new Date(drill.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {drill.ok ? `opened fine (${drill.summary})` : `failed: ${drill.summary}`}</p>}
    </section>
  );
}

/** A one-line nudge on Home, only when something needs doing. */
export function SafetyNudge() {
  const { h } = useHealth();
  if (h.level === 'ok') return null;
  return (
    <button className={`safety-nudge ${h.level}`} onClick={() => go('/settings')}>
      <span className={`safe-seal ${h.level}`} aria-hidden>!</span>
      <span><b>{h.title}</b><span className="dim"> · {h.detail.split('. ')[0]}.</span></span>
      <span aria-hidden>→</span>
    </button>
  );
}
