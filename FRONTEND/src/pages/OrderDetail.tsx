import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Calendar,
  Download,
  Package,
  ChevronDown,
  Check,
  WifiOff,
  Phone,
  MapPin,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import { useOrderStore } from "../store/orderStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import OrderPrintView from "../components/features/OrderPrintView";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { currentOrder, loading, error, getOrderById, clearError, updateOrder, deleteOrder } =
    useOrderStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'processing', label: 'En Proceso', color: 'bg-blue-100 text-blue-800' },
    { value: 'completed', label: 'Completada', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  ];

  useEffect(() => {
    if (id) {
      getOrderById(parseInt(id));
    }
  }, [id, getOrderById]);

  const handleStatusChange = async (newStatus: string) => {
    if (!currentOrder || updatingStatus) return;
    
    setUpdatingStatus(true);
    try {
      await updateOrder(currentOrder.id, { status: newStatus as any });
      await getOrderById(currentOrder.id); // Refresh order data
      setShowStatusDropdown(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al actualizar el estado';
      addNotification({ type: 'error', title: 'Error', message: msg });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePrint = async () => {
    if (!currentOrder || generatingPdf || !printRef.current) return;
    if (currentOrder.status === 'pending') {
      await updateOrder(currentOrder.id, { status: 'processing' });
      await getOrderById(currentOrder.id);
    }

    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const orderNumber = currentOrder.orderNumber;

      await new Promise<void>((resolve, reject) => {
        pdf.html(printRef.current!, {
          callback: (doc) => {
            try { doc.save(`${orderNumber}.pdf`); resolve(); }
            catch (e) { reject(e); }
          },
          margin: [0, 0, 0, 0],
          autoPaging: 'text',
          width: 210,
          windowWidth: 794,
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          },
        });
      });
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo generar el PDF' });
    } finally {
      setGeneratingPdf(false);
    }
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

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.color : "bg-gray-100 text-gray-800";
  };

  const getStatusText = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : status.toUpperCase();
  };

  // Calculate totals with dynamic tax rates
  const calculateOrderTotals = () => {
    if (!currentOrder?.items || currentOrder.items.length === 0) {
      return {
        subtotal: currentOrder?.totalAmount || 0,
        totalTax: 0,
        total: currentOrder?.totalAmount || 0,
      };
    }

    let subtotal = 0;
    let totalTax = 0;

    currentOrder.items.forEach((item) => {
      const itemBase = Number(item.unitPrice) * Number(item.quantity);
      const itemTax = itemBase * ((Number(item.taxRate) || 0) / 100);
      subtotal += itemBase;
      totalTax += itemTax;
    });

    if (subtotal === 0) {
      return {
        subtotal: currentOrder.totalAmount,
        totalTax: 0,
        total: currentOrder.totalAmount,
      };
    }

    return { subtotal, totalTax, total: subtotal + totalTax };
  };

  const totals = currentOrder
    ? calculateOrderTotals()
    : { subtotal: 0, totalTax: 0, total: 0 };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        message={error}
        onDismiss={clearError}
        onRetry={() => id && getOrderById(parseInt(id))}
      />
    );
  }

  if (!currentOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Orden no encontrada</p>
      </div>
    );
  }

  const isLocalOrder = (currentOrder as any)._isLocal;
  const canEdit = user?.role === "admin" || user?.role === "seller";

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        {/* Offline banner */}
        {isLocalOrder && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Guardada localmente · se sincronizará con internet
            </p>
          </div>
        )}

        {/* Header bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/orders")}
            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-bold text-gray-900 text-base">
            #{currentOrder.orderNumber}
          </h1>

          {/* Status dropdown */}
          <div className="relative">
            {canEdit ? (
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={updatingStatus}
                className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(currentOrder.status)} ${updatingStatus ? 'opacity-50' : 'hover:opacity-80'}`}
              >
                {updatingStatus ? <LoadingSpinner size="sm" /> : <span>{getStatusText(currentOrder.status)}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(currentOrder.status)}`}>
                {getStatusText(currentOrder.status)}
              </span>
            )}
            {showStatusDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    disabled={updatingStatus || option.value === currentOrder.status}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm ${option.value === currentOrder.status ? 'bg-gray-50' : ''}`}
                  >
                    <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>{option.label}</span>
                    {option.value === currentOrder.status && <Check className="w-3 h-3 text-green-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action icons */}
          <button
            onClick={handlePrint}
            disabled={generatingPdf}
            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 disabled:opacity-50"
            title="Descargar PDF"
          >
            {generatingPdf
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />
            }
          </button>
          {canEdit && (
            <button
              onClick={() => navigate(`/orders/${currentOrder.id}/edit`)}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {user?.role === "admin" && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 rounded-md hover:bg-red-100 text-red-500"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Info row compacto */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{formatDate(currentOrder.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{currentOrder.user?.username ?? `Usuario #${currentOrder.userId}`}</span>
          </div>
          <div className="col-span-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-gray-500">Total de la orden</span>
            <span className="font-bold text-base text-blue-600">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Cliente compacto */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cliente</p>
          <p className="font-semibold text-sm text-gray-900">
            {currentOrder.customer?.name ?? `Cliente #${currentOrder.customerId}`}
          </p>
          {currentOrder.customer?.nit && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
              <span className="text-gray-400 font-medium">NIT/CC:</span>
              <span>{currentOrder.customer.nit}</span>
            </div>
          )}
          {currentOrder.customer?.contact && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
              <Phone className="w-3 h-3 text-gray-400" />
              <span>{currentOrder.customer.contact}</span>
            </div>
          )}
          {currentOrder.customer?.address && (
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-600">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span>{currentOrder.customer.address}</span>
            </div>
          )}
          {currentOrder.customer?.note && (
            <p className="mt-1 text-xs text-gray-500 italic">{currentOrder.customer.note}</p>
          )}
        </div>

        {/* Notas compactas */}
        {currentOrder.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-700 mb-1">Notas</p>
            <p className="text-xs text-gray-700 whitespace-pre-line">{currentOrder.notes}</p>
          </div>
        )}

        {/* Productos */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-3.5 h-3.5 text-green-600" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Productos</p>
          </div>

          {/* Lista de items - filas compactas en móvil */}
          <div className="space-y-0 divide-y divide-gray-100">
            {(currentOrder.items || []).map((item, index) => {
              const itemSubtotal = Number(item.unitPrice) * Number(item.quantity);
              const itemTax = itemSubtotal * ((Number(item.taxRate) || 0) / 100);
              const itemTotal = itemSubtotal + itemTax;
              return (
                <div key={index} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name}</p>
                      <p className="text-xs text-gray-400">{item.product?.code} · {item.quantity} × {formatCurrency(item.unitPrice)}{item.taxRate ? ` + IVA ${item.taxRate}%` : ''}</p>
                    </div>
                    <p className="text-sm font-semibold text-green-600 flex-shrink-0">{formatCurrency(itemTotal)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totales */}
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.totalTax > 0 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>IVA</span>
                <span>{formatCurrency(totals.totalTax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span className="text-blue-600">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Off-screen render for PDF capture */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', pointerEvents: 'none' }}>
          <OrderPrintView ref={printRef} order={currentOrder} />
        </div>

        {/* Click outside status dropdown */}
        {showStatusDropdown && (
          <div className="fixed inset-0 z-5" onClick={() => setShowStatusDropdown(false)} />
        )}

        {/* Modal eliminar */}
        {showDeleteModal && (
          <div className="fixed px-4 inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-sm">
              <h2 className="text-base font-bold mb-2">¿Eliminar orden?</h2>
              <p className="text-sm text-gray-600 mb-4">Esta acción no se puede deshacer.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    try {
                      await deleteOrder(currentOrder.id);
                      navigate('/orders');
                    } catch { /* handled */ }
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetail;