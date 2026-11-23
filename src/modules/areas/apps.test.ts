import { describe, expect, it } from 'vitest';
import { appKey, applyApplications, appText, normalizeStatus, parseAppDate, parseApplications, pipeline, previewApplications, splitAppText, type ParsedApp } from './apps';
import type { AreaItem } from './types';

const app = (company: string, role: string, status: AreaItem['status'] = 'applied', date = '2026-11-01', extra: Partial<AreaItem> = {}): AreaItem =>
  ({ id: `${company}-${role}`, list: 'apps', text: appText(company, role), date, status, ...extra });

describe('statuses', () => {
  it('maps whatever the tracker says onto the pipeline', () => {
    const cases: [string, string][] = [
      ['Saved', 'saved'], ['Wishlist', 'saved'], ['interested', 'saved'], ['To Apply', 'saved'],
      ['Applied', 'applied'], ['SUBMITTED', 'applied'],
      ['Phone Screen', 'screen'], ['Recruiter screen', 'screen'], ['screening', 'screen'],
      ['Interview', 'interview'], ['Onsite', 'interview'], ['on-site', 'interview'], ['Final round', 'interview'], ['Technical', 'interview'], ['2nd interview', 'interview'],
      ['Offer', 'offer'], ['Accepted', 'offer'],
      ['Rejected', 'closed'], ['Declined', 'closed'], ['Withdrawn', 'closed'], ['Ghosted', 'closed'], ['No response', 'closed'], ['Closed', 'closed'],
      ['Rejected after interview', 'closed'], ['Offer declined', 'closed'],
    ];
    for (const [raw, want] of cases) expect([raw, normalizeStatus(raw)]).toEqual([raw, want]);
  });
  it('reads anything unknown (or blank) as applied', () => {
    expect(normalizeStatus('Hmm, maybe?')).toBe('applied');
    expect(normalizeStatus('')).toBe('applied');
  });
});

describe('names', () => {
  it('matches the same company and role however they are written', () => {
    expect(appKey('Toast, Inc.', 'Product Manager')).toBe(appKey('toast', 'product  manager'));
    expect(appKey('Ben & Jerry’s', 'PM')).toBe(appKey('Ben and Jerrys', 'pm'));
    expect(appKey('Café Nova LLC', 'Ops')).toBe(appKey('cafe nova', 'ops'));
    expect(appKey('Toast', 'Product Manager')).not.toBe(appKey('Toast', 'Senior Product Manager'));
  });
  it('writes and reads back "Company — Role"', () => {
    expect(appText(' Toast ', 'PM ')).toBe('Toast — PM');
    expect(appText('Toast', '')).toBe('Toast');
    expect(splitAppText('Toast — PM — Payments')).toEqual({ company: 'Toast', role: 'PM — Payments' });
    expect(splitAppText('Toast')).toEqual({ company: 'Toast', role: '' });
  });
});

describe('dates', () => {
  it('reads the formats trackers export', () => {
    expect(parseAppDate('2026-11-03')).toBe('2026-11-03');
    expect(parseAppDate('2026-11-03T22:15:00Z')).toBe('2026-11-03');
    expect(parseAppDate('11/3/2026')).toBe('2026-11-03');
    expect(parseAppDate('11/3/26')).toBe('2026-11-03');
    expect(parseAppDate('11/3/2026 10:42 AM')).toBe('2026-11-03');
    expect(parseAppDate('Nov 3, 2026')).toBe('2026-11-03');
    expect(parseAppDate('November 3rd, 2026')).toBe('2026-11-03');
    expect(parseAppDate('Tuesday, November 3, 2026')).toBe('2026-11-03');
    expect(parseAppDate('Nov 3, 2026, 10:42 AM')).toBe('2026-11-03');
    expect(parseAppDate('3 Nov 2026')).toBe('2026-11-03');
    expect(parseAppDate('46329')).toBe('2026-11-03'); // an Excel day number
    expect(parseAppDate('last week')).toBeNull();
    expect(parseAppDate('')).toBeNull();
  });
});

describe('reading the Application Ledger CSV', () => {
  const messy = '﻿' + [
    'Exported from Application Ledger,,,,,',
    '',
    'Employer,Job Title,Stage,Date Applied,Posting URL,Notes,Follow-up date',
    '"Toast, Inc.",Product Manager,Phone Screen,11/3/2026,https://careers.toast.com/pm,"Spoke to Jordan, follow up Friday",11/10/2026',
    '',
    'Stripe,"Product Manager, Payments",Applied,Nov 12 2026,,,',
    'Figma,Product Ops,Vibes unclear,2026-11-20,not a link,,',
    ',,,,,,',
    'Notion,PM,rejected,someday,,"line one',
    'line two",',
    '  ,Orphan role,Applied,2026-11-01,,,',
    'Linear,PM,offer,46340,https://linear.app/careers,,',
  ].join('\r\n');

  it('finds the columns by name and reads every row it can', () => {
    const r = parseApplications(messy);
    if (!r.ok) throw new Error(r.error);
    expect(r.columns).toEqual({ company: 'Employer', role: 'Job Title', status: 'Stage', date: 'Date Applied', link: 'Posting URL', notes: 'Notes' });
    expect(r.apps).toHaveLength(5);
    expect(r.apps[0]).toEqual({ company: 'Toast, Inc.', role: 'Product Manager', status: 'screen', rawStatus: 'Phone Screen', date: '2026-11-03', link: 'https://careers.toast.com/pm', notes: 'Spoke to Jordan, follow up Friday' });
    expect(r.apps[1]).toMatchObject({ company: 'Stripe', role: 'Product Manager, Payments', status: 'applied', date: '2026-11-12' });
    expect(r.apps[1].link).toBeUndefined();
    expect(r.apps[2]).toMatchObject({ company: 'Figma', status: 'applied', rawStatus: 'Vibes unclear' });
    expect(r.apps[2].link).toBeUndefined(); // "not a link" isn't kept as a link
    expect(r.apps[3]).toMatchObject({ company: 'Notion', status: 'closed', date: null, notes: 'line one\nline two' });
    expect(r.apps[4]).toMatchObject({ company: 'Linear', status: 'offer', date: '2026-11-14' });
    expect(r.skipped).toBe(1); // the row with a role but no company
    expect(r.unknown).toEqual(['Vibes unclear']);
    expect(r.undated).toBe(1);
  });

  it('takes the plain names too, and the first matching column only once', () => {
    const r = parseApplications('company,role,status,date,link,notes\nAcme,PM,interview,2026-11-02,https://acme.com/j,\n');
    expect(r.ok && r.apps[0]).toEqual({ company: 'Acme', role: 'PM', status: 'interview', rawStatus: 'interview', date: '2026-11-02', link: 'https://acme.com/j' });
    const t = parseApplications('Organization,Position,Applied On\nAcme,PM,2026-11-02\n');
    expect(t.ok && t.columns).toEqual({ company: 'Organization', role: 'Position', date: 'Applied On' });
    expect(t.ok && t.apps[0].status).toBe('applied');
  });

  it('says plainly when it can’t read a file', () => {
    expect(parseApplications('')).toEqual({ ok: false, error: 'That file is empty.' });
    expect(parseApplications('Date,Amount\n2026-11-01,4.50\n').ok).toBe(false);
    expect(parseApplications('Company,Role\n,PM\n').ok).toBe(false);
  });
});

describe('previewing an import', () => {
  const incoming: ParsedApp[] = [
    { company: 'Toast', role: 'Product Manager', status: 'interview', rawStatus: 'Onsite', date: '2026-11-03' },
    { company: 'Stripe', role: 'PM', status: 'applied', rawStatus: 'Applied', date: '2026-11-12' },
    { company: 'Figma', role: 'Product Ops', status: 'applied', rawStatus: 'Applied', date: null },
    { company: 'Linear', role: 'PM', status: 'applied', rawStatus: 'Applied', date: '2026-11-01' },
    { company: 'Notion', role: 'PM', status: 'applied', rawStatus: '', date: '2026-11-01' },
    { company: 'toast inc', role: 'product manager', status: 'closed', rawStatus: 'Rejected', date: null },
  ];
  const existing = [
    app('Toast, Inc.', 'Product Manager', 'applied'),
    app('Stripe', 'PM', 'applied'),
    app('Linear', 'PM', 'interview'),
    app('Notion', 'PM', 'screen'),
    { id: 'w', list: 'wins', text: 'Figma — Product Ops', date: '2026-11-01' } as AreaItem, // another list: never matched
  ];

  it('sorts the file into new, moved and unchanged', () => {
    const p = previewApplications(existing, incoming);
    expect(p.add.map((a) => a.company)).toEqual(['Figma']);
    expect(p.moved.map((m) => [m.item.id, m.from, m.to, m.back])).toEqual([
      ['Toast, Inc.-Product Manager', 'applied', 'interview', false],
      ['Linear-PM', 'interview', 'applied', true],
    ]);
    // Notion's row has no status, so it says nothing about where it stands.
    expect(p.same.map((s) => s.item.id)).toEqual(['Stripe-PM', 'Notion-PM']);
    expect(p.repeats).toBe(1);
  });

  it('adds the new ones and changes only the status of moved ones; nothing is removed', () => {
    const p = previewApplications(existing, incoming);
    let n = 0;
    const next = applyApplications(existing, p.add, p.moved, '2026-11-23', () => `new-${++n}`);
    expect(next).toHaveLength(existing.length + 1);
    expect(next[0]).toEqual({ id: 'new-1', list: 'apps', text: 'Figma — Product Ops', date: '2026-11-23', status: 'applied' });
    const toast = next.find((i) => i.id === 'Toast, Inc.-Product Manager')!;
    expect(toast).toEqual({ ...existing[0], status: 'interview' });
    expect(next.find((i) => i.id === 'Stripe-PM')).toBe(existing[1]);
    for (const old of existing) expect(next.some((i) => i.id === old.id)).toBe(true);
  });

  it('fills a blank date only, and carries link and notes onto new ones', () => {
    const blank = { ...app('Acme', 'PM', 'applied'), date: '' };
    const p = previewApplications([blank], [
      { company: 'Acme', role: 'PM', status: 'screen', rawStatus: 'screen', date: '2026-11-04' },
      { company: 'Beta', role: 'Ops', status: 'saved', rawStatus: 'saved', date: '2026-11-05', link: 'https://beta.io/j', notes: 'warm intro' },
    ]);
    const next = applyApplications([blank], p.add, p.moved, '2026-11-23', () => 'b');
    expect(next[1]).toMatchObject({ id: blank.id, status: 'screen', date: '2026-11-04' });
    expect(next[0]).toEqual({ id: 'b', list: 'apps', text: 'Beta — Ops', date: '2026-11-05', status: 'saved', link: 'https://beta.io/j', body: 'warm intro' });
    const dated = app('Acme', 'PM', 'applied', '2026-10-01');
    const p2 = previewApplications([dated], [{ company: 'Acme', role: 'PM', status: 'screen', rawStatus: 'screen', date: '2026-11-04' }]);
    const again = applyApplications([dated], [], p2.moved, '2026-11-23', () => 'x');
    expect(again[0]).toMatchObject({ status: 'screen', date: '2026-10-01' });
  });

  it('a second import of the same file changes nothing', () => {
    const r = parseApplications('Company,Role,Status,Date\nAcme,PM,Interview,2026-11-02\nBeta,Ops,Applied,2026-11-03\n');
    if (!r.ok) throw new Error(r.error);
    const once = applyApplications([], previewApplications([], r.apps).add, [], '2026-11-23', (() => { let n = 0; return () => `i${++n}`; })());
    const p = previewApplications(once, r.apps);
    expect([p.add.length, p.moved.length, p.same.length]).toEqual([0, 0, 2]);
  });
});

describe('the pipeline', () => {
  it('counts each stage, the last 7 and 30 days, and the response rate', () => {
    const items = [
      app('A', '1', 'saved', '2026-11-23'),
      app('B', '1', 'applied', '2026-11-23'),
      app('C', '1', 'applied', '2026-11-17'), // 6 days ago: inside the week
      app('D', '1', 'screen', '2026-11-16'), // 7 days ago: outside it
      app('E', '1', 'interview', '2026-10-25'), // 29 days ago
      app('F', '1', 'offer', '2026-10-24'), // 30 days ago
      app('G', '1', 'closed', '2026-09-01'),
      { ...app('H', '1', 'applied', '2026-11-20'), status: undefined },
      { id: 'w', list: 'wins', text: 'Not an app', date: '2026-11-23' } as AreaItem,
    ];
    const p = pipeline(items, '2026-11-23');
    expect(p.counts).toEqual({ saved: 1, applied: 3, screen: 1, interview: 1, offer: 1, closed: 1 });
    expect(p.total).toBe(8);
    expect(p.sent).toBe(7);
    expect(p.last7).toBe(3); // B, C, H (the saved one doesn't count)
    expect(p.last30).toBe(5); // + D, E
    expect(p.responseRate).toBeCloseTo(3 / 7);
  });
  it('has no response rate before anything is sent', () => {
    expect(pipeline([], '2026-11-23')).toMatchObject({ total: 0, sent: 0, responseRate: null });
    expect(pipeline([app('A', '1', 'saved')], '2026-11-23').responseRate).toBeNull();
  });
});
