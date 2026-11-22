import { describe, expect, it } from 'vitest';
import { allTags, describeIdeas, filterIdeas, kindCounts, parseCapture, revisit, type Idea } from './logic';

const I = (p: Partial<Idea>): Idea => ({ id: p.title ?? 'x', kind: 'novel', title: '', spark: 's', tags: [], heat: 2, stage: 'spark', created: '2026-01-01', updated: '2026-01-01', ...p });

describe('quick capture', () => {
  it('reads a kind prefix, a title, and tags', () => {
    expect(parseCapture('short: The Lighthouse Wife — she keeps the light after he drowns #grief #sea', 'novel'))
      .toEqual({ kind: 'short', title: 'The Lighthouse Wife', spark: 'she keeps the light after he drowns', tags: ['grief', 'sea'] });
    expect(parseCapture('#flash A dog that only barks at one neighbor', 'novel')).toMatchObject({ kind: 'flash', title: '', spark: 'A dog that only barks at one neighbor' });
    expect(parseCapture('The Second Phone: a wife finds the burner in the garage', 'novel')).toMatchObject({ kind: 'novel', title: 'The Second Phone', spark: 'a wife finds the burner in the garage' });
  });
  it('understands two-word kinds, typed or dictated', () => {
    expect(parseCapture('short story: The Last Ferry — two strangers, one lie', 'novel')).toMatchObject({ kind: 'short', title: 'The Last Ferry', spark: 'two strangers, one lie' });
    expect(parseCapture('Short story a ferry that never reaches the island', 'novel')).toMatchObject({ kind: 'short', spark: 'a ferry that never reaches the island' });
    expect(parseCapture('Flash fiction the last voicemail', 'novel')).toMatchObject({ kind: 'flash', spark: 'the last voicemail' });
    expect(parseCapture('Novel about a town that forgets', 'short')).toMatchObject({ kind: 'short', spark: 'Novel about a town that forgets' });
  });
  it('keeps a plain idea whole', () => {
    expect(parseCapture('What if the nanny cam caught the husband lying, not the nanny?', 'short'))
      .toEqual({ kind: 'short', title: '', spark: 'What if the nanny cam caught the husband lying, not the nanny?', tags: [] });
    expect(parseCapture('a #story about #twins in the attic', 'novel')).toEqual({ kind: 'short', title: '', spark: 'a story about twins in the attic', tags: ['twins'] });
  });
});

describe('the vault', () => {
  const ideas = [
    I({ title: 'A', heat: 1, updated: '2026-03-01', tags: ['twins'] }),
    I({ title: 'B', heat: 3, kind: 'short', updated: '2026-02-01', tags: ['twins', 'sea'] }),
    I({ title: 'C', stage: 'written', updated: '2026-05-01' }),
    I({ title: 'D', stage: 'shelved', kind: 'short' }),
  ];
  it('filters to open ideas, hottest first', () => {
    expect(filterIdeas(ideas, {}).map((i) => i.title)).toEqual(['B', 'A']);
    expect(filterIdeas(ideas, { stage: 'written' }).map((i) => i.title)).toEqual(['C']);
    expect(filterIdeas(ideas, { stage: null }).length).toBe(4);
    expect(filterIdeas(ideas, { kind: 'short', stage: null }).map((i) => i.title)).toEqual(['B', 'D']);
    expect(filterIdeas(ideas, { q: 'b' }).map((i) => i.title)).toEqual(['B']);
    expect(filterIdeas(ideas, { tag: 'sea' }).map((i) => i.title)).toEqual(['B']);
  });
  it('counts, tags and resurfaces', () => {
    expect(kindCounts(ideas)).toMatchObject({ novel: 2, short: 1 });
    expect(allTags(ideas)).toEqual([{ tag: 'twins', n: 2 }, { tag: 'sea', n: 1 }]);
    expect(['A', 'B']).toContain(revisit(ideas, '2026-11-22')!.title);
    expect(revisit([], '2026-11-22')).toBeNull();
    expect(describeIdeas.detail({ ideas })).toBe('4 ideas · 2 novels, 2 short');
  });
});
