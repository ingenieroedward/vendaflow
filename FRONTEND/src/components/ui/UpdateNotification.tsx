import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { getPendingUpdate } from '../../utils/serviceWorkerRegistration';

/**
 * Banner "hay una actualización" — se dispara cuando serviceWorkerRegistration
 * detecta un Service Worker nuevo instalado y esperando (evento
 * 'sw-update-available', ver src/utils/serviceWorkerRegistration.ts).
 * No fuerza el reload: el usuario decide cuándo actualizar, para no perder
 * una venta o un formulario a medias.
 */
export const UpdateNotification: React.FC = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Por si el evento ya disparó antes de que este componente montara
    const pending = getPendingUpdate();
    if (pending) setRegistration(pending);

    const handler = (e: Event) => setRegistration((e as CustomEvent<ServiceWorkerRegistration>).detail);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  const handleUpdate = () => {
    if (!registration?.waiting) { window.location.reload(); return; }
    setUpdating(true);
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!registration) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up" role="alert" aria-live="polite">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm w-full mx-4 p-4 flex items-start gap-3">
        <div className="w-9 h-9 flex-shrink-0 bg-blue-50 rounded-full flex items-center justify-center">
          <RefreshCw className={`w-4 h-4 text-blue-600 ${updating ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Nueva versión disponible</p>
          <p className="mt-0.5 text-xs text-gray-500">Actualiza cuando termines lo que estás haciendo.</p>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {updating ? 'Actualizando…' : 'Actualizar ahora'}
            </button>
            <button
              onClick={() => setRegistration(null)}
              disabled={updating}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Más tarde
            </button>
          </div>
        </div>
        <button onClick={() => setRegistration(null)} disabled={updating} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;
