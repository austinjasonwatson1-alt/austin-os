import { Suspense } from 'react';
import { byPath } from './modules/registry';
import CabinHome from './shell/CabinHome';
import Home from './shell/Home';
import { useRoute } from './shell/router';
import { Sidebar } from './shell/Sidebar';
import { Sky } from './shell/Sky';
import { Soon } from './shell/Soon';

function Screen({ route }: { route: string }) {
  if (route === '/home') return <Home />;
  if (route === '/cabin') return <CabinHome />;
  const m = byPath(route);
  if (!m) return <Home />;
  if (!m.component) return <Soon m={m} />;
  const C = m.component;
  return <C />;
}

export default function App() {
  const route = useRoute();
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
