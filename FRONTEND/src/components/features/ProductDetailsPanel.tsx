import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Edit, ExternalLink, Package, MapPin } from 'lucide-react';
import { Product } from '../../types';
import Button from '../ui/Button';

interface ProductDetailsPanelProps {
  product: Product | null;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

// Panel lateral derecho con el resumen del producto: se abre al hacer clic en una
// fila de la lista, sin salir de la búsqueda. En mobile ocupa toda la pantalla.
const ProductDetailsPanel: React.FC<ProductDetailsPanelProps> = ({ product, onClose }) => {
  const navigate = useNavigate();

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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="product-panel-title">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} aria-hidden="true" />

      <aside className="absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-white shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-gray-100">
          <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="product-panel-title" className="text-base sm:text-lg font-semibold text-gray-900 leading-snug break-words">
              {product.name}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-mono text-primary">{product.code}</span>
              <span className="text-gray-300 mx-1.5">•</span>
              {product.unit}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
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
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{p.supplier?.name ?? 'Proveedor'}</span>
                      {i === 0 && prices.length > 1 && (
                        <span className="flex-shrink-0 text-[10px] font-semibold uppercase text-green-700 bg-green-100 rounded px-1.5 py-0.5">Mejor</span>
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

          <p className="text-xs text-gray-400">Actualizado el {formatDate(product.updatedAt)}</p>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-100 flex gap-2">
          <Button variant="primary" icon={Edit} className="flex-1" onClick={() => navigate(`/products/${product.id}/edit`)}>
            Editar
          </Button>
          <Button variant="outline" icon={ExternalLink} onClick={() => navigate(`/products/${product.id}`)}>
            Ver ficha
          </Button>
        </div>
      </aside>
    </div>
  );
};

export default ProductDetailsPanel;
