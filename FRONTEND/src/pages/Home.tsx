import React, {  useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Package, TrendingUp } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useTenantStore } from '../store/tenantStore';
import { useAuthStore } from '../store/authStore';
import SearchBar from '../components/features/SearchBar';
import ProductCard from '../components/features/ProductCard';
import Pagination from '../components/features/Pagination';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import Button from '../components/ui/Button';

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

  useEffect(() => {
    if (!searchQuery) {
      getProducts(1,10,false);
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

  const handleProductClick = (productId: number) => {
    navigate(`/products/${productId}`);
  };

  const handleSearchResultClick = (productId: number) => {
    navigate(`/products/${productId}`);
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
          <div className="items-center flex justify-between space-x-2 sm:space-x-3">
              <Button
                variant="outline"
                icon={RefreshCw}
                onClick={handleRefresh}
                size="sm"
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                Actualizar
              </Button>
              {user?.role === 'admin' && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => navigate('/products/new')}
                  size="sm"
                  className="w-full sm:w-auto font-medium"
                >
                  Nuevo producto
                </Button>
              )}
          </div>
        </div>

        {/* Stats Cards - Optimizado para mobile */}
        {!showSearchResults && (
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white  rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center  gap-2 flex-wrap">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">P. Totales</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{pagination.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 mr-3" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Con precios</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {products.filter(p => p.prices && p.prices.length > 0).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 font-bold text-sm sm:text-base">%</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Cobertura</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {pagination.total > 0 
                      ? Math.round((products.filter(p => p.prices && p.prices.length > 0).length / pagination.total) * 100)
                      : 0
                    }%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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

              {/* Products Grid - Optimizado para mobile */}
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClick={() => handleProductClick(product.id)}
                     
                    />
                  ))}
                </div>
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
    </div>
  );
};

export default Home;