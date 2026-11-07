import React from 'react';

export interface SegmentedTab<K extends string> {
  key: K;
  label: string;
  icon?: React.ElementType;
  count?: number;
  /** Conteo que pide atención (ej. órdenes sin enviar): se pinta en ámbar */
  attention?: boolean;
}

interface Props<K extends string> {
  tabs: SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Control de pestañas único de la app (antes Órdenes, Informes e Inventario
 * tenían tres estilos distintos). Segmentado, con scroll horizontal contenido
 * en pantallas angostas para no desbordar la página.
 */
export function SegmentedTabs<K extends string>({ tabs, value, onChange, ariaLabel, className = '' }: Props<K>) {
  return (
    <div className={`-mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      <div role="tablist" aria-label={ariaLabel} className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => {
          const active = t.key === value;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 sm:px-4 min-h-[40px] text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    t.attention ? 'bg-amber-100 text-amber-900' : active ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SegmentedTabs;
