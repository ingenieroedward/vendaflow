import { Transaction } from 'sequelize';
import { Product } from './product.model';
import { NotFoundError } from '@/core/errors/AppError';

/**
 * Error 404 claro cuando un ítem (orden, cotización, compra) apunta a un producto
 * que no existe para el tenant. Caso típico: un borrador guardado en el navegador
 * con un producto que luego se eliminó. `deleteProduct` hace borrado lógico, así
 * que la búsqueda con `paranoid: false` encuentra el archivado y lo nombra.
 *
 * El sufijo "(ID n)" es un contrato con el frontend (`utils/missingProduct.ts`):
 * lo usa para quitar ese ítem del formulario. No cambiarlo sin actualizar ambos.
 */
export async function productNotFoundError(
  productId: number,
  tenantId: number,
  transaction?: Transaction,
): Promise<NotFoundError> {
  const deleted = await Product.findOne({
    where: { id: productId, tenantId },
    paranoid: false,
    attributes: ['name'],
    ...(transaction && { transaction }),
  });
  return new NotFoundError(
    deleted
      ? `El producto "${deleted.name}" fue eliminado y ya no está disponible (ID ${productId})`
      : `El producto ya no existe (ID ${productId})`,
  );
}

/**
 * Código con el que queda un producto eliminado (borrado lógico). Libera el código
 * original — el índice único (tenantId, code) incluye las filas eliminadas — y
 * deja visible en el historial qué pasó. Único por id; cabe en STRING(255).
 */
export function archivedProductCode(code: string, id: number): string {
  const suffix = ` (eliminado #${id})`;
  return code.slice(0, 255 - suffix.length) + suffix;
}
