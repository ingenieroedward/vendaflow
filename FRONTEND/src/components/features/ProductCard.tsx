import React from "react";
import { Package, Calendar, MapPin, TrendingUp, Edit } from "lucide-react";
import { Product } from "../../types";

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  className?: string;
  showPrice?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  className = "",
  //showPrice = true,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getMinMaxPrices = () => {
    if (!product.prices || product.prices.length === 0) {
      return { min: null, max: null };
    }

    const prices = product.prices.map(p => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  };

  const { min, max } = getMinMaxPrices();
  //const hasMultiplePrices = product.prices && product.prices.length > 1;

  return (
    
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 sm:p-6 transition-all duration-200 hover:shadow-md hover:border-blue-300 active:scale-[0.98] cursor-pointer ${className}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight truncate">
              {product.name}
            </h3>
            {/* Sale Price */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs sm:text-sm text-gray-500">Precio de venta:</span>
              <span className="text-base sm:text-lg font-semibold text-blue-600">
                {formatCurrency(product.salePrice)}
              </span>
            </div>
            {/* Code and Unit */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 mt-1">
              <span className="font-medium text-blue-600">{product.code}</span>
              <span className="text-gray-300">•</span>
              <span>{product.unit}</span>
            </div>
          </div>
        </div>
        
        {/* Date and Edit Button */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <div className="flex items-center text-xs sm:text-sm text-gray-500">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">{formatDate(product.updatedAt)}</span>
            <span className="sm:hidden">{new Date(product.updatedAt).getDate()}</span>
          </div>
          <button 
            className="p-1.5 sm:p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200 rounded-full hover:bg-gray-100 active:bg-gray-200" 
            title="Editar producto"
            onClick={(e) => {
              e.stopPropagation();
              // Aquí puedes agregar la lógica de edición
            }}
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Supplier Count and Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-medium text-gray-700">
            {product.prices?.length || 0} proveedor{product.prices?.length !== 1 ? 'es' : ''}
          </span>
          <div className="flex items-center text-green-600">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="text-xs sm:text-sm font-medium">Disponible</span>
          </div>
        </div>

        {/* Price Comparison */}
        {product.prices && product.prices.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="bg-green-50 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-green-600 font-medium uppercase">Menor</p>
              <p className="text-base sm:text-lg font-bold text-green-700 truncate">
                {formatCurrency(min || product.prices[0].price)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-blue-600 font-medium uppercase">Mayor</p>
              <p className="text-base sm:text-lg font-bold text-blue-700 truncate">
                {formatCurrency(max || product.prices[0].price)}
              </p>
            </div>
          </div>
        )}

        {/* Recent Suppliers */}
        {product.prices && product.prices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-medium text-gray-700">Proveedores recientes:</p>
            <div className="space-y-1">
              {product.prices.slice(0, 3).map((priceItem) => (
                <div key={priceItem.id} className="flex items-center justify-between text-xs sm:text-sm bg-gray-50 rounded-md p-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 truncate">{priceItem.supplier?.name}</span>
                  </div>
                  <span className="font-medium text-gray-900 flex-shrink-0 ml-2">
                    {formatCurrency(priceItem.price)}
                  </span>
                </div>
              ))}
              {product.prices.length > 3 && (
                <div className="text-xs text-gray-500 text-center pt-1">
                  +{product.prices.length - 3} más
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;