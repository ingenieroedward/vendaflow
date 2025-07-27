import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Calendar,
  DollarSign,
  Package,
  Menu,
  X,
  Notebook,
  ChevronDown,
  Check,
} from "lucide-react";
import { useOrderStore } from "../store/orderStore";
import { useAuthStore } from "../store/authStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import PrintButton from "../components/ui/PrintButton";
import OrderPrintView from "../components/features/OrderPrintView";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentOrder, loading, error, getOrderById, clearError, updateOrder, deleteOrder } =
    useOrderStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePrint = async () => {
    if (!currentOrder) return;
    if (currentOrder.status === 'pending') {
      await updateOrder(currentOrder.id, { status: 'processing' });
      await getOrderById(currentOrder.id); // refresca la orden
    }
    if (printRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Orden ${currentOrder?.orderNumber}</title>
              <style>
                @page {
                  size: A4;
                  margin: 1cm;
                }
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0; 
                  padding: 0;
                  line-height: 1.4;
                  color: #000;
                  font-size: 12px;
                }
                .print-container {
                  max-width: 100%;
                  margin: 0 auto;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 10px 0;
                  font-size: 11px;
                }
                th, td {
                  border: 1px solid #ccc;
                  padding: 6px;
                  text-align: left;
                }
                th {
                  background-color: #f5f5f5;
                  font-weight: bold;
                  font-size: 10px;
                }
                .header {
                  border-bottom: 2px solid #333;
                  padding-bottom: 20px;
                  margin-bottom: 20px;
                  text-align: center;
                }
                .header h1 {
                  font-size: 20px;
                  margin: 0;
                  color: #333;
                }
                .section {
                  margin-bottom: 15px;
                }
                .section-title {
                  font-size: 14px;
                  font-weight: bold;
                  border-bottom: 1px solid #ccc;
                  padding-bottom: 5px;
                  margin-bottom: 10px;
                }
                .customer-info, .user-info {
                  background-color: #f9f9f9;
                  padding: 10px;
                  border-radius: 4px;
                  margin-bottom: 10px;
                }
                .info-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin-bottom: 20px;
                }
                .totals {
                  text-align: right;
                  margin-top: 15px;
                  font-size: 12px;
                }
                .total-row {
                  border-top: 2px solid #333;
                  padding-top: 8px;
                  margin-top: 8px;
                  font-weight: bold;
                  font-size: 14px;
                }
                .notes {
                  background-color: #fff3cd;
                  border-left: 4px solid #ffc107;
                  padding: 10px;
                  margin: 15px 0;
                  font-size: 11px;
                }
                .footer {
                  border-top: 1px solid #333;
                  padding-top: 15px;
                  margin-top: 30px;
                  text-align: center;
                  font-size: 10px;
                  color: #666;
                }
                .tax-detail {
                  font-size: 10px;
                  color: #666;
                  font-style: italic;
                }
                @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="print-container">
                ${printRef.current.innerHTML}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
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
    let subtotal = 0;
    let totalTax = 0;

    currentOrder?.items.forEach((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);

      subtotal += itemSubtotal;
      totalTax += itemTax;
    });

    return {
      subtotal,
      totalTax,
      total: subtotal + totalTax,
    };
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-8">
        {/* Header */}

        <div>
          <Button
            variant="ghost"
            icon={ArrowLeft}
            className="mb-3 sm:mb-4 -ml-2"
            onClick={() => navigate("/orders")}
            size="sm"
          >
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6 mb-4 lg:mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 lg:space-x-3">
                <h1 className="text-lg lg:text-2xl font-bold text-gray-900">
                  <span className="hidden sm:inline">
                    #{currentOrder.orderNumber}
                  </span>
                  <span className="sm:hidden">#{currentOrder.orderNumber}</span>
                </h1>
              </div>

              {/* Desktop Actions */}
              <div className="hidden lg:flex items-center space-x-2">
                <PrintButton onPrint={handlePrint} />
                {(user?.role === "admin" || user?.role === "seller") && (
                  <>
                    <Button
                      variant="outline"
                      icon={Edit}
                      onClick={() =>
                        navigate(`/orders/${currentOrder.id}/edit`)
                      }
                      size="sm"
                    >
                      Editar
                    </Button>
                    {user?.role === "admin" && (
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={() => setShowDeleteModal(true)}
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Eliminar
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  icon={showMobileMenu ? X : Menu}
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  size="sm"
                >
                  <span className="hidden">abrir</span>
                </Button>
              </div>
            </div>

            {/* Mobile Actions Menu */}
            {showMobileMenu && (
              <div className="lg:hidden place-content-center mb-2 gap-1 grid grid-cols-3 border-t pt-4 mt-4">
                <Button
                  onClick={handlePrint}
                  className="w-full justify-start py-1"
                  variant="outline"
                  size="sm"
                >
                  Imprimir
                </Button>
                {(user?.role === "admin" || user?.role === "seller") && (
                  <>
                    <Button
                      onClick={() =>
                        navigate(`/orders/${currentOrder.id}/edit`)
                      }
                      className="w-full justify-start"
                      variant="outline"
                      size="sm"
                    >
                      Editar
                    </Button>
                    {user?.role === "admin" && (
                      <Button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full justify-start text-red-600 hover:text-red-700"
                        variant="outline"
                        size="sm"
                      >
                        Eliminar
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Order Info - Mobile Optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Fecha</p>
                  <p className="font-medium text-sm lg:text-base">
                    {formatDate(currentOrder.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Creado por</p>
                  <p className="font-medium text-sm lg:text-base">
                    {currentOrder.user.username}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:col-span-2 lg:col-span-1">
                <DollarSign className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Total</p>
                  <p className="font-bold text-base lg:text-lg text-blue-600">
                    {formatCurrency(totals.total)}
                  </p>
                </div>
              </div>
            </div>

            {/* Status with Dropdown */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {(user?.role === "admin" || user?.role === "seller") ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      disabled={updatingStatus}
                      className={`px-3 py-1 rounded-full text-xs lg:text-sm font-medium ${getStatusColor(
                        currentOrder.status
                      )} hover:opacity-80 transition-opacity flex items-center space-x-1 ${
                        updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <span>{getStatusText(currentOrder.status)}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showStatusDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            disabled={updatingStatus || option.value === currentOrder.status}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between text-sm ${
                              option.value === currentOrder.status ? 'bg-gray-50' : ''
                            } ${
                              updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                              {option.label}
                            </span>
                            {option.value === currentOrder.status && (
                              <Check className="w-3 h-3 text-green-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-xs lg:text-sm font-medium ${getStatusColor(
                      currentOrder.status
                    )}`}
                  >
                    {getStatusText(currentOrder.status)}
                  </span>
                )}
              </div>

              {updatingStatus && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <LoadingSpinner size="sm" />
                  <span>Actualizando estado...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer and User Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600 mr-2" />
              Datos del cliente
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Nombre</p>
                <p className="font-medium text-gray-900 text-sm lg:text-base">
                  {currentOrder.customer.name}
                </p>
              </div>
              {currentOrder.customer.contact && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Contacto</p>
                  <p className="text-gray-700 text-sm lg:text-base">
                    {currentOrder.customer.contact}
                  </p>
                </div>
              )}
              {currentOrder.customer.address && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Dirección</p>
                  <p className="text-gray-700 text-sm lg:text-base">
                    {currentOrder.customer.address}
                  </p>
                </div>
              )}
              {currentOrder.customer.note && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Nota</p>
                  <p className="text-gray-700 italic text-sm lg:text-base">
                    {currentOrder.customer.note}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Notes */}
          {currentOrder.notes && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6 mb-4 lg:mb-6">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-4 h-4 lg:w-5 lg:h-5 text-yellow-600 mr-2">
                  <Notebook />
                </span>
                Notas de la orden
              </h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-gray-700 leading-relaxed text-sm lg:text-base">
                  {currentOrder.notes.split("\n").map((line, index) => (
                    <React.Fragment key={index}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Products - Mobile Optimized */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6 mb-4 lg:mb-6">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="w-4 h-4 lg:w-5 lg:h-5 text-green-600 mr-2" />
            Productos
          </h2>

          {/* Mobile Product Cards */}
          <div className="lg:hidden space-y-4">
            {currentOrder.items.map((item, index) => {
              const itemSubtotal = item.quantity * item.unitPrice;
              const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);
              const itemTotal = itemSubtotal + itemTax;

              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Código: {item.product.code}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600 text-sm">
                        {formatCurrency(itemTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Cantidad</p>
                      <p className="font-medium">{item.quantity}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Precio Unit.</p>
                      <p className="font-medium">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">IVA</p>
                      <p className="font-medium">{item.taxRate || 0}%</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(itemSubtotal)}</span>
                    </div>
                    {itemTax > 0 && (
                      <div className="flex justify-between">
                        <span>IVA ({item.taxRate}%):</span>
                        <span>{formatCurrency(itemTax)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Producto
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    Cantidad
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Precio Unit.
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    IVA
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Subtotal
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    IVA
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentOrder.items.map((item, index) => {
                  const itemSubtotal = item.quantity * item.unitPrice;
                  const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);
                  const itemTotal = itemSubtotal + itemTax;

                  return (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            Código: {item.product.code}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-medium text-gray-900">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-gray-700">
                          {formatCurrency(item.unitPrice)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {item.taxRate || 0}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-gray-700">
                          {formatCurrency(itemSubtotal)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-gray-700">
                          {formatCurrency(itemTax)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-green-600">
                          {formatCurrency(itemTotal)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Order Summary */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="w-full lg:w-64 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total IVA:</span>
                  <span>{formatCurrency(totals.totalTax)}</span>
                </div>
                <div className="flex justify-between text-base lg:text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total:</span>
                  <span className="text-blue-600">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden print view */}
        <div className="hidden">
          <OrderPrintView ref={printRef} order={currentOrder} />
        </div>

        {/* Click outside handler for dropdown */}
        {showStatusDropdown && (
          <div
            className="fixed inset-0 z-5"
            onClick={() => setShowStatusDropdown(false)}
          />
        )}

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && (
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
                      await deleteOrder(currentOrder.id);
                      navigate('/orders');
                    } catch {
                      // Puedes agregar notificación de error si lo deseas
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
    </div>
  );
};

export default OrderDetail;