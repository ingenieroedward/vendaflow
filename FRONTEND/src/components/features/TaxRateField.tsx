import React from 'react';

// Tarifas de IVA vigentes en Colombia. Si el producto trae otra (dato viejo o
// importado), se muestra igual como opción para no perderla al guardar.
const RATES = [
  { value: 19, label: '19% — general' },
  { value: 5, label: '5% — tarifa diferencial' },
  { value: 0, label: '0% — exento o excluido' },
];

interface TaxRateFieldProps {
  value: number;
  onChange: (value: number) => void;
  id?: string;
}

export const TaxRateField: React.FC<TaxRateFieldProps> = ({ value, onChange, id = 'taxRate' }) => {
  const options = RATES.some(r => r.value === value)
    ? RATES
    : [...RATES, { value, label: `${value}%` }];
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        IVA
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-600">
        Se suma al precio de venta en órdenes y cotizaciones. El vendedor puede cambiarlo en cada línea.
      </p>
    </div>
  );
};

export default TaxRateField;
