import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Tipografía del rediseño, empaquetada con la app (funciona sin conexión);
// solo el subconjunto latino y los pesos que se usan
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './index.css';
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration';
import { Capacitor } from '@capacitor/core';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service Worker solo en web — en Capacitor los assets ya están en el APK
if (!Capacitor.isNativePlatform()) {
  serviceWorkerRegistration.register();
}
