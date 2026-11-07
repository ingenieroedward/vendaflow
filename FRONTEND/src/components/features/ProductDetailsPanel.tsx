import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Edit, ExternalLink, Package, MapPin, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import { Product, StockMovement } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { productService } from '../../services/products';
import Button from '../ui/Button';

interface ProductDetailsPanelProps {
  product: Product | null;
  onClose: () => void;
  /** Se llama tras ajustar el stock, con el producto actualizado */
  onProductChanged?: (product: Product) => void;
}

const MOVEMENT_LABEL: Record<StockMovement['type'], string> = {
  sale: 'Venta',
  purchase: 'Compra',
  adjustment: 'Ajuste',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

// Panel lateral derecho con el resumen del producto: se abre al hacer clic en una
// fila de la lista, sin salir de la búsqueda. En mobile ocupa toda la pantalla.
const ProductDetailsPanel: React.FC<ProductDetailsPanelProps> = ({ product, onClose, onProductChanged }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const role = user?.role ?? '';
  const canSell = role === 'seller' || role === 'admin';
  const canManage = role === 'buyer' || role === 'admin';

  // Últimos movimientos del kardex (solo vendedor/admin, solo con conexión)
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  useEffect(() => {
    setMovements(null);
    if (!product || !canSell || !navigator.onLine) return;
    let alive = true;
    productService.getProductMovements(product.id, 5)
      .then((m) => { if (alive) setMovements(m); })
      .catch(() => { if (alive) setMovements([]); });
    return () => { alive = false; };
  }, [product?.id, canSell]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajuste de stock: se digita el conteo real y se guarda la diferencia
  const [adjusting, setAdjusting] = useState(false);
  const [counted, setCounted] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAdjusting(false); setCounted(''); setAdjustNote(''); }, [product?.id]);

  const saveAdjustment = async () => {
    if (!product) return;
    const target = Number(counted);
    if (counted === '' || !Number.isFinite(target)) return;
    const delta = Math.round((target - Number(product.stock ?? 0)) * 100) / 100;
    if (delta === 0) { setAdjusting(false); return; }
    setSaving(true);
    try {
      const updated = await productService.adjustStock(product.id, delta, adjustNote.trim() || 'Ajuste desde Productos');
      addNotification({ type: 'success', title: 'Stock actualizado', message: `${product.name}: ${target}` });
      setAdjusting(false); setCounted(''); setAdjustNote('');
      onProductChanged?.({ ...product, stock: Number(updated?.stock ?? target) });
      if (canSell) productService.getProductMovements(product.id, 5).then(setMovements).catch(() => {});
    } catch (err: unknown) {
      addNotification({ type: 'error', title: 'No se pudo ajustar el stock', message: (err as { message?: string })?.message });
    } finally {
      setSaving(false);
    }
  };
  // ≥1280px: panel acoplado a la derecha (la lista se corre, no se tapa);
  // en pantallas menores sigue siendo un diálogo encima de la lista
  const [docked, setDocked] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setDocked(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  if (!product) return null;

  const prices = [...(product.prices ?? [])].sort((a, b) => a.price - b.price);
  const minCost = prices[0]?.price ?? null;
  const maxCost = prices[prices.length - 1]?.price ?? null;
  const margin = minCost !== null && product.salePrice > 0
    ? Math.round(((product.salePrice - minCost) / product.salePrice) * 100)
    : null;

  return (
    <div
      className={docked ? 'fixed inset-y-0 right-0 z-30 w-[28rem]' : 'fixed inset-0 z-50'}
      role={docked ? 'complementary' : 'dialog'}
      aria-modal={docked ? undefined : true}
      aria-labelledby="product-panel-title"
    >
      {!docked && <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} aria-hidden="true" />}

      <aside className={`absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-white flex flex-col ${docked ? 'border-l border-gray-200' : 'shadow-xl animate-slide-in-right'}`}>
        {/* Header */}
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-gray-100">
          <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="product-panel-title" className="text-base sm:text-lg font-semibold text-gray-900 leading-snug break-words">
              {product.name}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              <span className="font-mono text-primary">{product.code}</span>
              <span className="text-gray-300 mx-1.5">•</span>
              {product.unit}
              <span className="text-gray-300 mx-1.5">•</span>
              IVA {Number(product.taxRate ?? 0)}%{Number(product.taxRate ?? 0) > 0 && (product.priceIncludesTax === false ? ' (se suma)' : ' incluido')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <p className="text-xs font-medium text-primary uppercase">Precio de venta</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(product.salePrice)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Stock</p>
              <p className="text-xl font-bold text-gray-900">{Number(product.stock ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700 uppercase">Menor costo</p>
              <p className="text-lg font-bold text-green-700">{minCost !== null ? formatCurrency(minCost) : '—'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Margen</p>
              <p className={`text-lg font-bold ${margin !== null && margin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {margin !== null ? `${margin}%` : '—'}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Proveedores <span className="font-normal text-gray-500">({prices.length})</span>
              </h3>
              {maxCost !== null && minCost !== maxCost && (
                <span className="text-xs text-gray-500">Mayor: {formatCurrency(maxCost)}</span>
              )}
            </div>
            {prices.length > 0 ? (
              <ul className="space-y-1.5">
                {prices.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0 text-gray-700">
                      <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="truncate">{p.supplier?.name ?? 'Proveedor'}</span>
                      {i === 0 && prices.length > 1 && (
                        <span className="flex-shrink-0 text-xs font-semibold uppercase text-green-700 bg-green-100 rounded px-1.5 py-0.5">Mejor</span>
                      )}
                    </span>
                    <span className="font-medium text-gray-900 flex-shrink-0">{formatCurrency(p.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Sin precios de proveedores registrados.</p>
            )}
          </div>

          {canManage && (
            <div>
              {!adjusting ? (
                <button
                  type="button"
                  onClick={() => { setAdjusting(true); setCounted(String(Number(product.stock ?? 0))); }}
                  className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Ajustar stock
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="adj-count" className="block text-xs text-gray-600 mb-1">Stock real contado</label>
                      <input
                        id="adj-count"
                        type="number"
                        inputMode="decimal"
                        value={counted}
                        onChange={(e) => setCounted(e.target.value)}
                        className="w-full h-11 px-3 border border-gray-300 rounded-lg text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="adj-note" className="block text-xs text-gray-600 mb-1">Motivo (opcional)</label>
                      <input
                        id="adj-note"
                        value={adjustNote}
                        onChange={(e) => setAdjustNote(e.target.value)}
                        placeholder="Conteo, daño…"
                        className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Queda registrado en el kardex como ajuste.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" loading={saving} onClick={saveAdjustment} className="min-h-[40px]">Guardar</Button>
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(false)} className="min-h-[40px]">Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canSell && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Últimos movimientos</h3>
              {movements === null ? (
                <p className="text-sm text-gray-600">{navigator.onLine ? 'Cargando…' : 'Disponible con conexión.'}</p>
              ) : movements.length === 0 ? (
                <p className="text-sm text-gray-600">Sin movimientos todavía.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                  {movements.map((m) => {
                    const qty = Number(m.quantity);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium text-gray-900">{MOVEMENT_LABEL[m.type] ?? m.type}</span>
                          <span className="block text-xs text-gray-600 truncate">{formatDate(m.createdAt)}{m.notes ? ` · ${m.notes}` : ''}</span>
                        </span>
                        <span className={`tabular-nums font-semibold flex-shrink-0 ${qty < 0 ? 'text-red-700' : 'text-green-800'}`}>
                          {qty > 0 ? '+' : ''}{qty}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">Actualizado el {formatDate(product.updatedAt)}</p>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-100 flex flex-wrap gap-2">
          {canSell && (
            <Button
              variant="primary"
              icon={ShoppingCart}
              className="flex-1 min-h-[44px]"
              onClick={() => navigate('/orders/new', { state: { addProduct: product } })}
            >
              Agregar a una orden
            </Button>
          )}
          {canManage && (
            <Button
              variant={canSell ? 'outline' : 'primary'}
              icon={Edit}
              className={`min-h-[44px] ${canSell ? '' : 'flex-1'}`}
              onClick={() => navigate(`/products/${product.id}/edit`)}
            >
              Editar
            </Button>
          )}
          <Button variant="outline" icon={ExternalLink} className="min-h-[44px]" onClick={() => navigate(`/products/${product.id}`)}>
            Ver ficha
          </Button>
        </div>
      </aside>
    </div>
  );
};

export default ProductDetailsPanel;
