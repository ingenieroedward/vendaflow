import { z } from 'zod';
import { orderItemSchema } from '../order/order.dto';

export const posPaymentLineSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'other']),
  amount: z.number().positive('El monto del pago debe ser mayor a 0'),
});
export type PosPaymentLineDto = z.infer<typeof posPaymentLineSchema>;

// Venta de mostrador: siempre de contado, siempre asociada al turno de caja
// abierto. Sin customerId = "Consumidor final" (se resuelve/crea en el service).
// payments: desglose del pago (puede ser mixto — parte efectivo, parte
// tarjeta) y debe sumar exacto al total de los items. cashReceived: efectivo
// físico que entregó el cliente (solo si hay una línea 'cash'), para calcular
// el vuelto — es informativo, no afecta lo que queda registrado como pago.
export const posSaleSchema = z.object({
  customerId: z.number().positive().optional(),
  items: z.array(orderItemSchema).min(1, 'Agrega al menos un producto'),
  payments: z.array(posPaymentLineSchema).min(1, 'Agrega al menos un método de pago'),
  cashReceived: z.number().nonnegative().optional(),
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
