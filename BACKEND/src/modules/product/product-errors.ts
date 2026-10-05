import { Transaction } from 'sequelize';
import { Product } from './product.model';
import { NotFoundError } from '@/core/errors/AppError';

/**
 * Error 404 claro cuando un ítem (orden, cotización, compra) apunta a un producto
 * que no existe para el tenant. Caso típico: un borrador guardado en el navegador
 * con un producto que luego se eliminó. Hoy `deleteProduct` borra con
 * `force: true` (sin soft delete), así que lo normal es el mensaje genérico — el
 * frontend toma el nombre del ítem del formulario. Si algún día el borrado pasa a
 * ser lógico, la búsqueda con `paranoid: false` lo nombra sin cambios acá.
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
