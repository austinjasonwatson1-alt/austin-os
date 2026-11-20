import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { addDays, todayISO } from '../../core/dates';
import { CountUp, embers, tilt } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { fmtPts, progressTo } from './logic';
import { useWallet } from './useWallet';
import { LoungeScene } from './LoungeScene';
import { useLounge } from './store';
import { asText, DEFAULT_RATES, GLYPHS, type Claim, type Rates, type Reward } from './types';
import '../../styles/cabin.css';
import '../../styles/lounge.css';

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function LoungePage() {
  const w = useWallet();
  const { rewards, claims, loaded } = useLounge();
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(id);
  }, [toast]);

  const toBuy = claims.filter((c) => !c.boughtAt).sort((a, b) => b.claimedAt.localeCompare(a.claimedAt));
  const bought = claims.filter((c) => c.boughtAt).sort((a, b) => (b.boughtAt ?? '').localeCompare(a.boughtAt ?? ''));
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);

  return (
    <div className="home lounge">
      <section className="hero lounge-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">Writer's Cabin · The Lounge</div>
          <h1 className="hero-title">The Writing<br /><em>Lounge.</em></h1>
          <p className="hero-line">Every minute at the desk turns into points. Spend them on real things, then mark them bought.</p>
          <div className="wallet-chips mono">
            <span><b>+{fmtPts(w.today)}</b> today</span>
            <span><b>+{fmtPts(w.week)}</b> this week</span>
            <span><b>{fmtPts(w.earned.total)}</b> earned</span>
            <span><b>{fmtPts(w.spent)}</b> spent</span>
          </div>
        </div>
        <div className="wallet" aria-live="polite">
          <div className="coin" aria-hidden><span>✦</span></div>
          <div className="wallet-n">{w.loaded ? <CountUp value={w.balance} /> : '—'}</div>
          <div className="wallet-l mono">points to spend</div>
        </div>
      </section>

      <div className="rise" style={rise(1)}><LoungeScene /></div>

      {toast && (
        <div className="lounge-toast mono" role="status">
          {toast.text}{' '}
          {toast.undo && <button className="qundo" onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button>}
        </div>
      )}

      <div className="lounge-grid">
        <section className="rise" style={rise(1)}>
          <div className="lounge-h">
            <h2 className="section-h">The shop</h2>
            <span className="mono faint" style={{ fontSize: 11 }}>real things, your prices</span>
          </div>
          <div className="shop">
            {loaded && sorted.map((r) => <RewardCard key={r.id} r={r} balance={w.balance} onToast={setToast} />)}
            <AddReward />
          </div>
        </section>

        <aside className="lounge-side rise" style={rise(2)}>
          <section className="panel">
            <div className="panel-h">
              <p className="panel-t">To buy</p>
              <span className="mono faint" style={{ fontSize: 11 }}>{toBuy.length || ''}</span>
            </div>
            {toBuy.length === 0 ? (
              <p className="dim empty">Nothing waiting. Claim something from the shop and it lands here until you buy it.</p>
            ) : (
              <ul className="claims">{toBuy.map((c) => <ToBuyRow key={c.id} c={c} onToast={setToast} />)}</ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-h"><p className="panel-t">Bought</p></div>
            {bought.length === 0 ? (
              <p className="dim empty">The trophy shelf. Everything you've earned and actually bought shows up here.</p>
            ) : (
              <ul className="claims bought">
                {bought.map((c) => (
                  <li key={c.id} className="claim">
                    <span className="claim-g" aria-hidden>{asText(c.glyph)}</span>
                    <span className="claim-b">
                      <span className="claim-n">{c.name}</span>
                      <span className="claim-m mono">bought {when(c.boughtAt!)} · {fmtPts(c.cost)} pts</span>
                    </span>
                    <button className="btn ghost sm" onClick={() => useLounge.getState().unmarkBought(c.id)}>Not yet</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <HowPoints />
        </aside>
      </div>
    </div>
  );
}

/* ---------------- a reward in the shop ---------------- */

function RewardCard({ r, balance, onToast }: { r: Reward; balance: number; onToast: (t: { text: string; undo?: () => void }) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<'idle' | 'confirm' | 'edit'>('idle');
  const p = progressTo(balance, r.cost);
  const can = balance >= r.cost;

  if (mode === 'edit') return <RewardForm initial={r} onDone={() => setMode('idle')} />;

  const claim = () => {
    const c = useLounge.getState().claim(r.id);
    setMode('idle');
    embers(ref.current);
    if (c) onToast({ text: `Claimed ${r.name} for ${fmtPts(r.cost)} pts. It's on your To buy list.`, undo: () => useLounge.getState().cancelClaim(c.id) });
  };

  return (
    <article ref={ref} className={can ? 'reward tilt can' : 'reward tilt'} style={{ '--p': p } as CSSProperties} {...tilt(5)}>
      <button className="reward-edit" aria-label={`Edit ${r.name}`} onClick={() => setMode('edit')}>✎</button>
      <div className="reward-medal" aria-hidden>
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" className="rm-track" />
          <circle cx="32" cy="32" r="28" className="rm-fill" strokeDasharray={`${175.9 * p} 176`} transform="rotate(-90 32 32)" />
        </svg>
        <span>{asText(r.glyph)}</span>
      </div>
      <h3 className="reward-n">{r.name}</h3>
      {r.note && <p className="reward-note">{r.note}</p>}
      <div className="reward-foot">
        <span className="reward-cost"><b>{fmtPts(r.cost)}</b> <small className="mono">pts</small></span>
        {mode === 'confirm' ? (
          <span className="reward-confirm">
            <button className="btn ghost sm" onClick={() => setMode('idle')}>No</button>
            <button className="btn primary sm" onClick={claim}>Spend {fmtPts(r.cost)}</button>
          </span>
        ) : can ? (
          <button className="btn primary sm" onClick={() => setMode('confirm')}>Claim</button>
        ) : (
          <span className="reward-need mono">{fmtPts(r.cost - Math.max(0, balance))} to go</span>
        )}
      </div>
    </article>
  );
}

function RewardForm({ initial, onDone }: { initial?: Reward; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [cost, setCost] = useState(String(initial?.cost ?? 250));
  const [note, setNote] = useState(initial?.note ?? '');
  const [glyph, setGlyph] = useState(initial?.glyph ?? GLYPHS[0]);
  const [sure, setSure] = useState(false);
  const ok = name.trim() && Number(cost) > 0;

  const save = () => {
    if (!ok) return;
    useLounge.getState().saveReward({ id: initial?.id, name, cost: Number(cost), note, glyph });
    onDone();
  };

  return (
    <form className="reward reward-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="glyphs" role="radiogroup" aria-label="Symbol">
        {GLYPHS.map((g) => <button type="button" key={g} role="radio" aria-checked={g === glyph} onClick={() => setGlyph(g)}>{asText(g)}</button>)}
      </div>
      <label className="field"><span>What is it?</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="A new hardcover" autoFocus /></label>
      <div className="field-row">
        <label className="field"><span>Price</span><input value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
        <label className="field grow"><span>Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
      </div>
      <div className="reward-foot">
        {initial ? (
          sure
            ? <button type="button" className="btn danger sm" onClick={() => { useLounge.getState().removeReward(initial.id); onDone(); }}>Remove it</button>
            : <button type="button" className="btn ghost sm" onClick={() => setSure(true)}>Remove…</button>
        ) : <span />}
        <span className="reward-confirm">
          <button type="button" className="btn ghost sm" onClick={onDone}>Cancel</button>
          <button className="btn primary sm" disabled={!ok}>{initial ? 'Save' : 'Add to shop'}</button>
        </span>
      </div>
    </form>
  );
}

function AddReward() {
  const [open, setOpen] = useState(false);
  if (open) return <RewardForm onDone={() => setOpen(false)} />;
  return (
    <button className="reward reward-add" onClick={() => setOpen(true)}>
      <span className="reward-add-plus" aria-hidden>+</span>
      <span>Add a reward</span>
      <small className="mono">something real you want</small>
    </button>
  );
}

/* ---------------- to buy ---------------- */

function ToBuyRow({ c, onToast }: { c: Claim; onToast: (t: { text: string; undo?: () => void }) => void }) {
  const [sure, setSure] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const s = useLounge.getState();
  return (
    <li ref={ref} className="claim">
      <span className="claim-g" aria-hidden>{asText(c.glyph)}</span>
      <span className="claim-b">
        <span className="claim-n">{c.name}</span>
        <span className="claim-m mono">claimed {when(c.claimedAt)} · {fmtPts(c.cost)} pts</span>
      </span>
      {sure ? (
        <span className="claim-act">
          <button className="btn ghost sm" onClick={() => setSure(false)}>Keep</button>
          <button className="btn danger sm" onClick={() => { s.cancelClaim(c.id); onToast({ text: `${fmtPts(c.cost)} pts back in the wallet.` }); }}>Refund</button>
        </span>
      ) : (
        <span className="claim-act">
          <button className="btn ghost sm" onClick={() => setSure(true)} aria-label={`Cancel ${c.name} and refund`}>✕</button>
          <button className="btn primary sm" onClick={() => {
            s.markBought(c.id);
            embers(ref.current, 12);
            onToast({ text: `${c.name}: bought. Enjoy it, you earned it.`, undo: () => s.unmarkBought(c.id) });
          }}>Mark bought</button>
        </span>
      )}
    </li>
  );
}

/* ---------------- how points work ---------------- */

const RATE_ROWS: { k: keyof Rates; label: string }[] = [
  { k: 'perTenMin', label: 'Every 10 minutes' },
  { k: 'good', label: 'Good day bonus' },
  { k: 'elite', label: 'Elite day bonus' },
  { k: 'weekGood', label: 'Good week bonus' },
  { k: 'weekElite', label: 'Elite week bonus' },
  { k: 'streak7', label: '7-day streak' },
  { k: 'streak30', label: '30-day streak' },
  { k: 'streak100', label: 'Every 100 days' },
];

function HowPoints() {
  const { rates, countFrom, setRates, setCountFrom } = useLounge();
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const parts = [
    ['Minutes', w.earned.minutes], ['Day bonuses', w.earned.days], ['Week bonuses', w.earned.weeks], ['Streaks', w.earned.streaks],
  ] as const;
  return (
    <section className="panel how">
      <div className="panel-h">
        <p className="panel-t">Where points come from</p>
        <button className="btn ghost sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Done' : 'Tune'}</button>
      </div>
      {!open ? (
        <>
          <ul className="how-parts">
            {parts.map(([l, v]) => (
              <li key={l}><span>{l}</span><b className="mono">{fmtPts(v)}</b></li>
            ))}
          </ul>
          <p className="faint mono how-note">
            {rates.perTenMin} pt / 10 min · +{rates.good} good day · +{rates.elite} elite day · counting {countFrom ? `from ${countFrom}` : 'all history'}.
            Only writing-career minutes earn.
          </p>
        </>
      ) : (
        <div className="rates">
          {RATE_ROWS.map(({ k, label }) => (
            <label key={k} className="rate">
              <span>{label}</span>
              <input inputMode="numeric" value={rates[k]} onChange={(e) => setRates({ ...rates, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            </label>
          ))}
          <label className="rate">
            <span>Count from</span>
            <input type="date" value={countFrom ?? ''} max={todayISO()} onChange={(e) => setCountFrom(e.target.value || null)} />
          </label>
          <div className="rates-foot">
            <button className="btn ghost sm" onClick={() => { setRates(DEFAULT_RATES); setCountFrom(null); }}>Reset to defaults</button>
            <button className="btn ghost sm" onClick={() => setCountFrom(addDays(todayISO(), 0))}>Start fresh today</button>
          </div>
        </div>
      )}
      <button className="btn ghost sm how-ledger" onClick={() => go('/cabin/ledger')}>Open the Ledger →</button>
    </section>
  );
}
