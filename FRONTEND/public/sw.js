/**
 * Service Worker Avanzado para JJLM
 * Implementa offline-first con múltiples estrategias de cache
 * SPEC-006: Service Worker Avanzado
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const VERSION = '1.0.0';
const CACHE_PREFIX = 'jjlm';

// Nombres de caches
const STATIC_CACHE = `${CACHE_PREFIX}-static-v${VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-v${VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-v${VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-v${VERSION}`;

// Lista de todos los caches para facilitar limpieza
const ALL_CACHES = [STATIC_CACHE, API_CACHE, IMAGE_CACHE, DYNAMIC_CACHE];

// Assets críticos para pre-cachear durante la instalación
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Vite genera estos archivos con hash, los capturaremos dinámicamente
];

// Configuración de Background Sync
const SYNC_TAG = 'sync-queue';
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// EVENTO: INSTALL
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker version', VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('[SW] Critical assets cached successfully');
        // Forzar activación inmediata
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Pre-caching failed:', error);
      })
  );
});

// ============================================================================
// EVENTO: ACTIVATE
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker version', VERSION);

  event.waitUntil(
    // Limpiar caches antiguos
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Eliminar caches que empiezan con nuestro prefijo pero no están en la lista actual
              return cacheName.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(cacheName);
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned');
        // Tomar control de todos los clientes inmediatamente
        return self.clients.claim();
      })
  );
});

// ============================================================================
// EVENTO: FETCH - Estrategias de Cache
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar solicitudes que no sean HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }

  // Ignorar archivos de desarrollo (Vite HMR, etc.)
  if (
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/__') ||
    url.searchParams.has('import')
  ) {
    return;
  }

  // Determinar estrategia según el tipo de recurso
  if (isAPIRequest(url)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isImageRequest(url)) {
    event.respondWith(staleWhileRevalidateStrategy(request, IMAGE_CACHE));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// ============================================================================
// ESTRATEGIA: Cache-First (para assets estáticos)
// ============================================================================

async function cacheFirstStrategy(request, cacheName) {
  try {
    // Intentar obtener de cache primero
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no está en cache, hacer fetch y cachear
    const networkResponse = await fetch(request);

    // Solo cachear respuestas exitosas
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-First failed:', error);

    // Intentar obtener de cache como fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si todo falla, retornar página offline
    return getOfflineFallback(request);
  }
}

// ============================================================================
// ESTRATEGIA: Network-First (para API calls)
// ============================================================================

async function networkFirstStrategy(request, cacheName) {
  try {
    // Intentar red primero con timeout
    const networkResponse = await fetchWithTimeout(request, 5000);

    // Cachear respuesta exitosa
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error.message);

    // Si la red falla, intentar cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si es una solicitud de API y no hay cache, retornar error offline
    if (isAPIRequest(new URL(request.url))) {
      return new Response(
        JSON.stringify({
          error: 'No hay conexión a internet',
          offline: true,
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Para otros recursos, retornar fallback
    return getOfflineFallback(request);
  }
}

// ============================================================================
// ESTRATEGIA: Stale-While-Revalidate (para imágenes)
// ============================================================================

async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch en segundo plano para actualizar cache
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Retornar cache si existe, sino esperar al fetch
  return cachedResponse || fetchPromise;
}

// ============================================================================
// EVENTO: MESSAGE - Comunicación con el cliente
// ============================================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // Forzar actualización inmediata
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      // Enviar versión actual al cliente
      event.ports[0].postMessage({ version: VERSION });
      break;

    case 'CLEAR_CACHE':
      // Limpiar cache específico o todos
      clearCaches(payload?.cacheName)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    case 'CACHE_URLS':
      // Cachear URLs específicas
      if (payload?.urls && Array.isArray(payload.urls)) {
        cacheUrls(payload.urls, payload.cacheName || DYNAMIC_CACHE)
          .then(() => {
            event.ports[0].postMessage({ success: true });
          })
          .catch((error) => {
            event.ports[0].postMessage({ success: false, error: error.message });
          });
      }
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// ============================================================================
// EVENTO: SYNC - Background Sync
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncQueuedRequests());
  }
});

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Determina si una URL es una solicitud de API
 */
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || url.hostname.includes('api.');
}

/**
 * Determina si una URL es una imagen
 */
function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  return imageExtensions.some((ext) => url.pathname.toLowerCase().endsWith(ext));
}

/**
 * Determina si una URL es un asset estático
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some((ext) => url.pathname.toLowerCase().endsWith(ext));
}

/**
 * Fetch con timeout
 */
function fetchWithTimeout(request, timeout = 5000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
}

/**
 * Obtener página offline de fallback
 */
async function getOfflineFallback(request) {
  // Intentar obtener página offline cacheada
  const offlinePage = await caches.match('/offline.html');
  if (offlinePage) {
    return offlinePage;
  }

  // Si no hay página offline, retornar respuesta básica
  return new Response(
    `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sin Conexión - JJLM</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
          }
          .container {
            max-width: 500px;
          }
          h1 {
            font-size: 3rem;
            margin: 0 0 1rem;
          }
          p {
            font-size: 1.2rem;
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📡</h1>
          <h1>Sin Conexión</h1>
          <p>No hay conexión a internet. Por favor, verifica tu conexión e intenta nuevamente.</p>
        </div>
      </body>
    </html>
    `,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

/**
 * Limpiar caches
 */
async function clearCaches(cacheName) {
  if (cacheName) {
    // Limpiar cache específico
    await caches.delete(cacheName);
    console.log('[SW] Cache deleted:', cacheName);
  } else {
    // Limpiar todos los caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[SW] All caches deleted');
  }
}

/**
 * Cachear URLs específicas
 */
async function cacheUrls(urls, cacheName) {
  const cache = await caches.open(cacheName);
  await cache.addAll(urls);
  console.log('[SW] URLs cached:', urls.length);
}

/**
 * Sincronizar solicitudes en cola (Background Sync)
 * Integración con IndexedDB syncQueue
 */
async function syncQueuedRequests() {
  console.log('[SW] Syncing queued requests...');

  try {
    // Obtener todos los clientes (páginas abiertas)
    const clients = await self.clients.matchAll();

    if (clients.length === 0) {
      console.warn('[SW] No hay clientes activos para procesar la sincronización');
      console.log('[SW] La sincronización se procesará cuando la app se abra');
      return;
    }

    // Notificar a los clientes que la sincronización está en progreso
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_STARTED',
      });
    });

    // El cliente procesará la sincronización usando backgroundSync.syncNow()
    // El cliente nos notificará cuando termine mediante un mensaje

    // Esperar respuesta del cliente (timeout de 30 segundos)
    const syncPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout esperando sincronización del cliente'));
      }, 30000);

      // Escuchar mensaje de confirmación del cliente
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'SYNC_PROCESSED') {
          clearTimeout(timeout);
          self.removeEventListener('message', messageHandler);
          resolve(event.data.payload);
        }
      };

      self.addEventListener('message', messageHandler);
    });

    // Solicitar al cliente que procese la sincronización
    clients[0].postMessage({
      type: 'PROCESS_SYNC_QUEUE',
    });

    // Esperar resultado
    const result = await syncPromise;

    // Notificar éxito a todos los clientes
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        payload: result,
      });
    });

    console.log('[SW] Sync completed successfully:', result);
  } catch (error) {
    console.error('[SW] Sync failed:', error);

    // Notificar a los clientes sobre el error
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_FAILED',
        payload: { error: error.message },
      });
    });
  }
}

// ============================================================================
// NOTIFICACIONES DE ACTUALIZACIÓN
// ============================================================================

/**
 * Notificar a los clientes sobre nueva versión disponible
 */
self.addEventListener('install', (event) => {
  // Notificar a todos los clientes sobre la actualización
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'UPDATE_AVAILABLE',
        payload: { version: VERSION },
      });
    });
  });
});

// ============================================================================
// LOG DE INICIALIZACIÓN
// ============================================================================

console.log('[SW] Service Worker loaded - Version:', VERSION);
console.log('[SW] Caches configured:', ALL_CACHES);
