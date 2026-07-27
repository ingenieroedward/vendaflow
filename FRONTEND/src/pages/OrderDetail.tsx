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
  CreditCard,
  Banknote,
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
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import OrderPrintView from "../components/features/OrderPrintView";
import OrderPrintViewCarta from "../components/features/OrderPrintViewCarta";
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
  const printRefCarta = useRef<HTMLDivElement>(null);
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

  const handlePrintCarta = async () => {
    if (!currentOrder || generatingPdf || !printRefCarta.current) return;
    if (currentOrder.status === 'pending') {
      await updateOrder(currentOrder.id, { status: 'processing' });
      await getOrderById(currentOrder.id);
    }

    setGeneratingPdf(true);
    setShowPdfMenu(false);
    try {
      const container = printRefCarta.current;
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const pageWmm = pdf.internal.pageSize.getWidth();   // 215.9 mm
      const pageHmm = pdf.internal.pageSize.getHeight();  // 279.4 mm

      const domW = container.offsetWidth;                  // 794 px
      const canvasScale = canvas.width / domW;             // ≈2

      // Page height in canvas pixels (letter: 279.4 / 215.9 ratio)
      const pageHcanvas = (pageHmm / pageWmm) * domW * canvasScale;
      // Top margin for pages 2+ (32px DOM → canvas px)
      const topPadCanvas = Math.round(28 * canvasScale);

      // Use getBoundingClientRect — reliable for <tr> inside tables
      const containerTop = container.getBoundingClientRect().top;
      const rows = Array.from(
        container.querySelectorAll('tbody tr, tfoot tr')
      ) as HTMLElement[];

      const breakPoints: number[] = [];
      let pageBottom = pageHcanvas;

      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        const rowTop    = (rect.top  - containerTop) * canvasScale;
        const rowBottom = (rect.bottom - containerTop) * canvasScale;
        if (rowBottom > pageBottom) {
          breakPoints.push(rowTop);
          pageBottom = rowTop + pageHcanvas;
        }
      }
      breakPoints.push(canvas.height);

      // Render one PDF page per segment, with top-margin whitespace on pages 2+
      let sliceY = 0;
      for (let i = 0; i < breakPoints.length; i++) {
        const sliceH   = breakPoints[i] - sliceY;
        const padTop   = i > 0 ? topPadCanvas : 0;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width  = canvas.width;
        pageCanvas.height = sliceH + padTop;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, sliceY, canvas.width, sliceH,
                              0, padTop, canvas.width, sliceH);
        const pageHmm2 = (pageCanvas.height / canvas.width) * pageWmm;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWmm, pageHmm2);
        sliceY = breakPoints[i];
        if (i < breakPoints.length - 1) pdf.addPage();
      }

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

        <Breadcrumbs
          items={[{ label: 'Órdenes', to: '/orders' }, { label: `#${currentOrder.orderNumber}` }]}
          className="mb-2"
        />

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

          {/* PDF download dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPdfMenu(v => !v)}
              disabled={generatingPdf}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 disabled:opacity-50"
              title="Descargar PDF"
            >
              {generatingPdf
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />
              }
            </button>
            {showPdfMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                <button
                  onClick={() => { setShowPdfMenu(false); handlePrint(); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-gray-400" />
                  Ticket 80mm
                </button>
                <button
                  onClick={() => handlePrintCarta()}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-gray-400" />
                  Hoja carta
                </button>
              </div>
            )}
          </div>
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
        <div className="bg-white rounded-xl border border-gray-200 p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
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
        <div className="bg-white rounded-xl border border-gray-200 p-3">
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

        {/* Pago */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {currentOrder.paymentType === "credit" ? (
                <CreditCard className={`w-4 h-4 flex-shrink-0 ${currentOrder.paidAt ? "text-green-600" : "text-amber-600"}`} />
              ) : (
                <Banknote className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pago</p>
                {currentOrder.paymentType === "credit" ? (
                  <p className="text-sm text-gray-800">
                    Crédito
                    {currentOrder.paymentDueDate && (
                      <> · vence el {format(new Date(`${currentOrder.paymentDueDate}T00:00:00`), "d 'de' MMMM", { locale: es })}</>
                    )}
                    {currentOrder.paidAt ? (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Pagada {format(new Date(currentOrder.paidAt), "d MMM", { locale: es })}
                      </span>
                    ) : currentOrder.paymentDueDate && new Date(`${currentOrder.paymentDueDate}T00:00:00`) < new Date() ? (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Vencida</span>
                    ) : (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Por cobrar</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-gray-800">Contado</p>
                )}
              </div>
            </div>
            {currentOrder.paymentType === "credit" && (user?.role === "admin" || user?.role === "seller") && (
              currentOrder.paidAt ? (
                <button
                  onClick={() => handleMarkPaid(false)}
                  disabled={markingPaid}
                  className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0 disabled:opacity-50"
                >
                  Revertir
                </button>
              ) : (
                <button
                  onClick={() => handleMarkPaid(true)}
                  disabled={markingPaid}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {markingPaid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Marcar pagada
                </button>
              )
            )}
          </div>

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
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={handleAddAbono} disabled={abonoSaving || !abonoMonto}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {abonoSaving ? '...' : 'Abonar'}
                  </button>
                </div>
              )}
              {abonos.payments.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {abonos.payments.map(a => (
                    <li key={a.id} className="flex justify-between text-[11px] text-gray-400">
                      <span>{format(new Date(a.createdAt), "d MMM yyyy", { locale: es })}{a.notes ? ` · ${a.notes}` : ''}</span>
                      <span className="text-gray-600">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(a.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
        <div className="bg-white rounded-xl border border-gray-200 p-3">
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

        {/* Off-screen renders for PDF capture */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '302px', pointerEvents: 'none' }}>
          <OrderPrintView ref={printRef} order={currentOrder} />
        </div>
        <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', pointerEvents: 'none' }}>
          <OrderPrintViewCarta ref={printRefCarta} order={currentOrder} />
        </div>

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