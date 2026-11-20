import { usePwa } from '../core/pwa';

/** In the rail: "a new version is ready" and "install the app", only when they apply. */
export function AppStatus() {
  const { updateReady, installable, update, install } = usePwa();
  if (!updateReady && !installable) return null;
  return (
    <div className="app-status">
      {updateReady && (
        <button className="app-pill update" onClick={update}>
          <span className="dot ok pulse" /> <span className="app-pill-t">New version ready · <b>Update</b></span>
        </button>
      )}
      {installable && (
        <button className="app-pill" onClick={() => void install()}>
          <span aria-hidden>⤓</span> <span className="app-pill-t">Install Austin OS</span>
        </button>
      )}
    </div>
  );
}
