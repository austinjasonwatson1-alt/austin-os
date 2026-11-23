/**
 * The job-application pipeline: reading the Application Ledger's CSV export, matching it against
 * the applications already in the Office (list `apps`), and counting the pipeline. Pure; no browser APIs.
 */

import { addDays } from '../../core/dates';
import { parseCsvRows } from '../ledger/logic';
import { parseBankDate } from '../money/logic';
import type { AreaItem } from './types';

export type AppStatus = NonNullable<AreaItem['status']>;

export const APPS_LIST = 'apps';

/** The road to an offer, in order. Closed sits apart from it. */
export const STAGES: { k: AppStatus; label: string }[] = [
  { k: 'saved', label: 'Saved' },
  { k: 'applied', label: 'Applied' },
  { k: 'screen', label: 'Screen' },
  { k: 'interview', label: 'Interview' },
  { k: 'offer', label: 'Offer' },
  { k: 'closed', label: 'Closed' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.k, s.label])) as Record<AppStatus, string>;
const RANK: Record<AppStatus, number> = { saved: 0, applied: 1, screen: 2, interview: 3, offer: 4, closed: 5 };

/* ---------------- statuses ---------------- */

/** Checked in this order, so "Rejected after interview" is closed and "Offer declined" is closed too. */
const STATUS_RULES: [AppStatus, RegExp][] = [
  ['closed', /\b(reject\w*|declin\w*|withdr[ae]wn?|withdraw\w*|ghost\w*|no (response|reply|answer)|closed?|not (selected|moving forward|a fit)|turned down|dead|lost|archived|position filled|filled|unsuccessful)\b/],
  ['offer', /\b(offers?|offered|accepted|hired|signed)\b/],
  ['interview', /\b(interview\w*|on ?site|final\w*|technical|tech screen|panel|case study|take ?home|loop|round \d|\d(st|nd|rd|th) round)\b/],
  ['screen', /\b(screen\w*|phone|recruiter (call|chat)|hr call|intro call)\b/],
  ['applied', /\b(applied|submitted|sent|application sent|in review|under review|pending)\b/],
  ['saved', /\b(saved|wish ?list|interested|to apply|bookmark\w*|planning|not applied|draft)\b/],
];

/** A status as the Application Ledger wrote it → a pipeline stage, or null if it's not one we know. */
export function matchStatus(raw: string): AppStatus | null {
  const s = raw.toLowerCase().replace(/[_\-/]+/g, ' ').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const [k, re] of STATUS_RULES) if (re.test(s)) return k;
  return null;
}

/** Any status → a pipeline stage. Anything unknown (or blank) counts as applied. */
export const normalizeStatus = (raw: string): AppStatus => matchStatus(raw) ?? 'applied';

/* ---------------- names & matching ---------------- */

const SUFFIX = /\s+(inc|incorporated|llc|ltd|limited|corp|corporation|plc|gmbh|co)$/;

/** Lowercase letters and digits only, accents dropped, "&" read as "and", company suffixes off. */
export function normName(s: string): string {
  let n = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['\u2019]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  while (SUFFIX.test(n)) n = n.replace(SUFFIX, '');
  return n;
}

/** The key one application is matched by: company + role. */
export const appKey = (company: string, role: string) => `${normName(company)}|${normName(role)}`;

/** "Company — Role" (just the company when there's no role). */
export const appText = (company: string, role: string) => (role.trim() ? `${company.trim()} — ${role.trim()}` : company.trim());

/** The reverse of `appText`. */
export function splitAppText(text: string): { company: string; role: string } {
  const i = text.indexOf(' — ');
  return i < 0 ? { company: text.trim(), role: '' } : { company: text.slice(0, i).trim(), role: text.slice(i + 3).trim() };
}

export const itemKey = (i: AreaItem) => { const { company, role } = splitAppText(i.text); return appKey(company, role); };
export const statusOf = (i: AreaItem): AppStatus => i.status ?? 'applied';

/* ---------------- reading the CSV ---------------- */

export interface ParsedApp {
  company: string;
  role: string;
  status: AppStatus;
  /** The status as the file wrote it. */
  rawStatus: string;
  /** Local 'YYYY-MM-DD', or null when the file had no date we could read. */
  date: string | null;
  link?: string;
  notes?: string;
}

export type Field = 'company' | 'role' | 'status' | 'date' | 'link' | 'notes';

export type AppsParse =
  | {
      ok: true;
      apps: ParsedApp[];
      /** Which header each field was read from. */
      columns: Partial<Record<Field, string>>;
      /** Data rows with no company or role. */
      skipped: number;
      /** Statuses we didn't recognise (read as applied), each once. */
      unknown: string[];
      /** Rows with a date we couldn't read (they'll be dated today). */
      undated: number;
    }
  | { ok: false; error: string };

const normHead = (h: string) => h.toLowerCase().replace(/[^a-z]+/g, ' ').trim();

/** Exact header names first (in priority order), then a loose word match. */
const NAMES: Record<Field, { exact: string[]; loose?: string[] }> = {
  company: { exact: ['company', 'employer', 'organization', 'organisation', 'company name', 'employer name', 'org'], loose: ['company', 'employer', 'organization', 'organisation'] },
  role: { exact: ['role', 'title', 'position', 'job', 'job title', 'role title', 'position title', 'job role', 'job name'], loose: ['role', 'title', 'position'] },
  status: { exact: ['status', 'stage', 'application status', 'current status'], loose: ['status', 'stage'] },
  date: { exact: ['applied', 'date applied', 'applied on', 'applied date', 'application date', 'date of application', 'date submitted', 'submitted', 'date'], loose: ['applied'] },
  link: { exact: ['link', 'url', 'posting', 'job link', 'job url', 'posting url', 'posting link', 'job posting'], loose: ['link', 'url', 'posting'] },
  notes: { exact: ['notes', 'note', 'comments', 'comment'], loose: ['notes'] },
};
const ORDER: Field[] = ['company', 'role', 'status', 'date', 'link', 'notes'];

function columnsOf(head: string[]): Partial<Record<Field, number>> {
  const h = head.map(normHead);
  const used = new Set<number>();
  const out: Partial<Record<Field, number>> = {};
  for (const f of ORDER) {
    let i = -1;
    for (const n of NAMES[f].exact) { i = h.findIndex((x, j) => x === n && !used.has(j)); if (i >= 0) break; }
    if (i < 0) for (const w of NAMES[f].loose ?? []) { i = h.findIndex((x, j) => !used.has(j) && x.split(' ').includes(w)); if (i >= 0) break; }
    if (i >= 0) { out[f] = i; used.add(i); }
  }
  return out;
}

/** Excel serial day numbers (45964) as well as everything the bank parser reads; ordinals and weekdays are tolerated. */
export function parseAppDate(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    return n > 30000 && n < 80000 ? addDays('1970-01-01', n - 25569) : null;
  }
  s = s.replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i, '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/\s+at\s+.*$/i, '');
  return parseBankDate(s) ?? parseBankDate(s.replace(/,?\s+\d{1,2}:\d{2}.*$/, ''));
}

/**
 * Read the Application Ledger's CSV export (or any job tracker's): finds the header row,
 * picks columns by their common names, and maps every status onto the pipeline.
 */
export function parseApplications(text: string): AppsParse {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  if (!rows.length) return { ok: false, error: 'That file is empty.' };
  let headerRow = -1;
  let C: Partial<Record<Field, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const c = columnsOf(rows[i]);
    if (c.company !== undefined && Object.keys(c).length >= 2) { headerRow = i; C = c; break; }
  }
  if (headerRow < 0) return { ok: false, error: "Couldn't find the columns in that file. It needs a header row with a Company column, and a Role (or Title / Position) column." };

  const head = rows[headerRow];
  const get = (r: string[], f: Field) => (C[f] === undefined ? '' : (r[C[f]!] ?? '').trim());
  const apps: ParsedApp[] = [];
  const unknown = new Set<string>();
  let skipped = 0, undated = 0;
  for (const r of rows.slice(headerRow + 1)) {
    const company = get(r, 'company').replace(/\s+/g, ' ');
    const role = get(r, 'role').replace(/\s+/g, ' ');
    if (!company) { skipped++; continue; }
    const rawStatus = get(r, 'status');
    if (rawStatus && !matchStatus(rawStatus)) unknown.add(rawStatus);
    const rawDate = get(r, 'date');
    const date = rawDate ? parseAppDate(rawDate) : null;
    if (rawDate && !date) undated++;
    const link = get(r, 'link');
    const notes = get(r, 'notes').replace(/\r\n?/g, '\n');
    apps.push({
      company, role, status: normalizeStatus(rawStatus), rawStatus, date,
      ...(/^https?:\/\/\S+$/i.test(link) ? { link } : {}),
      ...(notes ? { notes } : {}),
    });
  }
  if (!apps.length) return { ok: false, error: 'Found the columns, but no rows with a company underneath them.' };
  const columns: Partial<Record<Field, string>> = {};
  for (const f of ORDER) if (C[f] !== undefined) columns[f] = head[C[f]!].trim();
  return { ok: true, apps, columns, skipped, unknown: [...unknown], undated };
}

/* ---------------- previewing & applying an import ---------------- */

export interface MovedApp { item: AreaItem; app: ParsedApp; from: AppStatus; to: AppStatus; /** Further back down the road than it is here (e.g. interview → applied). */ back: boolean }

export interface AppsPlan {
  add: ParsedApp[];
  moved: MovedApp[];
  same: { item: AreaItem; app: ParsedApp }[];
  /** Rows that repeat an earlier row of the same file (the first one counts). */
  repeats: number;
}

/** What an import would do. Matches by company + role; nothing existing is removed. */
export function previewApplications(existing: AreaItem[], incoming: ParsedApp[]): AppsPlan {
  const have = new Map<string, AreaItem>();
  for (const i of existing) if (i.list === APPS_LIST && !have.has(itemKey(i))) have.set(itemKey(i), i);
  const seen = new Set<string>();
  const plan: AppsPlan = { add: [], moved: [], same: [], repeats: 0 };
  for (const app of incoming) {
    const k = appKey(app.company, app.role);
    if (seen.has(k)) { plan.repeats++; continue; }
    seen.add(k);
    const item = have.get(k);
    if (!item) plan.add.push(app);
    // A row with no status says nothing about where an application stands: leave it be.
    else if (app.rawStatus.trim() && statusOf(item) !== app.status) plan.moved.push({ item, app, from: statusOf(item), to: app.status, back: RANK[app.status] < RANK[statusOf(item)] });
    else plan.same.push({ item, app });
  }
  return plan;
}

/**
 * The office items after an import: new applications first (newest first, like a hand-added one),
 * moved ones get their new status (and a date only if theirs is blank). Nothing else changes; nothing is removed.
 */
export function applyApplications(items: AreaItem[], add: ParsedApp[], moved: MovedApp[], today: string, newId: () => string): AreaItem[] {
  const move = new Map(moved.map((m) => [m.item.id, m]));
  const next = items.map((i) => {
    const m = move.get(i.id);
    if (!m) return i;
    return { ...i, status: m.to, ...(!i.date ? { date: m.app.date ?? today } : {}) };
  });
  const fresh: AreaItem[] = add.map((a) => ({
    id: newId(), list: APPS_LIST, text: appText(a.company, a.role), date: a.date ?? today, status: a.status,
    ...(a.link ? { link: a.link } : {}), ...(a.notes ? { body: a.notes } : {}),
  }));
  fresh.sort((x, y) => y.date.localeCompare(x.date));
  return [...fresh, ...next];
}

/* ---------------- the pipeline ---------------- */

export interface Pipeline {
  counts: Record<AppStatus, number>;
  total: number;
  /** Applications sent (anything past saved) dated in the last 7 / 30 days, today included. */
  last7: number;
  last30: number;
  /** Everything past saved: applied, screen, interview, offer and closed. */
  sent: number;
  /** (screen + interview + offer) / sent; null before anything is sent. */
  responseRate: number | null;
}

export function pipeline(items: AreaItem[], today: string): Pipeline {
  const counts: Record<AppStatus, number> = { saved: 0, applied: 0, screen: 0, interview: 0, offer: 0, closed: 0 };
  const from7 = addDays(today, -6), from30 = addDays(today, -29);
  let last7 = 0, last30 = 0, total = 0;
  for (const i of items) {
    if (i.list !== APPS_LIST) continue;
    const s = statusOf(i);
    counts[s]++;
    total++;
    if (s === 'saved' || i.date > today) continue;
    if (i.date >= from7) last7++;
    if (i.date >= from30) last30++;
  }
  const sent = total - counts.saved;
  const responded = counts.screen + counts.interview + counts.offer;
  return { counts, total, last7, last30, sent, responseRate: sent ? responded / sent : null };
}
