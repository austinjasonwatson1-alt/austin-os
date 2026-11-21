import { useEffect, useMemo, useRef, useState } from 'react';
import { useAutoBackup } from '../core/autoBackup';
import { useBackup } from '../core/backup';
import { todayISO } from '../core/dates';
import { fmtMins } from '../modules/ledger/logic';
import { useLedger } from '../modules/ledger/store';
import { CATS } from '../modules/ledger/types';
import { AREAS, MODULES } from '../modules/registry';
import { useTimer } from '../modules/timer/store';
import { parseLog, rank, type Command } from './paletteLogic';
import { go } from './router';

type Cmd = Command & { run: () => void };

/** Open the palette from anywhere (the rail's search button calls this). */
export const openPalette = () => window.dispatchEvent(new Event('austin:palette'));

/** ⌘K / Ctrl+K: jump anywhere, run an action, or type "30 writing" to log minutes. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [done, setDone] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    const show = () => setOpen(true);
    window.addEventListener('keydown', key);
    window.addEventListener('austin:palette', show);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('austin:palette', show); };
  }, []);
  useEffect(() => { if (open) { setQ(''); setSel(0); setDone(''); setTimeout(() => input.current?.focus(), 0); } }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const nav = (path: string, title: string, keywords = '', hint = ''): Cmd => ({ id: `go:${path}`, title, hint, keywords, group: 'Go to', run: () => go(path) });
    return [
      nav('/home', 'Home', 'homestead dashboard'),
      nav('/review', 'Weekly review', 'sunday week'),
      nav('/year', 'Year in review', 'annual stats'),
      nav('/library', 'Library of You', 'archive journal months memories'),
      nav('/cabin', "The Writer's Cabin", 'writing dashboard'),
      ...MODULES.filter((m) => m.component).map((m) => nav(m.path, m.name, m.blurb)),
      ...AREAS.filter((a) => a.id !== 'cabin').map((a) => nav(a.path, a.name, a.blurb, a.live ? '' : 'being built')),
      { id: 'do:lamp', title: 'Start a lamp-mode session', keywords: 'timer focus write', group: 'Do', run: () => { const t = useTimer.getState(); if (!t.running) t.start(t.lastCat, t.lastGoal); go('/cabin/timer'); } },
      { id: 'do:backup', title: 'Download a backup now', keywords: 'export save', group: 'Do', run: () => void useBackup.getState().exportAll() },
      { id: 'do:sync', title: 'Sync with my other computer', keywords: 'pull merge', group: 'Do', run: () => void useAutoBackup.getState().pull() },
      ...CATS.flatMap((c) => [15, 30, 60].map((n): Cmd => ({
        id: `log:${c.k}:${n}`, title: `Log ${n}m of ${c.name}`, keywords: `add ${c.name}`, group: 'Log',
        run: () => logMins(n, c.k),
      }))),
    ];
  }, []);

  const typed = parseLog(q);
  const list: Cmd[] = useMemo(() => {
    const r = rank(cmds, q).slice(0, 9);
    if (!typed) return r;
    const cat = CATS.find((c) => c.k === typed.cat)!;
    return [{ id: 'log:typed', title: `Log ${fmtMins(typed.mins)} of ${cat.name} today`, group: 'Log' as const, run: () => logMins(typed.mins, typed.cat) }, ...r];
  }, [cmds, q, typed]);

  function logMins(n: number, cat: (typeof CATS)[number]['k']) {
    const l = useLedger.getState();
    if (!l.loaded) return;
    const day = todayISO();
    l.setMinutes(day, cat, (Number(l.days[day]?.[cat]) || 0) + n);
    setDone(`Logged ${fmtMins(n)} of ${CATS.find((c) => c.k === cat)!.name}.`);
  }

  const runAt = (i: number) => {
    const c = list[i];
    if (!c) return;
    c.run();
    if (c.group === 'Log') { setQ(''); input.current?.focus(); } else setOpen(false);
  };

  if (!open) return null;
  return (
    <div className="pal-back" onMouseDown={() => setOpen(false)}>
      <div className="pal" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pal-in">
          <span aria-hidden>⌕</span>
          <input ref={input} value={q} placeholder="Go anywhere, or type “30 writing” to log…" aria-label="Search commands"
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); runAt(sel); }
            }} />
          <kbd className="mono">esc</kbd>
        </div>
        {done && <div className="pal-done mono">✓ {done}</div>}
        <ul className="pal-list" role="listbox">
          {list.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === sel} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={() => runAt(i)}>
              <span className={`pal-g g-${c.group === 'Go to' ? 'go' : c.group === 'Do' ? 'do' : 'log'}`}>{c.group}</span>
              <span className="pal-t">{c.title}</span>
              {c.hint && <span className="pal-h mono">{c.hint}</span>}
            </li>
          ))}
          {list.length === 0 && <li className="pal-none">Nothing matches. Try a room name, or “45 editing”.</li>}
        </ul>
        <div className="pal-foot mono"><span>↑↓ move</span><span>↵ run</span><span>⌘K toggle</span></div>
      </div>
    </div>
  );
}
