import { describe, expect, it } from 'vitest';
import { fuzzyScore, parseLog, rank } from './paletteLogic';

describe('command palette', () => {
  it('ranks fuzzy matches, word starts first', () => {
    const cmds = [{ id: 'l', title: 'The Ledger', group: 'Go to' as const }, { id: 'lo', title: 'The Lounge', group: 'Go to' as const }, { id: 'lm', title: 'Lamp Mode', group: 'Go to' as const, keywords: 'timer focus' }];
    expect(rank(cmds, 'led').map((c) => c.id)).toEqual(['l']);
    expect(rank(cmds, 'lm')[0].id).toBe('lm');
    expect(rank(cmds, 'timer').map((c) => c.id)).toEqual(['lm']);
    expect(fuzzyScore('zzz', 'The Ledger')).toBe(0);
  });

  it('understands quick logging', () => {
    expect(parseLog('30 writing')).toEqual({ mins: 30, cat: 'writing' });
    expect(parseLog('log 45m edit')).toEqual({ mins: 45, cat: 'editing' });
    expect(parseLog('1.5h reading')).toEqual({ mins: 90, cat: 'reading' });
    expect(parseLog('craft 20')).toEqual({ mins: 20, cat: 'learning' });
    expect(parseLog('the ledger')).toBeNull();
    expect(parseLog('30 praying')).toBeNull();
  });
});
