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
  CalendarClock,
  Printer,
  ArrowRightCircle,
} from "lucide-react";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useQuoteStore } from "../store/quoteStore";
import { useAuthStore } from "../store/authStore";
import { useTenantStore } from "../store/tenantStore";
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import QuotePrintView from "../components/features/QuotePrintView";
import { generateCartaPdf, urlToDataUrl } from "../utils/generateCartaPdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
  converted: "Convertida",
};

const QUOTE_STATUS_COLOR: Record<string, [number, number, number]> = {
  draft: [75, 85, 99],
  sent: [29, 78, 216],
  accepted: [21, 128, 61],
  rejected: [220, 38, 38],
  expired: [180, 83, 9],
  converted: [4, 120, 87],
};

const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tenant = useTenantStore(s => s.tenant);
  const { addNotification } = useUIStore();
  const { currentQuote, loading, error, getQuoteById, clearError, updateQuote, deleteQuote, convertToOrder } =
    useQuoteStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const statusOptions = [
    { value: 'draft', label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
    { value: 'sent', label: 'Enviada', color: 'bg-primary/15 text-primary' },
    { value: 'accepted', label: 'Aceptada', color: 'bg-green-100 text-green-800' },
    { value: 'rejected', label: 'Rechazada', color: 'bg-red-100 text-red-800' },
    { value: 'expired', label: 'Vencida', color: 'bg-amber-100 text-amber-800' },
  ];

  useEffect(() => {
    if (id) {
      getQuoteById(parseInt(id));
    }
  }, [id, getQuoteById]);

  const handleStatusChange = async (newStatus: string) => {
    if (!currentQuote || updatingStatus) return;

    setUpdatingStatus(true);
    try {
      await updateQuote(currentQuote.id, { status: newStatus as any });
      await getQuoteById(currentQuote.id);
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

  const handleConvert = async () => {
    if (!currentQuote || converting) return;
    setConverting(true);
    try {
      const order = await convertToOrder(currentQuote.id);
      addNotification({ type: 'success', title: 'Convertida a orden', message: `Se creó la orden #${order.orderNumber}` });
      navigate(`/orders/${order.id}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo convertir a orden';
      addNotification({ type: 'error', title: 'Error', message: msg });
    } finally {
      setConverting(false);
      setShowConvertModal(false);
    }
  };

  const handlePrint = async () => {
    if (!currentQuote || generatingPdf || !printRef.current) return;

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

      const fileName = `${currentQuote.quoteNumber}.pdf`;

      if (Capacitor.isNativePlatform()) {
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
        await Share.share({ title: `Cotización ${fileName}`, url: uri });
      } else {
        pdf.save(fileName);
      }
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo generar el PDF' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Impresión directa (PC/navegador) — ver .print-ticket-root en index.css
  // y el mismo mecanismo en OrderDetail.tsx.
  const handleDirectPrint = () => {
    if (!currentQuote || generatingPdf) return;
    setShowPdfMenu(false);
    window.print();
  };

  const handlePrintCarta = async () => {
    if (!currentQuote || generatingPdf) return;

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
        docTypeLabel: 'Cotización',
        docNumber: currentQuote.quoteNumber,
        statusLabel: QUOTE_STATUS_LABEL[currentQuote.status] ?? currentQuote.status,
        statusColor: QUOTE_STATUS_COLOR[currentQuote.status] ?? [55, 65, 81],
        createdAt: currentQuote.createdAt,
        extraInfoLine: currentQuote.validUntil
          ? `Válida hasta: ${format(new Date(currentQuote.validUntil), "d 'de' MMMM 'de' yyyy", { locale: es })}`
          : undefined,
        customer: {
          name: currentQuote.customer?.name ?? `Cliente #${currentQuote.customerId}`,
          code: currentQuote.customer?.code,
          nit: currentQuote.customer?.nit,
          contact: currentQuote.customer?.contact,
          address: currentQuote.customer?.address,
        },
        items: currentQuote.items.map((item) => ({
          code: item.product.code,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
        notes: currentQuote.notes,
        totalLabel: 'Total Cotizado',
        footerNote: 'Este documento no constituye una factura',
      });

      const fileName = `${currentQuote.quoteNumber}-carta.pdf`;
      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: `Cotización ${fileName}`, url: uri });
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
    return statusOption ? statusOption.color : "bg-emerald-100 text-emerald-800";
  };

  const getStatusText = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : QUOTE_STATUS_LABEL[status] ?? status;
  };

  // Calculate totals with dynamic tax rates
  const calculateQuoteTotals = () => {
    if (!currentQuote?.items || currentQuote.items.length === 0) {
      return {
        subtotal: currentQuote?.totalAmount || 0,
        totalTax: 0,
        total: currentQuote?.totalAmount || 0,
      };
    }

    let subtotal = 0;
    let totalTax = 0;

    currentQuote.items.forEach((item) => {
      const itemBase = Number(item.unitPrice) * Number(item.quantity);
      const itemTax = itemBase * ((Number(item.taxRate) || 0) / 100);
      subtotal += itemBase;
      totalTax += itemTax;
    });

    if (subtotal === 0) {
      return {
        subtotal: currentQuote.totalAmount,
        totalTax: 0,
        total: currentQuote.totalAmount,
      };
    }

    return { subtotal, totalTax, total: subtotal + totalTax };
  };

  const totals = currentQuote
    ? calculateQuoteTotals()
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
        onRetry={() => id && getQuoteById(parseInt(id))}
      />
    );
  }

  if (!currentQuote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cotización no encontrada</p>
      </div>
    );
  }

  const isLocalQuote = (currentQuote as any)._isLocal;
  const canEdit = (user?.role === "admin" || user?.role === "seller") && currentQuote.status !== 'converted';
  const canConvert = (user?.role === "admin" || user?.role === "seller") && currentQuote.status !== 'converted' && !isLocalQuote;

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">

        {isLocalQuote && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg" role="status">
            <WifiOff className="w-4 h-4 text-amber-700 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-900">Guardada en este equipo · se envía sola cuando haya internet</p>
          </div>
        )}

        <Breadcrumbs items={[{ label: 'Cotizaciones', to: '/quotes' }, { label: `#${currentQuote.quoteNumber}` }]} />

        {/* Encabezado: número, fecha/vendedor, estado y acciones con nombre */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[12rem]">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">#{currentQuote.quoteNumber}</h1>
            <p className="text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
              <Calendar className="w-4 h-4" aria-hidden="true" /> {formatDate(currentQuote.createdAt)}
              <span aria-hidden="true">·</span>
              <User className="w-4 h-4" aria-hidden="true" /> {currentQuote.user?.username ?? `Usuario #${currentQuote.userId}`}
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
                aria-label={`Estado: ${getStatusText(currentQuote.status)}. Cambiar`}
                className={`min-h-[36px] px-3 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(currentQuote.status)} ${updatingStatus ? 'opacity-50' : 'hover:opacity-80'}`}
              >
                {updatingStatus ? <LoadingSpinner size="sm" /> : <span>{getStatusText(currentQuote.status)}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : (
              <span className={`inline-flex min-h-[36px] items-center px-3 rounded-full text-sm font-medium ${getStatusColor(currentQuote.status)}`}>
                {getStatusText(currentQuote.status)}
              </span>
            )}
            {showStatusDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    disabled={updatingStatus || option.value === currentQuote.status}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm ${option.value === currentQuote.status ? 'bg-gray-50' : ''}`}
                  >
                    <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>{option.label}</span>
                    {option.value === currentQuote.status && <Check className="w-3 h-3 text-green-600" />}
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
              <Button variant="outline" icon={Edit} onClick={() => navigate(`/quotes/${currentQuote.id}/edit`)} className="min-h-[40px]">
                Editar
              </Button>
            )}
            {user?.role === "admin" && currentQuote.status !== 'converted' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                aria-label="Eliminar cotización"
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
                <span className="text-sm font-normal text-gray-600">({(currentQuote.items || []).length})</span>
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
                    {(currentQuote.items || []).map((item, index) => {
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

            {currentQuote.notes && (
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Notas</h2>
                <p className="text-sm text-gray-800 whitespace-pre-line">{currentQuote.notes}</p>
              </section>
            )}
          </div>

          {/* ── Lateral: cobro y cliente ── */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="od-pago">
              <h2 id="od-pago" className="text-xs font-medium text-gray-600">Total cotizado</h2>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatCurrency(totals.total)}</p>
              {currentQuote.validUntil && (
                <p className="mt-1 text-sm text-gray-700 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  Válida hasta el {format(new Date(currentQuote.validUntil), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              )}
              {canConvert && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 min-h-[44px] px-4 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/90"
                >
                  <ArrowRightCircle className="w-4 h-4" aria-hidden="true" />
                  Convertir a orden
                </button>
              )}
              {currentQuote.status === 'converted' && currentQuote.convertedOrderId && (
                <button
                  onClick={() => navigate(`/orders/${currentQuote.convertedOrderId}`)}
                  className="mt-3 w-full flex items-center justify-center gap-2 min-h-[44px] px-4 border border-gray-300 text-gray-800 text-sm font-semibold rounded-lg hover:bg-gray-50"
                >
                  <ArrowRightCircle className="w-4 h-4" aria-hidden="true" />
                  Ver orden generada
                </button>
              )}
              <p className="mt-2 text-xs text-gray-600">Una cotización no descuenta inventario hasta convertirse en orden.</p>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="od-cliente">
              <h2 id="od-cliente" className="text-xs font-medium text-gray-600 mb-1">Cliente</h2>
              <p className="font-semibold text-gray-900">{currentQuote.customer?.name ?? `Cliente #${currentQuote.customerId}`}</p>
              <dl className="mt-1 space-y-1 text-sm text-gray-700">
                {currentQuote.customer?.nit && (
                  <div className="flex gap-1.5"><dt className="text-gray-600">NIT/CC:</dt><dd>{currentQuote.customer.nit}</dd></div>
                )}
                {currentQuote.customer?.contact && (
                  <div className="flex items-center gap-1.5"><dt className="sr-only">Teléfono</dt><Phone className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{currentQuote.customer.contact}</dd></div>
                )}
                {currentQuote.customer?.address && (
                  <div className="flex items-center gap-1.5"><dt className="sr-only">Dirección</dt><MapPin className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{currentQuote.customer.address}</dd></div>
                )}
              </dl>
            </section>
          </aside>
        </div>

        {/* Portal a #print-root — ver mismo mecanismo en OrderDetail.tsx */}
        {createPortal(
          <div className="print-ticket-root" style={{ position: 'absolute', left: '-9999px', top: 0, width: '302px', pointerEvents: 'none' }}>
            <QuotePrintView ref={printRef} quote={currentQuote} />
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
              <h2 className="text-base font-bold mb-2">¿Eliminar cotización?</h2>
              <p className="text-sm text-gray-600 mb-4">Esta acción no se puede deshacer.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    try {
                      await deleteQuote(currentQuote.id);
                      navigate('/quotes');
                    } catch { /* handled */ }
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal convertir a orden */}
        {showConvertModal && (
          <div className="fixed px-4 inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm">
              <h2 className="text-base font-bold mb-2">¿Convertir a orden?</h2>
              <p className="text-sm text-gray-600 mb-4">
                Se creará una orden de venta con estos mismos productos y se descontará del inventario.
                La cotización quedará marcada como convertida y no se podrá editar.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowConvertModal(false)} disabled={converting}>Cancelar</Button>
                <Button variant="primary" size="sm" onClick={handleConvert} loading={converting} disabled={converting}>
                  {converting ? 'Convirtiendo…' : 'Convertir'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteDetail;
