import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { debounce } from '../../utils/helpers';
import { DEBOUNCE_DELAY } from '../../utils/constants';

interface SearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  onResultClick?: (productId: number) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Buscar productos...',
  autoFocus = false,
  onResultClick,
}) => {
  const { searchQuery, setSearchQuery, searchProducts, products, loading } = useProductStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const debouncedSearch = debounce((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchProducts(query, false);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, DEBOUNCE_DELAY);

  useEffect(() => {
    debouncedSearch(localQuery);
  }, [localQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  };

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
    setShowResults(false);
  };

  const handleResultClick = (productId: number) => {
    setShowResults(false);
    onResultClick?.(productId);
  };

  const handleInputFocus = () => {
    if (localQuery.trim() && products.length > 0) {
      setShowResults(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding results to allow clicking on them
    setTimeout(() => setShowResults(false), 200);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
        <input
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3 text-base sm:text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-200"
        />
        {localQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        {loading && (
          <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Search Results */}
      {showResults && localQuery.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 sm:max-h-96 overflow-y-auto z-50">
          {products.length > 0 ? (
            <div className="py-1 sm:py-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleResultClick(product.id)}
                  className="w-full px-3 sm:px-4 py-3 sm:py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                        {product.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                        <span className="text-xs sm:text-sm font-medium text-blue-600">
                          {product.code}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-400">•</span>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {product.unit}
                        </span>
                        {product.category && (
                          <>
                            <span className="text-xs sm:text-sm text-gray-400">•</span>
                            <span className="text-xs sm:text-sm text-gray-500 truncate">
                              {product.category.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {product.prices && product.prices.length > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs sm:text-sm font-medium text-green-600">
                          {product.prices.length} precio{product.prices.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 sm:py-6 text-center text-gray-500">
              <Search className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm sm:text-base">No se encontraron productos</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Intenta con otros términos
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;