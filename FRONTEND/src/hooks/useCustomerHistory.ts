import { useEffect, useState } from 'react';
import { db } from '../database/LocalDatabase';

export interface CustomerHistory {
  /** IDs de producto ordenados por cuántas órdenes del cliente los incluyen */
  topProductIds: number[];
  /** Fecha (ISO) de la orden más reciente del cliente, si hay */
  lastOrderAt: string | null;
}

/**
 * Historial de compras de un cliente a partir de las órdenes guardadas en este
 * equipo (IndexedDB): funciona sin conexión y sin endpoint nuevo. Es una ayuda
 * para vender más rápido ("lo que más compra"), no un reporte exacto.
 */
export function useCustomerHistory(customerId: number | null | undefined, limit = 6): CustomerHistory {
  const [history, setHistory] = useState<CustomerHistory>({ topProductIds: [], lastOrderAt: null });

  useEffect(() => {
    let alive = true;
    if (!customerId) {
      setHistory({ topProductIds: [], lastOrderAt: null });
      return;
    }
    (async () => {
      try {
        const orders = await db.orders
          .where('customerId').equals(customerId)
          .filter(o => !o.deletedAt && o.status !== 'cancelled')
          .toArray();
        // Los ítems pueden apuntar al id local o al del servidor según cómo se guardaron
        const orderIds = orders.flatMap(o => [o.id, o.serverId]).filter((x): x is number => typeof x === 'number');
        const items = orderIds.length
          ? await db.orderItems.where('orderId').anyOf(orderIds).filter(i => !i.deletedAt).toArray()
          : [];
        const counts = new Map<number, number>();
        for (const it of items) counts.set(it.productId, (counts.get(it.productId) ?? 0) + 1);
        const topProductIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
        const lastOrderAt = orders
          .map(o => o.createdAt)
          .filter((d): d is string => !!d)
          .sort()
          .pop() ?? null;
        if (alive) setHistory({ topProductIds, lastOrderAt });
      } catch {
        if (alive) setHistory({ topProductIds: [], lastOrderAt: null });
      }
    })();
    return () => { alive = false; };
  }, [customerId, limit]);

  return history;
}
