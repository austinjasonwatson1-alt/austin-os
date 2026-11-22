import { lazy, Suspense, useEffect, useRef } from 'react';
import { routeMotion } from './shell/routeLogic';
import { useAutoBackup } from './core/autoBackup';
import { startSync } from './shell/sync';
import { useBackup } from './core/backup';
import { useLedger } from './modules/ledger/store';
import { useLounge } from './modules/lounge/store';
import { useTimer } from './modules/timer/store';
import { useShelf } from './modules/shelf/store';
import { useChapel } from './modules/chapel/store';
import { useManuscripts } from './modules/manuscripts/store';
import { useReview } from './modules/review/store';
import { useDrafts } from './modules/drafts/store';
import { usePub } from './modules/pub/store';
import { AREA_STORES } from './modules/areas/store';
import { areaByPath, byPath } from './modules/registry';
import { AreaSoon } from './shell/AreaSoon';
import CabinHome from './shell/CabinHome';
import Home from './shell/Home';
import { useRoute } from './shell/router';
import { Sidebar } from './shell/Sidebar';
import { Sky } from './shell/Sky';
import { Celebrations } from './shell/Celebrations';
import { CommandPalette } from './shell/CommandPalette';
import { Notifier } from './shell/Notifier';
import { Soundscape } from './shell/Soundscape';
import { DeepLinkPage } from './shell/DeepLinkPage';
import { parseDeepLink } from './shell/deepLink';
import { useCloud } from './shell/cloud';
import { useSky } from './core/skyStore';
import { Soon } from './shell/Soon';

const ReviewPage = lazy(() => import('./modules/review/ReviewPage'));
const YearPage = lazy(() => import('./modules/review/YearPage'));
const WritePage = lazy(() => import('./modules/drafts/WritePage'));
const LibraryPage = lazy(() => import('./modules/review/LibraryPage'));
const HallPage = lazy(() => import('./modules/records/HallPage'));
const FilmPage = lazy(() => import('./modules/film/FilmPage'));
const SettingsPage = lazy(() => import('./shell/SettingsPage'));
const KeeperPage = lazy(() => import('./modules/keeper/KeeperPage'));

function Screen({ route }: { route: string }) {
  const link = parseDeepLink(route);
  if (link) return <DeepLinkPage link={link} />;
  if (route === '/settings') return <SettingsPage />;
  if (route === '/keeper') return <KeeperPage />;
  if (route === '/home') return <Home />;
  if (route === '/cabin') return <CabinHome />;
  if (route === '/review') return <ReviewPage />;
  if (route === '/year') return <YearPage />;
  if (route === '/library') return <LibraryPage />;
  if (route === '/records') return <HallPage />;
  if (route === '/film') return <FilmPage />;
  if (route.startsWith('/cabin/write/')) return <WritePage />;
  const area = areaByPath(route);
  if (area && !area.live) return <AreaSoon a={area} />;
  if (area?.component) { const A = area.component; return <A />; }
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
    startSync();
    void useCloud.getState().start();
    void useAutoBackup.getState().start();
    void useLedger.getState().load();
    void useLounge.getState().load();
    void useTimer.getState().load();
    void useSky.getState().load();
    void useShelf.getState().load();
    void useChapel.getState().load();
    void useManuscripts.getState().load();
    void useReview.getState().load();
    void useDrafts.getState().load();
    void usePub.getState().load();
    void AREA_STORES.office.getState().load();
    void AREA_STORES.observatory.getState().load();
    void AREA_STORES.forge.getState().load();
    void AREA_STORES.bank.getState().load();
    void AREA_STORES.hearth.getState().load();
  }, []);
  return (
    <>
      <Sky />
      <Celebrations />
      <CommandPalette />
      <Notifier />
      <Soundscape />
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
