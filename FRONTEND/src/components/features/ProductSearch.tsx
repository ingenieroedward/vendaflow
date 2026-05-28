import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, X, Loader2 } from 'lucide-react';
import { Product } from '../../types';

interface ProductSearchProps {
  onProductSelect: (product: Product | null) => void;
  selectedProduct?: Product | null;
  products: Product[];
  placeholder?: string;
  className?: string;
  /** When provided and online, called instead of filtering the local `products` array */
  searchFn?: (query: string) => Promise<Product[]>;
}

const ProductSearch: React.FC<ProductSearchProps> = ({
  onProductSelect,
  selectedProduct,
  products,
  placeholder = "Buscar producto...",
  className = "",
  searchFn,
}) => {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [apiResults, setApiResults] = useState<Product[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query with selected product
  useEffect(() => {
    if (selectedProduct) {
      setQuery(selectedProduct.name);
    } else {
      setQuery('');
    }
  }, [selectedProduct]);

  // Local filter (offline fallback)
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(query.toLowerCase()) ||
    product.code.toLowerCase().includes(query.toLowerCase())
  );

  // Displayed list: API results when searchFn provided, otherwise local filter
  const displayedProducts = searchFn ? (apiResults ?? []) : filteredProducts;

  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    setQuery(product.name);
    setShowDropdown(false);
    setApiResults(null);
  };

  const handleClear = () => {
    setQuery('');
    onProductSelect(null);
    setShowDropdown(false);
    setApiResults(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (selectedProduct && value !== selectedProduct.name) {
      onProductSelect(null);
    }

    if (value.length < 2) {
      setShowDropdown(false);
      setApiResults(null);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    setShowDropdown(true);

    if (searchFn) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchFn(value);
          setApiResults(results);
        } catch {
          setApiResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    }
  };

  const handleInputFocus = () => {
    if (query.length >= 2) {
      setShowDropdown(true);
    }
  };

  // Clear debounce on unmount
  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = inputRef.current?.closest('.product-search-container');
      if (container && !container.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
    }).format(amount);
  };

  return (
    <div className={`relative product-search-container ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className={`block w-full pl-10 pr-10 py-2 border rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
            selectedProduct 
              ? 'border-green-300 bg-green-50' 
              : 'border-gray-300'
          }`}
          placeholder={placeholder}
        />
        {isSearching ? (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          </div>
        ) : (query || selectedProduct) ? (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            type="button"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {showDropdown && !selectedProduct && (
        <div className="absolute z-50 w-full mt-1 bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto border border-gray-200">
          {isSearching ? (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              {`No se encontraron productos con "${query}"`}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                {displayedProducts.length} producto{displayedProducts.length !== 1 ? 's' : ''} encontrado{displayedProducts.length !== 1 ? 's' : ''}
              </div>
              {displayedProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-50 last:border-b-0"
                  type="button"
                >
                  <div className="flex items-center">
                    <Package className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{product.name}</div>
                      <div className="text-xs text-gray-500">Código: {product.code}</div>
                      <div className="text-xs text-green-600 font-medium">
                        Precio: {formatCurrency(product.salePrice)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Selected Product Display */}
      {selectedProduct && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-4 w-4 text-green-600 mr-2" />
              <div>
                <div className="font-medium text-green-900">{selectedProduct.name}</div>
                <div className="text-xs text-green-700">Código: {selectedProduct.code}</div>
                {selectedProduct.prices && selectedProduct.prices.length > 0 && (
                  <div className="text-xs text-green-700 font-medium">
                    Precio: {formatCurrency(selectedProduct.prices[0].price)}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleClear}
              className="text-green-600 hover:text-green-800"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSearch;