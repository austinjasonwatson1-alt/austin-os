import { describe, expect, it } from 'vitest';
import {
  applyRules, byCategory, categorize, defaultMonth, describeMoney, filterTxns, fingerprints, fmtMoney, merchantOf,
  monthTotals, parseAmount, parseBankDate, parseStatement, previewImport, shiftMonth, toTxns, upsertRule, writingSpend, yearTrend,
  editTxn, handCents, handProblem, handTxn, isHand, suggestCategory,
} from './logic';
import type { Rule, Txn } from './types';

const NOW = '2026-11-22T12:00:00.000Z';
const ok = (text: string, flip?: boolean) => {
  const r = parseStatement(text, { flip });
  if (!r.ok) throw new Error(r.error);
  return r;
};
const T = (p: Partial<Txn>): Txn => ({ id: p.fp ?? Math.random().toString(36), date: '2026-11-03', desc: 'x', cents: -100, category: 'other', fp: p.id ?? Math.random().toString(36), addedAt: NOW, ...p });

describe('reading values', () => {
  it('parses the date shapes banks use, as local dates', () => {
    expect(parseBankDate('2026-11-03')).toBe('2026-11-03');
    expect(parseBankDate('11/03/2026')).toBe('2026-11-03');
    expect(parseBankDate('11/3/26')).toBe('2026-11-03');
    expect(parseBankDate('03 Nov 2026')).toBe('2026-11-03');
    expect(parseBankDate('3-Nov-26')).toBe('2026-11-03');
    expect(parseBankDate('Nov 3, 2026')).toBe('2026-11-03');
    expect(parseBankDate('20261103')).toBe('2026-11-03');
    expect(parseBankDate('25/11/2026')).toBe('2026-11-25'); // day first when it can't be a month
    expect(parseBankDate('2026-11-03T00:00:00')).toBe('2026-11-03');
    expect(parseBankDate('02/30/2026')).toBeNull();
    expect(parseBankDate('Total')).toBeNull();
  });

  it('parses amounts with symbols, commas, parentheses and trailing signs', () => {
    expect(parseAmount('$1,234.56')).toBe(123456);
    expect(parseAmount('(45.00)')).toBe(-4500);
    expect(parseAmount('-45.00')).toBe(-4500);
    expect(parseAmount('45.00-')).toBe(-4500);
    expect(parseAmount('-$12.5')).toBe(-1250);
    expect(parseAmount('12.00 DR')).toBe(-1200);
    expect(parseAmount('+3')).toBe(300);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('n/a')).toBeNull();
  });

  it('formats money', () => {
    expect(fmtMoney(123456)).toBe('$1,234.56');
    expect(fmtMoney(-4500)).toBe('−$45');
    expect(fmtMoney(4500, { sign: true, cents: true })).toBe('+$45.00');
  });
});

describe('reading a statement', () => {
  it('reads a checking export with one signed Amount column', () => {
    const r = ok('Date,Description,Amount,Running Bal.\n11/03/2026,"KROGER #123 AUSTIN TX","-82.10","1,000.00"\n11/04/2026,PAYROLL ACME CO,"2,400.00",3400\n');
    expect(r.layout.kind).toBe('amount');
    expect(r.lines).toEqual([
      { date: '2026-11-03', desc: 'KROGER #123 AUSTIN TX', cents: -8210 },
      { date: '2026-11-04', desc: 'PAYROLL ACME CO', cents: 240000 },
    ]);
  });

  it('finds the header below account details at the top', () => {
    const r = ok('Description,,Summary Amt.\nBeginning balance as of 11/01/2026,,"1,000.00"\n\nDate,Description,Amount,Running Bal.\n11/02/2026,CHEWY.COM,-64.99,935.01\n');
    expect(r.headerRow).toBe(2); // blank lines are dropped
    expect(r.lines[0]).toEqual({ date: '2026-11-02', desc: 'CHEWY.COM', cents: -6499 });
  });

  it('reads separate Debit and Credit columns (Capital One style)', () => {
    const r = ok('Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit\n2026-11-03,2026-11-04,1234,SCRIVENER LITERATURE LATTE,Other,59.99,\n2026-11-05,2026-11-05,1234,CAPITAL ONE AUTOPAY PYMT,Payment,,500.00\n');
    expect(r.layout).toMatchObject({ kind: 'split', date: 'Transaction Date', desc: 'Description', debit: 'Debit', credit: 'Credit' });
    expect(r.lines.map((l) => l.cents)).toEqual([-5999, 50000]);
  });

  it('reads Withdrawal / Deposit columns and a Payee column', () => {
    const r = ok('Posted Date,Payee,Withdrawal,Deposit,Balance\n03 Nov 2026,First Baptist Church,"$100.00",,900\n04 Nov 2026,Interest Paid,,$0.42,900.42\n');
    expect(r.lines).toEqual([
      { date: '2026-11-03', desc: 'First Baptist Church', cents: -10000 },
      { date: '2026-11-04', desc: 'Interest Paid', cents: 42 },
    ]);
  });

  it('uses a debit/credit type column to sign unsigned amounts', () => {
    const r = ok('Date,Name,Amount,Type\n11/3/26,Petco,25.00,Debit\n11/4/26,Refund,5.00,Credit\n');
    expect(r.lines.map((l) => l.cents)).toEqual([-2500, 500]);
  });

  it('spots card exports that list charges as positive, and flips them on request', () => {
    const text = 'Date,Description,Amount\n11/01/2026,NETFLIX.COM,15.49\n11/02/2026,STARBUCKS,6.20\n11/03/2026,SHELL OIL,40.00\n11/04/2026,TARGET,22.00\n11/05/2026,PAYMENT THANK YOU,-200.00\n';
    expect(ok(text).suggestFlip).toBe(true);
    const flipped = ok(text, true);
    expect(flipped.lines[0].cents).toBe(-1549);
    expect(flipped.lines[4].cents).toBe(20000);
    expect(flipped.suggestFlip).toBe(true); // still describes the file, so the toggle stays offered
  });

  it('skips footer and blank lines, and explains a file without usable columns', () => {
    const r = ok('Date,Description,Amount\n11/01/2026,A,-1\nTotal,,-1\n');
    expect([r.lines.length, r.skipped]).toEqual([1, 1]);
    const bad = parseStatement('Name,Notes\nBob,hi\n');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/Date column/);
  });
});

describe('de-duplication', () => {
  const stmtA = 'Date,Description,Amount\n11/03/2026,COFFEE HOUSE,-4.50\n11/03/2026,COFFEE HOUSE,-4.50\n11/04/2026,HEB #554,-60.00\n';
  const stmtB = 'Date,Description,Amount\n11/03/2026,COFFEE HOUSE,-4.50\n11/03/2026,COFFEE HOUSE,-4.50\n11/04/2026,HEB #554,-60.00\n11/05/2026,HEB #554,-12.00\n';

  it('counts genuine same-day repeats', () => {
    const fps = fingerprints(ok(stmtA).lines);
    expect(fps[0]).not.toBe(fps[1]);
    expect(fps[0].endsWith('|0')).toBe(true);
    expect(fps[1].endsWith('|1')).toBe(true);
  });

  it('only adds the new lines when an overlapping statement is imported again', () => {
    const first = toTxns(ok(stmtA).lines, [], NOW);
    const p1 = previewImport([], first);
    expect([p1.add.length, p1.already]).toEqual([3, 0]);
    const again = toTxns(ok(stmtB).lines, [], NOW);
    const p2 = previewImport(p1.add, again);
    expect([p2.add.length, p2.already]).toEqual([1, 3]);
    expect(p2.add[0].cents).toBe(-1200);
  });

  it('gives the same line the same id on every device, and keeps deleted lines out', () => {
    const a = toTxns(ok(stmtA).lines, [], NOW);
    const b = toTxns(ok(stmtA).lines, [], '2027-01-01T00:00:00Z');
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
    const p = previewImport([], b, [a[2].id]);
    expect([p.add.length, p.deletedBefore]).toEqual([2, 1]);
  });

  it('ignores reference numbers that change between exports', () => {
    const a = toTxns([{ date: '2026-11-03', desc: 'ZELLE 88812345 MOM', cents: -500 }], [], NOW);
    const b = toTxns([{ date: '2026-11-03', desc: 'Zelle 99912345 Mom', cents: -500 }], [], NOW);
    expect(previewImport(a, b).add).toHaveLength(0);
  });
});

describe('categories', () => {
  it('sorts common merchants', () => {
    const c = (d: string, cents = -1000) => categorize(d, cents);
    expect(c('KROGER #123 AUSTIN TX')).toBe('groceries');
    expect(c('UBER EATS 8005928996')).toBe('dining');
    expect(c('UBER TRIP')).toBe('transport');
    expect(c('SHELL OIL 57444')).toBe('transport');
    expect(c('NETFLIX.COM')).toBe('subscriptions');
    expect(c('AMAZON PRIME*2K4')).toBe('subscriptions');
    expect(c('AMAZON.COM*MK12AB')).toBe('shopping');
    expect(c('BANFIELD PET HOSPITAL')).toBe('pets');
    expect(c('CHEWY.COM')).toBe('pets');
    expect(c('NORTH AUSTIN VET CLINIC')).toBe('pets');
    expect(c('VETERANS UNITED HOME LOANS')).toBe('other'); // "vet" is a whole word only
    expect(c('TITHE.LY FIRST BAPTIST')).toBe('giving');
    expect(c('CVS/PHARMACY #1234')).toBe('health');
    expect(c('VERIZON WIRELESS')).toBe('housing');
    expect(c('ONLINE TRANSFER TO SAVINGS')).toBe('transfers');
    expect(c('MYSTERY SHOP LLC')).toBe('other');
  });

  it('knows the writing life', () => {
    for (const d of ['SCRIVENER LITERATURE LATTE', 'REEDSY LTD', 'QUERYTRACKER.NET', 'SUBMITTABLE* CONTEST ENTRY', 'BARNES & NOBLE #2041', 'THRILLERFEST CONFERENCE', 'Amazon KDP']) {
      expect(categorize(d, -2500)).toBe('writing');
    }
    expect(categorize('AMAZON KDP ROYALTIES', 4200)).toBe('writing');
  });

  it('treats unmatched money in as income, and income words never claim spending', () => {
    expect(categorize('ACME CORP PAYROLL', 240000)).toBe('income');
    expect(categorize('MOBILE DEPOSIT', 5000)).toBe('income');
    expect(categorize('INTEREST CHARGE', -300)).toBe('other');
  });

  it('lets user rules beat the defaults, longest phrase first', () => {
    const rules: Rule[] = [
      { id: 'r1', match: 'target', category: 'groceries', createdAt: NOW },
      { id: 'r2', match: 'target optical', category: 'health', createdAt: NOW },
    ];
    expect(categorize('TARGET 00012345', -1000, rules)).toBe('groceries');
    expect(categorize('TARGET OPTICAL 22', -1000, rules)).toBe('health');
  });

  it('pulls a merchant phrase out of a messy description', () => {
    expect(merchantOf('POS DEBIT SQ *BLUE BOTTLE 1234 AUSTIN TX')).toBe('blue bottle');
    expect(merchantOf('STARBUCKS STORE 12345 AUSTIN TX')).toBe('starbucks store');
    expect(merchantOf('HEB #554 AUSTIN TX')).toBe('heb austin tx');
  });

  it('adds or replaces rules and re-applies them, leaving hand-set ones alone', () => {
    let rules = upsertRule([], 'Blue Bottle', 'dining', 'r1', NOW);
    rules = upsertRule(rules, 'blue  bottle', 'groceries', 'r2', NOW);
    expect(rules).toEqual([{ id: 'r1', match: 'blue bottle', category: 'groceries', createdAt: NOW }]);
    const txns = [T({ desc: 'SQ *BLUE BOTTLE', category: 'other' }), T({ desc: 'SQ *BLUE BOTTLE', category: 'pets', manual: true })];
    const out = applyRules(txns, rules);
    expect(out.map((t) => t.category)).toEqual(['groceries', 'pets']);
    expect(applyRules(out, rules)).toBe(out);
  });
});

describe('totals', () => {
  const txns = [
    T({ date: '2026-11-01', cents: 300000, category: 'income' }),
    T({ date: '2026-11-02', cents: -8000, category: 'groceries' }),
    T({ date: '2026-11-03', cents: -2000, category: 'groceries' }),
    T({ date: '2026-11-03', cents: 500, category: 'groceries' }), // a refund
    T({ date: '2026-11-04', cents: -5999, category: 'writing', desc: 'SCRIVENER' }),
    T({ date: '2026-11-05', cents: -50000, category: 'transfers' }),
    T({ date: '2026-10-10', cents: -1000, category: 'dining' }),
    T({ date: '2026-03-10', cents: 4200, category: 'writing', desc: 'KDP' }),
    T({ date: '2025-12-10', cents: -9999, category: 'writing' }),
  ];

  it('totals a month, leaving transfers out', () => {
    expect(monthTotals(txns, '2026-11')).toEqual({ inC: 300500, outC: 15999, net: 284501, count: 6 });
  });

  it('splits spending by category, refunds netted', () => {
    const c = byCategory(txns, '2026-11');
    expect(c.map((x) => [x.cat, x.cents])).toEqual([['groceries', 9500], ['writing', 5999]]);
    expect(c[0].share + c[1].share).toBeCloseTo(1);
  });

  it('builds a 12-month trend across the year boundary', () => {
    const t = yearTrend(txns, '2026-11');
    expect(t).toHaveLength(12);
    expect(t[0].ym).toBe('2025-12');
    expect(t[11]).toMatchObject({ ym: '2026-11', inC: 300500, outC: 15999 });
    expect(t[0].outC).toBe(9999);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('calls out the writing year', () => {
    const w = writingSpend(txns, 2026);
    expect(w).toMatchObject({ spent: 5999, earned: 4200, net: -1799, count: 2 });
    expect(w.top[0]).toEqual({ desc: 'scrivener', cents: 5999 });
  });

  it('opens on a month with data, searches and filters', () => {
    expect(defaultMonth(txns, '2026-11-22')).toBe('2026-11');
    expect(defaultMonth(txns, '2027-02-01')).toBe('2026-11');
    expect(defaultMonth([], '2027-02-01')).toBe('2027-02');
    expect(filterTxns(txns, { q: 'scriv' })).toHaveLength(1);
    expect(filterTxns(txns, { cat: 'writing' }).map((t) => t.date)).toEqual(['2026-11-04', '2026-03-10', '2025-12-10']);
    expect(filterTxns(txns, { ym: '2026-10' })).toHaveLength(1);
  });

  it('describes itself for restore', () => {
    expect(describeMoney.detail({ txns: [T({}), T({})], rules: [{ id: 'r', match: 'x', category: 'other', createdAt: NOW }] })).toBe('2 transactions · 1 rule');
    expect(describeMoney.size({})).toBe(0);
  });
});

describe('entered by hand', () => {
  const draft = { date: '2026-11-03', desc: '  COFFEE   HOUSE ', amount: '4.50', dir: 'out' as const, category: 'dining' as const };

  it('makes a hand line with its own id and a fingerprint no statement can have', () => {
    const t = handTxn(draft, 'h-abc', NOW);
    expect(t).toMatchObject({ id: 'h-abc', date: '2026-11-03', desc: 'COFFEE HOUSE', cents: -450, category: 'dining', fp: 'hand|h-abc', manual: true, hand: true });
    expect(isHand(t)).toBe(true);
    expect(isHand(toTxns([{ date: '2026-11-03', desc: 'x', cents: -1 }], [], NOW)[0])).toBe(false);
  });

  it('is never skipped, matched or dropped by a later statement import of the same purchase', () => {
    const stmtA = 'Date,Description,Amount\n11/03/2026,COFFEE HOUSE,-4.50\n11/03/2026,COFFEE HOUSE,-4.50\n';
    const hand = [handTxn(draft, 'h-1', NOW), handTxn(draft, 'h-2', NOW)];
    const incoming = toTxns(ok(stmtA).lines, [], NOW);
    const plan = previewImport(hand, incoming);
    // Both statement lines still come in (the hand lines don't count as "already here")…
    expect([plan.add.length, plan.already]).toEqual([2, 0]);
    // …nothing incoming shares an id or fingerprint with a hand line…
    for (const t of plan.add) for (const h of hand) { expect(t.id).not.toBe(h.id); expect(t.fp).not.toBe(h.fp); }
    // …and they are flagged so Austin can see the likely doubles.
    expect(plan.likeHand).toBe(2);
    // Merged books keep every hand line.
    const books = [...hand, ...plan.add];
    expect(books.filter(isHand).map((t) => t.id)).toEqual(['h-1', 'h-2']);
    // Re-importing the statement adds nothing and still leaves the hand lines alone.
    const again = previewImport(books, toTxns(ok(stmtA).lines, [], NOW));
    expect([again.add.length, again.already, again.likeHand]).toEqual([0, 2, 0]);
  });

  it('a hand line far from any statement line is not flagged', () => {
    const plan = previewImport([handTxn({ ...draft, date: '2026-10-01' }, 'h-1', NOW)], toTxns([{ date: '2026-11-03', desc: 'COFFEE HOUSE', cents: -450 }], [], NOW));
    expect(plan.likeHand).toBe(0);
  });

  it('reads the amount with the chosen direction', () => {
    expect(handCents('$1,200', 'in')).toBe(120000);
    expect(handCents('-12.5', 'out')).toBe(-1250);
    expect(handCents('12.5', 'in')).toBe(1250);
    expect(handCents('0', 'out')).toBeNull();
    expect(handCents('abc', 'out')).toBeNull();
  });

  it('says what is missing', () => {
    expect(handProblem(draft)).toBeNull();
    expect(handProblem({ ...draft, desc: ' ' })).toMatch(/what/);
    expect(handProblem({ ...draft, amount: '' })).toMatch(/amount/);
    expect(handProblem({ ...draft, date: '' })).toMatch(/day/);
  });

  it('suggests a category as you type', () => {
    expect(suggestCategory('Starbucks', 'out')).toBe('dining');
    expect(suggestCategory('', 'in')).toBe('income');
    expect(suggestCategory('', 'out')).toBe('other');
    expect(suggestCategory('Kroger', 'out', [{ id: 'r', match: 'kroger', category: 'pets', createdAt: NOW }])).toBe('pets');
  });

  it('edits date, description and amount only on hand lines; id and fp never change', () => {
    const h = handTxn(draft, 'h-1', NOW);
    const e = editTxn(h, { date: '2026-11-05', desc: 'Dutch Bros', cents: -575, category: 'dining' });
    expect(e).toMatchObject({ id: 'h-1', fp: 'hand|h-1', date: '2026-11-05', desc: 'Dutch Bros', cents: -575 });
    const s = toTxns([{ date: '2026-11-03', desc: 'HEB', cents: -6000 }], [], NOW)[0];
    const es = editTxn(s, { date: '2026-11-09', desc: 'changed', cents: -1, category: 'pets' });
    expect(es).toMatchObject({ id: s.id, fp: s.fp, date: '2026-11-03', desc: 'HEB', cents: -6000, category: 'pets', manual: true });
  });
});
