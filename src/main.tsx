import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { requestPersistence } from './core/storage';
import { usePwa } from './core/pwa';
import './styles/global.css';

void requestPersistence();
usePwa.getState().start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
