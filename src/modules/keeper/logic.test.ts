import { describe, expect, it } from 'vitest';
import { askPrompt, briefing, DEFAULT_ALLOW, fallbackRejected, keeperError } from './logic';
import { DEFAULT_PUB } from '../pub/types';

const data = {
  today: '2026-11-21',
  days: { '2026-11-20': { writing: 60, note: 'Fixed the party scene' }, '2026-11-21': { reading: 20 } },
  manuscripts: [{ id: 'm', title: 'The Life I Deserve', target: 85000, history: {}, chapters: [{ id: 'c', title: 'The party', words: 3400, status: 'done' as const }] }],
  reviews: { '2026-11-09': { intention: 'Finish ch 7', sealedAt: 'x' } },
  books: [{ id: 'b', title: 'Rebecca', author: 'du Maurier', genre: '', status: 'read' as const, rating: 5, craft: ['Unnamed narrator'], addedAt: '' }],
  pub: DEFAULT_PUB,
  chapel: { days: { '2026-11-21': { prayer: 15 } }, prayers: [{ id: 'p', text: 'private', added: '2026-11-01' }], verses: [] },
};

describe('the Keeper briefing', () => {
  it('includes only what is allowed', () => {
    const b = briefing(data, DEFAULT_ALLOW);
    expect(b).toContain('Streak: 2 days');
    expect(b).toContain('Fixed the party scene');
    expect(b).toContain('1. The party [done, 3400w]');
    expect(b).toContain('intention: Finish ch 7');
    expect(b).toContain('craft notes: Unnamed narrator');
    expect(b).not.toContain('CHAPEL');
    const none = briefing(data, { ledger: false, manuscripts: false, chapterText: false, reviews: false, shelf: false, publishing: false, chapel: false });
    expect(none).toBe('Today is 2026-11-21.');
    expect(briefing(data, { ...DEFAULT_ALLOW, chapel: true })).toContain('1 prayers carried');
  });
  it('only sends chapter text when given it', () => {
    expect(askPrompt('craft', { chapterTitle: 'The party' })).toContain('not its text');
    expect(askPrompt('craft', { chapterTitle: 'The party', chapterText: 'She smiled.' })).toContain('She smiled.');
  });
});

describe('the whole life in the briefing', () => {
  it('reads the rest of life, the calendar and money only when allowed', async () => {
    const { briefing: b, DEFAULT_ALLOW: A } = await import('./logic');
    const d = {
      today: '2026-11-22', days: {}, manuscripts: [], reviews: {}, books: [], pub: { queries: [], contests: [], feedback: [], outreach: [] }, chapel: { days: {}, prayers: [], verses: [] },
      life: { work: { '2026-11-21': 300 }, learning: {}, body: {}, family: { '2026-11-22': 90 }, walks: { '2026-11-22': 40 }, steps: { '2026-11-22': 9000 }, sleep: {} },
      events: [{ day: '2026-11-22', start: '09:00', end: '10:00', title: 'Standup' }],
      money: [{ month: '2026-11', income: 5000, spent: 3200, byCategory: [{ name: 'Groceries', dollars: 600 }] }],
    } as unknown as Parameters<typeof b>[0];
    const on = b(d, A);
    expect(on).toMatch(/Work \(the Office\): .*11-21 300m/);
    expect(on).toMatch(/Dog walks with Cooper and Shadow: .*11-22 40m/);
    expect(on).toMatch(/TODAY'S CALENDAR: 09:00–10:00 Standup/);
    expect(on).not.toMatch(/MONEY/);
    expect(b(d, { ...A, money: true })).toMatch(/MONEY 2026-11: in \$5000, out \$3200; by category: Groceries \$600/);
    expect(b(d, { ...A, life: false, calendar: false })).not.toMatch(/REST OF LIFE|CALENDAR/);
  });
});

describe('the Keeper reads the Scene Library', () => {
  it('lists marked scenes with the shelf, so craft help can name the move', () => {
    const b = briefing({ today: '2026-11-23', days: {}, manuscripts: [], reviews: {}, books: [{ id: 'b', title: 'Gone Girl', author: 'Flynn', genre: '', status: 'read', rating: 5, craft: [], addedAt: '' }], pub: { queries: [], contests: [], feedback: [], outreach: [], road: {} }, chapel: { days: {}, prayers: [], verses: [] } as never,
      scenes: [{ kind: 'interrogation', label: 'Silence does the work', source: 'Gone Girl', where: 'p. 212', why: 'he fills the quiet' }] }, DEFAULT_ALLOW);
    expect(b).toContain('SCENE LIBRARY');
    expect(b).toContain('[interrogation] Silence does the work — Gone Girl, p. 212 (why it works: he fills the quiet)');
  });
});

describe('when the Keeper can’t answer', () => {
  it('names the real cause in plain words', () => {
    expect(keeperError(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.')).toMatch(/no credit left/);
    expect(keeperError(401, 'authentication_error', 'invalid x-api-key')).toMatch(/wasn’t accepted/);
    expect(keeperError(404, 'not_found_error', 'model: claude-opus-5-5')).toMatch(/model: claude-opus-5-5/);
    expect(keeperError(529, 'overloaded_error', 'Overloaded')).toMatch(/busy/);
    expect(keeperError(0, '', '')).toMatch(/Couldn’t reach/);
    expect(keeperError(400, 'invalid_request_error', 'max_tokens: too large')).toBe('The Keeper couldn’t answer: max_tokens: too large');
  });
  it('spots a rejected fallback setting, so the request can go again without it', () => {
    expect(fallbackRejected('fallbacks: Extra inputs are not permitted')).toBe(true);
    expect(fallbackRejected('Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header')).toBe(true);
    expect(fallbackRejected('Your credit balance is too low')).toBe(false);
  });
});
