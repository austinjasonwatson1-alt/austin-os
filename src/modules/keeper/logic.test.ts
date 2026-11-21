import { describe, expect, it } from 'vitest';
import { askPrompt, briefing, DEFAULT_ALLOW } from './logic';
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
