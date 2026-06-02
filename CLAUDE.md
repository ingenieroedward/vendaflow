# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## PROPÓSITO DEL SISTEMA

**JJLM** es un Sistema de Gestión de Ventas y Comparación de Precios con:
- Comparación de precios por proveedor
- Gestión de órdenes de venta
- 3 roles: `buyer` (compras/precios), `seller` (órdenes/ventas), `admin` (acceso total)
- Modo offline-first en desarrollo activo (IndexedDB + Dexie.js)

**Ver también:** [CHANGELOG.md](./CHANGELOG.md) · [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## ARQUITECTURA GENERAL

```
JJLM/
├── BACKEND/    # Node.js + TypeScript, Express, Sequelize ORM, MySQL
└── FRONTEND/   # React + TypeScript, Vite, Zustand, Tailwind CSS
```

**Backend:** patrón MSC (Model-Service-Controller). Cada módulo tiene: `*.model.ts` → `*.service.ts` → `*.controller.ts` → `*.routes.ts` → `*.dto.ts`.

**Frontend:** Component-Based con estado global Zustand. `pages/` componen `components/` (organizados en `ui/`, `layout/`, `features/`), `services/` llaman la API REST, `store/` mantiene estado global, `repositories/` abstrae acceso a datos local+remoto (patrón Repository para offline-first).

**Path alias backend:** `@/` apunta a `src/` (e.g., `import logger from '@/core/logger'`).

---

## COMANDOS DE DESARROLLO

### Backend (`cd BACKEND`)

```bash
npm run dev          # Nodemon + TypeScript watch (puerto 3000)
npm run build        # Compila TypeScript → dist/
npm start            # Ejecuta dist/server.js (producción)
npm test             # Jest (infraestructura lista, sin tests implementados aún)
npm run test:watch
npm run test:coverage

npm run lint
npm run lint:fix
npm run format
npm run seed         # Ejecuta seeders
```

### Frontend (`cd FRONTEND`)

```bash
npm run dev          # Vite dev server (puerto 5173)
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint
npm run test:e2e     # Playwright e2e tests
npm run test:e2e:ui  # Playwright con UI interactiva
# Tests unitarios (solo offline-first): vitest sobre LocalDatabase, ProductRepository, OrderRepository
npx vitest run
```

### Docker

```bash
# Producción (desde la raíz del proyecto):
docker-compose up -d
docker-compose down
docker-compose logs -f

# Desarrollo:
cd BACKEND && npm run docker:dev
```

---

## STACK Y DEPENDENCIAS CLAVE

### Backend
- **Express** + **Sequelize ORM** (MySQL) con **sequelize-typescript**
- **Zod** para validación en DTOs
- **JWT** (jsonwebtoken) + **bcryptjs** para auth
- **Winston** para logging (archivos en `BACKEND/logs/`)
- **Soft deletes** en todos los modelos (`paranoid: true`)
- **No hay migrations** — se usa `sequelize.sync({ alter: false })`. Esto **solo crea tablas nuevas**, nunca agrega columnas a tablas existentes. Al agregar una columna a un modelo, hay que correrla manualmente en producción:
  ```bash
  docker exec -it <mysql-container> mysql -u root -p jjlm_db -e "ALTER TABLE <tabla> ADD COLUMN <col> <tipo> NULL AFTER <col_anterior>;"
  # Ver nombre del contenedor: docker ps | grep mysql
  ```

### Frontend
- **Zustand** para estado global
- **Axios** con interceptores (auto-attach token JWT, auto-logout en 401)
- **React Hook Form** para formularios
- **Dexie.js** para IndexedDB (feature offline-first en desarrollo)
- **Playwright** para tests e2e

---

## MÓDULOS BACKEND

Ubicados en `BACKEND/src/modules/`:

| Módulo | Descripción |
|--------|-------------|
| `auth/` | Login, register, JWT |
| `user/` | CRUD usuarios (solo admin) |
| `category/` | Categorías de productos |
| `product/` | Productos con búsqueda y paginación |
| `supplier/` | Proveedores |
| `price/` | Precios por producto/proveedor, tracking de cambios |
| `customer/` | Clientes con búsqueda |
| `order/` + `order/order-item/` | Órdenes con items, transacciones DB, numeración automática |

---

## FEATURE OFFLINE-FIRST (en desarrollo activo)

Documentado en `PROGRESO-OFFLINE-FIRST.md`. Implementa capacidad offline con sincronización:

**Archivos clave frontend:**
- `src/database/LocalDatabase.ts` — Dexie.js con 9 tablas locales
- `src/database/schemas/index.ts` — Esquemas Dexie
- `src/database/types/index.ts` — Tipos utilitarios: `ServerModel<T>`, `CreateModel<T>`, `SyncMetadata`
- `src/repositories/` — Patrón Repository: `BaseRepository` + repos por entidad (Product, Order, Customer, Price, Supplier, User). Abstrae leer/escribir en IndexedDB vs API según conectividad. Ver `src/repositories/README.md`.
- `src/store/syncStore.ts` — Estado de sincronización
- `src/services/pushNotifications.ts` — Notificaciones push
- `src/hooks/` — `useNetworkStatus`, `useAuth`, `useLocalStorage`, `usePushNotifications`

**Campos de sincronización** en modelos locales: `_syncStatus` (synced | pending_create | pending_update | pending_delete | conflict), `_version`, `_lastModifiedAt`, `_lastModifiedBy`.

---

## SISTEMA DE ROLES Y MIDDLEWARES

**Archivo:** `BACKEND/src/core/middlewares/auth.ts`

- `isAuth` — token JWT válido (cualquier rol)
- `isSeller` — rol seller o admin
- `isAdmin` — solo admin

Roles: `buyer` no puede crear órdenes ni eliminar; `seller` no puede eliminar ni gestionar usuarios; `admin` acceso completo.

---

## CONFIGURACIÓN

**Variables de entorno:** `BACKEND/.env`

```
NODE_ENV, PORT, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET, JWT_EXPIRES_IN
CORS_ORIGIN
```

**Base de datos:** MySQL, nombre `jjlm_db`. Se crea automáticamente una categoría "Sin categoría" al iniciar.

**Docker deploy:** VPS con Dokploy + Traefik. La red `dokploy-network` es externa y gestionada por Dokploy. Backend en puerto 3001, Frontend nginx en puerto 8080 (proxy `/api/` → backend).

---

## PATRONES IMPORTANTES

- **Errores:** usar las clases de `@/core/errors/AppError.ts` — `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (422), `InternalServerError` (500). Para casos custom: `new AppError(mensaje, statusCode)`. El middleware global en `errorHandler.ts` los captura.
- **Async controllers:** wrappear con `asyncHandler` de `@/core/utils/asyncHandler.ts`.
- **Transacciones:** las operaciones multi-tabla (ej. crear orden + items) deben usar `sequelize.transaction()`.
- **DTOs:** Zod schema + `z.infer<>` en cada módulo. Validar con `.parse(req.body)` en el controller.
- **Logging:** `import logger from '@/core/logger'` — no usar `console.log` directo.
