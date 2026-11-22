import { describe, expect, it } from 'vitest';
import { groupProjects, parseProjectList, previewProjects } from './projects';
import type { AreaItem } from './types';

describe('projects', () => {
  it('reads a pasted list', () => {
    const got = parseProjectList(`# my builds
Road to the NFL | https://claude.ai/artifact/abc | Game | shipped | Kicker career sim
Writer's Room | Writing tool | idea
Just a name
https://example.com/x Bare Link Project`);
    expect(got).toEqual([
      { text: 'Road to the NFL', link: 'https://claude.ai/artifact/abc', kind: 'Game', stage: 'shipped', body: 'Kicker career sim' },
      { text: "Writer's Room", link: undefined, kind: 'Writing tool', stage: 'idea' },
      { text: 'Just a name', link: undefined, kind: 'Other', stage: 'shipped' },
      { text: 'Bare Link Project', link: 'https://example.com/x', kind: 'Other', stage: 'shipped' },
    ]);
  });
  it('never adds a project twice', () => {
    const existing = [{ id: '1', list: 'projects', text: 'Road to the NFL', date: '2026-11-01' } as AreaItem];
    const p = previewProjects(existing, parseProjectList('Road to the NFL\nroad to the nfl!\nHearthhold\nHearthhold'));
    expect(p.add.map((x) => x.text)).toEqual(['Hearthhold']);
    expect(p.skip).toBe(3);
  });
  it('groups by kind, work in progress first', () => {
    const it = (text: string, kind: string, stage: AreaItem['stage'], date = '2026-11-01'): AreaItem => ({ id: text, list: 'projects', text, kind, stage, date });
    const g = groupProjects([it('B', 'Life', 'shipped'), it('A', 'Game', 'shipped', '2026-10-01'), it('C', 'Game', 'building'), it('D', 'Game', 'shipped', '2026-11-05')]);
    expect(g.map((x) => x.kind)).toEqual(['Game', 'Life']);
    expect(g[0].items.map((x) => x.text)).toEqual(['C', 'D', 'A']);
  });
});
