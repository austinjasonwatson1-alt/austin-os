import { Page } from './Page';
import { go } from './router';
import type { ModuleDef } from '../modules/registry';

export function Soon({ m }: { m: ModuleDef }) {
  return (
    <Page eyebrow="Writer's Cabin · Planned" title={m.name} lede={m.blurb}>
      <div className="panel" style={{ maxWidth: 560 }}>
        <p className="dim" style={{ marginTop: 0 }}>This room isn't built yet. It's on the list — see ROADMAP.md.</p>
        <button className="btn" onClick={() => go('/cabin')}>Back to the cabin</button>
      </div>
    </Page>
  );
}
