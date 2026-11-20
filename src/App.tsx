import { Suspense, useEffect, useRef } from 'react';
import { routeMotion } from './shell/routeLogic';
import { useAutoBackup } from './core/autoBackup';
import { useBackup } from './core/backup';
import { useLedger } from './modules/ledger/store';
import { useLounge } from './modules/lounge/store';
import { useTimer } from './modules/timer/store';
import { areaByPath, byPath } from './modules/registry';
import { AreaSoon } from './shell/AreaSoon';
import CabinHome from './shell/CabinHome';
import Home from './shell/Home';
import { useRoute } from './shell/router';
import { Sidebar } from './shell/Sidebar';
import { Sky } from './shell/Sky';
import { Celebrations } from './shell/Celebrations';
import { useSky } from './core/skyStore';
import { Soon } from './shell/Soon';

function Screen({ route }: { route: string }) {
  if (route === '/home') return <Home />;
  if (route === '/cabin') return <CabinHome />;
  const area = areaByPath(route);
  if (area && !area.live) return <AreaSoon a={area} />;
  const m = byPath(route);
  if (!m) return <Home />;
  if (!m.component) return <Soon m={m} />;
  const C = m.component;
  return <C />;
}

export default function App() {
  const route = useRoute();
  // Each page change plays a short entrance: deeper rooms zoom in, going back eases out.
  const prev = useRef<string | null>(null);
  const motion = routeMotion(prev.current, route);
  useEffect(() => {
    prev.current = route;
    window.scrollTo({ top: 0 });
  }, [route]);
  useEffect(() => {
    void useBackup.getState().load();
    void useAutoBackup.getState().start();
    void useLedger.getState().load();
    void useLounge.getState().load();
    void useTimer.getState().load();
    void useSky.getState().load();
  }, []);
  return (
    <>
      <Sky />
      <Celebrations />
      <div className="app">
        <Sidebar />
        <main className="main">
          <div key={route} className={`route route-${motion}`}>
            <Suspense fallback={<div className="route-wait" aria-hidden><span /></div>}>
              <Screen route={route} />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}
