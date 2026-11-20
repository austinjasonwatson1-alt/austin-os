import type { AreaDef } from '../modules/registry';
import { Page } from './Page';
import { go } from './router';
import '../styles/homestead.css';

/** A homestead building that hasn't been built yet: its blueprint and what it will hold. */
export function AreaSoon({ a }: { a: AreaDef }) {
  return (
    <Page eyebrow="The Homestead · Being built" title={a.name} lede={a.blurb}>
      <section className="blueprint">
        <span className="bp-glyph" aria-hidden>{a.glyph}</span>
        <p className="panel-t">The blueprint</p>
        <ul>{a.plans.map((p) => <li key={p}>{p}</li>)}</ul>
        <button className="btn" onClick={() => go('/home')}>Back to the homestead</button>
      </section>
    </Page>
  );
}
