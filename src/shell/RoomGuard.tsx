import { Component, type ReactNode } from 'react';
import { go } from './router';

/**
 * If one room breaks, only that room shows a note: the rail, the other rooms and the data are
 * untouched (nothing is saved or cleared here). Keyed by route in App, so moving on resets it.
 */
export class RoomGuard extends Component<{ route: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error(`Room ${this.props.route} broke:`, error); }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="room-broke" role="alert">
        <div className="page-eyebrow">Something came loose</div>
        <h1 className="page-title">This room didn’t <em>open</em>.</h1>
        <p className="dim">Your data is safe: nothing was changed. Try again, or head home and come back.</p>
        <p className="mono faint room-broke-why">{error.message}</p>
        <div className="room-broke-actions">
          <button className="btn primary" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn" onClick={() => go('/home')}>Go home</button>
        </div>
      </div>
    );
  }
}
