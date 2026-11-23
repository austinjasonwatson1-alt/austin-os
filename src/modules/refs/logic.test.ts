import { describe, expect, it } from 'vitest';
import { cleanScene, describeRefs, findScenes, kindCounts, kindOf, matchKind, parseSceneCapture, suggestKinds } from './logic';
import type { SceneRef } from './types';

const books = [{ id: 'b1', title: 'Gone Girl', author: 'Gillian Flynn' }, { id: 'b2', title: 'The Silent Patient', author: 'Alex Michaelides' }];
const S = (p: Partial<SceneRef>): SceneRef => ({ id: Math.random().toString(36), kind: 'other', label: 'x', source: 's', tags: [], added: '2026-11-01', ...p });

describe('the Scene Library', () => {
  it('reads a quick capture: kind, book, page and why it works', () => {
    expect(parseSceneCapture('interrogation: Gone Girl p. 212 — the detective lets the silence do the work', books)).toEqual({
      kind: 'interrogation', label: 'the detective lets the silence do the work', source: 'Gone Girl · Gillian Flynn', bookId: 'b1', where: 'p. 212', why: 'the detective lets the silence do the work', tags: [],
    });
    const s = parseSceneCapture('Twist: silent patient ch 41 - the therapist is the one in the diary, all along and in plain sight', books)!;
    expect([s.kind, s.bookId, s.where, s.label]).toEqual(['reveal', 'b2', 'ch 41', 'the therapist is the one in the diary,…']);
    const film = parseSceneCapture('interview: Mindhunter S1E2', books)!;
    expect([film.kind, film.source, film.bookId, film.label]).toEqual(['interrogation', 'Mindhunter S1E2', undefined, 'Interrogation in Mindhunter S1E2']);
    expect(parseSceneCapture('dinner party: Big Little Lies 62%', books)).toMatchObject({ kind: 'dinner party', where: '62%', source: 'Big Little Lies' });
    expect(parseSceneCapture('   ', books)).toBeNull();
  });

  it('reads it dictated, without the punctuation', () => {
    expect(parseSceneCapture('Interrogation Gone Girl page 212 the silence does the work', books)).toMatchObject({ kind: 'interrogation', bookId: 'b1', where: 'page 212', why: 'the silence does the work' });
    expect(parseSceneCapture('first line the silent patient she shot him five times in the face', books)).toMatchObject({ kind: 'opening', bookId: 'b2', why: 'she shot him five times in the face' });
    expect(parseSceneCapture('the twist Big Little Lies chapter 30', books)).toMatchObject({ kind: 'reveal', source: 'Big Little Lies', where: 'chapter 30' });
  });

  it('knows the kinds and keeps his own', () => {
    expect(matchKind('Interview')).toBe('interrogation');
    expect(matchKind('first line')).toBe('opening');
    expect(matchKind('Dinner Party')).toBe('dinner party');
    expect(kindOf('dinner party').label).toBe('Dinner party');
    expect(kindOf('interrogation').label).toBe('Interrogation');
  });

  it('suggests scenes for a chapter from its title', () => {
    expect(suggestKinds('Chapter 12: The Interview')).toEqual(['interrogation']);
    expect(suggestKinds('The body in the lake')).toContain('discovery');
    expect(suggestKinds('Tuesday')).toEqual([]);
  });

  it('finds scenes by any word and by kind, newest first, and counts kinds', () => {
    const all = [S({ kind: 'interrogation', label: 'Silence as pressure', added: '2026-11-02' }), S({ kind: 'interrogation', source: 'Mindhunter', added: '2026-11-05' }), S({ kind: 'dinner party', why: 'everyone lying at once' })];
    expect(findScenes(all, 'silence').map((s) => s.label)).toEqual(['Silence as pressure']);
    expect(findScenes(all, '', ['interrogation']).map((s) => s.added)).toEqual(['2026-11-05', '2026-11-02']);
    expect(findScenes(all, 'lying').length).toBe(1);
    expect(kindCounts(all).map((k) => [k.k, k.n])).toEqual([['interrogation', 2], ['dinner party', 1]]);
  });

  it('tidies before saving and describes itself for a restore', () => {
    expect(cleanScene({ kind: ' ', label: ' A ', source: 'B ', why: ' ', tags: ['#Police', 'police', ' '] })).toEqual({ kind: 'other', label: 'A', source: 'B', where: undefined, passage: undefined, why: undefined, tags: ['police'] });
    expect(describeRefs.detail({ scenes: [1, 2] })).toBe('2 scenes marked');
  });
});
