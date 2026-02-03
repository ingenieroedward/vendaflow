# Database Models

Este directorio contiene los modelos de base de datos local con validaciones, transformaciones y queries helpers para la arquitectura offline-first de JJLM.

## Estructura

```
models/
├── index.ts           # Punto de exportación central
├── Product.ts         # Modelo de productos
├── Order.ts           # Modelos de órdenes y items
├── Customer.ts        # Modelo de clientes
├── Supplier.ts        # Modelo de proveedores
├── Price.ts           # Modelo de precios
└── README.md          # Este archivo
```

## Arquitectura de Modelos

Cada modelo sigue el mismo patrón consistente:

### 1. Types

- `ServerModel<T>`: Type para datos que vienen del servidor (sin campos de sync)
- `CreateModel<T>`: Type para crear un registro (sin campos autogenerados)

### 2. Validation

Objeto con métodos de validación:
- `validateField()`: Validación de campo individual
- `validate()`: Validación completa del modelo

### 3. Transform

Helpers para convertir entre servidor ↔ local:
- `fromServer()`: Convierte datos del servidor a modelo local
- `toServer()`: Convierte modelo local a datos del servidor

### 4. Queries

Funciones predefinidas para consultas comunes:
- `activeQuery()`: Registros no eliminados
- `unsyncedQuery()`: Registros que necesitan sincronización
- Queries específicos por modelo

## Modelos Disponibles

### Product (Productos)

**Validaciones:**
- `validateName()`: 3-200 caracteres
- `validateCode()`: Código alfanumérico 2-50 caracteres
- `validateSalePrice()`: 0 a 999,999.99
- `validateUnit()`: Unidades válidas o máximo 20 caracteres

**Ejemplo de uso:**
```typescript
import { ProductValidation, ProductTransform, CreateProductDTO } from '@/database/models';

// Validar antes de crear
const product: CreateProductDTO = {
  name: 'Producto X',
  code: 'PROD-001',
  unit: 'pcs',
  salePrice: 100.00
};

const { valid, errors } = ProductValidation.validate(product);

if (valid) {
  // Crear en DB local
  await db.products.add({
    ...product,
    ...createBaseModel(userId)
  });
}

// Transformar desde servidor
const localProduct = ProductTransform.fromServer(serverProduct, userId);
await db.products.add(localProduct);
```

### Order (Órdenes)

**Validaciones Order:**
- `validateOrderNumber()`: Formato ORD-XXX
- `validateTotalAmount()`: 0 a 9,999,999.99
- `validateStatus()`: pending | processing | completed | cancelled

**Validaciones OrderItem:**
- `validateQuantity()`: Entero positivo hasta 999,999
- `validateUnitPrice()`: 0 a 999,999.99
- `validateTaxRate()`: Entero 0-100

**Calculations:**
- `calculateItemTotal()`: Calcula total de un item (cantidad × precio + impuestos)
- `calculateOrderTotal()`: Suma total de items
- `validateOrderTotal()`: Verifica que el total coincida con suma de items

**Ejemplo de uso:**
```typescript
import { OrderCalculations, OrderValidation, CreateOrderDTO } from '@/database/models';

// Calcular total de item
const itemTotal = OrderCalculations.calculateItemTotal(10, 100.00, 19);
// itemTotal = 1190.00

// Validar orden completa
const order: CreateOrderDTO = {
  orderNumber: 'ORD-001',
  customerId: 1,
  userId: 1,
  totalAmount: 1190.00,
  status: 'pending'
};

const { valid, errors } = OrderValidation.validate(order);
```

### Customer (Clientes)

**Validaciones:**
- `validateName()`: 2-200 caracteres
- `validateContact()`: 3-100 caracteres
- `validateAddress()`: 5-500 caracteres

**Queries adicionales:**
- `searchQuery(term)`: Busca en nombre, contacto o notas

**Ejemplo de uso:**
```typescript
import { CustomerQueries, CustomerValidation } from '@/database/models';

// Buscar clientes
const searchTerm = 'Juan';
const customers = await db.customers
  .filter(CustomerQueries.searchQuery(searchTerm))
  .toArray();

// Validar cliente
const { valid, errors } = CustomerValidation.validate({
  name: 'Juan Pérez',
  contact: '555-1234',
  address: 'Calle 123, Ciudad'
});
```

### Supplier (Proveedores)

**Validaciones:**
- `validateName()`: 2-200 caracteres
- `validateContact()`: 3-100 caracteres
- `validateLocation()`: 2-200 caracteres

**Queries adicionales:**
- `searchQuery(term)`: Busca en nombre o ubicación

**Ejemplo de uso:**
```typescript
import { SupplierQueries, SupplierValidation } from '@/database/models';

// Proveedores activos
const activeSuppliers = await db.suppliers
  .filter(SupplierQueries.activeSuppliersQuery())
  .toArray();

// Validar proveedor
const { valid, errors } = SupplierValidation.validate({
  name: 'Proveedor ABC',
  contact: 'contacto@abc.com',
  location: 'Ciudad X'
});
```

### Price (Precios)

**Validaciones:**
- `validatePrice()`: 0 a 9,999,999.99
- `validateProductId()`: ID entero positivo
- `validateSupplierId()`: ID entero positivo
- `validateUpdatedByUserId()`: ID entero positivo

**Queries adicionales:**
- `byProductQuery(productId)`: Precios de un producto
- `bySupplierQuery(supplierId)`: Precios de un proveedor
- `byProductAndSupplierQuery(productId, supplierId)`: Precio específico

**Comparison helpers:**
- `findLowestPrice()`: Encuentra el precio más bajo
- `findHighestPrice()`: Encuentra el precio más alto
- `calculateAveragePrice()`: Calcula precio promedio
- `calculatePriceDifference()`: Diferencia porcentual entre dos precios

**Ejemplo de uso:**
```typescript
import { PriceQueries, PriceComparison } from '@/database/models';

// Obtener precios de un producto
const productPrices = await db.prices
  .filter(PriceQueries.byProductQuery(productId))
  .toArray();

// Encontrar mejor precio
const lowestPrice = PriceComparison.findLowestPrice(productPrices);

// Calcular precio promedio
const avgPrice = PriceComparison.calculateAveragePrice(productPrices);

// Diferencia porcentual
const diff = PriceComparison.calculatePriceDifference(100, 120);
// diff = 20.00 (20% más caro)
```

## Patrones Comunes

### Crear un registro

```typescript
import { createBaseModel } from '@/database/schemas';
import { CreateProductDTO } from '@/database/models';

const newProduct: CreateProductDTO = {
  name: 'Producto',
  code: 'PROD-001',
  unit: 'pcs',
  salePrice: 100.00
};

const productWithSyncFields = {
  ...newProduct,
  ...createBaseModel(currentUserId)
};

await db.products.add(productWithSyncFields);
```

### Actualizar un registro

```typescript
// Actualizar y marcar como pendiente de sincronización
await db.products.update(productId, {
  name: 'Nuevo nombre',
  _syncStatus: SyncStatus.PENDING_UPDATE,
  _version: existingProduct._version + 1,
  _lastModifiedAt: Date.now(),
  _lastModifiedBy: currentUserId
});
```

### Soft delete

```typescript
// Marcar como eliminado
await db.products.update(productId, {
  deletedAt: new Date().toISOString(),
  _syncStatus: SyncStatus.PENDING_DELETE,
  _lastModifiedAt: Date.now(),
  _lastModifiedBy: currentUserId
});
```

### Sincronizar desde servidor

```typescript
import { ProductTransform } from '@/database/models';

// Recibir datos del servidor
const serverProducts: ServerProduct[] = await api.get('/products');

// Transformar e insertar
for (const serverProduct of serverProducts) {
  const localProduct = ProductTransform.fromServer(serverProduct, currentUserId);

  if (localProduct.serverId) {
    // Actualizar existente
    const existing = await db.products.where('serverId').equals(localProduct.serverId).first();
    if (existing) {
      await db.products.update(existing.id!, localProduct);
    } else {
      await db.products.add(localProduct);
    }
  }
}
```

### Sincronizar hacia servidor

```typescript
import { ProductTransform } from '@/database/models';

// Obtener registros pendientes
const pendingProducts = await db.products
  .filter(product => product._syncStatus !== SyncStatus.SYNCED)
  .toArray();

// Transformar y enviar al servidor
for (const product of pendingProducts) {
  const serverData = ProductTransform.toServer(product);

  if (product._syncStatus === SyncStatus.PENDING_CREATE) {
    const response = await api.post('/products', serverData);

    // Actualizar con serverId recibido
    await db.products.update(product.id!, {
      serverId: response.data.id,
      _syncStatus: SyncStatus.SYNCED
    });
  } else if (product._syncStatus === SyncStatus.PENDING_UPDATE) {
    await api.put(`/products/${product.serverId}`, serverData);

    await db.products.update(product.id!, {
      _syncStatus: SyncStatus.SYNCED
    });
  }
}
```

## Relaciones entre Modelos

```
Product
  ├── hasMany → Price (a través de productId)
  └── hasMany → OrderItem (a través de productId)

Supplier
  └── hasMany → Price (a través de supplierId)

Customer
  └── hasMany → Order (a través de customerId)

Order
  └── hasMany → OrderItem (a través de orderId)

User
  ├── hasMany → Order (como userId)
  └── hasMany → Price (como updatedByUserId)
```

## Mejores Prácticas

1. **Siempre validar antes de insertar:**
   ```typescript
   const { valid, errors } = Validation.validate(data);
   if (!valid) {
     throw new Error(errors.join(', '));
   }
   ```

2. **Usar transformaciones al sincronizar:**
   ```typescript
   // Desde servidor
   const local = Transform.fromServer(serverData, userId);

   // Hacia servidor
   const server = Transform.toServer(localData);
   ```

3. **Incluir campos de sync al crear:**
   ```typescript
   const record = {
     ...data,
     ...createBaseModel(userId)
   };
   ```

4. **Incrementar versión al actualizar:**
   ```typescript
   _version: existing._version + 1
   ```

5. **Usar queries predefinidos:**
   ```typescript
   // Mejor
   .filter(ProductQueries.activeProductsQuery())

   // En lugar de
   .filter(p => !p.deletedAt)
   ```

## Testing

Todos los modelos deben ser testeados con:

```typescript
import { ProductValidation } from '@/database/models';

describe('ProductValidation', () => {
  it('should validate name correctly', () => {
    expect(ProductValidation.validateName('ABC')).toBe(true);
    expect(ProductValidation.validateName('AB')).toBe(false);
  });

  it('should validate complete product', () => {
    const { valid, errors } = ProductValidation.validate({
      name: 'Producto',
      code: 'PROD-001',
      unit: 'pcs',
      salePrice: 100
    });

    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });
});
```

## Referencias

- [LocalDatabase.ts](../LocalDatabase.ts) - Definición de tablas Dexie
- [types/index.ts](../types/index.ts) - Utility types globales
- [schemas/index.ts](../schemas/index.ts) - Helpers de creación
- [SPEC-002](../../../../spec/002-modelos-base-datos-local.md) - Especificación completa
