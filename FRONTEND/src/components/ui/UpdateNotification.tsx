import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * UpdateNotification Component
 *
 * Muestra una notificación cuando hay una nueva versión del Service Worker disponible.
 * Permite al usuario actualizar la aplicación inmediatamente o posponer la actualización.
 *
 * SPEC-006: Service Worker Avanzado
 */

interface UpdateNotificationProps {
  /** Posición de la notificación en la pantalla */
  position?: 'top' | 'bottom';
  /** Duración en ms antes de ocultar automáticamente (0 = no ocultar) */
  autoHideDuration?: number;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  position = 'bottom',
  autoHideDuration = 0,
}) => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Verificar si el navegador soporta Service Workers
    if (!('serviceWorker' in navigator)) {
      console.warn('[UpdateNotification] Service Workers not supported');
      return;
    }

    // Obtener el Service Worker registration
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
    });

    // Listener para mensajes del Service Worker
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'UPDATE_AVAILABLE':
          console.log('[UpdateNotification] New version available:', payload?.version);
          setNewVersion(payload?.version || 'nueva versión');
          setIsUpdateAvailable(true);

          // Auto-hide si está configurado
          if (autoHideDuration > 0) {
            setTimeout(() => {
              setIsUpdateAvailable(false);
            }, autoHideDuration);
          }
          break;

        case 'SYNC_STARTED':
          console.log('[UpdateNotification] Sync started');
          break;

        case 'SYNC_COMPLETED':
          console.log('[UpdateNotification] Sync completed');
          break;

        case 'SYNC_FAILED':
          console.error('[UpdateNotification] Sync failed:', payload?.error);
          break;

        default:
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [autoHideDuration]);

  /**
   * Actualizar la aplicación
   * Envía mensaje SKIP_WAITING al Service Worker y recarga la página
   */
  const handleUpdate = () => {
    setIsUpdating(true);

    if (registration && registration.waiting) {
      // Enviar mensaje al Service Worker en espera para que se active
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Escuchar el evento controllerchange para saber cuándo el nuevo SW tomó control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[UpdateNotification] New Service Worker activated, reloading...');
        // Recargar la página para usar la nueva versión
        window.location.reload();
      });
    } else {
      // Si no hay SW en espera, simplemente recargar
      console.log('[UpdateNotification] No waiting SW, reloading...');
      window.location.reload();
    }
  };

  /**
   * Cerrar la notificación sin actualizar
   */
  const handleDismiss = () => {
    setIsUpdateAvailable(false);
  };

  // No mostrar si no hay actualización disponible
  if (!isUpdateAvailable) {
    return null;
  }

  const positionClasses = position === 'top'
    ? 'top-4'
    : 'bottom-4';

  return (
    <div
      className={`fixed left-1/2 transform -translate-x-1/2 ${positionClasses} z-50 animate-slide-up`}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icono */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <RefreshCw
                  className={`w-5 h-5 text-blue-600 dark:text-blue-400 ${isUpdating ? 'animate-spin' : ''}`}
                />
              </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Nueva versión disponible
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Hay una actualización ({newVersion}) lista para instalar.
                Actualiza ahora para obtener las últimas mejoras y correcciones.
              </p>

              {/* Acciones */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors duration-200"
                  aria-label="Actualizar aplicación"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Actualizar ahora
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  disabled={isUpdating}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors duration-200"
                  aria-label="Cerrar notificación"
                >
                  Más tarde
                </button>
              </div>
            </div>

            {/* Botón cerrar */}
            <button
              onClick={handleDismiss}
              disabled={isUpdating}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
