# CHANGELOG

Todos los cambios relevantes del proyecto JJLM se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

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
