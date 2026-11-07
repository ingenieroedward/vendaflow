import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Save,
  Package,
  User,
  FileText,
  WifiOff,
  Eraser,
  CalendarClock,
} from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useQuoteStore } from "../store/quoteStore";
import { useProductStore } from "../store/productStore";
import { useCustomerStore } from "../store/customerStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import CustomerSearch from "../components/features/CustomerSearch";
import ProductSearch from "../components/features/ProductSearch";
import { removeMissingProduct } from '../utils/missingProduct';
import CustomerModal from "../components/ui/CustomerModal";
import { CreateQuoteRequest } from "../types/quote";
import { Product } from "../types";
import { Customer } from "../types/customer";
import { productService } from "../services/products";

interface QuoteLineItem {
  id: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate: number; // IVA rate (0-100)
  product: Product;
}

const DRAFT_KEY = 'quoteNewDraft';

const QuoteNew: React.FC = () => {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatus();
  const { user } = useAuthStore();
  const { createQuote, loading, error, clearError } = useQuoteStore();
  const { products, getProducts, loading: productsLoading } = useProductStore();
  const {
    customers,
    getCustomers,
    loading: customersLoading,
  } = useCustomerStore();
  const { addNotification } = useUIStore();

  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    getProducts(1, 2000, false);
    getCustomers(1, 2000);

    // Restore draft from previous session
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.quoteItems?.length > 0) setQuoteItems(draft.quoteItems);
        if (draft.selectedCustomer) setSelectedCustomer(draft.selectedCustomer);
        if (draft.notes) setNotes(draft.notes);
        if (draft.validUntil) setValidUntil(draft.validUntil);
      } catch { /* ignore corrupt draft */ }
    }
  }, [getProducts, getCustomers]);

  // Auto-save draft on every change
  useEffect(() => {
    if (quoteItems.length === 0 && !selectedCustomer && !notes) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ quoteItems, selectedCustomer, notes, validUntil }));
  }, [quoteItems, selectedCustomer, notes, validUntil]);

  // Elegir un producto lo agrega de una vez (cantidad 1, precio e IVA de la
  // ficha); si ya está, suma una unidad
  const handleProductSelect = (product: Product | null) => {
    if (!product) return;
    setQuoteItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${product.id}`,
          productId: product.id,
          quantity: 1,
          unitPrice: Number(product.salePrice) || 0,
          taxRate: Number(product.taxRate ?? 0),
          product,
        },
      ];
    });
  };

  const handleRemoveItem = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setQuoteItems((prev) => prev.filter((item) => item.id !== id));
  };

  const stepQuantity = (id: string, delta: number) => {
    setQuoteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    );
  };

  const updateQuoteItem = (
    id: string,
    field: keyof QuoteLineItem,
    value: number
  ) => {
    setQuoteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateSubtotal = () => {
    return quoteItems.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0
    );
  };

  const calculateTotalTax = () => {
    return quoteItems.reduce((total, item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      return total + itemSubtotal * (item.taxRate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTotalTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (quoteItems.length === 0) {
      addNotification({
        type: "error",
        title: "Error",
        message: "Debes agregar al menos un producto a la cotización",
      });
      return;
    }

    if (!selectedCustomer) {
      addNotification({
        type: "error",
        title: "Error",
        message: "Debes seleccionar un cliente",
      });
      return;
    }

    const quoteData: CreateQuoteRequest = {
      customerId: selectedCustomer.id,
      userId: user?.id,
      items: quoteItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })),
      notes: notes.trim() || undefined,
      validUntil: validUntil || undefined,
    };

    try {
      const newQuote = await createQuote(quoteData);
      localStorage.removeItem(DRAFT_KEY);
      const isLocalQuote = (newQuote as any)._isLocal;

      if (isLocalQuote) {
        addNotification({
          type: "warning",
          title: "Cotización guardada sin conexión",
          message: "Se sincronizará automáticamente cuando haya internet",
        });
        navigate("/quotes");
      } else {
        addNotification({
          type: "success",
          title: "Cotización creada",
          message: "La cotización se ha creado correctamente",
        });
        navigate(`/quotes/${newQuote.id}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al crear la cotización';
      // Producto eliminado (típico de un borrador viejo): quitarlo para no quedar
      // atascado — el borrador se actualiza solo al cambiar los ítems.
      const fixed = removeMissingProduct(msg, quoteItems);
      if (fixed) {
        setQuoteItems(fixed.items);
        clearError(); // el aviso de abajo reemplaza el error crudo del store
        addNotification({
          type: 'warning',
          title: 'Producto no disponible',
          message: `"${fixed.productName}" ya no existe y se quitó de la cotización. Revisa y vuelve a guardar.`,
        });
        return;
      }
      addNotification({ type: 'error', title: 'Error', message: msg });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
    }).format(amount);
  };

  const handleCreateCustomer = () => {
    setShowCustomerModal(true);
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setSelectedCustomer(newCustomer);
    setShowCustomerModal(false);
  };

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setQuoteItems([]);
    setSelectedCustomer(null);
    setNotes('');
    setValidUntil('');
  };

  const hasDraft = quoteItems.length > 0 || !!selectedCustomer || !!notes;

  const handleBack = () => {
    navigate("/quotes");
  };

  // Qué falta para poder crear la cotización (antes el botón solo se deshabilitaba)
  const missing: string[] = [];
  if (!selectedCustomer) missing.push("elige un cliente");
  if (quoteItems.length === 0) missing.push("agrega al menos un producto");
  if (quoteItems.some((i) => i.unitPrice <= 0 || i.quantity <= 0)) missing.push("revisa cantidades y precios");
  const canSubmit = missing.length === 0 && !loading;
  const total = calculateTotal();
  const submitLabel = loading
    ? "Creando…"
    : quoteItems.length > 0
      ? `Crear cotización por ${formatCurrency(total)}`
      : "Crear cotización";

  const inputBase =
    "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="px-3 sm:px-6 py-4 sm:py-6 max-w-6xl mx-auto pb-40 md:pb-8">
        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver a cotizaciones"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0 truncate">Nueva cotización</h1>
          {hasDraft && (
            <button
              type="button"
              onClick={handleClearDraft}
              className="flex items-center gap-1.5 min-h-[44px] px-3 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            >
              <Eraser className="w-4 h-4" aria-hidden="true" />
              Limpiar borrador
            </button>
          )}
        </div>

        {/* Banner sin conexión */}
        {isOffline && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg" role="status">
            <WifiOff className="w-4 h-4 text-amber-700 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-900 flex-1">
              Sin conexión — la cotización se guarda en este equipo y se envía sola cuando vuelva internet.
            </p>
          </div>
        )}

        {error && (
          <ErrorMessage message={error} onDismiss={clearError} className="mb-4" />
        )}

        <form id="quote-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 lg:gap-6 items-start">
          {/* ── Columna principal: cliente + productos ── */}
          <div className="space-y-4 min-w-0">
            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="sec-cliente">
              <div className="flex items-center justify-between mb-3">
                <h2 id="sec-cliente" className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  Cliente
                </h2>
                {!selectedCustomer && (
                  <button
                    type="button"
                    onClick={handleCreateCustomer}
                    className="flex items-center gap-1 min-h-[40px] px-2 text-sm text-primary font-medium rounded-lg hover:bg-primary/5"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Nuevo cliente
                  </button>
                )}
              </div>
              {customersLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm text-gray-600">Cargando clientes…</span>
                </div>
              ) : (
                <CustomerSearch
                  onCustomerSelect={setSelectedCustomer}
                  selectedCustomer={selectedCustomer}
                  customers={customers}
                  placeholder="Buscar cliente por nombre o NIT…"
                />
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200" aria-labelledby="sec-productos">
              <div className="p-4 border-b border-gray-100">
                <h2 id="sec-productos" className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  Productos
                  {quoteItems.length > 0 && (
                    <span className="text-sm font-normal text-gray-600">({quoteItems.length})</span>
                  )}
                </h2>
                {/* Buscador siempre listo: elegir o Enter agrega a la cotización */}
                {productsLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-gray-600">Cargando productos…</span>
                  </div>
                ) : (
                  <ProductSearch
                    onProductSelect={handleProductSelect}
                    selectedProduct={null}
                    products={products}
                    clearOnSelect
                    ariaLabel="Buscar producto para agregar"
                    placeholder="Busca o escanea un producto y presiona Enter"
                    searchFn={!isOffline ? (q) => productService.searchProducts(q, false) : undefined}
                  />
                )}
              </div>

              {quoteItems.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-600">
                  Aún no hay productos. Búscalos arriba: cada uno se agrega con cantidad 1 y su precio e IVA de la ficha.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {quoteItems.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
                    const stock = Number(item.product.stock ?? NaN);
                    const lowStock = Number.isFinite(stock) && Number(item.product.minStock ?? 0) > 0 && item.quantity > stock;
                    return (
                      <li key={item.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 leading-snug">{item.product.name}</p>
                            <p className="text-xs text-gray-600 font-mono">{item.product.code}</p>
                            {lowStock && (
                              <p className="mt-0.5 text-xs font-medium text-amber-900">Solo hay {stock} en stock</p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap tabular-nums pt-0.5">
                            {formatCurrency(lineTotal)}
                          </span>
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="min-h-[36px] px-2.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                              >
                                Quitar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[36px] px-2.5 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium hover:bg-gray-200"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label={`Quitar ${item.product.name}`}
                              className="-mr-2 -mt-1.5 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Cantidad con +/− (44px) · precio · IVA */}
                        <div className="mt-2 flex flex-wrap items-end gap-3">
                          <div>
                            <span className="block text-xs text-gray-600 mb-1" id={`qty-${item.id}`}>Cantidad</span>
                            <div className="flex items-center" role="group" aria-labelledby={`qty-${item.id}`}>
                              <button
                                type="button"
                                onClick={() => stepQuantity(item.id, -1)}
                                aria-label={`Una unidad menos de ${item.product.name}`}
                                className="w-11 h-11 flex items-center justify-center rounded-l-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                aria-label={`Cantidad de ${item.product.name}`}
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={(e) => updateQuoteItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                                min="1"
                                className="w-16 h-11 border-y border-gray-300 text-center text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                              />
                              <button
                                type="button"
                                onClick={() => stepQuantity(item.id, 1)}
                                aria-label={`Una unidad más de ${item.product.name}`}
                                className="w-11 h-11 flex items-center justify-center rounded-r-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="w-36">
                            <label htmlFor={`price-${item.id}`} className="block text-xs text-gray-600 mb-1">Precio unitario</label>
                            <input
                              id={`price-${item.id}`}
                              type="number"
                              inputMode="decimal"
                              value={item.unitPrice === 0 ? "" : item.unitPrice}
                              onChange={(e) => updateQuoteItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-full h-11 px-3 border border-gray-300 rounded-lg text-base sm:text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="w-24">
                            <label htmlFor={`tax-${item.id}`} className="block text-xs text-gray-600 mb-1">IVA %</label>
                            <input
                              id={`tax-${item.id}`}
                              type="number"
                              inputMode="decimal"
                              value={item.taxRate}
                              onChange={(e) => updateQuoteItem(item.id, "taxRate", parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              className="w-full h-11 px-3 border border-gray-300 rounded-lg text-base sm:text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* ── Columna lateral: pago + notas + resumen (fija en desktop) ── */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="sec-validez">
              <h2 id="sec-validez" className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-gray-500" aria-hidden="true" />
                Válida hasta <span className="text-sm text-gray-600 font-normal">(opcional)</span>
              </h2>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[7, 15, 30].map((d) => {
                  const target = new Date();
                  target.setDate(target.getDate() + d);
                  const targetStr = target.toISOString().slice(0, 10);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={validUntil === targetStr}
                      onClick={() => setValidUntil(targetStr)}
                      className={`min-h-[36px] px-3 rounded-full text-sm font-medium border transition-colors ${
                        validUntil === targetStr
                          ? "border-primary bg-primary/10 text-gray-900"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {d} días
                    </button>
                  );
                })}
              </div>
              <label htmlFor="valid-until" className="sr-only">Fecha de validez</label>
              <input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className={inputBase}
              />
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <label htmlFor="quote-notes" className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" aria-hidden="true" />
                Notas <span className="text-sm text-gray-600 font-normal">(opcional)</span>
              </label>
              <textarea
                id="quote-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`${inputBase} resize-none`}
                placeholder="Notas para esta cotización…"
              />
            </section>

            {/* Resumen + crear (en mobile el botón también va en la barra fija de abajo) */}
            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-label="Resumen de la cotización">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-700">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatCurrency(calculateSubtotal())}</dd>
                </div>
                <div className="flex justify-between text-gray-700">
                  <dt>IVA</dt>
                  <dd className="tabular-nums">{formatCurrency(calculateTotalTax())}</dd>
                </div>
                <div className="flex justify-between pt-2 mt-1 border-t border-gray-200 text-base font-bold text-gray-900">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCurrency(total)}</dd>
                </div>
              </dl>
              <div className="hidden md:block mt-4">
                <Button type="submit" variant="primary" icon={Save} loading={loading} disabled={!canSubmit} className="w-full min-h-[44px]">
                  {submitLabel}
                </Button>
                {missing.length > 0 && !loading && (
                  <p className="mt-2 text-sm text-gray-700" role="status">
                    Para crear la cotización: {missing.join(", ")}.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </form>

        {/* Barra fija en mobile, al alcance del pulgar (encima de la barra de navegación) */}
        <div
          className="md:hidden fixed inset-x-0 z-30 bg-white border-t border-gray-200 px-3 pt-2 pb-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          {missing.length > 0 && !loading && (
            <p className="mb-1.5 text-xs text-gray-700" role="status">Falta: {missing.join(", ")}.</p>
          )}
          <Button type="submit" form="quote-form" variant="primary" icon={Save} loading={loading} disabled={!canSubmit} className="w-full min-h-[48px]">
            {submitLabel}
          </Button>
        </div>

        {/* Customer Modal */}
        {showCustomerModal && (
          <CustomerModal
            onClose={() => setShowCustomerModal(false)}
            onCustomerCreated={handleCustomerCreated}
          />
        )}
      </div>
    </div>
  );
};

export default QuoteNew;
