// Contrato con el backend (BACKEND/src/modules/product/product-errors.ts): cuando
// un ítem apunta a un producto que ya no existe, el 404 termina en "(ID <n>)".
// Caso típico: un borrador de orden/cotización guardado en el navegador con un
// producto que luego se eliminó — sin esto el formulario queda atascado,
// restaurando el borrador y fallando en cada intento.

/** ID del producto inexistente según el mensaje de error, o null si no es ese error. */
export function extractMissingProductId(message: string): number | null {
  const m = /\(ID (\d+)\)\s*$/.exec(message);
  return m ? Number(m[1]) : null;
}

/**
 * Si el error es de producto inexistente y ese producto está entre los ítems,
 * devuelve los ítems sin él y el nombre a mostrar. Si no aplica, null.
 */
export function removeMissingProduct<T extends { productId: number; product?: { name?: string } }>(
  message: string,
  items: T[],
): { items: T[]; productName: string } | null {
  const id = extractMissingProductId(message);
  if (id === null) return null;
  const missing = items.find(i => i.productId === id);
  if (!missing) return null;
  return {
    items: items.filter(i => i.productId !== id),
    productName: missing.product?.name ?? `ID ${id}`,
  };
}
