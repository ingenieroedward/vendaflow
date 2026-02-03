/**
 * Service Worker Test Helper
 * Copia y pega este script en la consola del navegador para ejecutar tests
 * Servidor: http://localhost:4173/
 */

window.SWTestHelper = {
  /**
   * Test 1: Verificar registro del Service Worker
   */
  async checkRegistration() {
    console.log('\n🧪 TEST 1: Verificando registro del Service Worker...\n');

    if (!('serviceWorker' in navigator)) {
      console.error('❌ Service Worker no soportado en este navegador');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker registrado');
      console.log('   Scope:', registration.scope);
      console.log('   Estado:', registration.active?.state);

      if (registration.active) {
        console.log('✅ Service Worker activo');
        return true;
      } else {
        console.error('❌ Service Worker no está activo');
        return false;
      }
    } catch (error) {
      console.error('❌ Error al verificar registro:', error);
      return false;
    }
  },

  /**
   * Test 2: Verificar caches
   */
  async checkCaches() {
    console.log('\n🧪 TEST 2: Verificando caches del Service Worker...\n');

    try {
      const cacheNames = await caches.keys();
      console.log(`✅ Total de caches: ${cacheNames.length}`);

      const expectedCaches = [
        'jjlm-static-v1.0.0',
        'jjlm-api-v1.0.0',
        'jjlm-images-v1.0.0',
        'jjlm-dynamic-v1.0.0'
      ];

      for (const expected of expectedCaches) {
        const exists = cacheNames.some(name => name.includes(expected.split('-v')[0]));
        if (exists) {
          console.log(`✅ Cache encontrado: ${expected.split('-v')[0]}-*`);
        } else {
          console.warn(`⚠️  Cache no encontrado: ${expected}`);
        }
      }

      // Inspeccionar contenido del cache estático
      const staticCacheName = cacheNames.find(name => name.includes('static'));
      if (staticCacheName) {
        const cache = await caches.open(staticCacheName);
        const keys = await cache.keys();
        console.log(`\n📦 Contenido del cache estático (${keys.length} items):`);
        keys.forEach(request => console.log(`   - ${request.url}`));
      }

      return cacheNames.length > 0;
    } catch (error) {
      console.error('❌ Error al verificar caches:', error);
      return false;
    }
  },

  /**
   * Test 3: Obtener versión del SW
   */
  async getVersion() {
    console.log('\n🧪 TEST 3: Obteniendo versión del Service Worker...\n');

    try {
      const registration = await navigator.serviceWorker.ready;

      return new Promise((resolve, reject) => {
        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (event) => {
          console.log('✅ Versión del SW:', event.data.version);
          resolve(event.data.version);
        };

        if (registration.active) {
          registration.active.postMessage(
            { type: 'GET_VERSION' },
            [messageChannel.port2]
          );

          setTimeout(() => reject(new Error('Timeout')), 5000);
        } else {
          reject(new Error('No hay SW activo'));
        }
      });
    } catch (error) {
      console.error('❌ Error al obtener versión:', error);
      return null;
    }
  },

  /**
   * Test 4: Simular modo offline
   */
  async testOfflineMode() {
    console.log('\n🧪 TEST 4: Test de modo offline...\n');
    console.log('📝 INSTRUCCIONES:');
    console.log('1. Abre DevTools → Network tab');
    console.log('2. Selecciona "Offline" en el dropdown de throttling');
    console.log('3. Presiona F5 para recargar');
    console.log('4. Verifica que la app carga desde cache');
    console.log('5. Navega por la app (productos, órdenes)');
    console.log('6. Los datos locales deben estar disponibles');
    console.log('\n⚠️  Para volver online: Network tab → "No throttling"');

    return {
      isOnline: navigator.onLine,
      message: navigator.onLine ? '🟢 Actualmente ONLINE' : '🔴 Actualmente OFFLINE'
    };
  },

  /**
   * Test 5: Verificar estrategia de cache para API
   */
  async testNetworkFirst() {
    console.log('\n🧪 TEST 5: Test Network-First para API...\n');

    try {
      console.log('📡 Haciendo request a API...');
      const startTime = performance.now();
      const response = await fetch('/api/products?page=1&limit=10');
      const endTime = performance.now();

      console.log(`✅ Response recibida en ${Math.round(endTime - startTime)}ms`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Desde: ${response.headers.get('x-from-cache') ? 'Cache' : 'Network'}`);

      return response.ok;
    } catch (error) {
      console.log('⚠️  Network falló, intentando desde cache...');
      console.error(error);
      return false;
    }
  },

  /**
   * Test 6: Limpiar cache específico
   */
  async clearCache(cacheName) {
    console.log(`\n🧪 TEST 6: Limpiando cache ${cacheName || 'todos'}...\n`);

    try {
      const registration = await navigator.serviceWorker.ready;

      return new Promise((resolve, reject) => {
        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            console.log('✅ Cache limpiado exitosamente');
            resolve(true);
          } else {
            console.error('❌ Error al limpiar cache:', event.data.error);
            resolve(false);
          }
        };

        if (registration.active) {
          registration.active.postMessage(
            {
              type: 'CLEAR_CACHE',
              payload: { cacheName }
            },
            [messageChannel.port2]
          );

          setTimeout(() => reject(new Error('Timeout')), 5000);
        }
      });
    } catch (error) {
      console.error('❌ Error:', error);
      return false;
    }
  },

  /**
   * Test 7: Cachear URLs específicas
   */
  async cacheUrls(urls, cacheName = 'jjlm-dynamic-v1.0.0') {
    console.log(`\n🧪 TEST 7: Cacheando ${urls.length} URLs...\n`);

    try {
      const registration = await navigator.serviceWorker.ready;

      return new Promise((resolve, reject) => {
        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            console.log('✅ URLs cacheadas exitosamente');
            resolve(true);
          } else {
            console.error('❌ Error al cachear URLs:', event.data.error);
            resolve(false);
          }
        };

        if (registration.active) {
          registration.active.postMessage(
            {
              type: 'CACHE_URLS',
              payload: { urls, cacheName }
            },
            [messageChannel.port2]
          );

          setTimeout(() => reject(new Error('Timeout')), 10000);
        }
      });
    } catch (error) {
      console.error('❌ Error:', error);
      return false;
    }
  },

  /**
   * Test 8: Verificar Background Sync
   */
  async checkBackgroundSync() {
    console.log('\n🧪 TEST 8: Verificando Background Sync...\n');

    if (!('sync' in registration)) {
      console.error('❌ Background Sync no soportado');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Background Sync soportado');

      // Verificar si hay sync pendiente
      const tags = await registration.sync.getTags();
      console.log(`📋 Sync tags registrados: ${tags.length}`);
      tags.forEach(tag => console.log(`   - ${tag}`));

      return true;
    } catch (error) {
      console.error('❌ Error al verificar Background Sync:', error);
      return false;
    }
  },

  /**
   * Test completo (ejecuta todos los tests)
   */
  async runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 EJECUTANDO TODOS LOS TESTS DEL SERVICE WORKER');
    console.log('='.repeat(70));

    const results = {
      registration: await this.checkRegistration(),
      caches: await this.checkCaches(),
      version: await this.getVersion(),
      networkFirst: await this.testNetworkFirst(),
      backgroundSync: await this.checkBackgroundSync()
    };

    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN DE RESULTADOS');
    console.log('='.repeat(70));

    let passed = 0;
    let total = 0;

    Object.entries(results).forEach(([test, result]) => {
      total++;
      if (result) {
        passed++;
        console.log(`✅ ${test}: PASS`);
      } else {
        console.log(`❌ ${test}: FAIL`);
      }
    });

    console.log('\n' + '-'.repeat(70));
    console.log(`Resultado: ${passed}/${total} tests pasaron (${Math.round(passed/total*100)}%)`);
    console.log('='.repeat(70) + '\n');

    return results;
  },

  /**
   * Ayuda
   */
  help() {
    console.log('\n📖 SERVICE WORKER TEST HELPER - COMANDOS DISPONIBLES\n');
    console.log('SWTestHelper.checkRegistration()      - Verificar que el SW está registrado');
    console.log('SWTestHelper.checkCaches()            - Listar caches y su contenido');
    console.log('SWTestHelper.getVersion()             - Obtener versión del SW');
    console.log('SWTestHelper.testOfflineMode()        - Instrucciones para test offline');
    console.log('SWTestHelper.testNetworkFirst()       - Test estrategia Network-First');
    console.log('SWTestHelper.clearCache(name?)        - Limpiar cache específico o todos');
    console.log('SWTestHelper.cacheUrls(urls, name?)   - Cachear URLs específicas');
    console.log('SWTestHelper.checkBackgroundSync()    - Verificar Background Sync');
    console.log('SWTestHelper.runAllTests()            - Ejecutar todos los tests');
    console.log('SWTestHelper.help()                   - Mostrar esta ayuda\n');

    console.log('💡 EJEMPLOS:\n');
    console.log('// Test rápido de todo');
    console.log('await SWTestHelper.runAllTests();\n');

    console.log('// Verificar registro');
    console.log('await SWTestHelper.checkRegistration();\n');

    console.log('// Ver caches');
    console.log('await SWTestHelper.checkCaches();\n');

    console.log('// Limpiar cache de API');
    console.log('await SWTestHelper.clearCache("jjlm-api-v1.0.0");\n');

    console.log('// Cachear URLs específicas');
    console.log('await SWTestHelper.cacheUrls(["/api/products", "/api/customers"]);\n');
  }
};

// Auto-ejecutar mensaje de bienvenida
console.log('\n✨ Service Worker Test Helper cargado');
console.log('📖 Ejecuta SWTestHelper.help() para ver comandos disponibles');
console.log('🚀 Ejecuta SWTestHelper.runAllTests() para ejecutar todos los tests\n');
