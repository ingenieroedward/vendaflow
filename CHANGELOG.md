# CHANGELOG

Todos los cambios relevantes del proyecto JJLM se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

---

## [2026-06-25] — QA Audit, Hotfixes producción, Mobile & Reports

### Fixed

- **[CRÍTICO] Colisión de números de orden en producción** (`order.service.ts`)
  - `ORDER BY orderNumber DESC` era alfabético: `"ORD-9X" > "ORD-1XX"` → el generador
    devolvía siempre el mismo número existente → 3 intentos fallidos → 409 en el cliente.
  - Fix: `MAX(CAST(SUBSTRING(orderNumber, 5) AS UNSIGNED))` — extracción numérica real.
  - Padding aumentado de 2 a 4 dígitos (`ORD-0001`) para proteger hasta 9.999 órdenes.
  - Mismo padding aplicado en `purchase-order.service.ts` (`POC-0001`).

- **[ALTA] Flood de 401 con JWT vencido en carga inicial** (`services/auth.ts`)
  - `isAuthenticated()` solo verificaba existencia del token, no su expiración.
  - Con un JWT vencido en localStorage el app disparaba todas las peticiones iniciales
    simultáneamente y todas fallaban con 401 visible en logs de producción.
  - Fix: `getToken()` decodifica el payload base64 y valida `exp * 1000 < Date.now()`.
    Si vencido, llama `logout()` en el momento → ninguna request sale con token caducado.

- **[ALTA] Badge de estado de orden en inglés en lista de órdenes** (`Orders.tsx`)
  - `getStatusText` no tenía caso para `"processing"` → mostraba `"PROCESSING"` (raw).
  - Agregado `processing → "En proceso"` con color azul (`bg-blue-100 text-blue-800`).
  - Cambiado de mayúsculas duras (`PENDIENTE`) a title case para mejor legibilidad.

- **[ALTA] Tabla de Inventario inutilizable en mobile** (`Inventory.tsx`)
  - Tabla de 7 columnas (723 px) desbordaba en viewport de 375 px sin scroll horizontal.
  - Reemplazada por layout de **cards en `<sm`**: nombre, código, stock actual/mínimo
    con barra de estado, precio de venta, badge de estado con colores reactivos.
  - Tabla original preservada en `sm:block`.

- **[ALTA] Tabla de Órdenes de Compra inutilizable en mobile** (`PurchaseOrders.tsx`)
  - Tabla de 6 columnas (546 px) desbordaba 171 px sin scroll horizontal visible.
  - Reemplazada por **cards en `<sm`**: número de orden, proveedor, fecha, total,
    badge de estado, botones de acción con área de toque ≥ 44 px.
  - Tabla original preservada en `hidden sm:block`.

### Added

- **Módulo de Informes expandido** (`Reports.tsx`)
  - Nuevo tab **Inventario**: 4 KPIs (total productos, negativos, sin stock, valor a
    precio venta), gráfica de distribución de estados, top 8 productos por valor en
    stock, tabla detallada de productos con stock negativo + columna "unidades a reponer".
  - Nuevo tab **Compras**: 4 KPIs (invertido/recibido, este mes, en tránsito, borradores),
    gráfica de compras por mes (últimos 6), top 5 proveedores por monto, panel de estado
    visual (borradores / ordenadas / recibidas) con porcentajes.
  - Tab **Ventas**: contenido anterior sin cambios.
  - Carga paralela con `Promise.all` de órdenes de venta + órdenes de compra + productos.

### Deployed

- APK v1.0 entregada al cliente — Android 16, Motorola Edge 60 (confirmado en logs de
  producción: `Referer: https://localhost/` desde Capacitor WebView, IP 38.224.244.228).

---

## [2026-03-23]

### Changed
- **Docker**: Dockerfile del backend refactorizado a **multi-stage build**
  - Stage 1 (builder): instala todas las dependencias + compila TypeScript
  - Stage 2 (production): solo dependencias de producción + `dist/` → imagen más pequeña

### Removed
- `BACKEND/docker-compose.yml` — template obsoleto con credenciales/BD incorrectas
- `BACKEND/docker-compose.dev.yml` — setup de desarrollo antiguo con phpmyadmin
- `BACKEND/Dockerfile.dev` — solo lo usaban los compose eliminados

### Fixed
- **Hard delete de usuario** (`DELETE /api/users/:id`): el `user.destroy({ force: true })`
  fallaba con error 500 porque MySQL rechazaba el `DELETE` por FK constraints.
  Causa: `include: [Order, Price]` usaba `paranoid: true` por defecto, por lo que los
  registros soft-deleted no se cargaban, pero sí seguían referenciando al usuario en la BD.
  Fix: include con `paranoid: false` + `Order.update` y `Price.update` con `paranoid: false`
  para reasignar **todos** los registros (activos y eliminados) antes del hard delete.

### Added
- **Reasignación de órdenes en hard delete de usuario**: al eliminar permanentemente un
  usuario, sus órdenes ahora se reasignan al admin que ejecuta la acción (igual que los
  precios). Antes lanzaba `ConflictError`; ahora requiere `transferToAdminId`.

---

## [2026-03-22]

### Added
- **JSDoc** en métodos complejos del backend:
  - `OrderService.generateOrderNumber` — formato ORD-XXXX, fallback a timestamp
  - `OrderService.createOrder` — advertencia sobre ausencia de transacción en items
  - `OrderService.updateOrder` — algoritmo de sync de items con rollback transaccional
  - `PriceService.createPrice` / `updatePrice` — comportamiento de notificaciones push
  - `UserService.deleteUser` — flujo soft/hard delete y transferencia de datos
- **Comentario de arquitectura offline** en `orderStore.ts`: explica el ciclo
  IndexedDB → PENDING_CREATE → sync → SYNCED con diagrama en prosa
- **JSDoc en `syncPendingOrders`**: parámetros, retorno y estrategia de retry

### Fixed
- `ProductSearch.tsx`: eliminado `console.log('Product selected:', product)` de debug
- `Orders.tsx`: eliminado `};` duplicado (brace sobrante)

---

## [2026-03-10 — 2026-03-20] — Offline & Mobile

### Added
- **Soporte offline completo** para creación de órdenes con IndexedDB
- **Auto-sync al reconectar**: las órdenes pendientes se sincronizan automáticamente
- **Botón de sync manual** en la lista de órdenes
- **Bottom navigation** en mobile + sidebar en desktop (layout responsivo)
- **Vista compacta de orden** optimizada para móvil
- **Safe area** para iPhone (notch e indicador de inicio)

### Fixed
- Sync de eliminación de órdenes a IndexedDB
- Optional chaining en user/customer de órdenes offline
- Visualización de órdenes offline/pendientes desde lista y detalle
- Retry de órdenes atascadas en sync al cargar la app
- Query por `_syncStatus` en lugar de syncQueue (más robusto)

---

## [2026-01-15 — 2026-03-09] — Deploy & Push Notifications

### Added
- **Push Notifications** (Web Push / VAPID) al crear/actualizar precios
- **Docker deploy** completo con MySQL, backend y frontend
- **PWA** con Service Worker y soporte offline básico
- **Arquitectura offline-first** con caché en visita para producto detalle y precios

### Fixed
- Conflicto de puerto MySQL (3306 → 3307)
- Error de permisos en logs (`EACCES` → volumen nombrado)
- Puerto backend corregido a 3001
- Healthcheck start_period aumentado para evitar 502 en arranque
- Red `dokploy-network` añadida para que Traefik alcance los contenedores

---

## [2026-01-01] — Release Inicial

### Added
- Módulo de **autenticación** (JWT, bcrypt, roles: buyer/seller/admin)
- Módulo de **productos** con búsqueda, paginación y comparación de precios
- Módulo de **proveedores** y **categorías**
- Módulo de **precios** con relación producto-proveedor
- Módulo de **clientes** con búsqueda
- Módulo de **órdenes** con items, cálculo de totales e impuestos
- Módulo de **usuarios** con gestión de roles (solo admin)
- Frontend React + TypeScript + Tailwind CSS
- Estado global con Zustand
- Validación con Zod (backend) y React Hook Form (frontend)
- Soft deletes en todos los modelos (`paranoid: true`)
- Sistema de logging con Winston (rotación de archivos)
- Rate limiting y seguridad HTTP con Helmet
