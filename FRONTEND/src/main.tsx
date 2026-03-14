import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration';
import { setupAutoSync } from './utils/backgroundSync';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registrar Service Worker
// En desarrollo: registro directo para testear offline
// En producción: register() lo maneja automáticamente
serviceWorkerRegistration.registerForDevelopment();

serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log('✅ Service Worker registrado exitosamente');
    console.log('📦 Contenido cacheado para uso offline');
  },
  onUpdate: (registration) => {
    console.log('🔄 Nueva versión disponible');
    // El componente UpdateNotification manejará la notificación al usuario
  },
  onError: (error) => {
    console.error('❌ Error al registrar Service Worker:', error);
  },
});

// Configurar sincronización automática en segundo plano
setupAutoSync();
console.log('🔄 Background Sync configurado');
