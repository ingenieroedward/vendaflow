import React from 'react';
import { MapPin, User, Calendar } from 'lucide-react';
import { Price } from '../../types';
import { formatCurrency, formatDate } from '../../utils/helpers';

interface PriceTableProps {
  prices: Price[];
}

const PriceTable: React.FC<PriceTableProps> = ({ prices }) => {
  if (prices.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 text-center">
        <p className="text-gray-500 text-sm sm:text-base">No hay precios registrados</p>
      </div>
    );
  }

  const sortedPrices = [...prices].sort((a, b) => a.price - b.price);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Precios por proveedor ({prices.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actualizado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Por
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPrices.map((price, index) => (
                <tr key={price.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {price.supplier?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {price.supplier?.location}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span
                        className={`text-lg font-bold ${
                          index === 0
                            ? 'text-green-600'
                            : index === sortedPrices.length - 1 && sortedPrices.length > 1
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {formatCurrency(price.price)}
                      </span>
                      {index === 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Mejor precio
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(price.updatedAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {price.updatedByUser && (
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="w-4 h-4 mr-1" />
                        {price.updatedByUser.username}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/Tablet Cards */}
      <div className="md:hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">
            Precios ({prices.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {sortedPrices.map((price, index) => (
            <div key={price.id} className="p-4 hover:bg-gray-50 transition-colors duration-150">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center mb-1">
                    <MapPin className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {price.supplier?.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {price.supplier?.location}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center ml-3">
                  <span
                    className={`text-lg font-bold ${
                      index === 0
                        ? 'text-green-600'
                        : index === sortedPrices.length - 1 && sortedPrices.length > 1
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(price.price)}
                  </span>
                  {index === 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Mejor
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDate(price.updatedAt)}</span>
                </div>
                
                {price.updatedByUser && (
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate">{price.updatedByUser.username}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PriceTable;