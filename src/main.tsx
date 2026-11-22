import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { requestPersistence } from './core/storage';
import { usePwa } from './core/pwa';
// Fonts ship with the app (no Google request, and they work offline).
import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/literata/opsz.css';
import '@fontsource-variable/literata/opsz-italic.css';
import './styles/global.css';

void requestPersistence();
usePwa.getState().start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
