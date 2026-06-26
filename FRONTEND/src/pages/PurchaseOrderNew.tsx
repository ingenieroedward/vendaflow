import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ShoppingCart, AlertCircle, ChevronDown, ArrowLeft } from 'lucide-react';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useProductStore } from '../store/productStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Product, PurchaseOrderItem } from '../types';
import { productService } from '../services/products';
import Button from '../components/ui/Button';
import SearchableSelect from '../components/ui/SearchableSelect';

interface LocalItem extends Omit<PurchaseOrderItem, 'id'> {
  id: string;
  product: Product;
}

const PurchaseOrderNew: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { create, loading } = usePurchaseOrderStore();
  const { products, getProducts } = useProductStore();

  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LocalItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProducts(1, 2000, false);
    productService.getSuppliers(1, 200).then(r => setSupplierOptions(r.data));
  }, [getProducts]);

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) return;
    const existing = items.find(i => i.productId === selectedProduct.id);
    if (existing) {
      setItems(prev => prev.map(i =>
        i.productId === selectedProduct.id
          ? { ...i, quantity: i.quantity + quantity, totalCost: (i.quantity + quantity) * i.unitCost }
          : i
      ));
    } else {
      setItems(prev => [...prev, {
        id: Date.now().toString(),
        productId: selectedProduct.id,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        product: selectedProduct,
      }]);
    }
    setSelectedProduct(null);
    setQuantity(1);
    setUnitCost(0);
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

  const handleSubmit = async () => {
    if (!supplierId) { setError('Selecciona un proveedor'); return; }
    if (items.length === 0) { setError('Agrega al menos un producto'); return; }
    setError(null);
    try {
      const po = await create({
        supplierId: Number(supplierId),
        notes: notes || undefined,
        status: 'draft',
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      addNotification({ type: 'success', message: `Orden ${po.poNumber} creada exitosamente` });
      navigate('/purchase-orders');
    } catch (err: any) {
      setError(err?.message ?? 'Error al crear la orden');
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Nueva Orden de Compra</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Registra la compra de productos a un proveedor</p>
        </div>
        <button
          onClick={() => navigate('/purchase-orders')}
          className="flex-shrink-0 flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors ml-2"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline text-sm">Volver</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Proveedor y notas */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Información general</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
            <div className="relative">
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar proveedor...</option>
                {supplierOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observaciones de la orden..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Agregar productos */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="font-semibold text-gray-800 mb-3">Agregar productos</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Producto</label>
            <SearchableSelect
              options={products}
              selectedValue={selectedProduct}
              onSelect={(p: Product | null) => {
                setSelectedProduct(p);
                if (p) setUnitCost(0);
              }}
              getLabel={(p: Product) => `${p.code} — ${p.name}`}
              placeholder="Buscar producto..."
              searchFn={(q) => productService.searchProducts(q, false)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={quantity === 0 ? '' : quantity}
              onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Costo unitario</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={unitCost === 0 ? '' : unitCost}
              onChange={e => setUnitCost(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={handleAddItem}
            disabled={!selectedProduct || quantity <= 0}
            className="flex items-center gap-2 text-sm"
          >
            <Plus size={15} /> Agregar producto
          </Button>
        </div>
      </div>

      {/* Tabla de items */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3">Productos en la orden ({items.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="py-2 text-left">Producto</th>
                  <th className="py-2 text-center w-24">Cantidad</th>
                  <th className="py-2 text-center w-28">Costo unit.</th>
                  <th className="py-2 text-right w-28">Total</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2">
                      <div className="font-medium text-gray-800">{item.product.name}</div>
                      <div className="text-xs text-gray-400">{item.product.code} · {item.product.unit}</div>
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={item.quantity}
                        onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitCost}
                        onChange={e => handleUpdateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="w-24 border border-gray-200 rounded px-2 py-1 text-center text-sm"
                      />
                    </td>
                    <td className="py-2 text-right font-medium">
                      ${(item.quantity * item.unitCost).toLocaleString('es-CO')}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="py-2 text-right font-semibold text-gray-700">Total orden:</td>
                  <td className="py-2 text-right font-bold text-lg text-indigo-700">
                    ${totalAmount.toLocaleString('es-CO')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/purchase-orders')}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <Button
          onClick={handleSubmit}
          disabled={loading || items.length === 0 || !supplierId}
          className="flex items-center gap-2"
        >
          <ShoppingCart size={16} />
          {loading ? 'Guardando...' : 'Crear Orden de Compra'}
        </Button>
      </div>
    </div>
  );
};

export default PurchaseOrderNew;
