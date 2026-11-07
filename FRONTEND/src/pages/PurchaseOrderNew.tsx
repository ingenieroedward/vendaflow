import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2, ShoppingCart, AlertCircle, ArrowLeft, Package, Truck, FileText } from 'lucide-react';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';
import { Product, PurchaseOrderItem } from '../types';
import { productService } from '../services/products';
import Button from '../components/ui/Button';
import ProductSearch from '../components/features/ProductSearch';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface LocalItem extends Omit<PurchaseOrderItem, 'id'> {
  id: string;
  product: Product;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const inputBase =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';

/**
 * Nueva orden de compra con el mismo patrón que Nueva orden de venta: elegir
 * un producto (o Enter / lector de código) lo agrega con cantidad 1 y el
 * último costo conocido; cantidades y costos se ajustan en la línea.
 */
const PurchaseOrderNew: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const { create, loading } = usePurchaseOrderStore();
  const { products, getProducts } = useProductStore();
  const { isOffline } = useNetworkStatus();

  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [affectsStock, setAffectsStock] = useState(true);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [costs, setCosts] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProducts(1, 2000, false);
    productService.getSuppliers(1, 200).then(r => setSupplierOptions(r.data)).catch(() => setSupplierOptions([]));
    // Último costo de compra (o menor precio de proveedor) para prellenar el costo
    productService.getCosts().then(setCosts).catch(() => setCosts({}));
  }, [getProducts]);

  const handleProductSelect = (product: Product | null) => {
    if (!product) return;
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.id === existing.id
          ? { ...i, quantity: i.quantity + 1, totalCost: (i.quantity + 1) * i.unitCost }
          : i);
      }
      const unitCost = Number(costs[product.id] ?? 0);
      return [...prev, { id: `${Date.now()}-${product.id}`, productId: product.id, quantity: 1, unitCost, totalCost: unitCost, product }];
    });
  };

  const handleRemoveItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const handleUpdateItem = (id: string, field: 'quantity' | 'unitCost', value: number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      return { ...updated, totalCost: updated.quantity * updated.unitCost };
    }));
  };

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const missing: string[] = [];
  if (!supplierId) missing.push('elige el proveedor');
  if (items.length === 0) missing.push('agrega al menos un producto');
  if (items.some(i => i.quantity <= 0)) missing.push('revisa las cantidades');
  const canSubmit = missing.length === 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) { setError(`Para crear la compra: ${missing.join(', ')}.`); return; }
    setError(null);
    try {
      const po = await create({
        supplierId: Number(supplierId),
        notes: notes || undefined,
        status: 'draft',
        affectsStock,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      addNotification({ type: 'success', message: `Compra ${po.poNumber} creada` });
      navigate('/purchase-orders');
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al crear la compra');
    }
  };

  const submitLabel = loading ? 'Creando…' : items.length > 0 ? `Crear compra por ${money(totalAmount)}` : 'Crear compra';

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-40 md:pb-8">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            aria-label="Volver a órdenes de compra"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Nueva orden de compra</h1>
            <p className="text-sm text-gray-600">Registra lo que le compras a un proveedor.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 lg:gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <label htmlFor="po-supplier" className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-gray-500" aria-hidden="true" /> Proveedor
              </label>
              <select
                id="po-supplier"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                className={`${inputBase} bg-white`}
              >
                <option value="">Elige un proveedor…</option>
                {supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {supplierOptions.length === 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  No hay proveedores. <button type="button" onClick={() => navigate('/suppliers')} className="text-primary underline">Crea uno</button>.
                </p>
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200" aria-labelledby="po-items">
              <div className="p-4 border-b border-gray-100">
                <h2 id="po-items" className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-gray-500" aria-hidden="true" /> Productos
                  {items.length > 0 && <span className="text-sm font-normal text-gray-600">({items.length})</span>}
                </h2>
                <ProductSearch
                  onProductSelect={handleProductSelect}
                  selectedProduct={null}
                  products={products}
                  clearOnSelect
                  ariaLabel="Buscar producto para agregar a la compra"
                  placeholder="Busca o escanea un producto y presiona Enter"
                  searchFn={!isOffline ? (q) => productService.searchProducts(q, false) : undefined}
                />
              </div>

              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-600">
                  Aún no hay productos. Cada uno se agrega con cantidad 1 y su último costo conocido.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map(item => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                          <p className="text-xs text-gray-600 font-mono">{item.product.code}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums pt-0.5">{money(item.quantity * item.unitCost)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Quitar ${item.product.name}`}
                          className="-mr-2 -mt-1.5 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <div>
                          <span className="block text-xs text-gray-600 mb-1" id={`poq-${item.id}`}>Cantidad</span>
                          <div className="flex items-center" role="group" aria-labelledby={`poq-${item.id}`}>
                            <button type="button" onClick={() => handleUpdateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                              aria-label={`Una unidad menos de ${item.product.name}`}
                              className="w-11 h-11 flex items-center justify-center rounded-l-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number" inputMode="decimal" min="1"
                              aria-label={`Cantidad de ${item.product.name}`}
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-16 h-11 border-y border-gray-300 text-center text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                            />
                            <button type="button" onClick={() => handleUpdateItem(item.id, 'quantity', item.quantity + 1)}
                              aria-label={`Una unidad más de ${item.product.name}`}
                              className="w-11 h-11 flex items-center justify-center rounded-r-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="w-40">
                          <label htmlFor={`poc-${item.id}`} className="block text-xs text-gray-600 mb-1">Costo unitario</label>
                          <input
                            id={`poc-${item.id}`}
                            type="number" inputMode="decimal" min="0"
                            value={item.unitCost === 0 ? '' : item.unitCost}
                            onChange={e => handleUpdateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full h-11 px-3 border border-gray-300 rounded-lg text-base sm:text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={affectsStock}
                  onChange={e => setAffectsStock(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-400 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-900">
                  Sumar al inventario al recibir
                  <span className="block text-xs text-gray-600 mt-0.5">
                    Desmárcalo si el stock ya fue cargado (ej. carga inicial) y solo registras la compra por costos.
                  </span>
                </span>
              </label>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <label htmlFor="po-notes" className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" aria-hidden="true" />
                Notas <span className="text-sm text-gray-600 font-normal">(opcional)</span>
              </label>
              <textarea
                id="po-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones de la compra…"
                className={`${inputBase} resize-none`}
              />
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4" aria-label="Resumen de la compra">
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span className="tabular-nums">{money(totalAmount)}</span>
              </div>
              <div className="hidden md:block mt-4">
                <Button variant="primary" icon={ShoppingCart} onClick={handleSubmit} loading={loading} disabled={!canSubmit} className="w-full min-h-[44px]">
                  {submitLabel}
                </Button>
                {missing.length > 0 && !loading && (
                  <p className="mt-2 text-sm text-gray-700" role="status">Para crear la compra: {missing.join(', ')}.</p>
                )}
              </div>
            </section>
          </aside>
        </div>

        <div
          className="md:hidden fixed inset-x-0 z-30 bg-white border-t border-gray-200 px-3 pt-2 pb-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          {missing.length > 0 && !loading && <p className="mb-1.5 text-xs text-gray-700" role="status">Falta: {missing.join(', ')}.</p>}
          <Button variant="primary" icon={ShoppingCart} onClick={handleSubmit} loading={loading} disabled={!canSubmit} className="w-full min-h-[48px]">
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderNew;
