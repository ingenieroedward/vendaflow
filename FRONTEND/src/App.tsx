import React, { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { useOrderStore } from './store/orderStore';
import { useCustomerStore } from './store/customerStore';
import { useProductStore } from './store/productStore';
import { useUserStore } from './store/userStore';
import { useTenantStore } from './store/tenantStore';
import { detectTenantSlug, fetchTenantBySlug } from './services/tenant';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { Network } from '@capacitor/network';
import { Download } from 'lucide-react';

const SeedingProgressBanner: React.FC = () => {
  const { seedingSteps } = useUIStore();
  if (seedingSteps.length === 0) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="flex items-center gap-2 bg-gray-800/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
        <Download className="w-3 h-3 animate-bounce flex-shrink-0" />
        <span>Descargando {seedingSteps.join(', ')}…</span>
      </div>
    </div>
  );
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed min-w-72 top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden border-l-4 ${
            notification.type === 'success'
              ? 'border-green-500'
              : notification.type === 'error'
              ? 'border-red-500'
              : notification.type === 'warning'
              ? 'border-yellow-500'
              : 'border-blue-500'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    notification.type === 'success'
                      ? 'bg-green-500'
                      : notification.type === 'error'
                      ? 'bg-red-500'
                      : notification.type === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                />
              </div>
              <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="mt-1 text-sm text-gray-500">
                    {notification.message}
                  </p>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SEED_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

function shouldReseed(): boolean {
  const last = localStorage.getItem('lastSeedAt');
  if (!last) return true;
  return Date.now() - Number(last) > SEED_INTERVAL_MS;
}

function markSeeded() {
  localStorage.setItem('lastSeedAt', String(Date.now()));
}

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();
  const { addNotification } = useUIStore();
  const { syncPendingOrders, seedAllOrders } = useOrderStore();
  const { syncPendingCustomers, seedAllCustomers } = useCustomerStore();
  const { seedAllProducts, seedPricesData } = useProductStore();
  const { getUsers } = useUserStore();

  useEffect(() => {
    // Apply stored tenant theme immediately to avoid flash of default color
    useTenantStore.getState().loadFromStorage();
    checkAuth();

    // Detect tenant from URL and fetch if not cached
    const slug = detectTenantSlug();
    if (slug && !useTenantStore.getState().tenant) {
      useTenantStore.setState({ isLoading: true });
      fetchTenantBySlug(slug)
        .then((t) => { if (t) useTenantStore.getState().setTenant(t); })
        .finally(() => useTenantStore.setState({ isLoading: false }));
    }
  }, [checkAuth]);

  // Sincronizar al arrancar si ya hay conexión y el usuario está autenticado
  useEffect(() => {
    if (!isAuthenticated || !navigator.onLine) return;
    // Clientes primero — las órdenes pueden referenciar clientes recién creados offline
    // Sync primero, seed después — evita race condition donde seed crea duplicados
    // de órdenes que aún no han sido enviadas al servidor
    syncPendingCustomers().then(customers =>
      syncPendingOrders().then(orders => {
        const total = orders.synced + customers.synced;
        if (total > 0) {
          const parts = [];
          if (orders.synced > 0) parts.push(`${orders.synced} orden${orders.synced > 1 ? 'es' : ''}`);
          if (customers.synced > 0) parts.push(`${customers.synced} cliente${customers.synced > 1 ? 's' : ''}`);
          addNotification({
            type: 'success',
            title: 'Sincronización completada',
            message: `${parts.join(' y ')} sincronizado${total > 1 ? 's' : ''} con el servidor`,
          });
        }
      })
    ).finally(() => {
      // Usuarios: siempre refrescar (no throttle) — crítico para mostrar nombres en órdenes offline
      getUsers().catch(() => {});
      // Resto del seed: solo si no se hizo en las últimas 4 horas
      if (shouldReseed()) {
        seedAllProducts();
        seedAllCustomers();
        seedPricesData();
        seedAllOrders();
        markSeeded();
      }
    });
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar al recuperar conexión (Capacitor Network — más confiable que window.online en Android)
  useEffect(() => {
    const handleOnline = async () => {
      // Ignorar si el usuario no está autenticado — evita que markSeeded() envenene
      // el shouldReseed() del startup effect antes de que el usuario haga login
      if (!useAuthStore.getState().isAuthenticated) return;
      // Clientes primero, luego órdenes (pueden referenciar clientes recién sincronizados)
      const customers = await syncPendingCustomers();
      const orders = await syncPendingOrders();
      // Al reconectar siempre refrescar datos — el usuario pudo estar offline mucho tiempo
      seedAllProducts();
      seedAllCustomers();
      seedPricesData();
      seedAllOrders();
      getUsers().catch(() => {});
      // markSeeded no se llama aquí — el reconnect siempre seedea (no necesita throttle)
      // así el startup effect del próximo arranque siempre re-verifica
      const total = orders.synced + customers.synced;
      if (total > 0) {
        const parts = [];
        if (orders.synced > 0) parts.push(`${orders.synced} orden${orders.synced > 1 ? 'es' : ''}`);
        if (customers.synced > 0) parts.push(`${customers.synced} cliente${customers.synced > 1 ? 's' : ''}`);
        addNotification({
          type: 'success',
          title: 'Sincronización completada',
          message: `${parts.join(' y ')} sincronizado${total > 1 ? 's' : ''} con el servidor`,
        });
      }
    };

    // Capacitor Network is more reliable than window.online on Android WebView —
    // window.online is intentionally omitted to prevent double-sync on reconnect.
    const listenerPromise = Network.addListener('networkStatusChange', (status) => {
      if (status.connected) handleOnline();
    });

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, [syncPendingOrders, syncPendingCustomers, addNotification]);

  return (
    <ErrorBoundary>
      <div className="App min-h-screen">
        <AppRouter />
        <SeedingProgressBanner />
        <NotificationContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
