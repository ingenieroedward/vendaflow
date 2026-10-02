import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

// Miga de pan para páginas de detalle: los ítems con `to` son links,
// el último (sin `to`) es la página actual
const Breadcrumbs: React.FC<{ items: Crumb[]; className?: string }> = ({ items, className = '' }) => (
  <nav className={`flex items-center gap-1 text-xs text-gray-400 overflow-x-auto whitespace-nowrap ${className}`}>
    {items.map((c, i) => (
      <React.Fragment key={`${c.label}-${i}`}>
        {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
        {c.to ? (
          <Link to={c.to} className="hover:text-primary transition-colors">{c.label}</Link>
        ) : (
          <span className="text-gray-600 font-medium truncate">{c.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export default Breadcrumbs;
