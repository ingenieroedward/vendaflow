import { z } from 'zod';
import { orderItemSchema } from '../order/order.dto';

// Venta de mostrador: siempre de contado, siempre asociada al turno de caja
// abierto. Sin customerId = "Consumidor final" (se resuelve/crea en el service).
export const posSaleSchema = z.object({
  customerId: z.number().positive().optional(),
  items: z.array(orderItemSchema).min(1, 'Agrega al menos un producto'),
  notes: z.string().max(255).optional(),
});
export type PosSaleDto = z.infer<typeof posSaleSchema>;

export const openSessionSchema = z.object({
  openingAmount: z.number().min(0, 'El monto inicial debe ser mayor o igual a 0'),
  notes: z.string().max(255).optional(),
});
export type OpenSessionDto = z.infer<typeof openSessionSchema>;

export const closeSessionSchema = z.object({
  countedCash: z.number().min(0, 'El conteo de efectivo debe ser mayor o igual a 0'),
  notes: z.string().max(200).optional(),
});
export type CloseSessionDto = z.infer<typeof closeSessionSchema>;
