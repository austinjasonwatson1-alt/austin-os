import { Suspense, useEffect } from 'react';
import { useAutoBackup } from './core/autoBackup';
import { useBackup } from './core/backup';
import { useLedger } from './modules/ledger/store';
import { areaByPath, byPath } from './modules/registry';
import { AreaSoon } from './shell/AreaSoon';
import CabinHome from './shell/CabinHome';
import Home from './shell/Home';
import { useRoute } from './shell/router';
import { Sidebar } from './shell/Sidebar';
import { Sky } from './shell/Sky';
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
  useEffect(() => {
    void useBackup.getState().load();
    void useAutoBackup.getState().start();
    void useLedger.getState().load();
  }, []);
  return (
    <>
      <Sky />
      <div className="app">
        <Sidebar />
        <main className="main">
          <Suspense fallback={null}>
            <Screen route={route} />
          </Suspense>
        </main>
      </div>
    </>
  );
}
