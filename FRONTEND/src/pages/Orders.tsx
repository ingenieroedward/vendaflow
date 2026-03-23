import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Edit, Trash2, Calendar, User, WifiOff, RefreshCw } from "lucide-react";
import { useOrderStore } from "../store/orderStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Order, OrderItem } from "../types";

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { orders, loading, error, pagination, getOrders, clearError, deleteOrder, syncPendingOrders } =
    useOrderStore();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);

  useEffect(() => {
    getOrders();
  }, [getOrders]);

  const handleRefresh = () => {
    getOrders(pagination.page);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { synced, failed } = await syncPendingOrders();
      if (synced > 0) {
        addNotification({ type: 'success', title: 'Sincronizado', message: `${synced} orden${synced > 1 ? 'es' : ''} enviada${synced > 1 ? 's' : ''} al servidor` });
      } else if (failed > 0) {
        addNotification({ type: 'error', title: 'Error al sincronizar', message: `${failed} orden${failed > 1 ? 'es' : ''} no pudieron sincronizarse. Revisa la consola para más detalles.` });
      } else {
        addNotification({ type: 'info', title: 'Sin pendientes', message: 'No hay órdenes pendientes de sincronizar' });
      }
      getOrders();
    } finally {
      setSyncing(false);
    }
  };
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
    }).format(amount);
  };

  const filteredOrders = orders.filter((order) => {
    const searchLower = search.toLowerCase();
    return (
      order.orderNumber.toString().includes(searchLower) ||
      (order.customer?.name ?? '').toLowerCase().includes(searchLower) ||
      (order.user?.username ?? '').toLowerCase().includes(searchLower) ||
      formatDate(order.createdAt).toLowerCase().includes(searchLower)
    );
  });

  // Función para mostrar el desglose de precios
  const getPriceBreakdown = (order: Order) => {
    if (!order.items || order.items.length === 0) {
      return {
        subtotal: order.totalAmount,
        tax: 0,
        total: order.totalAmount,
      };
    }

    let subtotal = 0;
    let totalTax = 0;

    order.items.forEach((item: OrderItem) => {
      subtotal += item.totalPrice;
      totalTax += (item.totalPrice * item.taxRate) / 100;
    });

    return {
      subtotal,
      tax: totalTax,
      total: subtotal + totalTax,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "PENDIENTE";
      case "completed":
        return "COMPLETADA";
      case "cancelled":
        return "CANCELADA";
      default:
        return status.toUpperCase();
    }
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

          {/* Actions */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={Search}
                onClick={handleRefresh}
                size="sm"
                className="text-xs sm:text-sm"
              >
                Actualizar
              </Button>
              {/* Botón de sync manual — solo si hay pendientes */}
              {orders.some(o => (o as any)._isLocal) && navigator.onLine && (
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
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => navigate("/orders/new")}
                size="sm"
                className="font-medium"
              >
                Nueva orden
              </Button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorMessage
            message={error}
            onDismiss={clearError}
            onRetry={handleRefresh}
            className="mb-4 sm:mb-6"
          />
        )}

        {/* Content */}
        <div className="space-y-4 sm:space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-12 sm:py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Results Header */}
              {orders.length > 0 && (
                <div className="flex gap-4 justify-between items-center px-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Órdenes
                    <span className="text-gray-500 font-normal ml-2 text-sm sm:text-base">
                      ({orders.length})
                    </span>
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

              {/* Orders Grid */}
              {filteredOrders.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {filteredOrders.map((order) => {
                    const priceBreakdown = getPriceBreakdown(order);

                    const isLocal = (order as any)._isLocal;
                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-lg shadow-sm border p-4 sm:p-6 hover:shadow-md transition-shadow duration-200 ${isLocal ? 'border-amber-300' : 'border-gray-200'}`}
                      >
                        {/* Order Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                #{order.orderNumber}
                              </h3>
                              {isLocal && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                  <WifiOff className="w-3 h-3" />
                                  Sin sincronizar
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusText(order.status)}
                          </span>
                        </div>

                        {/* Order Info */}
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              Cliente: {order.customer?.name || `ID: ${order.customerId}`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              Creado por: {order.user?.username || `ID: ${order.userId}`}
                            </span>
                          </div>

                          {/* Price Breakdown */}
                          <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="font-medium">
                                {formatCurrency(priceBreakdown.subtotal)}
                              </span>
                            </div>
                            {priceBreakdown.tax > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">IVA:</span>
                                <span className="font-medium">
                                  {formatCurrency(priceBreakdown.tax)}
                                </span>
                              </div>
                            )}
                            <div className="border-t pt-1 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-900">
                                  Total:
                                </span>
                                <span className="font-bold text-lg text-gray-900">
                                  {formatCurrency(priceBreakdown.total)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Items count */}
                          {order.items && order.items.length > 0 && (
                            <div className="text-sm text-gray-500">
                              {order.items.length} producto
                              {order.items.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 pt-4 border-t border-gray-100">
                          <Button
                            variant="ghost"
                            icon={Eye}
                            onClick={() => navigate(`/orders/${order.id}`)}
                            size="sm"
                            className="flex-1"
                          >
                            Ver
                          </Button>

                          {(user?.role === "admin" ||
                            user?.role === "seller") && (
                            <>
                              <Button
                                variant="ghost"
                                icon={Edit}
                                onClick={() =>
                                  navigate(`/orders/${order.id}/edit`)
                                }
                                size="sm"
                                className="flex-1"
                                disabled={isLocal}
                                title={isLocal ? 'No disponible hasta sincronizar' : undefined}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                icon={Trash2}
                                onClick={() => {
                                  setOrderToDelete(order.id);
                                  setShowDeleteModal(true);
                                }}
                                size="sm"
                                className="flex-1 text-red-600 hover:text-red-700"
                              >
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
                    No hay órdenes
                  </h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-6 max-w-sm mx-auto">
                    Comienza creando tu primera orden
                  </p>
                  {(user?.role === "admin" || user?.role === "seller") && (
                    <Button
                      variant="primary"
                      icon={Plus}
                      onClick={() => navigate("/orders/new")}
                      className="w-full sm:w-auto max-w-xs mx-auto"
                    >
                      Crear orden
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && orderToDelete !== null && (
        <div className="fixed px-2 inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">¿Eliminar orden?</h2>
            <p className="mb-6">Esta acción no se puede deshacer. ¿Seguro que deseas eliminar la orden?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
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
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
