import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Edit, Trash2, Phone, MapPin, Hash, ShoppingCart } from 'lucide-react';
import { Customer } from '../../types/customer';
import { db } from '../../database/LocalDatabase';
import Button from '../ui/Button';

interface Props {
  customer: Customer | null;
  onClose: () => void;
  onEdit?: (c: Customer) => void;
  onDelete?: (c: Customer) => void;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  totalAmount: number;
  status: string;
  createdAt?: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', processing: 'En proceso', completed: 'Completada', cancelled: 'Cancelada',
};

/**
 * Panel lateral del cliente (mismo patrón que el de Productos): acoplado a la
 * derecha en pantallas ≥1280px y como diálogo encima en pantallas menores.
 * Las últimas órdenes salen de las guardadas en este equipo (IndexedDB), así
 * que funciona sin conexión.
 */
const CustomerDetailsPanel: React.FC<Props> = ({ customer, onClose, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const [docked, setDocked] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setDocked(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!customer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [customer, onClose]);

  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  useEffect(() => {
    setOrders(null);
    if (!customer) return;
    let alive = true;
    db.orders
      .where('customerId').equals(customer.id)
      .filter(o => !o.deletedAt)
      .toArray()
      .then(list => {
        if (!alive) return;
        const recent = list
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 5)
          .map(o => ({ id: o.serverId ?? o.id!, orderNumber: o.orderNumber, totalAmount: Number(o.totalAmount), status: o.status, createdAt: o.createdAt }));
        setOrders(recent);
      })
      .catch(() => { if (alive) setOrders([]); });
    return () => { alive = false; };
  }, [customer]);

  if (!customer) return null;
  const balance = Number(customer.creditBalance ?? 0);

  return (
    <div
      className={docked ? 'fixed inset-y-0 right-0 z-30 w-[28rem]' : 'fixed inset-0 z-50'}
      role={docked ? 'complementary' : 'dialog'}
      aria-modal={docked ? undefined : true}
      aria-labelledby="customer-panel-title"
    >
      {!docked && <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} aria-hidden="true" />}
      <aside className={`absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-white flex flex-col ${docked ? 'border-l border-gray-200' : 'shadow-xl animate-slide-in-right'}`}>
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 id="customer-panel-title" className="text-lg font-semibold text-gray-900 leading-snug break-words">{customer.name}</h2>
            {customer.code && <p className="text-sm text-gray-600 font-mono">{customer.code}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          <div className={`rounded-lg p-3 ${balance > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <p className="text-xs font-medium text-gray-700">Saldo por cobrar</p>
            <p className={`text-2xl font-bold tabular-nums ${balance > 0 ? 'text-amber-900' : 'text-gray-900'}`}>{money(balance)}</p>
          </div>

          <dl className="space-y-2 text-sm text-gray-800">
            {customer.nit && (
              <div className="flex items-center gap-2"><dt className="sr-only">NIT/CC</dt><Hash className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{customer.nit}</dd></div>
            )}
            {customer.contact && (
              <div className="flex items-center gap-2"><dt className="sr-only">Contacto</dt><Phone className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{customer.contact}</dd></div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2"><dt className="sr-only">Dirección</dt><MapPin className="w-4 h-4 text-gray-500" aria-hidden="true" /><dd>{customer.address}</dd></div>
            )}
          </dl>
          {customer.note && <p className="text-sm text-gray-700 italic">{customer.note}</p>}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Últimas órdenes</h3>
            {orders === null ? (
              <p className="text-sm text-gray-600">Cargando…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-gray-600">Sin órdenes guardadas en este equipo.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                {orders.map(o => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${o.id}`)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="font-mono font-semibold text-gray-900">#{o.orderNumber}</span>
                        <span className="block text-xs text-gray-600">
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : ''} · {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold text-gray-900">{money(o.totalAmount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100 flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={ShoppingCart}
            className="flex-1 min-h-[44px]"
            onClick={() => navigate('/orders/new', { state: { customer } })}
          >
            Nueva orden
          </Button>
          {onEdit && (
            <Button variant="outline" icon={Edit} className="min-h-[44px]" onClick={() => onEdit(customer)}>Editar</Button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(customer)}
              aria-label={`Eliminar ${customer.name}`}
              className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};

export default CustomerDetailsPanel;
