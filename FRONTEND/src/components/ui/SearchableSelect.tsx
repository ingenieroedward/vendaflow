import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, ChevronDown } from 'lucide-react';

interface SearchableSelectProps<T> {
  options: T[];
  selectedValue: T | null;
  onSelect: (value: T | null) => void;
  getLabel: (item: T) => string;
  placeholder?: string;
  className?: string;
  searchFn?: (query: string) => Promise<T[]>;
}

function SearchableSelect<T>({
  options,
  selectedValue,
  onSelect,
  getLabel,
  placeholder = 'Buscar...',
  className = '',
  searchFn,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [apiResults, setApiResults] = useState<T[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedValue) {
      setQuery(getLabel(selectedValue));
    } else {
      setQuery('');
    }
  }, [selectedValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  const localFiltered = options.filter(item =>
    getLabel(item).toLowerCase().includes(query.toLowerCase())
  );

  const displayed = searchFn ? (apiResults ?? []) : localFiltered;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (selectedValue) onSelect(null);

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

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery(getLabel(item));
    setShowDropdown(false);
    setApiResults(null);
  };

  const handleClear = () => {
    setQuery('');
    onSelect(null);
    setShowDropdown(false);
    setApiResults(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (query.length >= 2) setShowDropdown(true); }}
          placeholder={placeholder}
          className={`block w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            selectedValue ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white'
          }`}
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (query || selectedValue) ? (
            <button onClick={handleClear} type="button" className="p-0.5">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      {showDropdown && !selectedValue && (
        <div className="absolute z-50 w-full mt-1 bg-white shadow-lg max-h-60 rounded-lg py-1 text-sm overflow-auto border border-gray-200">
          {isSearching ? (
            <div className="px-4 py-3 text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          ) : displayed.length === 0 ? (
            <div className="px-4 py-3 text-gray-500">No se encontraron resultados</div>
          ) : (
            displayed.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {getLabel(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
