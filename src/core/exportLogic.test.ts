import { describe, expect, it } from 'vitest';
import { backupHealth, cell, csv, dataUrlBytes, exportFiles, slug } from './exportLogic';

describe('plain-file export', () => {
  it('writes safe CSV cells and names', () => {
    expect(cell('a,b')).toBe('"a,b"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell(undefined)).toBe('');
    expect(csv(['x', 'y'], [[1, 'two, three']])).toBe('x,y\n1,"two, three"\n');
    expect(slug('Chapter 1: The Night / of the Party!')).toBe('Chapter-1-The-Night-of-the-Party');
    expect(slug('')).toBe('untitled');
    expect(dataUrlBytes('data:image/jpeg;base64,AQID')).toEqual(new Uint8Array([1, 2, 3]));
    expect(dataUrlBytes('nope')).toBeNull();
  });

  it('lays everything out as files people can open', () => {
    const dump = {
      'ledger.v3': { days: { '2026-11-02': { writing: 60, editing: 15, note: 'Good, day' }, '2026-11-01': { reading: 30 } } },
      'manuscripts.v1': { manuscripts: [{ id: 'm', title: 'The Life I Deserve', chapters: [{ id: 'c', title: 'The night of the party', status: 'draft', words: 3 }] }] },
      'drafts.v1': { drafts: { 'm/c': { text: 'The scream came first.' } } },
      'ideas.v1': { ideas: [{ kind: 'short', title: 'The Lighthouse Wife', spark: 'she keeps the light', stage: 'spark', tags: ['grief'] }] },
      'shelf.v1': { books: [{ title: 'Gone Girl', author: 'Flynn', status: 'read', rating: 5, craft: ['diary twist'] }] },
      'schedule.v1': { days: { '2026-11-23': { labels: { '0': 'Plan the week' }, done: [0, 2] } }, weeks: { '2026-11-23': [{ id: 'a', text: 'Send the synopsis', done: true }, { id: 'b', text: 'Removed', gone: true }] } },
      'refs.v1': { scenes: [{ id: 's1', kind: 'interrogation', label: 'Silence does the work', source: 'Gone Girl · Flynn', where: 'p. 212', passage: 'She waited.', why: 'He fills the quiet', tags: ['police'] }] },
      'money.v1': { txns: [{ date: '2026-11-03', desc: 'KROGER', cents: -8412, category: 'groceries' }] },
      'memories.v1': { items: [{ id: 'p1', day: '2026-11-20', caption: 'Cooper, muddy', thumb: 'data:image/jpeg;base64,AQ==' }], capsules: [{ title: 'To future me', body: 'Hi', written: '2026-11-22' }] },
      'memories.photo.p1': 'data:image/jpeg;base64,AQID',
      'kennel.v1': { walks: [{ date: '2026-11-22', who: 'both', minutes: 30 }], care: [], weights: [] },
      'day.v1': { habits: [], days: { '2026-11-22': { intentions: [{ area: 'writing', text: 'Finish chapter 7', state: 'kept' }], done: [], well: 'Wrote early' } } },
      'area.office': { days: {}, items: [{ id: 'a1', list: 'apps', text: 'Toast — Product Manager', date: '2026-11-03', link: 'https://careers.toast.com/pm', status: 'interview', body: 'Onsite, Friday' }, { id: 'w1', list: 'wins', text: 'Kind reply', date: '2026-11-04' }] },
    };
    const f = exportFiles(dump, '{"app":"austin-os"}', '2026-11-22');
    expect(f['backup/austin-os-backup.json']).toBe('{"app":"austin-os"}');
    expect(f['writing/ledger.csv']).toBe('date,writing,editing,reading,research,craft,querying,total,note\n2026-11-01,,,30,,,,30,\n2026-11-02,60,15,,,,,75,"Good, day"\n');
    expect(f['writing/manuscripts/The-Life-I-Deserve/01-The-night-of-the-party.md']).toBe('# 1. The night of the party\n\nThe scream came first.\n');
    expect(f['writing/idea-vault.md']).toMatch(/### The Lighthouse Wife\n\nshe keeps the light/);
    expect(f['reading/reading-notes.md']).toMatch(/- diary twist/);
    expect(f['life/schedule-blocks.csv']).toBe('date,block,what,done\n2026-11-23,1,Plan the week,yes\n2026-11-23,3,,yes\n');
    expect(f['life/weekly-tasks.md']).toBe('# Weekly tasks\n\n## Week of 2026-11-23\n\n- [x] Send the synopsis\n');
    expect(f['reading/scene-library.md']).toBe('# The Scene Library\n\n## interrogation\n\n### Silence does the work\n\n*Gone Girl · Flynn, p. 212*\n\n> She waited.\n\n**Why it works:** He fills the quiet\n\n#police\n\n');
    expect(f['money/transactions.csv']).toMatch(/2026-11-03,KROGER,-84.12,groceries/);
    expect(f['memories/photos/2026-11-20-Cooper-muddy.jpg']).toEqual(new Uint8Array([1, 2, 3]));
    expect(f['memories/photos.csv']).toMatch(/photos\/2026-11-20-Cooper-muddy.jpg/);
    expect(f['memories/time-capsule.md']).toMatch(/still sealed/);
    expect(f['life/kennel-walks.csv']).toMatch(/2026-11-22,both,30/);
    expect(f['life/the-day.md']).toMatch(/## 2026-11-22\n\n- writing: Finish chapter 7 \(kept\)\n\nWent well: Wrote early/);
    expect(f['life/office-lists.csv']).toBe('list,text,details,date,when,amount,done,progress,link,stage,kind,status\napps,Toast — Product Manager,"Onsite, Friday",2026-11-03,,,,,https://careers.toast.com/pm,,,interview\nwins,Kind reply,,2026-11-04,,,,,,,,\n');
    expect(f['life/office-time.csv']).toBeUndefined();
    expect(Object.keys(f).some((k) => k.startsWith('publishing/'))).toBe(false);
  });
});

describe('backup health', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
  it('says what to do next', () => {
    expect(backupHealth({ fileName: null, permission: null, lastWriteAt: null, lastDrill: null, now })).toMatchObject({ level: 'bad', action: 'choose' });
    expect(backupHealth({ fileName: 'b.json', permission: 'prompt', lastWriteAt: ago(0), lastDrill: null, now })).toMatchObject({ level: 'warn', action: 'reconnect' });
    expect(backupHealth({ fileName: 'b.json', permission: 'granted', lastWriteAt: ago(9), lastDrill: ago(1), now })).toMatchObject({ level: 'warn', title: 'The backup has been quiet for 9 days' });
    expect(backupHealth({ fileName: 'b.json', permission: 'granted', lastWriteAt: ago(0), lastDrill: null, now })).toMatchObject({ action: 'drill' });
    expect(backupHealth({ fileName: 'b.json', permission: 'granted', lastWriteAt: ago(0), lastDrill: ago(40), now }).title).toBe('Last tested 40 days ago');
    expect(backupHealth({ fileName: 'b.json', permission: 'granted', lastWriteAt: ago(1), lastDrill: ago(2), now })).toMatchObject({ level: 'ok', action: 'none' });
  });
});
