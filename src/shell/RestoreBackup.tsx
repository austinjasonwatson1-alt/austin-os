import { useEffect, useRef, useState } from 'react';
import { useAutoBackup } from '../core/autoBackup';
import { planRestore, type Change, type Describer, type RestorePlan } from '../core/restoreLogic';
import { dumpAll, saveWithSnapshot, snapshotNow } from '../core/storage';
import { describeLedger } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { describeLounge } from '../modules/lounge/logic';
import { useLounge } from '../modules/lounge/store';
import { describeTimer } from '../modules/timer/logic';
import { describeShelf } from '../modules/shelf/logic';
import { useShelf } from '../modules/shelf/store';
import { describeManuscripts } from '../modules/manuscripts/logic';
import { useManuscripts } from '../modules/manuscripts/store';
import { useTimer } from '../modules/timer/store';

/** Every module's stored key → how to describe it. Add new modules here. */
const DESCRIBERS: Record<string, Describer> = { 'ledger.v3': describeLedger, 'lounge.v1': describeLounge, 'timer.v1': describeTimer, 'shelf.v1': describeShelf, 'manuscripts.v1': describeManuscripts };

/** After a restore, every store re-reads what it holds. Add new modules here. */
const reloadStores = () => Promise.all([useLedger.getState().load(true), useLounge.getState().load(true), useTimer.getState().load(true), useShelf.getState().load(true), useManuscripts.getState().load(true)]);

const TAG: Record<Change, { text: string; cls: string }> = {
  new: { text: 'Brings back', cls: 'back' },
  more: { text: 'Adds', cls: 'back' },
  same: { text: 'Same', cls: '' },
  less: { text: 'Smaller', cls: 'gone' },
  different: { text: 'Changes', cls: 'warn' },
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'unknown date';

async function applyRestore(plan: RestorePlan) {
  const current = await dumpAll();
  const label = `Before restoring backup from ${plan.exportedAt ? new Date(plan.exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'a file'}`;
  if (plan.shrinks.length) useAutoBackup.getState().expectShrink();
  for (const [key, value] of Object.entries(plan.writes)) {
    if (current[key] !== undefined) await snapshotNow(key, current[key], label);
    await saveWithSnapshot(key, value);
  }
  await reloadStores();
}

type Source = { name: string; text: string };

/**
 * "Restore from backup": pick a backup file (or use the auto-backup file), see exactly what would
 * change, then replace. Every replaced module gets a restore point first, so it can be undone.
 */
export function RestoreButton({ label, primary = false, fromAutoBackup = false }: { label: string; primary?: boolean; fromAutoBackup?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [err, setErr] = useState('');

  const start = async () => {
    setErr('');
    if (!fromAutoBackup) return input.current?.click();
    try {
      const f = await useAutoBackup.getState().readFile();
      if (f) setSource(f);
    } catch (e) {
      setErr(`Couldn't read the backup file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <button className={primary ? 'btn primary' : 'btn ghost'} onClick={() => void start()}>{label}</button>
      <input
        ref={input} type="file" accept="application/json,.json" hidden
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setSource({ name: f.name, text: await f.text() }); }}
      />
      {err && <span className="mono" style={{ fontSize: 12, color: 'var(--bad)' }}>{err}</span>}
      {source && <RestoreDialog source={source} onClose={() => setSource(null)} />}
    </>
  );
}

function RestoreDialog({ source, onClose }: { source: Source; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<RestorePlan | { error: string } | null>(null);
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');

  useEffect(() => {
    ref.current?.showModal();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(source.text);
    } catch {
      /* planRestore reports it */
    }
    void dumpAll().then((cur) => setPlan(planRestore(cur, parsed, DESCRIBERS)));
  }, [source]);

  const close = () => { ref.current?.close(); onClose(); };
  const ok = plan && !('error' in plan) ? plan : null;
  const changes = ok ? Object.keys(ok.writes).length : 0;

  const run = async () => {
    if (!ok) return;
    setState('working');
    await applyRestore(ok);
    setState('done');
  };

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="restore-title">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Restore from backup</div>
      <h2 id="restore-title" className="sheet-title">{state === 'done' ? 'Restored.' : 'Bring it all back'}</h2>
      <p className="sheet-src mono">{source.name}{ok ? ` · saved ${when(ok.exportedAt)}` : ''}</p>

      {!plan && <p className="dim">Reading the file…</p>}
      {plan && 'error' in plan && <p className="sheet-warn">{plan.error}</p>}

      {ok && (
        <>
          <ul className="rs-list">
            {ok.items.map((i) => (
              <li key={i.key} className="rs-row">
                <div>
                  <div className="rs-name">{i.name}</div>
                  <div className="rs-cmp mono">
                    <span>{i.now ?? 'nothing here'}</span>
                    <span className="rs-arrow">→</span>
                    <span className="rs-file">{i.file}</span>
                  </div>
                </div>
                <span className={`fx ${TAG[i.change].cls}`}>{TAG[i.change].text}</span>
              </li>
            ))}
          </ul>

          {state === 'done' ? (
            <p className="dim" style={{ fontSize: 13.5 }}>
              Everything in the file is back. Changed your mind? The Ledger → Restore points has “Before restoring backup…” at the top.
            </p>
          ) : changes === 0 ? (
            <p className="dim" style={{ fontSize: 13.5 }}>This backup matches what you already have — nothing to restore.</p>
          ) : (
            <>
              {ok.shrinks.length > 0 && (
                <p className="sheet-warn">
                  This backup holds <b>less</b> than you have now in {ok.shrinks.join(', ')}. Restoring replaces what's here with the older copy.
                </p>
              )}
              <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0' }}>
                Restoring replaces {changes === 1 ? 'that area' : `those ${changes} areas`} with the file's copy. What you have now is saved as a restore point first, so you can undo it.
              </p>
            </>
          )}
        </>
      )}

      <div className="sheet-actions">
        {state === 'done' || !ok || changes === 0 ? (
          <button className="btn primary" onClick={close}>Done</button>
        ) : (
          <>
            <button className="btn ghost" onClick={close} disabled={state === 'working'}>Cancel</button>
            <button className={ok.shrinks.length ? 'btn danger-solid' : 'btn primary'} onClick={() => void run()} disabled={state === 'working'}>
              {state === 'working' ? 'Restoring…' : ok.shrinks.length ? 'Replace with older copy' : 'Restore'}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
