/**
 * Service Worker Registration
 *
 * Maneja el registro, actualización y comunicación con el Service Worker.
 * SPEC-006: Service Worker Avanzado
 */

type UpdateCallback = (registration: ServiceWorkerRegistration) => void;

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

interface Config {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: UpdateCallback;
  onError?: (error: Error) => void;
}

/**
 * Registra el Service Worker
 */
export function register(config?: Config): void {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // Esperar a que la página cargue completamente
    window.addEventListener('load', () => {
      const swUrl = `${process.env.BASE_URL || '/'}sw.js`;

      if (isLocalhost) {
        // En localhost, verificar si el SW existe
        checkValidServiceWorker(swUrl, config);

        // Log adicional para desarrollo
        navigator.serviceWorker.ready.then(() => {
          console.log(
            '[SW Registration] Esta aplicación está siendo servida por un Service Worker en modo desarrollo. ' +
              'Para más información, visita https://bit.ly/CRA-PWA'
          );
        });
      } else {
        // En producción, registrar directamente
        registerValidSW(swUrl, config);
      }
    });
  }
}

/**
 * Registra un Service Worker válido
 */
function registerValidSW(swUrl: string, config?: Config): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('[SW Registration] Service Worker registrado con éxito:', registration.scope);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Nueva versión disponible
              console.log(
                '[SW Registration] Nueva versión disponible. La aplicación se actualizará cuando ' +
                  'todas las pestañas estén cerradas. Para forzar la actualización, cierra todas las pestañas.'
              );

              // Callback de actualización
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // Primera instalación
              console.log('[SW Registration] Contenido cacheado para uso offline.');

              // Callback de éxito
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };

      // Verificar actualizaciones periódicamente (cada 1 hora)
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // 1 hora
    })
    .catch((error) => {
      console.error('[SW Registration] Error durante el registro del Service Worker:', error);
      if (config && config.onError) {
        config.onError(error);
      }
    });
}

/**
 * Verifica si el Service Worker existe antes de registrarlo (útil en localhost)
 */
function checkValidServiceWorker(swUrl: string, config?: Config): void {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // Service Worker no encontrado
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service Worker encontrado, proceder con registro
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('[SW Registration] No hay conexión a internet. La aplicación se está ejecutando en modo offline.');
    });
}

/**
 * Desregistra el Service Worker
 */
export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log('[SW Registration] Service Worker desregistrado.');
      })
      .catch((error) => {
        console.error('[SW Registration] Error al desregistrar:', error.message);
      });
  }
}

/**
 * Fuerza la actualización del Service Worker
 */
export function forceUpdate(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.update();
        console.log('[SW Registration] Verificando actualizaciones...');
      })
      .catch((error) => {
        console.error('[SW Registration] Error al verificar actualizaciones:', error);
      });
  }
}

/**
 * Envía un mensaje al Service Worker
 */
export function sendMessage(message: { type: string; payload?: unknown }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator)) {
      reject(new Error('Service Worker no soportado'));
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        if (!registration.active) {
          reject(new Error('Service Worker no activo'));
          return;
        }

        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };

        registration.active.postMessage(message, [messageChannel.port2]);
      })
      .catch(reject);
  });
}

/**
 * Obtiene la versión del Service Worker
 */
export async function getServiceWorkerVersion(): Promise<string> {
  try {
    const response = await sendMessage({ type: 'GET_VERSION' });
    return (response as { version: string }).version || 'unknown';
  } catch (error) {
    console.error('[SW Registration] Error al obtener versión:', error);
    return 'unknown';
  }
}

/**
 * Limpia los caches del Service Worker
 */
export async function clearCaches(cacheName?: string): Promise<boolean> {
  try {
    const response = await sendMessage({
      type: 'CLEAR_CACHE',
      payload: { cacheName },
    });
    return (response as { success: boolean }).success || false;
  } catch (error) {
    console.error('[SW Registration] Error al limpiar cache:', error);
    return false;
  }
}

/**
 * Cachea URLs específicas
 */
export async function cacheUrls(urls: string[], cacheName?: string): Promise<boolean> {
  try {
    const response = await sendMessage({
      type: 'CACHE_URLS',
      payload: { urls, cacheName },
    });
    return (response as { success: boolean }).success || false;
  } catch (error) {
    console.error('[SW Registration] Error al cachear URLs:', error);
    return false;
  }
}

/**
 * Registra el Service Worker automáticamente en desarrollo
 * Solo si NODE_ENV es 'development' y quieres testear el SW
 */
export function registerForDevelopment(config?: Config): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.BASE_URL || '/'}sw.js`;
      registerValidSW(swUrl, config);
    });
  }
}
