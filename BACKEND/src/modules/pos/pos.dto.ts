import { z } from 'zod';

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
