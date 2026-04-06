import React, { useState, useEffect, useRef } from 'react';
import { Search, User, X, Phone, MapPin, StickyNote } from 'lucide-react';
import { Customer } from '../../types/customer';

interface CustomerSearchProps {
  onCustomerSelect: (customer: Customer | null) => void;
  selectedCustomer?: Customer | null;
  customers: Customer[];
  placeholder?: string;
  className?: string;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({
  onCustomerSelect,
  selectedCustomer,
  customers,
  placeholder = "Buscar cliente...",
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query with selected customer
  useEffect(() => {
    if (selectedCustomer) {
      setQuery(selectedCustomer.name);
    } else {
      setQuery('');
    }
  }, [selectedCustomer]);

  // Filter customers based on query
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(query.toLowerCase()) ||
    (customer.nit && customer.nit.toLowerCase().includes(query.toLowerCase())) ||
    (customer.contact && customer.contact.toLowerCase().includes(query.toLowerCase())) ||
    (customer.address && customer.address.toLowerCase().includes(query.toLowerCase()))
  );

  const handleCustomerSelect = (customer: Customer) => {
    console.log('Customer selected:', customer);
    onCustomerSelect(customer);
    setQuery(customer.name);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setQuery('');
    onCustomerSelect(null);
    setShowDropdown(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Clear selection if user is typing and it doesn't match selected customer
    if (selectedCustomer && value !== selectedCustomer.name) {
      onCustomerSelect(null);
    }
    
    setShowDropdown(value.length >= 2);
  };

  const handleInputFocus = () => {
    if (query.length >= 2) {
      setShowDropdown(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = inputRef.current?.closest('.customer-search-container');
      if (container && !container.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative customer-search-container ${className}`}>
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
            selectedCustomer 
              ? 'border-green-300 bg-green-50' 
              : 'border-gray-300'
          }`}
          placeholder={placeholder}
        />
        {(query || selectedCustomer) && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            type="button"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && !selectedCustomer && (
        <div className="absolute z-50 w-full mt-1 bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto border border-gray-200">
          {filteredCustomers.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              {query.length < 2 
                ? 'Escribe al menos 2 caracteres para buscar'
                : `No se encontraron clientes con "${query}"`
              }
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''} encontrado{filteredCustomers.length !== 1 ? 's' : ''}
              </div>
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-50 last:border-b-0"
                  type="button"
                >
                  <div className="flex items-center">
                    <User className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{customer.name}</div>
                      {customer.nit && (
                        <div className="text-xs text-gray-500 truncate">NIT/CC: {customer.nit}</div>
                      )}
                      {customer.contact && (
                        <div className="text-xs text-gray-500 truncate">{customer.contact}</div>
                      )}
                      {customer.address && (
                        <div className="text-xs text-gray-500 truncate">{customer.address}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Selected Customer Display */}
      {selectedCustomer && (
        <div className="mt-2 flex items-start gap-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{selectedCustomer.name}</p>
            {selectedCustomer.contact && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500 truncate">{selectedCustomer.contact}</p>
              </div>
            )}
            {selectedCustomer.address && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500 truncate">{selectedCustomer.address}</p>
              </div>
            )}
            {selectedCustomer.note && (
              <div className="flex items-center gap-1 mt-0.5">
                <StickyNote className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500 truncate">{selectedCustomer.note}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleClear}
            type="button"
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
            title="Cambiar cliente"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;