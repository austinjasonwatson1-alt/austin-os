/** Pure money logic: reading bank CSVs, de-duplicating, categorizing, totals. No browser APIs. */

import { iso, MONTHS_SHORT, pad } from '../../core/dates';
import type { Describer } from '../../core/restoreLogic';
import { parseCsvRows } from '../ledger/logic';
import { CATEGORIES, CAT_OF, type CatKey, type MoneyData, type Rule, type Txn } from './types';

/* ---------------- formatting ---------------- */

/** "$1,234.56", "−$45" (whole dollars drop the cents). */
export function fmtMoney(cents: number, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const abs = Math.abs(cents) / 100;
  const showCents = opts.cents ?? abs % 1 !== 0;
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0 });
  const sign = cents < 0 ? '−' : opts.sign && cents > 0 ? '+' : '';
  return `${sign}$${s}`;
}

/* ---------------- parsing values ---------------- */

const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function mkDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d, 12);
  if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return iso(dt);
}

/** A statement date → local 'YYYY-MM-DD', or null. US order (month first) unless the first part can't be a month. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[ T])/))) return mkDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return mkDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:$| )/))) {
    const a = +m[1], b = +m[2];
    return a > 12 ? mkDate(+m[3], b, a) : mkDate(+m[3], a, b);
  }
  if ((m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})\.?[ ,-]+(\d{2}|\d{4})$/))) {
    const mo = MON[m[2].slice(0, 3).toLowerCase()];
    return mo ? mkDate(+m[3], mo, +m[1]) : null;
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/))) {
    const mo = MON[m[1].slice(0, 3).toLowerCase()];
    return mo ? mkDate(+m[3], mo, +m[2]) : null;
  }
  return null;
}

/** "$1,234.56" → 123456, "(45.00)" / "-45.00" / "45.00-" / "45.00 DR" → -4500. Blank or junk → null. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\s*(dr|debit)$/i.test(s)) { neg = true; s = s.replace(/\s*(dr|debit)$/i, ''); }
  s = s.replace(/\s*(cr|credit)$/i, '');
  s = s.replace(/usd|\$|,|\s/gi, '');
  if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const c = Math.round(parseFloat(s) * 100);
  return neg ? -c : c;
}

/* ---------------- reading a statement ---------------- */

export interface ParsedLine { date: string; desc: string; cents: number }

export interface Layout {
  date: string;
  desc: string;
  /** 'amount' for one signed column, or 'split' for separate money-out / money-in columns. */
  kind: 'amount' | 'split';
  amount?: string;
  debit?: string;
  credit?: string;
}

export type ParseResult =
  | { ok: true; lines: ParsedLine[]; layout: Layout; skipped: number; headerRow: number; suggestFlip: boolean }
  | { ok: false; error: string };

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]+/g, ' ').trim();

const DATE_NAMES = ['transaction date', 'trans date', 'date', 'posted date', 'posting date', 'post date', 'date posted', 'value date'];
const DESC_NAMES = ['description', 'transaction description', 'original description', 'payee', 'name', 'merchant', 'merchant name', 'details', 'transaction details', 'memo', 'narrative'];
const AMOUNT_NAMES = ['amount', 'transaction amount', 'amount usd', 'net amount'];
const DEBIT_NAMES = ['debit', 'debits', 'debit amount', 'withdrawal', 'withdrawals', 'withdrawal amount', 'money out', 'paid out', 'charge', 'charges'];
const CREDIT_NAMES = ['credit', 'credits', 'credit amount', 'deposit', 'deposits', 'deposit amount', 'money in', 'paid in', 'payment', 'payments'];
const TYPE_NAMES = ['type', 'transaction type', 'credit debit indicator', 'dr cr', 'cr dr'];

/** Index of the first header matching a name, in the names' priority order. */
function findCol(head: string[], names: string[], loose?: string): number {
  const h = head.map(norm);
  for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; }
  if (loose) { const i = h.findIndex((x) => x.split(' ').includes(loose) && !x.includes('balance')); if (i >= 0) return i; }
  return -1;
}

function layoutOf(head: string[]) {
  const date = findCol(head, DATE_NAMES, 'date');
  const desc = findCol(head, DESC_NAMES);
  const amount = findCol(head, AMOUNT_NAMES, 'amount');
  const debit = findCol(head, DEBIT_NAMES);
  const credit = findCol(head, CREDIT_NAMES);
  const type = findCol(head, TYPE_NAMES);
  const memo = findCol(head, ['memo']);
  return { date, desc, amount, debit, credit, type, memo };
}

/**
 * Read any bank or card CSV: finds the header row (banks often put account details above it),
 * then date / description / amount columns by their common names.
 * `flip` reverses every sign — for card exports that list charges as positive.
 */
export function parseStatement(text: string, opts: { flip?: boolean } = {}): ParseResult {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  if (!rows.length) return { ok: false, error: 'That file is empty.' };

  let headerRow = -1;
  let L: ReturnType<typeof layoutOf> | null = null;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const l = layoutOf(rows[i]);
    if (l.date >= 0 && (l.amount >= 0 || l.debit >= 0 || l.credit >= 0)) { headerRow = i; L = l; break; }
  }
  if (!L) {
    return { ok: false, error: "Couldn't find the columns in that file. A bank CSV needs a header row with a Date column and an Amount column (or Debit and Credit columns)." };
  }
  const head = rows[headerRow];
  const split = L.amount < 0;
  const descCol = L.desc >= 0 ? L.desc : head.findIndex((_, i) => ![L!.date, L!.amount, L!.debit, L!.credit, L!.type].includes(i));

  const lines: ParsedLine[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerRow + 1)) {
    const date = parseBankDate(r[L.date] ?? '');
    let cents: number | null;
    if (!split) {
      cents = parseAmount(r[L.amount] ?? '');
      if (cents !== null && L.type >= 0) {
        const t = (r[L.type] ?? '').trim().toLowerCase();
        if (/^(debit|dr|d|withdrawal|sale|purchase)$/.test(t)) cents = -Math.abs(cents);
        else if (/^(credit|cr|c|deposit)$/.test(t)) cents = Math.abs(cents);
      }
    } else {
      const out = L.debit >= 0 ? parseAmount(r[L.debit] ?? '') : null;
      const inn = L.credit >= 0 ? parseAmount(r[L.credit] ?? '') : null;
      cents = out === null && inn === null ? null : (inn ? Math.abs(inn) : 0) - (out ? Math.abs(out) : 0);
    }
    if (!date || cents === null || cents === 0) { skipped++; continue; }
    let desc = (descCol >= 0 ? r[descCol] ?? '' : '').trim().replace(/\s+/g, ' ');
    if (!desc && L.memo >= 0) desc = (r[L.memo] ?? '').trim().replace(/\s+/g, ' ');
    lines.push({ date, desc: desc || '(no description)', cents: opts.flip ? -cents : cents });
  }
  if (!lines.length) return { ok: false, error: 'Found the columns, but no rows with a date and an amount underneath them.' };

  // A card export that lists charges as positive: nearly everything is "money in".
  const pos = lines.filter((l) => (opts.flip ? -l.cents : l.cents) > 0).length;
  const suggestFlip = !split && lines.length >= 4 && pos / lines.length > 0.7;

  const name = (i: number) => (i >= 0 ? head[i].trim() : '');
  return {
    ok: true, lines, skipped, headerRow, suggestFlip,
    layout: split
      ? { date: name(L.date), desc: name(descCol), kind: 'split', debit: name(L.debit) || undefined, credit: name(L.credit) || undefined }
      : { date: name(L.date), desc: name(descCol), kind: 'amount', amount: name(L.amount) },
  };
}

/* ---------------- fingerprints & de-duplication ---------------- */

/** Lowercase words only; long digit runs (reference numbers, card digits) dropped. */
export function normDesc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b\d{4,}\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A short stable hash (cyrb53), base 36. */
export function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Fingerprint each line. Genuine repeats (two $4.50 coffees on the same day) get #0, #1…
 * counted within the file, so a re-import of the same statement matches line for line.
 */
export function fingerprints(lines: ParsedLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const base = `${l.date}|${l.cents}|${normDesc(l.desc)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}|${n}`;
  });
}

/** Turn parsed lines into transactions, categorized by the rules. */
export function toTxns(lines: ParsedLine[], rules: Rule[], now: string, source?: string): Txn[] {
  const fps = fingerprints(lines);
  return lines.map((l, i) => ({
    id: `t-${hash(fps[i])}`, date: l.date, desc: l.desc, cents: l.cents,
    category: categorize(l.desc, l.cents, rules), fp: fps[i], addedAt: now, ...(source ? { source } : {}),
  }));
}

export interface ImportPlan {
  add: Txn[];
  /** New lines that look like one Austin entered by hand (same amount, within 3 days). Both are kept; he can delete one. */
  likeHand: number;
  /** Lines already in the books (left exactly as they are). */
  already: number;
  /** Lines Austin deleted before; kept out so they don't come back. */
  deletedBefore: number;
}

/** What an import would add. Nothing existing is touched; deleted lines stay deleted. */
export function previewImport(existing: Txn[], incoming: Txn[], deletedIds: Iterable<string> = []): ImportPlan {
  // Hand-entered lines never take part in matching: a statement line is never "already here" because of one.
  const stmt = existing.filter((t) => !isHand(t));
  const have = new Set(stmt.map((t) => t.fp));
  const haveId = new Set(existing.map((t) => t.id));
  const dead = new Set(deletedIds);
  const hands = existing.filter(isHand);
  const add: Txn[] = [];
  let already = 0, deletedBefore = 0, likeHand = 0;
  for (const t of incoming) {
    if (isHand(t)) continue; // only statement lines come in through an import
    if (have.has(t.fp) || haveId.has(t.id)) already++;
    else if (dead.has(t.id)) deletedBefore++;
    else {
      add.push(t); have.add(t.fp); haveId.add(t.id);
      if (hands.some((h) => h.cents === t.cents && Math.abs(dayDiff(h.date, t.date)) <= 3)) likeHand++;
    }
  }
  return { add, likeHand, already, deletedBefore };
}

const dayDiff = (a: string, b: string) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86400000);

/* ---------------- entered by hand ---------------- */

export const HAND_FP = 'hand|';

/** Was this line written in by hand (rather than read from a statement)? */
export const isHand = (t: Pick<Txn, 'fp'> & { hand?: boolean }) => t.hand === true || t.fp.startsWith(HAND_FP);

export interface HandDraft {
  date: string;
  desc: string;
  /** The amount as typed ("12.50", "$1,200"); the sign comes from `dir`. */
  amount: string;
  dir: 'in' | 'out';
  category: CatKey;
}

/** Signed cents for a typed amount, or null when it isn't a positive amount. */
export function handCents(amount: string, dir: HandDraft['dir']): number | null {
  const c = parseAmount(amount);
  if (c === null || c === 0) return null;
  return dir === 'in' ? Math.abs(c) : -Math.abs(c);
}

/** Why a hand entry can't be saved yet, or null. */
export function handProblem(d: HandDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'Choose the day.';
  if (!d.desc.trim()) return 'Say what it was.';
  if (handCents(d.amount, d.dir) === null) return 'Enter an amount, like 12.50.';
  return null;
}

/**
 * A transaction written in by hand. Its id is supplied (random, never derived from the
 * content), and its fingerprint is `hand|<id>`, which no statement line can ever have.
 * Its category counts as chosen by hand, so rules leave it alone.
 */
export function handTxn(d: HandDraft, id: string, now: string): Txn {
  const cents = handCents(d.amount, d.dir);
  if (cents === null) throw new Error('No amount');
  return { id, date: d.date, desc: d.desc.trim().replace(/\s+/g, ' '), cents, category: d.category, fp: HAND_FP + id, manual: true, hand: true, addedAt: now };
}

/** The category a hand entry would get as it's typed (rules, then keywords, then the sign). */
export const suggestCategory = (desc: string, dir: HandDraft['dir'], rules: Rule[] = []): CatKey =>
  categorize(desc || '', dir === 'in' ? 1 : -1, rules);

/**
 * Apply an edit. Category can change on any line; date, description and amount only on a
 * hand-entered one (statement lines stay exactly as the bank had them). Id and fp never change.
 */
export function editTxn(t: Txn, patch: Partial<Pick<Txn, 'date' | 'desc' | 'cents' | 'category'>>): Txn {
  const next: Txn = { ...t };
  if (patch.category && patch.category !== t.category) { next.category = patch.category; next.manual = true; }
  if (isHand(t)) {
    if (patch.date && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)) next.date = patch.date;
    if (patch.desc?.trim()) next.desc = patch.desc.trim().replace(/\s+/g, ' ');
    if (typeof patch.cents === 'number' && Number.isFinite(patch.cents) && patch.cents !== 0) next.cents = Math.round(patch.cents);
  }
  return next;
}

/* ---------------- categories ---------------- */

/**
 * Built-in keywords, checked in this order (first hit wins), as whole words on the normalized
 * description. A trailing '*' matches any word starting with it.
 */
export const DEFAULT_RULES: [CatKey, string[]][] = [
  ['transfers', ['transfer', 'xfer', 'zelle', 'venmo', 'payment thank you', 'autopay', 'auto pay', 'credit card payment', 'card payment', 'epay', 'online payment', 'atm withdrawal', 'atm', 'to savings', 'from savings', 'from checking', 'to checking']],
  ['writing', ['scrivener', 'literature latte', 'reedsy', 'querytracker', 'query tracker', 'kdp', 'kindle direct', 'submittable', 'duotrope', 'writers digest', 'writer s digest', 'poets writers', 'publishers marketplace', 'contest', 'contest entry', 'entry fee', 'editor', 'editing', 'editorial', 'manuscript', 'conference', 'writers conference', 'thrillerfest', 'bookshop', 'barnes noble', 'barnes', 'books', 'book', 'bookstore', 'books a million', 'half price books', 'prowritingaid', 'grammarly', 'ingramspark', 'bowker', 'isbn', 'nanowrimo', 'sisters in crime', 'mystery writers', 'thriller writers', 'masterclass', 'pitch wars', 'campfire', 'plottr', 'dabble']],
  ['giving', ['tithe', 'tithe ly', 'tithely', 'church', 'donation', 'donate', 'ministries', 'ministry', 'charity', 'pushpay', 'givelify', 'gofundme', 'salvation army', 'compassion international', 'parish', 'chapel', 'offering']],
  ['pets', ['vet', 'vets', 'veterinary', 'veterinarian', 'animal hospital', 'animal clinic', 'chewy', 'petco', 'petsmart', 'pet supplies', 'pet', 'rover', 'banfield', 'barkbox', 'bark', 'dog', 'groomer', 'grooming', 'kennel']],
  ['subscriptions', ['netflix', 'spotify', 'hulu', 'disney plus', 'disneyplus', 'hbo max', 'max com', 'apple com', 'icloud', 'google storage', 'google one', 'youtube premium', 'youtube', 'amazon prime', 'prime video', 'patreon', 'substack', 'openai', 'chatgpt', 'anthropic', 'claude ai', 'adobe', 'microsoft', 'dropbox', 'notion', 'audible', 'peacock', 'paramount', 'siriusxm', 'sirius', 'kindle unlimited', 'nytimes', 'subscription']],
  ['dining', ['uber eats', 'ubereats', 'doordash', 'grubhub', 'postmates', 'restaurant', 'cafe', 'coffee', 'starbucks', 'dutch bros', 'mcdonald*', 'chick fil a', 'chickfila', 'chipotle', 'panera', 'subway', 'wendy*', 'sonic', 'whataburger', 'domino*', 'pizza', 'taco*', 'burger*', 'tst', 'grill', 'kitchen', 'diner', 'bakery', 'bar', 'pub', 'brewing', 'cantina', 'bbq', 'sushi', 'dunkin', 'kolache*']],
  ['groceries', ['kroger', 'heb', 'h e b', 'whole foods', 'wholefds', 'trader joe*', 'aldi', 'safeway', 'publix', 'wegmans', 'costco', 'sams club', 'sprouts', 'grocery', 'groceries', 'supermarket', 'market', 'food lion', 'meijer', 'albertsons', 'instacart', 'harris teeter', 'winco', 'tom thumb', 'walmart grocery']],
  ['transport', ['shell', 'exxon', 'exxonmobil', 'mobil', 'chevron', 'bp', 'valero', 'qt', 'quiktrip', 'circle k', 'racetrac', 'buc ee*', 'bucees', 'murphy usa', 'gas', 'fuel', 'uber', 'lyft', 'parking', 'toll*', 'txtag', 'ezpass', 'e zpass', 'jiffy lube', 'autozone', 'o reilly', 'car wash', 'dmv', 'tire*', 'airline*', 'southwest', 'delta air', 'american air*', 'united air*']],
  ['housing', ['rent', 'mortgage', 'electric', 'energy', 'water', 'utility', 'utilities', 'at t', 'att', 'verizon', 't mobile', 'tmobile', 'comcast', 'xfinity', 'spectrum', 'internet', 'insurance', 'geico', 'state farm', 'progressive', 'allstate', 'hoa', 'property', 'apartment*', 'atmos', 'city of', 'waste', 'sewer']],
  ['health', ['pharmacy', 'cvs', 'walgreens', 'doctor', 'dental', 'dentist', 'clinic', 'hospital', 'medical', 'health', 'optometry', 'vision', 'labcorp', 'quest diagnostics', 'urgent care', 'gym', 'fitness', 'planet fitness', 'ymca', 'physician*', 'therapy', 'counseling']],
  ['shopping', ['amazon', 'amzn', 'amazon com', 'target', 'walmart', 'wal mart', 'best buy', 'etsy', 'ebay', 'home depot', 'lowe s', 'lowes', 'ikea', 'tj maxx', 'marshalls', 'kohls', 'old navy', 'apple store', 'nike', 'hobby lobby', 'michaels', 'dollar general', 'dollar tree']],
  ['income', ['payroll', 'direct dep', 'direct deposit', 'dir dep', 'salary', 'paycheck', 'interest paid', 'interest', 'dividend', 'royalt*', 'refund', 'cashback', 'cash back']],
];

function kwMatch(text: string, kw: string): boolean {
  if (kw.endsWith('*')) return ` ${text}`.includes(` ${kw.slice(0, -1)}`);
  return ` ${text} `.includes(` ${kw} `);
}

/** Normalize a rule phrase the same way descriptions are. */
export const normRule = (s: string) => normDesc(s);

/** User rules win (the longest matching phrase first), then the built-in keywords, then the sign. */
export function categorize(desc: string, cents: number, rules: Rule[] = []): CatKey {
  const text = normDesc(desc);
  const mine = rules.filter((r) => r.match && ` ${text} `.includes(` ${normRule(r.match)} `)).sort((a, b) => b.match.length - a.match.length);
  if (mine.length) return mine[0].category;
  for (const [cat, kws] of DEFAULT_RULES) {
    if (cat === 'income' && cents < 0) continue;
    if (kws.some((k) => kwMatch(text, k))) return cat;
  }
  return cents > 0 ? 'income' : 'other';
}

const PREFIXES = /^(pos|debit card|debit|card|purchase|recurring|checkcard|check card|ach|pre ?auth|sq|tst|sp|py|paypal|online|web|visa|mc|dbt|purch|des|withdrawal|payment to|payment)\b ?/;

/** The merchant part of a description, for "always categorize ___ as …". */
export function merchantOf(desc: string): string {
  let t = normDesc(desc).replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) { const n = t.replace(PREFIXES, ''); if (n === t) break; t = n; }
  const words = t.split(' ').filter((w) => w.length > 1 || /^[a-z]$/.test(w));
  return words.slice(0, words[0] && words[0].length <= 3 ? 3 : 2).join(' ');
}

/** Re-categorize every transaction Austin hasn't set by hand. Returns the same array if nothing changed. */
export function applyRules(txns: Txn[], rules: Rule[]): Txn[] {
  let changed = false;
  const out = txns.map((t) => {
    if (t.manual) return t;
    const c = categorize(t.desc, t.cents, rules);
    if (c === t.category) return t;
    changed = true;
    return { ...t, category: c };
  });
  return changed ? out : txns;
}

/** Add or replace (same phrase) a rule. */
export function upsertRule(rules: Rule[], match: string, category: CatKey, id: string, now: string): Rule[] {
  const m = normRule(match);
  if (!m) return rules;
  const i = rules.findIndex((r) => normRule(r.match) === m);
  if (i >= 0) return rules.map((r, j) => (j === i ? { ...r, category } : r));
  return [...rules, { id, match: m, category, createdAt: now }];
}

/* ---------------- totals ---------------- */

export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export const monthLabel = (ym: string, long = false) => {
  const [y, m] = ym.split('-').map(Number);
  return long ? `${new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })} ${y}` : `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
};

/** Transfers between Austin's own accounts are neither earned nor spent. */
const counts = (t: Txn) => t.category !== 'transfers';

export interface MonthTotals { inC: number; outC: number; net: number; count: number }

export function monthTotals(txns: Txn[], ym: string): MonthTotals {
  let inC = 0, outC = 0, count = 0;
  for (const t of txns) {
    if (monthOf(t.date) !== ym) continue;
    count++;
    if (!counts(t)) continue;
    if (t.cents > 0) inC += t.cents; else outC -= t.cents;
  }
  return { inC, outC, net: inC - outC, count };
}

export interface CatSpend { cat: CatKey; cents: number; count: number; share: number }

/** Spending per category for a month (refunds net against their category), largest first. */
export function byCategory(txns: Txn[], ym: string): CatSpend[] {
  const m = new Map<CatKey, { cents: number; count: number }>();
  for (const t of txns) {
    if (monthOf(t.date) !== ym || t.category === 'income' || t.category === 'transfers') continue;
    const cur = m.get(t.category) ?? { cents: 0, count: 0 };
    cur.cents -= t.cents; cur.count++;
    m.set(t.category, cur);
  }
  const rows = [...m.entries()].filter(([, v]) => v.cents > 0).map(([cat, v]) => ({ cat, ...v, share: 0 }));
  const total = rows.reduce((s, r) => s + r.cents, 0);
  return rows.map((r) => ({ ...r, share: total ? r.cents / total : 0 })).sort((a, b) => b.cents - a.cents);
}

export interface TrendMonth { ym: string; label: string; inC: number; outC: number }

/** The 12 months ending with `endYm`, oldest first. */
export function yearTrend(txns: Txn[], endYm: string): TrendMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const ym = shiftMonth(endYm, i - 11);
    const t = monthTotals(txns, ym);
    return { ym, label: MONTHS_SHORT[Number(ym.slice(5)) - 1], inC: t.inC, outC: t.outC };
  });
}

export interface WritingYear { spent: number; earned: number; net: number; count: number; top: { desc: string; cents: number }[] }

/** What the writing life cost (and paid) in a year. */
export function writingSpend(txns: Txn[], year: number): WritingYear {
  const y = String(year);
  let spent = 0, earned = 0, count = 0;
  const byMerchant = new Map<string, number>();
  for (const t of txns) {
    if (t.category !== 'writing' || !t.date.startsWith(y)) continue;
    count++;
    if (t.cents < 0) {
      spent -= t.cents;
      const k = merchantOf(t.desc) || t.desc;
      byMerchant.set(k, (byMerchant.get(k) ?? 0) - t.cents);
    } else earned += t.cents;
  }
  const top = [...byMerchant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([desc, cents]) => ({ desc, cents }));
  return { spent, earned, net: earned - spent, count, top };
}

/** Months that have any transactions, newest first. */
export function monthsWithData(txns: Txn[]): string[] {
  return [...new Set(txns.map((t) => monthOf(t.date)))].sort().reverse();
}

/** The month to open on: this month if it has data, else the latest that does. */
export function defaultMonth(txns: Txn[], today: string): string {
  const cur = monthOf(today);
  const ms = monthsWithData(txns);
  return ms.includes(cur) || !ms.length ? cur : ms[0];
}

/** Search + category filter, newest first. */
export function filterTxns(txns: Txn[], f: { q?: string; cat?: CatKey | null; ym?: string | null }): Txn[] {
  const q = f.q?.trim().toLowerCase();
  return txns
    .filter((t) => (!f.ym || monthOf(t.date) === f.ym) && (!f.cat || t.category === f.cat))
    .filter((t) => !q || t.desc.toLowerCase().includes(q) || CAT_OF[t.category].label.toLowerCase().includes(q) || fmtMoney(t.cents, { cents: true }).includes(q) || t.date.includes(q))
    .sort((a, b) => (a.date === b.date ? a.fp.localeCompare(b.fp) : b.date.localeCompare(a.date)));
}

export const categoryKeys = CATEGORIES.map((c) => c.k);

/* ---------------- restore preview ---------------- */

export const describeMoney: Describer = {
  name: 'Money',
  size: (v) => (v as Partial<MoneyData>).txns?.length ?? 0,
  detail: (v) => {
    const d = v as Partial<MoneyData>;
    const n = d.txns?.length ?? 0, r = d.rules?.length ?? 0;
    return `${n.toLocaleString('en-US')} transaction${n === 1 ? '' : 's'} · ${r} rule${r === 1 ? '' : 's'}`;
  },
};

/** A month in plain dollars for the Keeper: totals and spending by category, never single transactions. */
export function moneyBrief(txns: Txn[], ym: string): { month: string; income: number; spent: number; byCategory: { name: string; dollars: number }[] } {
  const t = monthTotals(txns, ym);
  const label = (k: string) => CATEGORIES.find((c) => c.k === k)?.label ?? k;
  return { month: ym, income: t.inC / 100, spent: t.outC / 100, byCategory: byCategory(txns, ym).map((c) => ({ name: label(c.cat), dollars: c.cents / 100 })) };
}
