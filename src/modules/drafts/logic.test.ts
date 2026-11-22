import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { countWords, maybeVersion, paragraphs, roundedCount, bestSprint, sprintPoints, sprintVerdict, wpm } from './logic';
import type { Sprint } from './types';
import { manuscriptDocx, manuscriptText } from './manuscriptFormat';

describe('drafts', () => {
  it('counts words like a publisher', () => {
    expect(countWords("She didn't look back — not once. Mother-in-law, 1999.")).toBe(8);
    expect(countWords('   ')).toBe(0);
  });

  it('splits paragraphs and scene breaks', () => {
    expect(paragraphs('One.\n\nTwo.\n#\nThree.')).toEqual([{ kind: 'p', text: 'One.' }, { kind: 'p', text: 'Two.' }, { kind: 'break' }, { kind: 'p', text: 'Three.' }]);
  });

  it('keeps versions every ten minutes, never duplicates', () => {
    const t0 = new Date('2026-11-21T20:00:00Z');
    let v = maybeVersion([], 'a', t0);
    v = maybeVersion(v, 'a b', new Date(t0.getTime() + 60_000));
    expect(v).toHaveLength(1);
    v = maybeVersion(v, 'a b', new Date(t0.getTime() + 11 * 60_000));
    expect(v.map((x) => x.words)).toEqual([2, 1]);
    expect(maybeVersion(v, 'a b', new Date(), true)).toBe(v);
    expect(maybeVersion(v, 'a b c', new Date(), true, 'Before restoring')[0].label).toBe('Before restoring');
  });

  it('rounds the title-page count', () => {
    expect(roundedCount(84_612)).toBe('about 85,000 words');
    expect(roundedCount(4_449)).toBe('about 4,400 words');
  });

  it('builds a real .docx in manuscript format', () => {
    const bytes = manuscriptDocx({ title: 'The Life I Deserve', author: { name: 'Austin Watson', surname: 'Watson', contact: 'austin@example.com' }, words: 84612,
      chapters: [{ title: 'The party', text: 'First line.\n\nSecond *line*.\n#\nAfter the break & more.' }] });
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/header1.xml', 'word/styles.xml']);
    const doc = strFromU8(files['word/document.xml']);
    expect(doc).toContain('THE LIFE I DESERVE');
    expect(doc).toContain('about 85,000 words');
    expect(doc).toContain('<w:i/>');
    expect(doc).toContain('After the break &amp; more.');
    expect(strFromU8(files['word/header1.xml'])).toContain('Watson / THE LIFE I DESERVE / ');
    expect(strFromU8(files['word/styles.xml'])).toContain('Times New Roman');
    expect(manuscriptText({ title: 'X', author: { name: 'A', surname: 'A', contact: '' }, words: 10, chapters: [{ title: 'Chapter 1', text: 'Hi.' }] })).toContain('CHAPTER 1\n\nHi.');
  });
});

describe('sprints', () => {
  const sp = (at: string, words: number, completed = true, minutes = 25): Sprint => ({ id: at, at, day: at.slice(0, 10), ms: 'm', ch: 'c', planned: 25, minutes, words, completed });
  it('scores pace and the best', () => {
    expect(wpm(500, 25)).toBe(20);
    expect(wpm(10, 0)).toBe(0);
    const before = [sp('2026-01-01T09:00', 400), sp('2026-01-02T09:00', 900, false)];
    expect(bestSprint(before)?.words).toBe(400);
    expect(sprintVerdict({ words: 450, minutes: 25, completed: true }, before)).toEqual({ pace: 18, best: true, prevBest: 400 });
    expect(sprintVerdict({ words: 450, minutes: 12, completed: false }, before).best).toBe(false);
  });
  it('pays the Lounge for finished sprints and new bests', () => {
    const p = sprintPoints([sp('2026-01-03T09:00', 300), sp('2026-01-01T09:00', 200), sp('2026-01-02T09:00', 100), sp('2026-01-04T09:00', 999, false), sp('2026-01-05T09:00', 0)]);
    expect(p).toEqual({ done: 3, bests: 1, total: 3 * 5 + 10 });
  });
});
