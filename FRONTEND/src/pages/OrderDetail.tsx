import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
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
  CreditCard,
  Banknote,
  Printer,
} from "lucide-react";
import { markOrderPaid } from "../services/orders";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useOrderStore } from "../store/orderStore";
import { useAuthStore } from "../store/authStore";
import { useTenantStore } from "../store/tenantStore";
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import OrderPrintView from "../components/features/OrderPrintView";
import { generateCartaPdf, urlToDataUrl } from "../utils/generateCartaPdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "En Proceso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const ORDER_STATUS_COLOR: Record<string, [number, number, number]> = {
  pending: [180, 83, 9],
  processing: [29, 78, 216],
  completed: [21, 128, 61],
  cancelled: [220, 38, 38],
};

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tenant = useTenantStore(s => s.tenant);
  const { addNotification } = useUIStore();
  const { currentOrder, loading, error, getOrderById, clearError, updateOrder, deleteOrder } =
    useOrderStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [abonos, setAbonos] = useState<{ payments: Array<{ id: number; amount: number; notes: string | null; createdAt: string }>; paidAmount: number; balance: number } | null>(null);
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoSaving, setAbonoSaving] = useState(false);

  const loadAbonos = async (orderId: number) => {
    try {
      const { apiService } = await import('../services/api');
      const r = await apiService.get<{ status: string; data: { payments: never[]; paidAmount: number; balance: number } }>(`/orders/${orderId}/payments`);
      setAbonos(r.data);
    } catch { setAbonos(null); }
  };

  useEffect(() => {
    if (currentOrder?.paymentType === 'credit' && navigator.onLine) loadAbonos(currentOrder.id);
  }, [currentOrder?.id, currentOrder?.paymentType, currentOrder?.paidAt]);

  const handleAddAbono = async () => {
    const monto = Number(abonoMonto);
    if (!currentOrder || !monto || monto <= 0 || abonoSaving) return;
    setAbonoSaving(true);
    try {
      const { apiService } = await import('../services/api');
      await apiService.post(`/orders/${currentOrder.id}/payments`, { amount: monto });
      setAbonoMonto('');
      await loadAbonos(currentOrder.id);
      await getOrderById(currentOrder.id);
      addNotification({ type: 'success', message: 'Abono registrado' });
    } catch {
      addNotification({ type: 'error', message: 'No se pudo registrar el abono' });
    } finally {
      setAbonoSaving(false);
    }
  };

  const handleMarkPaid = async (paid: boolean) => {
    if (!currentOrder || markingPaid) return;
    setMarkingPaid(true);
    try {
      await markOrderPaid(currentOrder.id, paid);
      await getOrderById(currentOrder.id);
      addNotification({ type: "success", message: paid ? "Orden marcada como pagada" : "Pago revertido" });
    } catch {
      addNotification({ type: "error", message: "No se pudo actualizar el pago" });
    } finally {
      setMarkingPaid(false);
    }
  };

  const statusOptions = [
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'processing', label: 'En Proceso', color: 'bg-sky-100 text-sky-900' },
    { value: 'completed', label: 'Completada', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Cancelada', color: 'bg-gray-200 text-gray-700' },
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
      await getOrderById(currentOrder.id);
      setShowStatusDropdown(false);
      const label = statusOptions.find(o => o.value === newStatus)?.label ?? newStatus;
      addNotification({ type: 'success', message: `Estado actualizado: ${label}` });
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
      // Render ticket at 80mm width (302px) — single tall page, no pagination
      const el = printRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });

      // 80mm wide, height proportional to content
      const ticketWidthMm = 80;
      const ticketHeightMm = (canvas.height / canvas.width) * ticketWidthMm;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [ticketWidthMm, ticketHeightMm],
      });

      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG', 0, 0, ticketWidthMm, ticketHeightMm
      );

      const fileName = `${currentOrder.orderNumber}.pdf`;

      if (Capacitor.isNativePlatform()) {
        // Android/iOS: write to cache dir then open share sheet
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        const { uri } = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });
        await Share.share({ title: `Orden ${fileName}`, url: uri });
      } else {
        pdf.save(fileName);
      }
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo generar el PDF' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Impresión directa (PC/navegador) — abre el diálogo nativo del sistema ya
  // con el ticket formateado, sin pasar por generar/descargar un PDF. La
  // impresora térmica emparejada por Bluetooth aparece ahí como una impresora
  // normal del sistema. Ver .print-ticket-root en index.css.
  const handleDirectPrint = async () => {
    if (!currentOrder || generatingPdf) return;
    setShowPdfMenu(false);
    if (currentOrder.status === 'pending') {
      await updateOrder(currentOrder.id, { status: 'processing' });
      await getOrderById(currentOrder.id);
    }
    window.print();
  };

  const handlePrintCarta = async () => {
    if (!currentOrder || generatingPdf) return;
    if (currentOrder.status === 'pending') {
      await updateOrder(currentOrder.id, { status: 'processing' });
      await getOrderById(currentOrder.id);
    }

    setGeneratingPdf(true);
    setShowPdfMenu(false);
    try {
      const logo = tenant?.logoUrl ? await urlToDataUrl(tenant.logoUrl) : null;
      const pdf = await generateCartaPdf({
        business: {
          name: tenant?.name ?? 'Merco',
          nit: tenant?.nit,
          address: tenant?.address,
          phone: tenant?.contactPhone,
          city: tenant?.city,
          logo,
        },
        docTypeLabel: 'Orden de Venta',
        docNumber: currentOrder.orderNumber,
        statusLabel: ORDER_STATUS_LABEL[currentOrder.status] ?? currentOrder.status,
        statusColor: ORDER_STATUS_COLOR[currentOrder.status] ?? [55, 65, 81],
        createdAt: currentOrder.createdAt,
        customer: {
          name: currentOrder.customer?.name ?? `Cliente #${currentOrder.customerId}`,
          code: currentOrder.customer?.code,
          nit: currentOrder.customer?.nit,
          contact: currentOrder.customer?.contact,
          address: currentOrder.customer?.address,
        },
        items: currentOrder.items.map((item) => ({
          code: item.product.code,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
        notes: currentOrder.notes,
        totalLabel: 'Total',
      });

      const fileName = `${currentOrder.orderNumber}-carta.pdf`;
      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: `Orden ${fileName}`, url: uri });
      } else {
        pdf.save(fileName);
      }
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo generar el PDF carta' });
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

  const isCredit = currentOrder.paymentType === "credit";
  const dueDate = currentOrder.paymentDueDate ? new Date(`${currentOrder.paymentDueDate}T00:00:00`) : null;
  const overdue = isCredit && !currentOrder.paidAt && dueDate !== null && dueDate < new Date();
  const canCollect = user?.role === "admin" || user?.role === "seller";

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">

        {isLocalOrder && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg" role="status">
            <WifiOff className="w-4 h-4 text-amber-700 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-900">Guardada en este equipo · se envía sola cuando haya internet</p>
          </div>
        )}

        <Breadcrumbs items={[{ label: 'Órdenes', to: '/orders' }, { label: `#${currentOrder.orderNumber}` }]} />

        {/* Encabezado: número, fecha/vendedor, estado y acciones con nombre */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[12rem]">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">#{currentOrder.orderNumber}</h1>
            <p className="text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
              <Calendar className="w-4 h-4" aria-hidden="true" /> {formatDate(currentOrder.createdAt)}
              <span aria-hidden="true">·</span>
              <User className="w-4 h-4" aria-hidden="true" /> {currentOrder.user?.username ?? `Usuario #${currentOrder.userId}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {/* Status dropdown */}
          <div className="relative">
            {canEdit ? (
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={updatingStatus}
                aria-haspopup="menu"
                aria-expanded={showStatusDropdown}
                aria-label={`Estado: ${getStatusText(currentOrder.status)}. Cambiar`}
                className={`min-h-[36px] px-3 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(currentOrder.status)} ${updatingStatus ? 'opacity-50' : 'hover:opacity-80'}`}
              >
                {updatingStatus ? <LoadingSpinner size="sm" /> : <span>{getStatusText(currentOrder.status)}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : (
              <span className={`inline-flex min-h-[36px] items-center px-3 rounded-full text-sm font-medium ${getStatusColor(currentOrder.status)}`}>
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

          {/* PDF download dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPdfMenu(v => !v)}
              disabled={generatingPdf}
              className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              aria-haspopup="menu"
              aria-expanded={showPdfMenu}
            >
              {generatingPdf
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Printer className="w-4 h-4" aria-hidden="true" />
              }
              Imprimir / PDF
            </button>
            {showPdfMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                <button
                  onClick={() => { setShowPdfMenu(false); handlePrint(); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  Ticket 80mm
                </button>
                <button
                  onClick={() => handlePrintCarta()}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  Hoja carta
                </button>
                {!Capacitor.isNativePlatform() && (
                  <button
                    onClick={() => handleDirectPrint()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                  >
                    <Printer className="w-3.5 h-3.5 text-gray-500" />
                    Imprimir (térmica)
                  </button>
                )}
              </div>
            )}
          </div>
            {canEdit && (
              <Button variant="outline" icon={Edit} onClick={() => navigate(`/orders/${currentOrder.id}/edit`)} className="min-h-[40px]">
                Editar
              </Button>
            )}
            {user?.role === "admin" && (
              <button
                onClick={() => setShowDeleteModal(true)}
                aria-label="Eliminar orden"
                title="Eliminar"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          {/* ── Productos ── */}
          <div className="space-y-4 min-w-0">
            <section className="bg-white rounded-xl border border-gray-200" aria-labelledby="od-items">
              <h2 id="od-items" className="px-4 pt-4 pb-2 text-base font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" aria-hidden="true" /> Productos
                <span className="text-sm font-normal text-gray-600">({(currentOrder.items || []).length})</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                    <tr>
                      <th scope="col" className="px-4 py-2">Producto</th>
                      <th scope="col" className="px-4 py-2 text-right">Cant.</th>
                      <th scope="col" className="px-4 py-2 text-right hidden sm:table-cell">Precio</th>
                      <th scope="col" className="px-4 py-2 text-right hidden sm:table-cell">IVA</th>
                      <th scope="col" className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(currentOrder.items || []).map((item, index) => {
                      const itemSubtotal = Number(item.unitPrice) * Number(item.quantity);
                      const itemTotal = itemSubtotal * (1 + (Number(item.taxRate) || 0) / 100);
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{item.product?.name}</p>
                            <p className="text-xs text-gray-600 font-mono">{item.product?.code}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{Number(item.quantity)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap hidden sm:table-cell">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap hidden sm:table-cell text-gray-700">{Number(item.taxRate) ? `${Number(item.taxRate)}%` : '—'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold text-gray-900">{formatCurrency(itemTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <dl className="px-4 py-3 border-t border-gray-100 space-y-1 text-sm">
                <div className="flex justify-between text-gray-700"><dt>Subtotal</dt><dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd></div>
                {totals.totalTax > 0 && (
                  <div className="flex justify-between text-gray-700"><dt>IVA</dt><dd className="tabular-nums">{formatCurrency(totals.totalTax)}</dd></div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-gray-100 text-base font-bold text-gray-900"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(totals.total)}</dd></div>
              </dl>
            </section>

            {currentOrder.notes && (
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Notas</h2>
                <p className="text-sm text-gray-800 whitespace-pre-line">{currentOrder.notes}</p>
              </section>
            )}
          </div>

          {/* ── Lateral: cobro y cliente ── */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="od-pago">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 id="od-pago" className="text-xs font-medium text-gray-600">Total de la orden</h2>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatCurrency(totals.total)}</p>
                </div>
                {isCredit ? (
                  currentOrder.paidAt ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Pagada</span>
                  ) : overdue ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Vencida</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900">Por cobrar</span>
                  )
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Contado</span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-700 flex items-center gap-1.5 flex-wrap">
                {isCredit ? <CreditCard className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <Banknote className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                {isCredit ? 'Crédito' : 'Contado'}
                {isCredit && dueDate && <> · {overdue ? 'venció' : 'vence'} el {format(dueDate, "d 'de' MMMM", { locale: es })}</>}
                {isCredit && currentOrder.paidAt && <> · pagada el {format(new Date(currentOrder.paidAt), "d MMM", { locale: es })}</>}
              </p>

              {isCredit && canCollect && (
                currentOrder.paidAt ? (
                  <button
                    onClick={() => handleMarkPaid(false)}
                    disabled={markingPaid}
                    className="mt-3 min-h-[40px] px-3 rounded-lg text-sm text-gray-700 underline hover:text-gray-900 disabled:opacity-50"
                  >
                    Marcar como no pagada
                  </button>
                ) : (
                  <button
                    onClick={() => handleMarkPaid(true)}
                    disabled={markingPaid}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50"
                  >
                    {markingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Marcar pagada
                  </button>
                )
              )}
          {/* Abonos parciales */}
          {currentOrder.paymentType === "credit" && !currentOrder.paidAt && abonos && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500">
                  Abonado <b className="text-gray-800">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(abonos.paidAmount)}</b> de {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(currentOrder.totalAmount))}
                </span>
                <span className="font-semibold text-amber-700">
                  Saldo {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(abonos.balance)}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-2">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (abonos.paidAmount / Number(currentOrder.totalAmount)) * 100)}%` }} />
              </div>
              {(user?.role === "admin" || user?.role === "seller") && (
                <div className="flex gap-2">
                  <input
                    type="number" min="1" value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)}
                    placeholder="Monto del abono"
                    aria-label="Monto del abono"
                    className="flex-1 min-w-0 h-11 px-3 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                  <button
                    onClick={handleAddAbono} disabled={abonoSaving || !abonoMonto}
                    className="h-11 px-4 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50"
                  >
                    {abonoSaving ? '...' : 'Abonar'}
                  </button>
                </div>
              )}
              {abonos.payments.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {abonos.payments.map(a => (
                    <li key={a.id} className="flex justify-between text-xs text-gray-600">
                      <span>{format(new Date(a.createdAt), "d MMM yyyy", { locale: es })}{a.notes ? ` · ${a.notes}` : ''}</span>
                      <span className="text-gray-600">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(a.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="od-cliente">
              <h2 id="od-cliente" className="text-xs font-medium text-gray-600 mb-1">Cliente</h2>
              <p className="font-semibold text-gray-900">{currentOrder.customer?.name ?? `Cliente #${currentOrder.customerId}`}</p>
              <dl className="mt-1 space-y-1 text-sm text-gray-700">
                {currentOrder.customer?.nit && (
                  <div className="flex gap-1.5"><dt className="text-gray-600">NIT/CC:</dt><dd>{currentOrder.customer.nit}</dd></div>
                )}
                {currentOrder.customer?.contact && (
                  <div className="flex items-center gap-1.5"><dt className="sr-only">Teléfono</dt><Phone className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{currentOrder.customer.contact}</dd></div>
                )}
                {currentOrder.customer?.address && (
                  <div className="flex items-center gap-1.5"><dt className="sr-only">Dirección</dt><MapPin className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{currentOrder.customer.address}</dd></div>
                )}
              </dl>
              {currentOrder.customer?.note && <p className="mt-1 text-sm text-gray-600 italic">{currentOrder.customer.note}</p>}
            </section>
          </aside>
        </div>

        {/* Portal a #print-root (hermano de #root en index.html — no anidado
            en los contenedores flex/scroll de esta página): en pantalla queda
            oculto (posición fuera de vista, ver index.css) y sigue sirviendo
            para la captura html2canvas del PDF ticket; al imprimir directo
            (handleDirectPrint), .print-ticket-root pasa a flujo normal ahí
            y es el único contenido de la página impresa. */}
        {createPortal(
          <div className="print-ticket-root" style={{ position: 'absolute', left: '-9999px', top: 0, width: '302px', pointerEvents: 'none' }}>
            <OrderPrintView ref={printRef} order={currentOrder} />
          </div>,
          document.getElementById('print-root') ?? document.body
        )}

        {/* Click outside overlays */}
        {showStatusDropdown && (
          <div className="fixed inset-0 z-5" onClick={() => setShowStatusDropdown(false)} />
        )}
        {showPdfMenu && (
          <div className="fixed inset-0 z-10" onClick={() => setShowPdfMenu(false)} />
        )}

        {/* Modal eliminar */}
        {showDeleteModal && (
          <div className="fixed px-4 inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm">
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