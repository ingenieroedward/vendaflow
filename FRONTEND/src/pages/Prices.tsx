import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Plus, Search, X, Edit, Trash2, DollarSign,
  AlertTriangle, ChevronDown, ChevronUp, Truck, WifiOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/products';
import { Product, Supplier, Price, CreatePriceRequest } from '../types';
import { useUIStore } from '../store/uiStore';
import { db } from '../database/LocalDatabase';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

type PriceModal =
  | { mode: 'create'; product: Product }
  | { mode: 'edit'; price: Price; product: Product };

const formatPrice = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const Prices: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<PriceModal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ price: Price; productName: string } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        setIsOffline(true);
        const [localProds, localSups, localPrices] = await Promise.all([
          db.products.filter(p => !p.deletedAt).toArray(),
          db.suppliers.filter(s => !s.deletedAt).toArray(),
          db.prices.filter(p => !p.deletedAt).toArray(),
        ]);

        const mappedSuppliers: Supplier[] = localSups.map(s => ({
          id: s.serverId ?? s.id!,
          name: s.name,
          contact: s.contact,
          location: s.location,
          createdAt: s.createdAt ?? '',
          updatedAt: s.updatedAt ?? '',
        }));
        const supplierMap = new Map(mappedSuppliers.map(s => [s.id, s]));

        const mappedProducts: Product[] = localProds.map(p => {
          const prodId = p.serverId ?? p.id!;
          const productPrices: Price[] = localPrices
            .filter(lp => lp.productId === prodId)
            .map(lp => ({
              id: lp.serverId ?? lp.id!,
              productId: prodId,
              supplierId: lp.supplierId,
              price: lp.price,
              updatedByUserId: lp.updatedByUserId,
              createdAt: lp.createdAt ?? '',
              updatedAt: lp.updatedAt ?? '',
              supplier: supplierMap.get(lp.supplierId),
            }));
          return {
            id: prodId, name: p.name, code: p.code, unit: p.unit,
            salePrice: p.salePrice, categoryId: p.categoryId ?? null,
            createdAt: p.createdAt ?? '', updatedAt: p.updatedAt ?? '',
            prices: productPrices,
          };
        });

        setProducts(mappedProducts);
        setSuppliers(mappedSuppliers);
        return;
      }

      setIsOffline(false);
      const [prodRes, supRes] = await Promise.all([
        productService.getProducts(1, 500, true),
        productService.getSuppliers(1, 500),
      ]);
      setProducts(prodRes.data);
      setSuppliers(supRes.data);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudieron cargar los precios' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (product: Product) => {
    // Only show suppliers that don't already have a price for this product
    const usedSupplierIds = new Set((product.prices ?? []).map(p => p.supplierId));
    const available = suppliers.filter(s => !usedSupplierIds.has(s.id));
    if (available.length === 0) {
      addNotification({ type: 'warning', title: 'Sin proveedores disponibles', message: 'Todos los proveedores ya tienen precio para este producto' });
      return;
    }
    setSelectedSupplierId(available[0].id);
    setPriceInput('');
    setModal({ mode: 'create', product });
  };

  const openEdit = (price: Price, product: Product) => {
    setSelectedSupplierId(price.supplierId);
    setPriceInput(String(price.price));
    setModal({ mode: 'edit', price, product });
  };

  const getAvailableSuppliers = () => {
    if (!modal) return suppliers;
    const usedIds = new Set(
      (modal.product.prices ?? [])
        .filter(p => modal.mode === 'edit' ? p.id !== modal.price.id : true)
        .map(p => p.supplierId)
    );
    return suppliers.filter(s => !usedIds.has(s.id));
  };

  const handleSave = async () => {
    const priceVal = parseFloat(priceInput);
    if (!modal || isNaN(priceVal) || priceVal <= 0 || !selectedSupplierId) return;
    setSaving(true);
    try {
      if (modal.mode === 'edit') {
        await productService.updatePrice(modal.price.id, { price: priceVal });
        addNotification({ type: 'success', title: 'Precio actualizado', message: modal.product.name });
      } else {
        const req: CreatePriceRequest = {
          productId: modal.product.id,
          supplierId: selectedSupplierId as number,
          price: priceVal,
        };
        await productService.createPrice(req);
        addNotification({ type: 'success', title: 'Precio creado', message: modal.product.name });
      }
      setModal(null);
      load();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo guardar el precio' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await productService.deletePrice(confirmDelete.price.id);
      setConfirmDelete(null);
      addNotification({ type: 'success', title: 'Precio eliminado', message: confirmDelete.productName });
      load();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el precio' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableSuppliers = getAvailableSuppliers();

  return (
    <div className="min-h-screen bg-gray-50 max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">Precios</h1>
          <p className="text-sm sm:text-lg text-gray-600 px-2">Compara y gestiona los precios por proveedor.</p>
        </div>
      </div>
      <div className="px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <p className="text-sm text-gray-500">{loading ? '...' : `${filtered.length} productos`}</p>
        </div>
      </div>

      {/* Offline banner */}
      {isOffline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Sin conexión — mostrando datos guardados localmente</span>
        </div>
      )}


      {/* List */}
      <div className="px-3 sm:px-6 lg:px-8 py-2 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Sin resultados para esa búsqueda' : 'Crea productos primero para gestionar sus precios'}
            </p>
          </div>
        ) : (
          filtered.map(product => {
            const prices = product.prices ?? [];
            const isOpen = expanded.has(product.id);
            return (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Product header row */}
                <button
                  onClick={() => toggleExpand(product.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">
                        {product.code}
                        {prices.length > 0 && (
                          <span className="ml-2 text-green-600 font-medium">
                            {prices.length} precio{prices.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {prices.length === 0 && (
                          <span className="ml-2 text-orange-500">Sin precios</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  }
                </button>

                {/* Expanded: prices list */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {prices.map(price => (
                      <div key={price.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 font-medium truncate">
                              {price.supplier?.name ?? `Proveedor #${price.supplierId}`}
                            </p>
                            <p className="text-base font-bold text-green-700">{formatPrice(price.price)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => openEdit(price, product)}
                            className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ price, productName: product.name })}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add price button */}
                    {suppliers.length > (new Set(prices.map(p => p.supplierId))).size && (
                      <button
                        onClick={() => openCreate(product)}
                        className="flex items-center space-x-2 w-full px-4 py-3 text-sm text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Agregar precio</span>
                      </button>
                    )}

                    {prices.length === 0 && (
                      <button
                        onClick={() => openCreate(product)}
                        className="flex items-center space-x-2 w-full px-4 py-3 text-sm text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Agregar primer precio</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="h-6" />

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!saving) setModal(null); }}>
          <div className="animate-slide-up w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{modal.mode === 'create' ? 'Agregar precio' : 'Editar precio'}</h3>
              <p className="text-sm text-gray-500 mb-5 truncate">{modal.product.name}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                  {modal.mode === 'edit' ? (
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                      {suppliers.find(s => s.id === modal.price.supplierId)?.name ?? `Proveedor #${modal.price.supplierId}`}
                    </div>
                  ) : (
                    <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary bg-white">
                      {availableSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP) *</label>
                  <Input type="number" inputMode="numeric" value={priceInput} onChange={e => setPriceInput(e.target.value)} placeholder="Ej: 15000" min="0" step="100" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { if (!saving) setModal(null); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" disabled={saving}>Cancelar</button>
                <button onClick={handleSave} disabled={saving || !priceInput || parseFloat(priceInput) <= 0} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!saving) setConfirmDelete(null); }}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Eliminar precio</h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                ¿Eliminar el precio de <span className="font-semibold text-gray-900">{confirmDelete.price.supplier?.name}</span> para <span className="font-semibold text-gray-900">{confirmDelete.productName}</span>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={saving}>Cancelar</button>
                <button onClick={handleDelete} disabled={saving} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">{saving ? 'Eliminando...' : 'Eliminar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prices;
