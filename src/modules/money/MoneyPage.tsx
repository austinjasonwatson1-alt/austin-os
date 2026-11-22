import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { todayISO } from '../../core/dates';
import { CountUp, embers } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import {
  byCategory, defaultMonth, filterTxns, fmtMoney, merchantOf, monthLabel, monthOf, monthTotals, parseStatement,
  previewImport, shiftMonth, toTxns, writingSpend, yearTrend, type ImportPlan, type Layout, type TrendMonth,
} from './logic';
import { useMoney } from './store';
import { CATEGORIES, CAT_OF, type CatKey, type Txn } from './types';
import '../../styles/cabin.css';
import '../../styles/money.css';

const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/* ================= the full page ================= */

export default function MoneyPage() {
  const { txns, load } = useMoney();
  useEffect(() => { void load(); }, [load]);
  const year = Number(todayISO().slice(0, 4));
  const w = writingSpend(txns, year);
  return (
    <div className="home money">
      <section className="hero mny-hero rise" style={rise(0)}>
        <div className="hero-copy">
          <div className="page-eyebrow">The Homestead · The Ledger House</div>
          <h1 className="hero-title">The<br /><em>Strongbox.</em></h1>
          <p className="hero-line">What came in, what went out, and what the writing life costs — read straight from your bank statements. Nothing leaves this device.</p>
        </div>
        <div className="mny-hero-coin" aria-hidden>
          <span className="mny-coin-v">{w.spent ? fmtMoney(w.spent, { cents: false }) : '—'}</span>
          <span className="mono">on the writing life in {year}</span>
        </div>
      </section>
      <MoneyPanel startIndex={1} />
    </div>
  );
}

/* ================= the panel (embeddable in the Ledger House) ================= */

export function MoneyPanel({ startIndex = 0 }: { startIndex?: number }) {
  const { txns, rules, loaded, load } = useMoney();
  useEffect(() => { void load(); }, [load]);
  const today = todayISO();
  const [ym, setYm] = useState<string | null>(null);
  const month = ym ?? defaultMonth(txns, today);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CatKey | null>(null);
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [open, setOpen] = useState<Txn | null>(null);
  const [limit, setLimit] = useState(60);

  const tot = useMemo(() => monthTotals(txns, month), [txns, month]);
  const cats = useMemo(() => byCategory(txns, month), [txns, month]);
  const trend = useMemo(() => yearTrend(txns, month), [txns, month]);
  const year = Number(month.slice(0, 4));
  const writing = useMemo(() => writingSpend(txns, year), [txns, year]);
  const list = useMemo(() => filterTxns(txns, { q, cat, ym: scope === 'month' ? month : null }), [txns, q, cat, scope, month]);
  useEffect(() => setLimit(60), [q, cat, scope, month]);

  if (!loaded) return null;
  const r = (i: number) => rise(startIndex + i);

  if (!txns.length) {
    return (
      <section className="panel mny-empty rise" style={r(0)}>
        <div className="mny-empty-art" aria-hidden><Strongbox /></div>
        <div>
          <p className="panel-t">Household money</p>
          <h2 className="mny-empty-t">An empty strongbox.</h2>
          <p className="dim">Bring in a bank or credit-card statement and the house will sort it — groceries, the dogs, the tithe, and every dollar the writing costs.</p>
          <ol className="mny-steps">
            <li>In your bank’s website, open the account and find <b>Download</b> or <b>Export transactions</b>.</li>
            <li>Choose <b>CSV</b> (sometimes called “spreadsheet” or “comma-separated”) and the dates you want.</li>
            <li>Choose that file here. You’ll see every line before anything is added.</li>
          </ol>
          <ImportMoney primary />
          <p className="mono faint mny-fine">Re-importing an overlapping statement is safe — lines already here are skipped.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="mny">
      <section className="mny-top rise" style={r(0)}>
        <div className="mny-month" role="group" aria-label="Month">
          <button className="mny-arrow" aria-label="Previous month" onClick={() => setYm(shiftMonth(month, -1))}>‹</button>
          <div className="mny-month-l">
            <span className="mny-month-n">{monthLabel(month, true).split(' ')[0]}</span>
            <span className="mono faint">{month.slice(0, 4)} · {tot.count} line{tot.count === 1 ? '' : 's'}</span>
          </div>
          <button className="mny-arrow" aria-label="Next month" disabled={month >= monthOf(today)} onClick={() => setYm(shiftMonth(month, 1))}>›</button>
        </div>
        <div className="mny-stats">
          <Stat label="Came in" cents={tot.inC} tone="in" />
          <Stat label="Went out" cents={tot.outC} tone="out" />
          <Stat label="Net" cents={tot.net} tone={tot.net >= 0 ? 'in' : 'bad'} signed />
        </div>
        <ImportMoney />
      </section>

      <div className="mny-grid">
        <section className="panel rise" style={r(1)}>
          <div className="panel-h"><p className="panel-t">Where it went</p><span className="mono faint mny-sub">{monthLabel(month, true)}</span></div>
          {cats.length === 0 ? <p className="dim mny-none">No spending recorded this month.</p> : (
            <ul className="mny-cats">
              {cats.map((c, i) => {
                const k = CAT_OF[c.cat];
                return (
                  <li key={c.cat}>
                    <button className={`mny-cat${cat === c.cat ? ' on' : ''}`} style={{ '--cc': k.color, '--w': `${(c.cents / cats[0].cents) * 100}%`, '--j': i } as CSSProperties}
                      onClick={() => { setCat(cat === c.cat ? null : c.cat); setScope('month'); }} aria-pressed={cat === c.cat}>
                      <span className="mny-cat-g" aria-hidden>{k.glyph}</span>
                      <span className="mny-cat-n">{k.label}</span>
                      <span className="mny-cat-v mono">{fmtMoney(c.cents, { cents: false })}<i className="faint"> · {Math.round(c.share * 100)}%</i></span>
                      <span className="mny-bar"><span /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel rise" style={r(2)}>
          <div className="panel-h"><p className="panel-t">Twelve months</p>
            <span className="mny-legend mono"><span><i className="in" />In</span><span><i className="out" />Out</span></span>
          </div>
          <Trend months={trend} selected={month} onPick={setYm} />
        </section>
      </div>

      <WritingCallout year={year} w={writing} onShow={() => { setCat('writing'); setScope('all'); }} style={r(3)} />

      <section className="panel mny-list rise" style={r(4)}>
        <div className="panel-h">
          <p className="panel-t">Transactions</p>
          <div className="seg" role="radiogroup" aria-label="Show">
            <button role="radio" aria-checked={scope === 'month'} onClick={() => setScope('month')}>{monthLabel(month)}</button>
            <button role="radio" aria-checked={scope === 'all'} onClick={() => setScope('all')}>All time</button>
          </div>
        </div>
        <label className="mny-search">
          <span aria-hidden>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchants, amounts, dates…" aria-label="Search transactions" />
        </label>
        <div className="mny-chips">
          <button className={`mny-chip${cat === null ? ' on' : ''}`} onClick={() => setCat(null)}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c.k} className={`mny-chip${cat === c.k ? ' on' : ''}`} style={{ '--cc': c.color } as CSSProperties} onClick={() => setCat(cat === c.k ? null : c.k)}>
              <i aria-hidden />{c.label}
            </button>
          ))}
        </div>
        {list.length === 0 ? <p className="dim mny-none">Nothing matches.</p> : (
          <ul className="mny-rows">
            {list.slice(0, limit).map((t) => <TxnRow key={t.id} t={t} onOpen={() => setOpen(t)} />)}
          </ul>
        )}
        {list.length > limit && <button className="btn ghost mny-more" onClick={() => setLimit(limit + 100)}>Show more ({list.length - limit} left)</button>}
        {rules.length > 0 && <Rules />}
      </section>

      {open && <Recategorize t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Stat({ label, cents, tone, signed }: { label: string; cents: number; tone: 'in' | 'out' | 'bad'; signed?: boolean }) {
  const d = Math.round(cents / 100);
  return (
    <div className={`mny-stat ${tone}`}>
      <span className="mny-stat-v"><CountUp value={d} format={(n) => (signed && n > 0 ? '+' : n < 0 ? '−' : '') + dollars(Math.abs(n))} /></span>
      <span className="mny-stat-l mono">{label}</span>
    </div>
  );
}

function Trend({ months, selected, onPick }: { months: TrendMonth[]; selected: string; onPick: (ym: string) => void }) {
  const W = 600, H = 190, top = 14, base = 160;
  const max = Math.max(1, ...months.flatMap((m) => [m.inC, m.outC]));
  const step = W / months.length;
  const bw = Math.min(16, step * 0.28);
  const y = (c: number) => base - (c / max) * (base - top);
  const net = months.map((m, i) => `${(i + 0.5) * step},${Math.max(top, Math.min(base, y(Math.max(0, m.inC - m.outC))))}`).join(' ');
  return (
    <svg className="mny-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Money in and out over twelve months">
      <defs>
        <linearGradient id="mny-g-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fe0ae" /><stop offset="1" stopColor="#2f8f62" stopOpacity=".55" /></linearGradient>
        <linearGradient id="mny-g-out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6c377" /><stop offset="1" stopColor="#b8691f" stopOpacity=".55" /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={base - f * (base - top)} y2={base - f * (base - top)} className="mny-grid-l" />)}
      <line x1="0" x2={W} y1={base} y2={base} className="mny-base" />
      {months.map((m, i) => {
        const cx = (i + 0.5) * step;
        const on = m.ym === selected;
        return (
          <g key={m.ym} className={`mny-tm${on ? ' on' : ''}`} onClick={() => onPick(m.ym)} style={{ '--j': i } as CSSProperties}>
            <title>{`${monthLabel(m.ym, true)}: ${fmtMoney(m.inC, { cents: false })} in, ${fmtMoney(m.outC, { cents: false })} out`}</title>
            <rect x={i * step} y={0} width={step} height={H} className="mny-hit" />
            {on && <rect x={i * step + 3} y={4} width={step - 6} height={base - 2} rx="8" className="mny-sel" />}
            <rect x={cx - bw - 1} y={y(m.inC)} width={bw} height={base - y(m.inC)} rx="3" fill="url(#mny-g-in)" className="mny-b" />
            <rect x={cx + 1} y={y(m.outC)} width={bw} height={base - y(m.outC)} rx="3" fill="url(#mny-g-out)" className="mny-b" />
            <text x={cx} y={H - 10} textAnchor="middle" className="mny-tl">{m.label}</text>
          </g>
        );
      })}
      <polyline points={net} className="mny-net" />
    </svg>
  );
}

function WritingCallout({ year, w, onShow, style }: { year: number; w: ReturnType<typeof writingSpend>; onShow: () => void; style: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <section ref={ref} className="mny-writing rise" style={style}>
      <div className="mny-quill" aria-hidden>✒</div>
      <div className="mny-writing-copy">
        <p className="page-eyebrow">The writing life · {year}</p>
        {w.count === 0 ? (
          <p className="mny-writing-line">Nothing spent on the writing yet in {year}. Books, Scrivener, contest fees and editors will gather here.</p>
        ) : (
          <>
            <p className="mny-writing-line">The writing life cost <b><CountUp value={Math.round(w.spent / 100)} format={dollars} /></b> this year{w.earned > 0 ? <> — and paid back <b className="g-good">{fmtMoney(w.earned, { cents: false })}</b></> : null}.</p>
            {w.top.length > 0 && <p className="mono faint mny-writing-top">Most went to {w.top.map((t) => `${t.desc} (${fmtMoney(t.cents, { cents: false })})`).join(' · ')}</p>}
          </>
        )}
      </div>
      {w.count > 0 && <button className="btn" onClick={() => { embers(ref.current, 10); onShow(); }}>Show {w.count} line{w.count === 1 ? '' : 's'}</button>}
    </section>
  );
}

function TxnRow({ t, onOpen }: { t: Txn; onOpen: () => void }) {
  const k = CAT_OF[t.category];
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const id = setTimeout(() => setSure(false), 3500); return () => clearTimeout(id); }, [sure]);
  return (
    <li className="mny-row" style={{ '--cc': k.color } as CSSProperties}>
      <span className="mny-row-d mono">{shortDate(t.date)}</span>
      <span className="mny-row-desc" title={t.desc}>{t.desc}</span>
      <button className="mny-tag" onClick={onOpen} title="Change category"><i aria-hidden />{k.label}</button>
      <span className={`mny-row-a mono ${t.cents > 0 ? 'in' : ''}`}>{fmtMoney(t.cents, { cents: true, sign: true })}</span>
      <button className={`mny-del${sure ? ' sure' : ''}`} aria-label={sure ? `Really delete ${t.desc}` : `Delete ${t.desc}`}
        onClick={() => (sure ? useMoney.getState().remove(t.id) : setSure(true))}>{sure ? 'Delete?' : '×'}</button>
    </li>
  );
}

function Recategorize({ t, onClose }: { t: Txn; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const [pick, setPick] = useState<CatKey>(t.category);
  const [always, setAlways] = useState(false);
  const [phrase, setPhrase] = useState(() => merchantOf(t.desc));
  const close = () => { ref.current?.close(); };
  const save = () => {
    useMoney.getState().setCategory(t.id, pick, always ? phrase : undefined);
    close();
  };
  return (
    <dialog ref={ref} className="sheet mny-sheet" onClose={onClose} aria-labelledby="mny-rc-t">
      <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Category</div>
      <h2 id="mny-rc-t" className="sheet-title mny-rc-title">{t.desc}</h2>
      <p className="sheet-src mono">{t.date} · {fmtMoney(t.cents, { cents: true, sign: true })}</p>
      <div className="mny-pick" role="radiogroup" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c.k} role="radio" aria-checked={pick === c.k} className="mny-pick-b" style={{ '--cc': c.color } as CSSProperties} onClick={() => setPick(c.k)}>
            <span aria-hidden>{c.glyph}</span>{c.label}
          </button>
        ))}
      </div>
      <label className="mny-always">
        <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
        <span>Always categorize <input className="mny-phrase" value={phrase} onChange={(e) => { setPhrase(e.target.value); setAlways(true); }} aria-label="Merchant phrase" /> as <b>{CAT_OF[pick].label}</b></span>
      </label>
      {always && <p className="mono faint mny-fine">Applies to every line containing “{phrase.trim() || '…'}” that you haven’t set by hand, now and on future imports.</p>}
      <div className="sheet-actions">
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={always && !phrase.trim()} onClick={save}>Save</button>
      </div>
    </dialog>
  );
}

function Rules() {
  const rules = useMoney((s) => s.rules);
  const [show, setShow] = useState(false);
  return (
    <div className="mny-rules">
      <button className="btn ghost sm" onClick={() => setShow(!show)} aria-expanded={show}>{show ? 'Hide' : 'Your'} {rules.length} rule{rules.length === 1 ? '' : 's'}</button>
      {show && (
        <ul>
          {rules.map((r) => (
            <li key={r.id} style={{ '--cc': CAT_OF[r.category].color } as CSSProperties}>
              <span className="mono">“{r.match}”</span><span className="faint">→</span><span className="mny-tag static"><i aria-hidden />{CAT_OF[r.category].label}</span>
              <button className="mny-del" aria-label={`Remove rule ${r.match}`} onClick={() => useMoney.getState().removeRule(r.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- importing a statement ---------------- */

type Loaded = { name: string; text: string; flip: boolean };

function ImportMoney({ primary }: { primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const { txns, rules } = useMoney();
  const [file, setFile] = useState<Loaded | null>(null);
  const [dead, setDead] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (file) ref.current?.showModal(); }, [file !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo(() => (file ? parseStatement(file.text, { flip: file.flip }) : null), [file]);
  const plan: ImportPlan | null = useMemo(() => {
    if (!parsed?.ok || !file) return null;
    return previewImport(txns, toTxns(parsed.lines, rules, new Date().toISOString(), file.name), dead);
  }, [parsed, txns, rules, dead, file]);

  const read = async (f: File) => {
    const text = await f.text();
    setDead(await useMoney.getState().deletedIds());
    setDone(null);
    const first = parseStatement(text);
    setFile({ name: f.name, text, flip: first.ok && first.suggestFlip });
  };
  const close = () => { ref.current?.close(); };
  const add = async () => {
    if (!plan || !file) return;
    setBusy(true);
    try { setDone(await useMoney.getState().importTxns(plan.add, `Before importing ${file.name}`)); }
    finally { setBusy(false); }
  };
  const range = plan && plan.add.length ? [plan.add.reduce((a, t) => (t.date < a ? t.date : a), plan.add[0].date), plan.add.reduce((a, t) => (t.date > a ? t.date : a), plan.add[0].date)] : null;
  const sum = plan ? plan.add.reduce((s, t) => s + t.cents, 0) : 0;

  return (
    <>
      <button className={primary ? 'btn primary' : 'btn'} onClick={() => input.current?.click()}>{primary ? 'Choose a statement (.csv)…' : '+ Import statement'}</button>
      <input ref={input} type="file" hidden accept=".csv,text/csv,text/plain"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
      {file && (
        <dialog ref={ref} className="sheet mny-sheet" onClose={() => setFile(null)} aria-labelledby="mny-imp-t">
          <div className="page-eyebrow" style={{ fontSize: 10.5 }}>Import</div>
          <h2 id="mny-imp-t" className="sheet-title">{done !== null ? 'In the strongbox.' : 'Bring a statement in'}</h2>
          <p className="sheet-src mono">{file.name}</p>
          {parsed && !parsed.ok ? (
            <p className="sheet-warn">{parsed.error}</p>
          ) : done !== null ? (
            <p className="dim">Added {done} transaction{done === 1 ? '' : 's'}. Changed your mind? A restore point named “Before importing {file.name}” was saved first.</p>
          ) : plan && parsed?.ok ? (
            <>
              <ColumnsRead layout={parsed.layout} />
              {parsed.suggestFlip && (
                <label className="mny-flip">
                  <input type="checkbox" checked={file.flip} onChange={(e) => setFile({ ...file, flip: e.target.checked })} />
                  <span>This looks like a card statement that lists <b>charges as positive</b>. Treat them as money out.</span>
                </label>
              )}
              <p className="dim" style={{ fontSize: 14 }}>
                <b className="g-good">{plan.add.length} new</b>, {plan.already} already here{plan.deletedBefore ? <>, {plan.deletedBefore} you deleted before (kept out)</> : null}
                {parsed.skipped ? <>; {parsed.skipped} row{parsed.skipped === 1 ? '' : 's'} without a date or amount skipped</> : null}. Nothing already here is changed.
              </p>
              {range && <p className="mono faint mny-fine">{shortDate(range[0])} – {shortDate(range[1])} · net {fmtMoney(sum, { cents: true, sign: true })}</p>}
              {plan.add.length > 0 && (
                <ul className="mny-imp">
                  {plan.add.slice(0, 12).map((t) => (
                    <li key={t.id} style={{ '--cc': CAT_OF[t.category].color } as CSSProperties}>
                      <span className="mono faint">{shortDate(t.date)}</span>
                      <span className="mny-imp-d">{t.desc}</span>
                      <span className="mny-tag static"><i aria-hidden />{CAT_OF[t.category].label}</span>
                      <span className={`mono ${t.cents > 0 ? 'g-good' : ''}`}>{fmtMoney(t.cents, { cents: true, sign: true })}</span>
                    </li>
                  ))}
                  {plan.add.length > 12 && <li className="mono faint">…and {plan.add.length - 12} more</li>}
                </ul>
              )}
            </>
          ) : null}
          <div className="sheet-actions">
            {plan && done === null && plan.add.length > 0 ? (
              <>
                <button className="btn ghost" onClick={close}>Cancel</button>
                <button className="btn primary" disabled={busy} onClick={() => void add()}>Add {plan.add.length} transaction{plan.add.length === 1 ? '' : 's'}</button>
              </>
            ) : <button className="btn primary" onClick={close}>Done</button>}
          </div>
        </dialog>
      )}
    </>
  );
}

function ColumnsRead({ layout }: { layout: Layout }) {
  const cols = layout.kind === 'amount' ? [layout.date, layout.desc, layout.amount] : [layout.date, layout.desc, layout.debit, layout.credit];
  return (
    <p className="mny-cols mono">
      <span className="faint">Read</span>
      {cols.filter(Boolean).map((c) => <span key={c} className="mny-col">{c}</span>)}
    </p>
  );
}

/** A small iron strongbox with a lamp glow on its lock, for the empty state. */
function Strongbox() {
  return (
    <svg viewBox="0 0 120 100" width="120" height="100">
      <defs>
        <radialGradient id="mny-sb-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#e8a84b" stopOpacity=".55" /><stop offset="1" stopColor="#e8a84b" stopOpacity="0" /></radialGradient>
        <linearGradient id="mny-sb-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2f3b" /><stop offset="1" stopColor="#141820" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="58" rx="46" ry="34" fill="url(#mny-sb-glow)" className="mny-sb-glow" />
      <rect x="18" y="34" width="84" height="52" rx="6" fill="url(#mny-sb-body)" stroke="rgba(233,228,216,.22)" />
      <path d="M18 46 h84" stroke="rgba(233,228,216,.18)" />
      <path d="M22 34 q38 -22 76 0" fill="none" stroke="rgba(233,228,216,.22)" />
      <rect x="52" y="50" width="16" height="18" rx="3" fill="#1b140a" stroke="#e8a84b" />
      <circle cx="60" cy="57" r="2.6" fill="#e8a84b" />
      <path d="M60 59 v5" stroke="#e8a84b" strokeWidth="2" strokeLinecap="round" />
      {[26, 94].map((x) => <circle key={x} cx={x} cy="78" r="1.6" fill="rgba(233,228,216,.3)" />)}
    </svg>
  );
}
