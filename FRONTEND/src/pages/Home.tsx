import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Package } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useTenantStore } from '../store/tenantStore';
import { useAuthStore } from '../store/authStore';
import SearchBar from '../components/features/SearchBar';
import ProductDetailsPanel from '../components/features/ProductDetailsPanel';
import ProductCard from '../components/features/ProductCard';
import Pagination from '../components/features/Pagination';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import Button from '../components/ui/Button';
import { Product } from '../types';

// Productos por página en la lista (antes 10 tarjetas grandes)
const PAGE_SIZE = 25;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const minCost = (p: Product) => (p.prices?.length ? Math.min(...p.prices.map(pr => pr.price)) : null);

// Stock con semáforo (solo con mínimo configurado): agotado / bajo / normal
const StockCell: React.FC<{ stock?: number; minStock?: number; unit: string }> = ({ stock = 0, minStock = 0 }) => {
  const n = Number(stock);
  const fmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
  // Solo alerta si el negocio configuró un mínimo: quien no lleva inventario
  // tiene todo en 0 y no debe ver "Agotado" en cada fila
  if (Number(minStock) <= 0) return <span className={n <= 0 ? 'text-gray-500' : 'text-gray-900'}>{fmt}</span>;
  if (n <= 0) return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Agotado</span>;
  if (n <= Number(minStock)) {
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800" title={`Mínimo: ${minStock}`}>{fmt} · bajo</span>;
  }
  return <span className="text-gray-900">{fmt}</span>;
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantStore();
  const { user } = useAuthStore();
  const {
    products, 
    loading, 
    error, 
    pagination, 
    searchQuery, 
    getProducts, 
    clearError 
  } = useProductStore();

  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    if (!searchQuery) {
      getProducts(1, PAGE_SIZE, false);
    }
  }, []);

  const handleRefresh = () => {
    if (searchQuery) {
      // If there's a search query, clear it and reload all products
      window.location.reload();
    } else {
      getProducts(pagination.page, pagination.limit, false);
    }
  };

  const handlePageChange = (page: number) => {
    getProducts(page, pagination.limit);
  };

  // Desktop: clic → panel de detalles a la derecha (sin salir de la lista).
  // Mobile: abre la ficha del producto, como siempre (decisión del usuario).
  const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

  const handleProductClick = (product: Product) => {
    if (isDesktop()) setSelected(product);
    else navigate(`/products/${product.id}`);
  };

  const handleSearchResultClick = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (product && isDesktop()) setSelected(product);
    else navigate(`/products/${productId}`);
  };

  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header - Optimizado para mobile */}
        <div className="mb-6 sm:mb-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="hidden sm:block text-3xl font-bold text-gray-900 mb-2">
              {tenant?.name ?? 'Merco'}
            </h1>
            <p className="text-sm sm:text-lg text-gray-600 px-2">
              Busca y compara precios de productos.
            </p>
          </div>

          {/* Search Bar - Prioridad en mobile */}
          <div className="mb-4 sm:mb-6">
            <SearchBar
              placeholder="Buscar productos..."
              onResultClick={handleSearchResultClick}
              autoFocus
            />
          </div>

          {/* Actions - Stack vertical en mobile */}
          <div className="items-center flex justify-between gap-2 sm:gap-3">
              {/* Antes: 3 tarjetas de indicadores calculadas solo sobre la página
                  visible (25) pero divididas por el total — cifras falsas. */}
              <p className="text-sm text-gray-600 tabular-nums mr-auto" aria-live="polite">
                {pagination.total} {pagination.total === 1 ? 'producto' : 'productos'}
              </p>
              <Button
                variant="outline"
                icon={RefreshCw}
                onClick={handleRefresh}
                size="sm"
                className="text-xs sm:text-sm"
              >
                Actualizar
              </Button>
              {user?.role === 'admin' && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => navigate('/products/new')}
                  size="sm"
                  className="font-medium"
                >
                  Nuevo producto
                </Button>
              )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorMessage
            message={error}
            onDismiss={clearError}
            onRetry={handleRefresh}
            className="mb-4 sm:mb-6"
          />
        )}

        {/* Content */}
        <div className="space-y-4 sm:space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-12 sm:py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Results Header - Más compacto en mobile */}
              {(products.length > 0 || showSearchResults) && (
                <div className="flex justify-between items-center px-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    {showSearchResults ? 'Resultados' : 'Productos'}
                    <span className="text-gray-500 font-normal ml-2 text-sm sm:text-base">
                      ({showSearchResults ? products.length : pagination.total})
                    </span>
                  </h2>
                </div>
              )}

              {/* Lista de productos: tabla en desktop, filas compactas en mobile */}
              {products.length > 0 ? (
                <>
                <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Código</th>
                        <th className="px-4 py-2.5 font-medium">Producto</th>
                        <th className="px-4 py-2.5 font-medium">Unidad</th>
                        <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                        <th className="px-4 py-2.5 font-medium text-right">Precio venta</th>
                        <th className="px-4 py-2.5 font-medium text-right">Menor costo</th>
                        <th className="px-4 py-2.5 font-medium text-right">Proveedores</th>
                        <th className="px-4 py-2.5 font-medium text-right">Actualizado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.map((product) => {
                        const cost = minCost(product);
                        const isSelected = selected?.id === product.id;
                        return (
                          <tr
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            // Fila operable con teclado (antes solo con mouse)
                            tabIndex={0}
                            aria-selected={isSelected}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProductClick(product); }
                            }}
                            className={`cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${isSelected ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs text-primary whitespace-nowrap">{product.code}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-900">{product.name}</td>
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{product.unit}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                              <StockCell stock={product.stock} minStock={product.minStock} unit={product.unit} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">{formatCurrency(product.salePrice)}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              {cost !== null ? <span className="text-green-700">{formatCurrency(cost)}</span> : <span className="text-gray-500">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{product.prices?.length ?? 0}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600 whitespace-nowrap">{formatDate(product.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: tarjetas, como antes */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onClick={() => handleProductClick(product)} />
                  ))}
                </div>
                </>
              ) : !loading && (
                <div className="text-center py-12 sm:py-16 px-4">
                  <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                    {showSearchResults ? 'No se encontraron productos' : 'No hay productos'}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-6 max-w-sm mx-auto">
                    {showSearchResults 
                      ? 'Intenta con otros términos de búsqueda'
                      : 'Comienza agregando tu primer producto'
                    }
                  </p>
                  {!showSearchResults && (
                    <Button
                      variant="primary"
                      icon={Plus}
                      onClick={() => navigate('/products/new')}
                      className="w-full sm:w-auto max-w-xs mx-auto"
                    >
                      Agregar producto
                    </Button>
                  )}
                </div>
              )}

              {/* Pagination - Más compacto en mobile */}
              {!showSearchResults && products.length > 0 && (
                <div className="mt-6 sm:mt-8">
                  <Pagination
                    pagination={pagination}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ProductDetailsPanel product={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default Home;