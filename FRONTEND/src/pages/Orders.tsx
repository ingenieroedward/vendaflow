import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Eye, Edit, Trash2, Calendar, User,
  WifiOff, RefreshCw, AlertCircle, CloudOff, CheckCircle2, Clock,
  RotateCcw, AlertTriangle, CreditCard
} from "lucide-react";
import { useOrderStore } from "../store/orderStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { orderService, getReceivables, Receivables } from "../services/orders";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Order, OrderItem } from "../types";
import { db, SyncStatus, LocalOrder } from "../database/LocalDatabase";

type TabType = 'active' | 'completed' | 'local' | 'trash';

interface LocalOrderMeta {
  order: LocalOrder;
  customerName?: string;
  attempts: number;
  errorMsg?: string;
  lastAttemptAt?: number;
}

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { orders, loading, error, pagination, getOrders, loadMoreOrders, clearError, deleteOrder, syncPendingOrders, retryConflictOrder, pendingSync } =
    useOrderStore();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);

  // Local tab state
  const [localOrders, setLocalOrders] = useState<LocalOrderMeta[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [localDeleteConfirm, setLocalDeleteConfirm] = useState<number | null>(null);

  // Trash tab state
  const [trashList, setTrashList] = useState<Order[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<number | null>(null);

  // Cartera: órdenes a crédito sin pagar
  const [receivables, setReceivables] = useState<Receivables | null>(null);

  // Búsqueda en servidor (cubre órdenes no cargadas en la página actual)
  const [serverResults, setServerResults] = useState<Order[] | null>(null);
  useEffect(() => {
    if (!navigator.onLine || search.trim().length < 2) { setServerResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const { searchOrdersServer } = await import('../services/orders');
        const r = await searchOrdersServer(search.trim());
        setServerResults(r);
      } catch { setServerResults(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);
  const [receivablesDismissed, setReceivablesDismissed] = useState(
    () => sessionStorage.getItem('receivablesBannerDismissed') === '1'
  );

  useEffect(() => { getOrders(1, 50); }, [getOrders]);

  useEffect(() => {
    if (!navigator.onLine) return;
    getReceivables().then(setReceivables).catch(() => setReceivables(null));
  }, []);

  const loadLocalOrders = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const pending = await db.orders
        .filter(o => o._syncStatus !== SyncStatus.SYNCED && !o.deletedAt)
        .reverse()
        .toArray();

      const withMeta: LocalOrderMeta[] = await Promise.all(pending.map(async o => {
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(o.id!)
          .filter(e => e.entityType === 'order')
          .first();
        const customer = await db.customers.get(o.customerId)
          ?? await db.customers.where('serverId').equals(o.customerId).first();
        return {
          order: o,
          customerName: customer?.name,
          attempts: queueEntry?.attempts ?? 0,
          errorMsg: queueEntry?.error,
          lastAttemptAt: queueEntry?.lastAttemptAt,
        };
      }));

      setLocalOrders(withMeta);
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'local') loadLocalOrders();
  }, [activeTab, loadLocalOrders]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const deleted = await orderService.getDeletedOrders();
      setTrashList(deleted);
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'trash') loadTrash();
  }, [activeTab, loadTrash]);

  const handleRestore = async (id: number) => {
    try {
      await orderService.restoreOrder(id);
      addNotification({ type: 'success', title: 'Orden restaurada', message: 'La orden volvió a la lista activa.' });
      loadTrash();
      getOrders();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo restaurar la orden.' });
    }
  };

  const handleHardDelete = async (id: number) => {
    try {
      await orderService.hardDeleteOrder(id);
      addNotification({ type: 'success', title: 'Eliminada definitivamente', message: 'La orden fue eliminada de forma permanente.' });
      setHardDeleteConfirm(null);
      loadTrash();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar la orden.' });
    }
  };

  const handleRefresh = () => getOrders(pagination.page, 50);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { synced, failed } = await syncPendingOrders();
      if (synced > 0) {
        addNotification({ type: 'success', title: 'Sincronizado', message: `${synced} orden${synced > 1 ? 'es' : ''} enviada${synced > 1 ? 's' : ''} al servidor` });
        getOrders();
      } else if (failed > 0) {
        addNotification({ type: 'error', title: 'Error al sincronizar', message: `${failed} orden${failed > 1 ? 'es' : ''} fallaron. Ver tab Pendientes para detalles.` });
      } else {
        addNotification({ type: 'info', title: 'Sin pendientes', message: 'No hay órdenes pendientes de sincronizar' });
      }
      if (activeTab === 'local') loadLocalOrders();
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryConflict = async (localId: number) => {
    setSyncing(true);
    try {
      await retryConflictOrder(localId);
      if (navigator.onLine) {
        await syncPendingOrders();
        loadLocalOrders();
        getOrders();
      } else {
        loadLocalOrders();
      }
      addNotification({ type: 'info', title: 'Reintentando', message: 'Orden reseteada. Se enviará al reconectar.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteLocal = async (localId: number) => {
    await db.orderItems.where('orderId').equals(localId).delete();
    await db.syncQueue.where('entityLocalId').equals(localId).filter(e => e.entityType === 'order').delete();
    await db.orders.delete(localId);
    setLocalDeleteConfirm(null);
    loadLocalOrders();
    const pendingCount = await db.syncQueue.count();
    useOrderStore.setState(s => ({ ...s, pendingSync: pendingCount }));
  };

  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(amount);

  const tabOrders = orders.filter((order) =>
    activeTab === 'completed' ? order.status === 'completed' : order.status !== 'completed'
  );

  const searchBase = serverResults
    ? serverResults.filter((order) => activeTab === 'completed' ? order.status === 'completed' : order.status !== 'completed')
    : tabOrders;
  const filteredOrders = searchBase.filter((order) => {
    const searchLower = search.toLowerCase();
    return (
      order.orderNumber.toString().includes(searchLower) ||
      (order.customer?.name ?? '').toLowerCase().includes(searchLower) ||
      (order.user?.username ?? '').toLowerCase().includes(searchLower) ||
      formatDate(order.createdAt).toLowerCase().includes(searchLower)
    );
  });

  const activeCount = orders.filter(o => o.status !== 'completed').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  const getPriceBreakdown = (order: Order) => {
    if (!order.items || order.items.length === 0) return { subtotal: order.totalAmount, tax: 0, total: order.totalAmount };
    let subtotal = 0, totalTax = 0;
    order.items.forEach((item: OrderItem) => {
      const base = Number(item.unitPrice) * Number(item.quantity);
      subtotal += base;
      totalTax += base * (Number(item.taxRate) / 100);
    });
    return { subtotal, tax: totalTax, total: subtotal + totalTax };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":    return "bg-yellow-100 text-yellow-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "completed":  return "bg-green-100 text-green-800";
      case "cancelled":  return "bg-red-100 text-red-800";
      default:           return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":    return "Pendiente";
      case "processing": return "En proceso";
      case "completed":  return "Completada";
      case "cancelled":  return "Cancelada";
      default:           return status;
    }
  };

  const getSyncStatusIcon = (item: LocalOrderMeta) => {
    if (item.errorMsg) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (item.attempts > 0) return <AlertCircle className="w-4 h-4 text-orange-500" />;
    return <Clock className="w-4 h-4 text-blue-500" />;
  };

  const getSyncStatusLabel = (item: LocalOrderMeta) => {
    if (item.errorMsg) return <span className="text-xs text-red-600 font-medium">Error al sincronizar</span>;
    if (item.attempts > 0) return <span className="text-xs text-orange-600 font-medium">{item.attempts} intento{item.attempts > 1 ? 's' : ''} fallido{item.attempts > 1 ? 's' : ''}</span>;
    return <span className="text-xs text-blue-600 font-medium">Pendiente de enviar</span>;
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">
              Gestión de órdenes
            </h1>
            <p className="text-sm text-balance sm:text-lg text-gray-600 px-2">
              Administra y visualiza todas las órdenes del sistema.
            </p>
          </div>

          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button variant="outline" icon={Search} onClick={handleRefresh} size="sm" className="text-xs sm:text-sm">
                Actualizar
              </Button>
              {navigator.onLine && (pendingSync > 0 || localOrders.length > 0 || orders.some(o => (o as any)._isLocal)) && (
                <Button
                  variant="outline"
                  icon={syncing ? undefined : RefreshCw}
                  onClick={handleManualSync}
                  disabled={syncing}
                  size="sm"
                  className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  {syncing ? <LoadingSpinner size="sm" /> : 'Sincronizar'}
                </Button>
              )}
            </div>
            {(user?.role === "admin" || user?.role === "seller") && (
              <Button variant="primary" icon={Plus} onClick={() => navigate("/orders/new")} size="sm" className="font-medium">
                Nueva orden
              </Button>
            )}
          </div>
        </div>

        {error && <ErrorMessage message={error} onDismiss={clearError} onRetry={handleRefresh} className="mb-4 sm:mb-6" />}

        {/* Cartera: crédito pendiente de cobro */}
        {receivables && receivables.count > 0 && !receivablesDismissed && (
          <div className={`mb-4 rounded-xl border p-4 relative ${receivables.overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <button
              onClick={() => { setReceivablesDismissed(true); sessionStorage.setItem('receivablesBannerDismissed', '1'); }}
              className="absolute top-2.5 right-2.5 p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Ocultar (reaparece en la próxima sesión)"
            >
              <span className="text-sm leading-none">✕</span>
            </button>
            <div className="flex items-start gap-2.5">
              <CreditCard className={`w-4 h-4 mt-0.5 flex-shrink-0 ${receivables.overdueCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${receivables.overdueCount > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                  Cartera: {formatCurrency(receivables.totalDue)} en {receivables.count} orden{receivables.count !== 1 ? 'es' : ''} a crédito
                  {receivables.overdueCount > 0 && ` — ${receivables.overdueCount} vencida${receivables.overdueCount !== 1 ? 's' : ''}`}
                </p>
                <div className="mt-1 space-y-0.5">
                  {receivables.orders.slice(0, 3).map(r => (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/orders/${r.id}`)}
                      className={`block text-xs hover:underline text-left ${r.daysUntilDue !== null && r.daysUntilDue < 0 ? 'text-red-700' : 'text-amber-700'}`}
                    >
                      #{r.orderNumber} · {r.customer?.name ?? 'Cliente'} · {formatCurrency(r.totalAmount)}
                      {r.daysUntilDue !== null && (
                        r.daysUntilDue < 0
                          ? ` — venció hace ${-r.daysUntilDue} día${r.daysUntilDue === -1 ? '' : 's'}`
                          : r.daysUntilDue === 0
                            ? ' — vence HOY'
                            : ` — vence en ${r.daysUntilDue} día${r.daysUntilDue === 1 ? '' : 's'}`
                      )}
                    </button>
                  ))}
                  {receivables.orders.length > 3 && (
                    <p className="text-xs text-gray-500">…y {receivables.orders.length - 3} más</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4 overflow-x-auto scrollbar-none">
          <button
            onClick={() => { setActiveTab('active'); setSearch(''); }}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-1.5">
              Activas
              {activeCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {activeCount}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('completed'); setSearch(''); }}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'completed' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-1.5">
              Entregadas
              {completedCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {completedCount}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'local' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-1.5">
              <CloudOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">Pendientes</span>
              <span className="xs:hidden">Offline</span>
              {pendingSync > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'local' ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-600'}`}>
                  {pendingSync}
                </span>
              )}
            </span>
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('trash')}
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'trash' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <span className="flex items-center gap-1.5">
                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Papelera</span>
                {trashList.length > 0 && activeTab === 'trash' && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{trashList.length}</span>
                )}
              </span>
            </button>
          )}
        </div>

        {/* ── TRASH TAB ────────────────────────────────────────────────── */}
        {activeTab === 'trash' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">Órdenes eliminadas</span>
              <span className="text-xs text-gray-400">— Solo admins pueden restaurar o eliminar definitivamente</span>
            </div>

            {trashLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : trashList.length === 0 ? (
              <div className="text-center py-16">
                <Trash2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">La papelera está vacía</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trashList.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border border-red-100 shadow-sm p-4 opacity-75">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 line-through">#{order.orderNumber}</p>
                        <p className="text-xs text-gray-500 truncate">{order.customer?.name ?? `Cliente #${order.customerId}`}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(order.totalAmount)}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleRestore(order.id)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setHardDeleteConfirm(order.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar definitivamente"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-red-400 mt-1">Eliminado: {formatDate((order as any).deletedAt ?? order.updatedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LOCAL TAB ────────────────────────────────────────────────── */}
        {activeTab === 'local' && (
          <div className="space-y-4">
            {/* Explanation */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">Órdenes guardadas solo en este dispositivo</p>
              <p className="text-amber-700">
                Estas órdenes no han llegado al servidor todavía. Puedes sincronizarlas si tienes conexión,
                o eliminarlas permanentemente de este dispositivo.
              </p>
            </div>

            {/* Sync button */}
            {navigator.onLine && localOrders.length > 0 && (
              <Button
                variant="primary"
                icon={syncing ? undefined : CheckCircle2}
                onClick={handleManualSync}
                disabled={syncing}
                className="w-full sm:w-auto"
              >
                {syncing ? <><LoadingSpinner size="sm" /><span className="ml-2">Sincronizando...</span></> : `Sincronizar ${localOrders.length} orden${localOrders.length !== 1 ? 'es' : ''}`}
              </Button>
            )}

            {loadingLocal ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : localOrders.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Todo sincronizado</h3>
                <p className="text-gray-500 text-sm">No hay órdenes pendientes en este dispositivo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {localOrders.map(({ order, customerName, attempts, errorMsg, lastAttemptAt }) => (
                  <div key={order.id} className={`bg-white rounded-xl border p-4 shadow-sm ${errorMsg ? 'border-red-200' : 'border-amber-200'}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-semibold text-gray-900">#{order.orderNumber}</span>
                          {order._syncStatus === SyncStatus.CONFLICT ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              <AlertCircle className="w-3 h-3" />
                              Conflicto
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              <WifiOff className="w-3 h-3" />
                              Local
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{order.createdAt ? formatDate(order.createdAt) : '—'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getSyncStatusIcon({ order, customerName, attempts, errorMsg, lastAttemptAt })}
                        {getSyncStatusLabel({ order, customerName, attempts, errorMsg, lastAttemptAt })}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{customerName ?? `Cliente #${order.customerId}`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Total</span>
                        <span className="text-base font-bold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                      </div>
                    </div>

                    {/* Error detail */}
                    {errorMsg && (
                      <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <p className="text-xs text-red-700 font-medium">Error:</p>
                        <p className="text-xs text-red-600 break-words">{errorMsg}</p>
                        {lastAttemptAt && (
                          <p className="text-xs text-red-400 mt-0.5">Último intento: {formatDate(new Date(lastAttemptAt).toISOString())}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      {navigator.onLine && (
                        <Button
                          variant="outline"
                          icon={RefreshCw}
                          onClick={() =>
                            order._syncStatus === SyncStatus.CONFLICT
                              ? handleRetryConflict(order.id!)
                              : handleManualSync()
                          }
                          disabled={syncing}
                          size="sm"
                          className={`flex-1 text-xs ${order._syncStatus === SyncStatus.CONFLICT ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}`}
                        >
                          {order._syncStatus === SyncStatus.CONFLICT ? 'Forzar reintento' : 'Reintentar'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setLocalDeleteConfirm(order.id!)}
                        size="sm"
                        className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SERVER TABS ──────────────────────────────────────────────── */}
        {activeTab !== 'local' && (
          <div className="space-y-4 sm:space-y-6">
            {loading ? (
              <div className="flex justify-center items-center py-12 sm:py-16"><LoadingSpinner size="lg" /></div>
            ) : (
              <>
                {tabOrders.length > 0 && (
                  <div className="flex gap-4 justify-between items-center px-1">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                      {activeTab === 'completed' ? 'Entregadas' : 'Activas'}
                      <span className="text-gray-500 font-normal ml-2 text-sm sm:text-base">({tabOrders.length})</span>
                    </h2>
                    <div className="flex items-center w-full sm:w-auto gap-2">
                      <input
                        type="text"
                        placeholder="Buscar por cliente, usuario, orden o fecha"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full sm:w-80 px-3 py-2 border rounded-md shadow-sm text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {filteredOrders.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {filteredOrders.map((order) => {
                      const priceBreakdown = getPriceBreakdown(order);
                      const isLocal = (order as any)._isLocal;
                      return (
                        <div key={order.id} className={`bg-white rounded-xl shadow-sm border p-4 sm:p-6 hover:shadow-md transition-shadow duration-200 ${isLocal ? 'border-amber-300' : 'border-gray-200'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-gray-900">#{order.orderNumber}</h3>
                                {isLocal && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                    <WifiOff className="w-3 h-3" />
                                    Sin sincronizar
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </span>
                              {order.paymentType === 'credit' && (
                                order.paidAt ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    Crédito pagado
                                  </span>
                                ) : (
                                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    order.paymentDueDate && new Date(`${order.paymentDueDate}T00:00:00`) < new Date()
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    <CreditCard className="w-3 h-3" />
                                    {order.paymentDueDate
                                      ? `Vence ${format(new Date(`${order.paymentDueDate}T00:00:00`), 'd MMM', { locale: es })}`
                                      : 'Crédito'}
                                  </span>
                                )
                              )}
                            </div>
                          </div>

                          <div className="space-y-3 mb-4">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">Cliente: {order.customer?.name || `ID: ${order.customerId}`}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">Creado por: {order.user?.username || `ID: ${order.userId}`}</span>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="font-medium">{formatCurrency(priceBreakdown.subtotal)}</span>
                              </div>
                              {priceBreakdown.tax > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600">IVA:</span>
                                  <span className="font-medium">{formatCurrency(priceBreakdown.tax)}</span>
                                </div>
                              )}
                              <div className="border-t pt-1 mt-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-900">Total:</span>
                                  <span className="font-bold text-lg text-gray-900">{formatCurrency(priceBreakdown.total)}</span>
                                </div>
                              </div>
                            </div>

                            {order.items && order.items.length > 0 && (
                              <div className="text-sm text-gray-500">
                                {order.items.length} producto{order.items.length !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 pt-4 border-t border-gray-100">
                            <Button variant="ghost" icon={Eye} onClick={() => navigate(`/orders/${order.id}`)} size="sm" className="flex-1">Ver</Button>
                            {(user?.role === "admin" || user?.role === "seller") && (
                              <>
                                <Button variant="ghost" icon={Edit} onClick={() => navigate(`/orders/${order.id}/edit`)} size="sm" className="flex-1" disabled={isLocal} title={isLocal ? 'No disponible hasta sincronizar' : undefined}>
                                  Editar
                                </Button>
                                <Button variant="ghost" icon={Trash2} onClick={() => { setOrderToDelete(order.id); setShowDeleteModal(true); }} size="sm" className="flex-1 text-red-600 hover:text-red-700">
                                  Eliminar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 sm:py-16 px-4">
                    <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                      {activeTab === 'completed' ? 'No hay órdenes entregadas' : 'No hay órdenes activas'}
                    </h3>
                    {activeTab === 'active' && (user?.role === "admin" || user?.role === "seller") && (
                      <>
                        <p className="text-sm sm:text-base text-gray-500 mb-6 max-w-sm mx-auto">Comienza creando tu primera orden</p>
                        <Button variant="primary" icon={Plus} onClick={() => navigate("/orders/new")} className="w-full sm:w-auto max-w-xs mx-auto">
                          Crear orden
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Cargar más — acumula sobre las ya mostradas */}
            {activeTab !== 'local' && activeTab !== 'trash' && !loading && orders.length < pagination.total && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" size="sm" onClick={loadMoreOrders}>
                  Cargar más órdenes ({orders.length} de {pagination.total})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: hard delete orden de papelera */}
      {hardDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setHardDeleteConfirm(null)}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><h3 className="font-semibold text-gray-900">Eliminar definitivamente</h3><p className="text-sm text-gray-500">Esta acción es irreversible. La orden se borrará para siempre.</p></div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setHardDeleteConfirm(null)} className="flex-1">Cancelar</Button>
                <Button variant="danger" onClick={() => handleHardDelete(hardDeleteConfirm)} className="flex-1">Eliminar para siempre</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar orden del servidor */}
      {showDeleteModal && orderToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowDeleteModal(false)}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <h2 className="text-base font-semibold text-gray-900 mb-2">¿Eliminar orden?</h2>
              <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
                <Button variant="danger" className="flex-1" onClick={async () => {
                  try {
                    await deleteOrder(orderToDelete);
                    setShowDeleteModal(false);
                    setOrderToDelete(null);
                    handleRefresh();
                  } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : 'Error al eliminar la orden';
                    addNotification({ type: 'error', title: 'Error', message: msg });
                    setShowDeleteModal(false);
                  }
                }}>Eliminar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar orden de local (Dexie) */}
      {localDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setLocalDeleteConfirm(null)}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Eliminar de este dispositivo</h3>
              <p className="text-sm text-gray-600 text-center mb-6">Esta orden nunca llegó al servidor y será eliminada solo de este dispositivo.</p>
              <div className="flex gap-3">
                <button onClick={() => setLocalDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={() => handleDeleteLocal(localDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
