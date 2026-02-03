# Repository Pattern

El patrón Repository proporciona una capa de abstracción entre la lógica de negocio y el acceso a datos, permitiendo que la aplicación funcione tanto online como offline de manera transparente.

## Estructura

```
repositories/
├── BaseRepository.ts              # Clase abstracta base
├── ProductRepository.ts           # Implementación para productos
├── OrderRepository.ts             # Implementación para órdenes
├── __tests__/
│   ├── ProductRepository.test.ts  # Tests de productos
│   └── OrderRepository.test.ts    # Tests de órdenes
└── README.md                      # Este archivo
```

## Arquitectura

### Flujo de Datos

```
┌─────────────┐
│  Component  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Store     │  (Zustand)
│ (productStore)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Repository  │  (ProductRepository)
└──────┬──────┘
       │
       ├──▶ IndexedDB (Local) ◀── Sync Queue
       │
       └──▶ API (Server) ◀── Network Status
```

### Responsabilidades

**BaseRepository:**
- CRUD local con IndexedDB
- Gestión de sync queue
- Validación de datos
- Versionado de registros
- Soft deletes

**ProductRepository:**
- Implementa métodos abstractos
- Búsqueda específica de productos
- Queries con precios
- Estadísticas

**Store (Zustand):**
- Estado de UI (loading, error)
- Cache en memoria
- Coordina operaciones

## BaseRepository

### Clase Abstracta

```typescript
abstract class BaseRepository<TLocal, TServer, TCreate> {
  protected abstract transformFromServer(serverData: TServer, userId?: number): Omit<TLocal, 'id'>;
  protected abstract transformToServer(localData: TLocal): Partial<TServer>;
  protected abstract validate(data: TCreate): { valid: boolean; errors: string[] };
}
```

### Métodos Públicos

#### CRUD Local

**getAll(): Promise<TLocal[]>**
- Obtiene todos los registros activos (no eliminados)
- Filtra automáticamente por `deletedAt === null`

**getById(id: number): Promise<TLocal | undefined>**
- Obtiene registro por ID local
- Retorna `undefined` si está eliminado

**getByServerId(serverId: number): Promise<TLocal | undefined>**
- Obtiene registro por ID del servidor
- Útil para sincronización

**createLocal(data: TCreate, userId?: number): Promise<TLocal>**
- Crea registro en IndexedDB
- Valida datos antes de insertar
- Agrega metadata de sync
- Añade operación a sync queue
- Retorna registro creado

**updateLocal(id: number, updates: Partial<TCreate>, userId?: number): Promise<TLocal>**
- Actualiza registro existente
- Incrementa versión automáticamente
- Marca como `PENDING_UPDATE`
- Añade operación a sync queue
- Retorna registro actualizado

**deleteLocal(id: number, userId?: number): Promise<void>**
- Soft delete (marca `deletedAt`)
- Marca como `PENDING_DELETE`
- Añade operación a sync queue
- No elimina físicamente el registro

#### Sincronización

**saveFromServer(serverData: TServer, userId?: number): Promise<TLocal>**
- Upsert: actualiza si existe, inserta si no
- Busca por `serverId`
- Marca como `SYNCED`
- Retorna registro guardado

**saveAllFromServer(serverDataArray: TServer[], userId?: number): Promise<TLocal[]>**
- Guarda múltiples registros desde servidor
- Procesa en lote

**getUnsyncedRecords(): Promise<TLocal[]>**
- Obtiene registros pendientes de sincronizar
- Filtra por `_syncStatus !== SYNCED`

**markAsSynced(id: number, serverId?: number): Promise<void>**
- Marca registro como sincronizado
- Opcionalmente asigna `serverId`

#### Utilidades

**count(): Promise<number>**
- Cuenta registros activos

**clearAll(): Promise<void>**
- ⚠️ Elimina TODOS los registros
- Usar con precaución

## ProductRepository

### Implementación Concreta

```typescript
class ProductRepository extends BaseRepository<
  LocalProduct,
  ServerProduct,
  CreateProductDTO
>
```

### Métodos Específicos

#### Búsqueda

**search(searchTerm: string): Promise<LocalProduct[]>**
```typescript
const products = await productRepository.search('iphone');
// Busca en name y code (case-insensitive)
```

**getByCode(code: string): Promise<LocalProduct | undefined>**
```typescript
const product = await productRepository.getByCode('PROD-001');
```

**getByCategory(categoryId: number): Promise<LocalProduct[]>**
```typescript
const products = await productRepository.getByCategory(1);
```

#### Precios

**getWithPrices(productId: number): Promise<{ product: LocalProduct; prices: LocalPrice[] } | null>**
```typescript
const result = await productRepository.getWithPrices(1);
if (result) {
  console.log(result.product.name);
  console.log(`${result.prices.length} proveedores`);
}
```

**getAllWithPrices(): Promise<Array<{ product: LocalProduct; prices: LocalPrice[] }>>**
```typescript
const productsWithPrices = await productRepository.getAllWithPrices();
```

**searchWithPrices(searchTerm: string): Promise<Array<{ product: LocalProduct; prices: LocalPrice[] }>>**
```typescript
const results = await productRepository.searchWithPrices('laptop');
```

#### Validación

**codeExists(code: string, excludeId?: number): Promise<boolean>**
```typescript
// Al crear
const exists = await productRepository.codeExists('PROD-001');
if (exists) {
  alert('El código ya existe');
}

// Al actualizar (excluir el mismo producto)
const exists = await productRepository.codeExists('PROD-001', productId);
```

#### Estadísticas

**getProductsWithoutPrices(): Promise<LocalProduct[]>**
```typescript
const withoutPrices = await productRepository.getProductsWithoutPrices();
console.log(`${withoutPrices.length} productos sin precios`);
```

**getStats(): Promise<{ total: number; withPrices: number; withoutPrices: number; byCategory: Record<number, number> }>**
```typescript
const stats = await productRepository.getStats();
console.log(`Total: ${stats.total}`);
console.log(`Con precios: ${stats.withPrices}`);
console.log(`Categoría 1: ${stats.byCategory[1]} productos`);
```

## OrderRepository

### Implementación Concreta

```typescript
class OrderRepository extends BaseRepository<
  LocalOrder,
  ServerOrder,
  CreateOrderDTO
>
```

**Característica Especial:** OrderRepository maneja transacciones complejas con múltiples entidades (Order + OrderItems) de manera atómica.

### Métodos Específicos

#### Gestión de Órdenes con Items

**createOrderWithItems(data: CreateOrderWithItemsDTO, userId?: number): Promise<{ order: LocalOrder; items: LocalOrderItem[] }>**

Crea una orden con sus items en una transacción atómica:

```typescript
const orderData: CreateOrderWithItemsDTO = {
  order: {
    orderNumber: 'ORD-001',
    customerId: 1,
    userId: 1,
    totalAmount: 1190,
    status: 'pending',
    notes: 'Orden de prueba'
  },
  items: [
    {
      productId: 1,
      quantity: 10,
      unitPrice: 100,
      taxRate: 19,
      totalPrice: 1190
    }
  ]
};

const result = await orderRepository.createOrderWithItems(orderData, userId);
console.log(`Orden creada: ${result.order.orderNumber}`);
console.log(`Items: ${result.items.length}`);
```

**Validaciones automáticas:**
- Valida datos de la orden
- Valida cada item
- Verifica que `totalAmount` coincida con la suma de `items.totalPrice`
- Todo en transacción: si falla alguna validación, no se crea nada

**updateOrderWithItems(orderId: number, orderUpdates: Partial<CreateOrderDTO>, items: CreateOrderItemDTO[], userId?: number): Promise<{ order: LocalOrder; items: LocalOrderItem[] }>**

Actualiza orden y reemplaza todos los items:

```typescript
const newItems: CreateOrderItemDTO[] = [
  {
    productId: 2,
    quantity: 5,
    unitPrice: 200,
    taxRate: 19,
    totalPrice: 1190
  }
];

const result = await orderRepository.updateOrderWithItems(
  orderId,
  { status: 'processing' },
  newItems,
  userId
);
```

**Comportamiento:**
- Soft delete de items anteriores
- Creación de nuevos items
- Recálculo automático de `totalAmount` desde items
- Incremento de `_version`
- Todo en transacción atómica

**deleteOrderWithItems(orderId: number, userId?: number): Promise<void>**

Soft delete de orden y todos sus items:

```typescript
await orderRepository.deleteOrderWithItems(orderId, userId);
// Marca order.deletedAt
// Marca items[].deletedAt (todos los items)
// Añade operaciones a sync queue
```

**getOrderWithItems(orderId: number): Promise<{ order: LocalOrder; items: LocalOrderItem[] } | null>**

Obtiene orden con todos sus items activos:

```typescript
const result = await orderRepository.getOrderWithItems(1);
if (result) {
  console.log(`Orden: ${result.order.orderNumber}`);
  console.log(`Items: ${result.items.length}`);
  result.items.forEach(item => {
    console.log(`- Producto ${item.productId}: ${item.quantity} x $${item.unitPrice}`);
  });
}
```

#### Numeración Automática

**getNextOrderNumber(): Promise<string>**

Genera el siguiente número de orden secuencial:

```typescript
const nextNumber = await orderRepository.getNextOrderNumber();
// Primera orden: "ORD-001"
// Segunda orden: "ORD-002"
// ...
// Orden 100: "ORD-100"
```

**Características:**
- Formato: `ORD-XXX` con padding de 3 dígitos mínimo
- No reutiliza números de órdenes eliminadas
- Maneja gaps en la numeración
- Thread-safe para creación concurrente

**orderNumberExists(orderNumber: string, excludeId?: number): Promise<boolean>**

Verifica si un número de orden ya existe:

```typescript
// Al crear
const exists = await orderRepository.orderNumberExists('ORD-001');
if (exists) {
  alert('Número de orden duplicado');
}

// Al actualizar (excluir la misma orden)
const exists = await orderRepository.orderNumberExists('ORD-001', orderId);
```

#### Búsqueda y Filtrado

**search(searchTerm: string): Promise<LocalOrder[]>**

Busca órdenes por número:

```typescript
const orders = await orderRepository.search('ORD-001');
// Búsqueda case-insensitive en orderNumber
```

**getByCustomer(customerId: number): Promise<LocalOrder[]>**

Obtiene todas las órdenes de un cliente:

```typescript
const customerOrders = await orderRepository.getByCustomer(1);
console.log(`Cliente tiene ${customerOrders.length} órdenes`);
```

**getByStatus(status: string): Promise<LocalOrder[]>**

Filtra órdenes por estado:

```typescript
const pendingOrders = await orderRepository.getByStatus('pending');
const completedOrders = await orderRepository.getByStatus('completed');
```

Estados válidos: `'pending' | 'processing' | 'completed' | 'cancelled'`

**getByDateRange(startDate: Date, endDate: Date): Promise<LocalOrder[]>**

Órdenes creadas en un rango de fechas:

```typescript
const start = new Date('2026-01-01');
const end = new Date('2026-01-31');
const januaryOrders = await orderRepository.getByDateRange(start, end);
```

#### Estadísticas

**getStats(): Promise<{ total: number; byStatus: Record<string, number>; totalRevenue: number; averageOrderValue: number }>**

Estadísticas completas de órdenes:

```typescript
const stats = await orderRepository.getStats();

console.log(`Total órdenes: ${stats.total}`);
console.log(`Pendientes: ${stats.byStatus['pending']}`);
console.log(`Completadas: ${stats.byStatus['completed']}`);
console.log(`Revenue total: $${stats.totalRevenue}`);
console.log(`Ticket promedio: $${stats.averageOrderValue}`);
```

#### Sincronización

**saveOrderWithItemsFromServer(serverOrder: ServerOrder, serverItems: ServerOrderItem[], userId?: number): Promise<{ order: LocalOrder; items: LocalOrderItem[] }>**

Guarda orden con items recibidos del servidor:

```typescript
// Cuando sincronizamos desde el servidor
const serverOrder = await api.get('/orders/1');
const serverItems = await api.get('/orders/1/items');

const result = await orderRepository.saveOrderWithItemsFromServer(
  serverOrder,
  serverItems,
  userId
);

// Upsert automático por serverId
// Marca como SYNCED
```

### Transacciones con Dexie

OrderRepository usa transacciones para garantizar atomicidad:

```typescript
// Internamente en createOrderWithItems:
return await db.transaction('rw', [db.orders, db.orderItems, db.syncQueue], async () => {
  // 1. Crear orden
  const orderId = await db.orders.add(orderData);

  // 2. Crear items
  await db.orderItems.bulkAdd(itemsData);

  // 3. Añadir a sync queue
  await db.syncQueue.add({ ... });

  // Si cualquier paso falla, todo se revierte
  return { order, items };
});
```

**Ventajas:**
- Atomicidad: todo o nada
- Consistencia: órdenes siempre tienen items válidos
- Aislamiento: no se ven estados intermedios
- Durabilidad: una vez committed, persiste

### Validación de Totales

OrderRepository valida que los totales coincidan:

```typescript
// En createOrderWithItems:
const calculatedTotal = OrderCalculations.calculateOrderTotal(items);

if (!OrderCalculations.validateOrderTotal(order.totalAmount, items)) {
  throw new Error(
    `Order total (${order.totalAmount}) does not match sum of items (${calculatedTotal})`
  );
}
```

**OrderCalculations:**
```typescript
// database/models/Order.ts
export const OrderCalculations = {
  calculateOrderTotal(items: CreateOrderItemDTO[]): number {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  },

  validateOrderTotal(orderTotal: number, items: CreateOrderItemDTO[]): boolean {
    const calculated = this.calculateOrderTotal(items);
    return Math.abs(orderTotal - calculated) < 0.01; // Tolerancia de 1 centavo
  }
};
```

### Patrón de Uso en Store

```typescript
// store/orderStore.ts
import { orderRepository } from '../repositories/OrderRepository';

export const useOrderStore = create<OrderState>((set) => ({
  createOrder: async (data) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;

      // Convertir CreateOrderRequest → CreateOrderWithItemsDTO
      const orderData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          userId: data.userId,
          totalAmount: data.totalAmount,
          status: data.status || 'pending',
          notes: data.notes
        },
        items: data.items || []
      };

      // Crear en local DB con transacción
      const result = await orderRepository.createOrderWithItems(orderData, userId);

      // Convertir LocalOrder → Order para UI
      const order = toOrder(result.order);

      set({ loading: false });
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  }
}));
```

### Ejemplo Completo: Crear Orden

```typescript
// 1. Obtener próximo número
const orderNumber = await orderRepository.getNextOrderNumber();

// 2. Preparar datos
const orderData: CreateOrderWithItemsDTO = {
  order: {
    orderNumber,
    customerId: selectedCustomer.id,
    userId: currentUser.id,
    totalAmount: 0, // Se calcula después
    status: 'pending',
    notes: 'Urgente'
  },
  items: [
    {
      productId: 1,
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 19,
      totalPrice: 1190.00
    },
    {
      productId: 2,
      quantity: 5,
      unitPrice: 50.00,
      taxRate: 19,
      totalPrice: 297.50
    }
  ]
};

// 3. Calcular total
orderData.order.totalAmount = OrderCalculations.calculateOrderTotal(orderData.items);
// 1190.00 + 297.50 = 1487.50

// 4. Crear orden con validación automática
try {
  const result = await orderRepository.createOrderWithItems(orderData, userId);

  console.log('✅ Orden creada exitosamente');
  console.log(`Número: ${result.order.orderNumber}`);
  console.log(`Total: $${result.order.totalAmount}`);
  console.log(`Items: ${result.items.length}`);

  // 5. La orden ya está en sync queue para sincronizar cuando haya conexión
} catch (error) {
  console.error('❌ Error creando orden:', error.message);
  // Mostrar error al usuario
}
```

## Integración con Store

### Ejemplo: productStore.ts

```typescript
import { productRepository } from '../repositories/ProductRepository';

export const useProductStore = create<ProductState>((set) => ({
  // ...

  createProduct: async (data) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;

      // Crear en local DB (automáticamente se añade a sync queue)
      const localProduct = await productRepository.createLocal(data, userId);

      set({ loading: false });
      return toProduct(localProduct);
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  searchProducts: async (query) => {
    set({ loading: true, error: null });
    try {
      // Buscar en local DB
      const localProducts = await productRepository.search(query);
      const products = localProducts.map(toProduct);

      set({ products, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  }
}));
```

## Sync Queue

### Flujo de Sincronización

1. **Operación Local:**
   ```typescript
   await productRepository.createLocal({ ... }, userId);
   ```

2. **Se añade a Sync Queue:**
   ```typescript
   // Automáticamente en BaseRepository
   await db.syncQueue.add({
     entityType: 'Product',
     entityId: newProduct.id,
     operation: 'CREATE',
     createdAt: new Date().toISOString(),
     retries: 0
   });
   ```

3. **Proceso de Sync (SPEC-009):**
   ```typescript
   // Pseudo-código del sync service
   const pendingItems = await db.syncQueue.toArray();

   for (const item of pendingItems) {
     const product = await db.products.get(item.entityId);

     if (item.operation === 'CREATE') {
       const serverData = productRepository.transformToServer(product);
       const response = await api.post('/products', serverData);

       await productRepository.markAsSynced(product.id, response.data.id);
       await db.syncQueue.delete(item.id);
     }
   }
   ```

## Patrones de Uso

### Patrón 1: Crear Registro

```typescript
// En el store o componente
const createProduct = async (data: CreateProductDTO) => {
  try {
    // 1. Validar (automático en repository)
    // 2. Crear en local DB
    const product = await productRepository.createLocal(data, userId);

    // 3. Sync automático en background (próximo spec)
    // El sync service procesará la queue

    return product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};
```

### Patrón 2: Actualizar Registro

```typescript
const updateProduct = async (id: number, updates: Partial<CreateProductDTO>) => {
  try {
    // 1. Validar y actualizar en local
    const updated = await productRepository.updateLocal(id, updates, userId);

    // 2. Version se incrementa automáticamente
    // 3. Se marca como PENDING_UPDATE
    // 4. Se añade a sync queue

    return updated;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};
```

### Patrón 3: Sincronizar desde Servidor

```typescript
const syncFromServer = async () => {
  try {
    // 1. Obtener datos del servidor
    const serverProducts = await api.get('/products');

    // 2. Guardar en local (upsert)
    for (const serverProduct of serverProducts) {
      await productRepository.saveFromServer(serverProduct, userId);
    }

    console.log('Sync completed');
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

### Patrón 4: Búsqueda con Fallback

```typescript
const searchProducts = async (query: string) => {
  try {
    // Siempre buscar primero en local (offline-first)
    const localResults = await productRepository.search(query);

    if (localResults.length > 0) {
      return localResults;
    }

    // Si no hay resultados locales y hay conexión, buscar en servidor
    if (navigator.onLine) {
      const serverResults = await api.get(`/products/search?q=${query}`);
      // Guardar en local para próxima vez
      await productRepository.saveAllFromServer(serverResults);
      return serverResults;
    }

    return [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
};
```

## Versionado de Registros

### ¿Por qué versionar?

El versionado permite detectar conflictos durante la sincronización:

```typescript
// Usuario A actualiza offline
await productRepository.updateLocal(1, { name: 'New Name A' });
// _version: 2

// Usuario B actualiza offline (mismo producto)
await productRepository.updateLocal(1, { name: 'New Name B' });
// _version: 2

// Al sincronizar, el servidor detecta que ambos tienen version 2
// pero el servidor está en version 1
// → CONFLICTO detectado
```

### Resolución de Conflictos (SPEC-010)

Estrategia **Last-Write-Wins** (LWW):
```typescript
if (localVersion > serverVersion) {
  // Local gana - enviar al servidor
  await api.put(`/products/${serverId}`, localData);
} else if (serverVersion > localVersion) {
  // Servidor gana - sobrescribir local
  await repository.saveFromServer(serverData);
} else {
  // Misma versión - comparar timestamps
  if (local._lastModifiedAt > server.updatedAt) {
    await api.put(`/products/${serverId}`, localData);
  } else {
    await repository.saveFromServer(serverData);
  }
}
```

## Testing

### Ejecutar Tests

```bash
npm test -- ProductRepository.test.ts
```

### Coverage

```bash
npm run test:coverage
```

### Estructura de Tests

```typescript
describe('ProductRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    repository = new ProductRepository();
  });

  describe('createLocal', () => {
    it('should create a product locally', async () => {
      const product = await repository.createLocal({ ... });
      expect(product.id).toBeDefined();
    });
  });

  describe('search', () => {
    it('should search by name', async () => {
      const results = await repository.search('iphone');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
```

## Mejores Prácticas

### 1. Siempre pasar userId

```typescript
// ✅ Bueno
await productRepository.createLocal(data, userId);

// ❌ Malo (no se sabe quién modificó)
await productRepository.createLocal(data);
```

### 2. Manejar errores apropiadamente

```typescript
try {
  await productRepository.createLocal(data, userId);
} catch (error) {
  if (error.message.includes('Validation failed')) {
    // Mostrar errores de validación al usuario
    showValidationErrors(error.message);
  } else {
    // Error inesperado
    console.error('Unexpected error:', error);
  }
}
```

### 3. No llamar API directamente desde componentes

```typescript
// ✅ Bueno
const product = await productRepository.createLocal(data, userId);

// ❌ Malo
const product = await api.post('/products', data);
```

### 4. Usar métodos específicos del repository

```typescript
// ✅ Bueno - usa método optimizado
const products = await productRepository.searchWithPrices('laptop');

// ❌ Malo - múltiples queries
const products = await productRepository.search('laptop');
for (const product of products) {
  const prices = await db.prices.where('productId').equals(product.id).toArray();
}
```

### 5. Validar antes de operaciones batch

```typescript
// ✅ Bueno
for (const data of bulkData) {
  const validation = ProductValidation.validate(data);
  if (!validation.valid) {
    console.error(`Invalid data: ${validation.errors.join(', ')}`);
    continue;
  }
  await productRepository.createLocal(data, userId);
}
```

## Extensión: Crear Nuevo Repository

### Paso 1: Crear archivo

```typescript
// repositories/CustomerRepository.ts
import { BaseRepository } from './BaseRepository';
import { db, LocalCustomer } from '../database/LocalDatabase';
import { ServerCustomer, CreateCustomerDTO } from '../database/models';

export class CustomerRepository extends BaseRepository<
  LocalCustomer,
  ServerCustomer,
  CreateCustomerDTO
> {
  constructor() {
    super(db.customers, 'Customer');
  }

  // Implementar métodos abstractos
  protected transformFromServer(serverData: ServerCustomer, userId?: number) {
    return CustomerTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalCustomer) {
    return CustomerTransform.toServer(localData);
  }

  protected validate(data: CreateCustomerDTO) {
    return CustomerValidation.validate(data);
  }

  // Métodos específicos de Customer
  async searchByName(name: string): Promise<LocalCustomer[]> {
    // ...
  }
}

export const customerRepository = new CustomerRepository();
```

### Paso 2: Integrar con Store

```typescript
// store/customerStore.ts
import { customerRepository } from '../repositories/CustomerRepository';

export const useCustomerStore = create<CustomerState>((set) => ({
  createCustomer: async (data) => {
    const customer = await customerRepository.createLocal(data, userId);
    return customer;
  }
}));
```

## CustomerRepository

### Implementación Concreta

```typescript
class CustomerRepository extends BaseRepository<
  LocalCustomer,
  ServerCustomer,
  CreateCustomerDTO
>
```

### Métodos Específicos

#### Búsqueda de Clientes

**search(searchTerm: string): Promise<LocalCustomer[]>**
- Busca clientes por nombre, contacto o notas
- Case-insensitive
- Retorna todos si searchTerm está vacío

**searchByName(name: string): Promise<LocalCustomer[]>**
- Búsqueda específica por nombre de cliente
- Útil para autocompletado

**getByContact(contact: string): Promise<LocalCustomer[]>**
- Busca clientes por información de contacto
- Retorna array vacío si contact está vacío

**searchByNotes(noteText: string): Promise<LocalCustomer[]>**
- Busca en el campo de notas
- Útil para encontrar clientes con características específicas

#### Ordenamiento y Validación

**getAllSortedByName(): Promise<LocalCustomer[]>**
- Retorna todos los clientes ordenados alfabéticamente por nombre

**customerNameExists(name: string, excludeId?: number): Promise<boolean>**
- Verifica si existe un cliente con ese nombre
- `excludeId` permite excluir un ID (útil para updates)

#### Estadísticas

**getStats(): Promise<Statistics>**

```typescript
{
  total: number;               // Total de clientes activos
  withNotes: number;           // Clientes con notas
  synced: number;              // Clientes sincronizados
  pendingSync: number;         // Pendientes de sincronización
}
```

### Ejemplo de Uso

```typescript
// Buscar clientes
const customers = await customerRepository.search('juan');

// Verificar duplicados antes de crear
const exists = await customerRepository.customerNameExists('Juan Pérez');
if (exists) {
  throw new Error('Cliente ya existe');
}

// Crear cliente
const newCustomer = await customerRepository.createLocal({
  name: 'Juan Pérez',
  contact: 'juan@email.com',
  address: 'Calle 123',
  note: 'Cliente preferencial'
}, userId);

// Obtener estadísticas
const stats = await customerRepository.getStats();
console.log(`${stats.total} clientes, ${stats.withNotes} con notas`);
```

---

## SupplierRepository

### Implementación Concreta

```typescript
class SupplierRepository extends BaseRepository<
  LocalSupplier,
  ServerSupplier,
  CreateSupplierDTO
>
```

### Métodos Específicos

#### Búsqueda de Proveedores

**search(searchTerm: string): Promise<LocalSupplier[]>**
- Busca proveedores por nombre o ubicación
- Case-insensitive

**searchByName(name: string): Promise<LocalSupplier[]>**
- Búsqueda específica por nombre

**searchByLocation(location: string): Promise<LocalSupplier[]>**
- Filtra proveedores por ubicación
- Útil para encontrar proveedores locales

#### Precios del Proveedor

**getWithPrices(supplierId: number): Promise<{ supplier, prices } | null>**
- Retorna proveedor con todos sus precios
- Incluye solo precios activos (no eliminados)
- Útil para ver catálogo completo del proveedor

**getAllWithPriceCounts(): Promise<Array<{ supplier, priceCount }>>**
- Retorna todos los proveedores con contador de precios
- Útil para dashboards y reportes

#### Ordenamiento

**getAllSortedByName(): Promise<LocalSupplier[]>**
- Proveedores ordenados alfabéticamente

**getAllSortedByLocation(): Promise<LocalSupplier[]>**
- Proveedores ordenados por ubicación

**getUniqueLocations(): Promise<string[]>**
- Retorna lista única de ubicaciones
- Útil para filtros

#### Validación

**supplierNameExists(name: string, excludeId?: number): Promise<boolean>**
- Verifica duplicados antes de crear/actualizar

#### Estadísticas

**getStats(): Promise<Statistics>**

```typescript
{
  total: number;                       // Total de proveedores
  byLocation: Record<string, number>;  // Conteo por ubicación
  withPrices: number;                  // Proveedores con precios definidos
  synced: number;                      // Sincronizados
  pendingSync: number;                 // Pendientes
}
```

### Ejemplo de Uso

```typescript
// Buscar proveedores por ubicación
const bogotaSuppliers = await supplierRepository.searchByLocation('Bogotá');

// Obtener proveedor con sus precios
const result = await supplierRepository.getWithPrices(supplierId);
if (result) {
  console.log(`${result.supplier.name}: ${result.prices.length} productos`);
}

// Filtrar por ubicaciones únicas
const locations = await supplierRepository.getUniqueLocations();
// ['Bogotá', 'Medellín', 'Cali']

// Estadísticas por ubicación
const stats = await supplierRepository.getStats();
console.log(stats.byLocation);
// { 'Bogotá': 5, 'Medellín': 3, 'Cali': 2 }
```

---

## PriceRepository

### Implementación Concreta

```typescript
class PriceRepository extends BaseRepository<
  LocalPrice,
  ServerPrice,
  CreatePriceDTO
>
```

**Característica Especial:** Valida integridad referencial antes de crear precios

### Métodos Específicos

#### Validación de Relaciones

**createLocal(data: CreatePriceDTO, userId?: number): Promise<LocalPrice>**
- ✅ Valida que el producto existe
- ✅ Valida que el proveedor existe
- ✅ Verifica que no exista duplicado (mismo producto-proveedor)
- ❌ Lanza error si falta alguna referencia

```typescript
// Ejemplo de validación automática
try {
  await priceRepository.createLocal({
    productId: 999,     // No existe
    supplierId: 1,
    price: 100,
    updatedByUserId: userId
  }, userId);
} catch (error) {
  // Error: "Product with id 999 not found"
}
```

#### Búsqueda de Precios

**getByProduct(productId: number): Promise<LocalPrice[]>**
- Todos los precios de un producto
- Ordenado por proveedor

**getBySupplier(supplierId: number): Promise<LocalPrice[]>**
- Todos los precios de un proveedor
- Ordenado por producto

**getByProductAndSupplier(productId, supplierId): Promise<LocalPrice | null>**
- Precio específico de un producto-proveedor
- Retorna `null` si no existe

#### Comparación de Precios

**findLowestPriceForProduct(productId: number): Promise<LocalPrice | null>**
- Encuentra el precio más bajo entre todos los proveedores
- Retorna `null` si no hay precios

**findHighestPriceForProduct(productId: number): Promise<LocalPrice | null>**
- Encuentra el precio más alto

**compareSuppliers(productId: number): Promise<PriceComparisonResult | null>**
- Compara precios de todos los proveedores
- Incluye estadísticas y porcentajes

```typescript
interface PriceComparisonResult {
  productId: number;
  productName?: string;
  prices: Array<{
    supplierId: number;
    supplierName?: string;
    price: number;
    isLowest: boolean;              // ¿Es el más barato?
    isHighest: boolean;             // ¿Es el más caro?
    differenceFromLowest: number;   // Diferencia absoluta
    differencePercentage: number;   // Diferencia porcentual
  }>;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceRange: number;               // highestPrice - lowestPrice
}
```

#### Operaciones Masivas

**bulkUpdatePrices(prices[], userId?: number): Promise<number>**
- Actualiza múltiples precios en una transacción
- Retorna cantidad de precios actualizados
- Más eficiente que actualizar uno por uno

```typescript
// Actualizar varios precios a la vez
const updatedCount = await priceRepository.bulkUpdatePrices([
  { id: 1, price: 100, updatedByUserId: userId },
  { id: 2, price: 150, updatedByUserId: userId },
  { id: 3, price: 200, updatedByUserId: userId }
], userId);
console.log(`${updatedCount} precios actualizados`);
```

#### Métodos de Relación

**getProductWithPrices(productId: number): Promise<{ product, prices } | null>**
- Producto con todos sus precios
- Alternativa a `productRepository.getWithPrices()`

**getSupplierWithPrices(supplierId: number): Promise<{ supplier, prices } | null>**
- Proveedor con todos sus precios

**getProductsWithoutPrices(): Promise<LocalProduct[]>**
- Productos que no tienen precios definidos
- Útil para identificar productos sin completar

**getSuppliersWithoutPrices(): Promise<LocalSupplier[]>**
- Proveedores sin precios
- Útil para detectar proveedores inactivos

#### Eliminación en Cascada

**deleteByProduct(productId: number, userId?: number): Promise<void>**
- Elimina todos los precios de un producto
- Soft delete (marca `deletedAt`)
- Usar cuando se elimina un producto

**deleteBySupplier(supplierId: number, userId?: number): Promise<void>**
- Elimina todos los precios de un proveedor
- Usar cuando se elimina un proveedor

#### Estadísticas

**getStats(): Promise<Statistics>**

```typescript
{
  total: number;                    // Total de precios
  byProduct: number;                // Productos únicos con precios
  bySupplier: number;               // Proveedores únicos con precios
  averagePrice: number;             // Precio promedio general
  lowestPrice: number;              // Precio más bajo del sistema
  highestPrice: number;             // Precio más alto del sistema
  productsWithPrices: number;       // Productos con al menos 1 precio
  productsWithoutPrices: number;    // Productos sin precios
  suppliersWithPrices: number;      // Proveedores activos
  suppliersWithoutPrices: number;   // Proveedores sin precios
}
```

### Ejemplo de Uso Completo

```typescript
// Crear precio con validación automática
try {
  const price = await priceRepository.createLocal({
    productId: 1,
    supplierId: 2,
    price: 150.00,
    updatedByUserId: userId
  }, userId);
  console.log('Precio creado:', price);
} catch (error) {
  // Maneja errores de validación
  console.error(error.message);
}

// Comparar precios entre proveedores
const comparison = await priceRepository.compareSuppliers(productId);
if (comparison) {
  console.log(`Rango de precios: $${comparison.lowestPrice} - $${comparison.highestPrice}`);
  console.log(`Promedio: $${comparison.averagePrice}`);

  comparison.prices.forEach(p => {
    if (p.isLowest) {
      console.log(`✅ ${p.supplierName}: $${p.price} (MEJOR PRECIO)`);
    } else {
      console.log(`${p.supplierName}: $${p.price} (+${p.differencePercentage}%)`);
    }
  });
}

// Encontrar productos sin precios
const productsNoPrices = await priceRepository.getProductsWithoutPrices();
console.log(`${productsNoPrices.length} productos necesitan precios`);

// Obtener estadísticas generales
const stats = await priceRepository.getStats();
console.log(`Cobertura: ${stats.productsWithPrices}/${stats.total} productos`);
```

### Integración con ProductStore

```typescript
// store/productStore.ts
import { priceRepository } from '../repositories/PriceRepository';

export const useProductStore = create<ProductState>((set) => ({
  // Crear precio desde el store
  createPrice: async (data) => {
    const price = await priceRepository.createLocal(data, userId);
    set(state => ({ prices: [...state.prices, toPrice(price)] }));
    return price;
  },

  // Comparar proveedores
  compareSuppliers: async (productId) => {
    const comparison = await priceRepository.compareSuppliers(productId);
    set({ priceComparison: comparison });
  },

  // Actualización masiva
  bulkUpdatePrices: async (prices) => {
    const count = await priceRepository.bulkUpdatePrices(prices, userId);
    return count;
  }
}));
```

---

## Referencias

- [BaseRepository.ts](./BaseRepository.ts) - Clase base
- [ProductRepository.ts](./ProductRepository.ts) - Implementación de productos
- [OrderRepository.ts](./OrderRepository.ts) - Implementación de órdenes
- [CustomerRepository.ts](./CustomerRepository.ts) - Implementación de clientes
- [SupplierRepository.ts](./SupplierRepository.ts) - Implementación de proveedores
- [PriceRepository.ts](./PriceRepository.ts) - Implementación de precios
- [SPEC-003](../../../spec/003-repository-pattern-productos.md) - Especificación de productos
- [SPEC-004](../../../spec/004-repository-pattern-ordenes.md) - Especificación de órdenes
- [SPEC-005](../../../spec/005-repository-pattern-clientes-proveedores-precios.md) - Especificación de clientes, proveedores y precios
- [LocalDatabase.ts](../database/LocalDatabase.ts) - Esquema de base de datos
- [Models](../database/models/) - Validaciones y transformaciones
