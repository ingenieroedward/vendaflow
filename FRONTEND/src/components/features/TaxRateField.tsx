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
  /** El precio de venta ya trae el IVA adentro */
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  id?: string;
}

export const TaxRateField: React.FC<TaxRateFieldProps> = ({ value, onChange, included, onIncludedChange, id = 'taxRate' }) => {
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
      {value > 0 && (
        <label className="mt-2 flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => onIncludedChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-400 text-primary focus:ring-primary"
          />
          <span>El precio de venta ya incluye el IVA</span>
        </label>
      )}
      <p className="mt-1 text-xs text-gray-600">
        {value === 0
          ? 'Sin IVA: se cobra el precio de venta tal cual.'
          : included
            ? 'Se cobra el precio de venta tal cual y el IVA se desglosa por dentro.'
            : 'El IVA se suma encima del precio de venta en órdenes, cotizaciones y POS.'}
      </p>
    </div>
  );
};

export default TaxRateField;
