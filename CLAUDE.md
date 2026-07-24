# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proyecto: **Merco** (vendaflow).

**Otros documentos del repo:** `CHANGELOG.md` (historial de cambios, formato Keep a Changelog), `CONTRIBUTING.md` (flujo git — parcialmente desactualizado, ver nota de rama abajo), `PROGRESO-OFFLINE-FIRST.md` (avance del modo offline).

---

## PROPÓSITO DEL SISTEMA

**Merco** (nombre histórico: **JJLM** — así aparece en README, CHANGELOG y CONTRIBUTING) es una plataforma SaaS **multi-tenant** de gestión de precios y ventas:
- Comparación de precios de productos por proveedor
- Gestión de órdenes de venta y compra
- Inventario con movimientos de stock
- Reportes de ventas, compras y rentabilidad
- Modo offline-first (IndexedDB + Dexie.js)
- **Multi-tenant**: cada empresa cliente tiene su propio slug y datos aislados

**Acceso producción:**
- Frontend: `https://<slug>.merco.edwsystem.com`
- API: `https://api.merco.edwsystem.com`
- Demo: `https://demo.merco.edwsystem.com` (usuario: `demo_admin` / `Demo2024!`)
- Superadmin: login sin tenantSlug, usuario: `superadmin`

**Rama de despliegue:** `feature/multitenant-phase1` — Dokploy escucha esta rama y despliega automáticamente en cada push. (Ojo: CONTRIBUTING.md describe un flujo `main`/`dev` que ya no refleja la práctica actual — la rama activa de trabajo y deploy es esta.)

---

## ARQUITECTURA GENERAL

```
vendaflow/
├── BACKEND/    # Node.js + TypeScript, Express, Sequelize ORM, MySQL
├── FRONTEND/   # React + TypeScript, Vite, Zustand, Tailwind CSS
└── docker-compose.yml
```

**Backend:** patrón MSC (Model → Service → Controller → Routes → DTO).

**Frontend:** Component-Based + Zustand. `pages/` → `components/` (ui/ layout/ features/), `services/` → API REST, `store/` → estado global, `repositories/` → abstracción offline-first.

**Path alias backend:** `@/` → `src/`

---

## MULTI-TENANCY

### Cómo funciona
- Cada tenant tiene un `slug` único (ej. `demo`, `imperium`)
- El frontend detecta el tenant del subdominio: `demo.merco.edwsystem.com` → slug `demo`
- En login: `{ username, password, tenantSlug }` en el **body** (no en headers)
- El JWT incluye `tenantId` — todos los endpoints lo usan para filtrar datos
- El middleware `tenantScope` en `BACKEND/src/core/middlewares/tenantScope.ts` aplica el filtro de tenant

### Roles
| Rol | Acceso |
|-----|--------|
| `superadmin` | Todo sin restricción de tenant. Login sin tenantSlug. Panel en `/superadmin` |
| `admin` | Gestión completa de su tenant |
| `seller` | Órdenes, clientes, reportes, inventario |
| `buyer` | Productos, precios, proveedores, categorías |

### Middlewares de auth
`BACKEND/src/core/middlewares/auth.ts`:
- `isAuth` — JWT válido (cualquier rol)
- `isAdmin` — admin o superadmin
- `isSuperAdmin` — solo superadmin
- `isSeller` — seller, admin o superadmin
- `isBuyer` — buyer, admin o superadmin
- `optionalAuth` — auth opcional (no falla si no hay token)

---

## COMANDOS DE DESARROLLO

### Backend (`cd BACKEND`)
```bash
npm run dev          # Nodemon + TypeScript watch (puerto 3005)
npm run build        # Compila TypeScript → dist/ (tsc + tsc-alias)
npm start            # Ejecuta dist/server.js
npm run lint
npm run lint:fix
npm run format
npm test             # Jest (configurado, pero hoy no hay archivos *.test.ts en BACKEND)
npx jest <ruta>      # Un solo archivo de test
npm run seed         # Puebla datos demo (src/seeders/seed.ts, conexión directa a MySQL)
```

### Frontend (`cd FRONTEND`)
```bash
npm run dev          # Vite dev server (puerto 5173)
npm run build        # Build de producción
npm run lint
npx vitest run       # Tests unitarios offline-first (src/**/__tests__, usan fake-indexeddb)
                     # ⚠️ vitest NO está en devDependencies — npx lo descarga al vuelo
npm run test:e2e     # Playwright e2e (specs en e2e/, levanta el dev server solo)
npx playwright test e2e/app.spec.ts   # Un solo spec e2e
npm run test:e2e:ui  # Playwright con UI
```

### Docker (desde raíz)
```bash
docker-compose up -d --build
docker-compose down
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## STACK Y DEPENDENCIAS CLAVE

### Backend
- **Express** + **Sequelize ORM** (`sequelize-typescript`) + **MySQL 8.0**
- **Zod** para validación en DTOs
- **JWT** (jsonwebtoken) + **bcryptjs** para auth
- **Winston** para logging (`BACKEND/logs/`)
- **Helmet** + **CORS** + **express-rate-limit** (20 intentos/15min en `/api/auth`)
- **Compression** para respuestas gzip
- **Soft deletes** en todos los modelos (`paranoid: true`)
- **Sin migrations** — `sequelize.sync({ alter: false })` solo crea tablas nuevas. Para agregar columna en producción:
  ```bash
  docker exec -it merco-mysql mysql -u root -p merco_db -e \
    "ALTER TABLE <tabla> ADD COLUMN <col> <tipo> NULL AFTER <col_anterior>;"
  ```

### Frontend
- **Zustand** para estado global
- **Axios** con interceptores (auto-attach JWT, auto-logout en 401)
- **React Hook Form** para formularios
- **Dexie.js** para IndexedDB (offline-first)
- **Recharts** para gráficas en Reports
- **date-fns** para fechas
- **lucide-react** para íconos (único icon set — no mezclar)
- **Tailwind CSS** para estilos (no usar librerías UI externas)
- **jspdf** + **html2canvas** para exportar PDF
- **Capacitor 8** ya instalado — existe `FRONTEND/android/` (proyecto Gradle) y `capacitor.config.ts` (appId `com.edwsystem.jjlm`, webDir `dist`)

---

## MÓDULOS BACKEND

`BACKEND/src/modules/`:

| Módulo | Ruta API | Descripción |
|--------|----------|-------------|
| `auth/` | `/api/auth` | Login, JWT. Rate limited (20/15min) |
| `user/` | `/api/users` | CRUD usuarios del tenant (solo admin) |
| `category/` | `/api/categories` | Categorías de productos |
| `product/` | `/api/products` | Productos con búsqueda y paginación |
| `supplier/` | `/api/suppliers` | Proveedores |
| `price/` | `/api/prices` | Precios por producto/proveedor, historial |
| `customer/` | `/api/customers` | Clientes con búsqueda |
| `order/` | `/api/orders` | Órdenes de venta con items |
| `purchase-order/` | `/api/purchase-orders` | Órdenes de compra |
| `stock-movement/` | `/api/stock-movements` | Movimientos de inventario |
| `push/` | `/api/push` | Notificaciones push (Web Push VAPID) |
| `tenant/` | `/api/tenants` | Gestión de tenants (superadmin) |
| `tenant/onboarding` | `/api/onboarding/register` | Registro público de nuevo tenant |

---

## RUTAS FRONTEND

`FRONTEND/src/routes/AppRouter.tsx`:

| Ruta | Componente | Roles |
|------|-----------|-------|
| `/login` | Login | público |
| `/superadmin` | Superadmin | superadmin |
| `/` | Home | buyer, admin |
| `/products/:id` | ProductDetail | buyer, admin |
| `/products/new` | ProductNew | buyer, admin |
| `/orders` | Orders | seller, admin |
| `/orders/new` | OrderNew | seller, admin |
| `/orders/:id` | OrderDetail | seller, admin |
| `/suppliers` | Suppliers | buyer, admin |
| `/categories` | Categories | buyer, admin |
| `/prices` | Prices | buyer, admin |
| `/customers` | Customers | seller, admin |
| `/reports` | Reports | seller, admin |
| `/inventory` | Inventory | seller, admin |
| `/purchase-orders` | PurchaseOrders | seller, admin |
| `/users` | Users | admin |
| `/settings` | TenantSettings | admin |

---

## INFRAESTRUCTURA Y DEPLOY

**Servidor:** VPS — Dokploy + Traefik

**Contenedores Docker:**
- `merco-mysql` — MySQL 8.0, solo en `dokploy-network` (sin puerto externo)
- `merco-backend` — Node.js, puerto 3005, en `dokploy-network`
- `merco-frontend` — nginx, en `dokploy-network`, expuesto vía Traefik

**DNS Traefik:** `*.merco.edwsystem.com` → `merco-frontend` (nginx proxy `/api/` → backend)

**IMPORTANTE — nginx proxy:** al usar variable `$backend_host` en proxy_pass, hay que incluir `$request_uri` explícitamente:
```nginx
proxy_pass http://$backend_host:3005$request_uri;
```

**Variables de entorno clave en Dokploy:**
- `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` — cuenta superadmin
- `DEMO_ADMIN_PASSWORD` — resetea demo_admin en cada arranque. No configurar fallback hardcodeado en docker-compose
- `JWT_SECRET` — secreto de firma JWT
- `MYSQL_PASSWORD` / `DB_PASSWORD` — credenciales MySQL

**Compose ID (deploy manual):** `fRFCqlfP25dO1If1jmo8I`

---

## STARTUP HOOKS (server.ts)

Al arrancar el backend:
1. `initializeDatabase()` — sync Sequelize, crea categoría "Sin categoría"
2. `ensureSuperadmin()` — crea/actualiza superadmin desde vars de entorno
3. `ensureDemoData()` — si `DEMO_ADMIN_PASSWORD` está seteado, garantiza tenant `demo` + `demo_admin`

---

## FEATURE OFFLINE-FIRST

**Archivos clave:**
- `src/database/LocalDatabase.ts` — Dexie.js, 9 tablas locales
- `src/repositories/` — patrón Repository: lee de IndexedDB offline, de API online
- `src/store/syncStore.ts` — estado de sincronización
- `src/hooks/useNetworkStatus.ts` — detecta conectividad

**Campos de sync:** `_syncStatus` (synced | pending_create | pending_update | pending_delete | conflict), `_version`, `_lastModifiedAt`, `_lastModifiedBy`

---

## COMPONENTES UI REUTILIZABLES

`FRONTEND/src/components/ui/`:
- `Modal.tsx` — bottom-sheet en mobile, centered en desktop. Animación `slide-up`
- `InstallModal.tsx` — modal PWA: instrucciones por plataforma (iOS/Android/desktop) + manual de usuario en accordion
- `CustomerModal.tsx` — bottom-sheet para crear/editar clientes
- `Button.tsx`, `Input.tsx`, `SearchableSelect.tsx`, `LoadingSpinner.tsx`, `TopLoadingBar.tsx`

`FRONTEND/src/components/layout/`:
- `Header.tsx` — mobile-only header sticky. Capta `beforeinstallprompt` event. Abre `InstallModal`. Retorna `<>header + InstallModal</>` (Fragment obligatorio — no omitir)

---

## PATRONES IMPORTANTES

**Errores backend:** clases en `@/core/errors/AppError.ts`:
- `BadRequestError(400)`, `UnauthorizedError(401)`, `ForbiddenError(403)`
- `NotFoundError(404)`, `ConflictError(409)`, `ValidationError(422)`, `InternalServerError(500)`

**Async controllers:** siempre con `asyncHandler` de `@/core/middlewares/asyncHandler.ts`

**Transacciones:** operaciones multi-tabla usan `sequelize.transaction()`

**DTOs:** Zod schema + `z.infer<>`. En orders, los items necesitan `taxRate` (número, puede ser 0)

**Logging:** `import logger from '@/core/logger'` — nunca `console.log` en producción

**CORS backend:** acepta lista estática (`CORS_ORIGIN`) + wildcard `*.merco.edwsystem.com` (`CORS_WILDCARD_ORIGIN`)

---

## SEGURIDAD — NOTAS IMPORTANTES

- `PUT /orders/:id` debe tener `isSeller` (sin él, cualquier buyer puede modificar órdenes)
- No poner contraseñas con fallback hardcodeado en docker-compose (`:-valor`)
- `ensureSuperadmin` debe actualizar contraseña si ya existe (no solo en creación)
- Rate limiting solo en `/api/auth` — endpoints de búsqueda sin límite (pendiente de hardening)
- `GET /tenants/slug/:slug` es público y expone plan/maxUsers — considerar filtrar esos campos

---

## DATOS DEMO (tenant: demo)

- 7 categorías, 4 proveedores, 35 productos, 34 precios comparativos, 6 clientes, 8 órdenes
- Usuario: `demo_admin` / `Demo2024!`
- Seeder: `cd BACKEND && npm run seed` (`src/seeders/seed.ts`). Además, en cada arranque `ensureDemoData()` (en `src/core/startup/`) garantiza tenant demo + usuario si `DEMO_ADMIN_PASSWORD` está seteado

---

## MEJORAS PENDIENTES

### Panel Superadmin (`/superadmin`) — YA IMPLEMENTADO
- [x] Header oscuro slate-900 (diferenciación visual de contexto)
- [x] Stats cards: Total / Activos / Trial / Suspendidos
- [x] Alerta si trial vence en ≤7 días
- [x] Búsqueda por nombre/slug + filtro por estado
- [x] Tabla con color dot, "Abrir app" link, plan badge, fecha trial con countdown
- [x] Modal edición: nombre, plan, fecha trial, límites
- [x] Formulario crear nuevo tenant
- [x] Backend `PUT /tenants/:id` (superadmin only)
- [ ] Stats de uso real por tenant: usuarios activos, productos, órdenes del mes

### Home del cliente (`/`)
- [ ] KPIs reales: órdenes pendientes, ventas del mes, stock bajo
- [ ] Accesos rápidos: Nueva Orden, Nuevo Producto
- [ ] Actividad reciente (últimas 5 órdenes)

### Seguridad (hardening)
- [ ] Rate limiting general en todos los endpoints (no solo auth)
- [ ] Middleware `tenantScope` como capa de defensa extra en rutas de negocio
- [ ] `ensureSuperadmin` debe actualizar contraseña si el usuario ya existe
- [ ] Eliminar fallback `:-Demo2024!` del docker-compose

### UX general
- [ ] Breadcrumbs en páginas de detalle
- [ ] Confirmación antes de acciones destructivas
- [ ] Empty states descriptivos con acciones sugeridas

---

## APK POR TENANT — PLAN DE IMPLEMENTACIÓN

Los clientes pueden pedir "su app" instalable. Hay 3 niveles:

### Nivel 1 — Ya funciona: PWA instalable
Merco es PWA. Android Chrome muestra "Agregar a pantalla de inicio". `InstallModal` guía paso a paso.
Sin Play Store, sin APK. Suficiente para el 90% de clientes B2B.

### Nivel 2 — APK por tenant vía TWA (próximo paso recomendado)
`bubblewrap` convierte la PWA en APK nativo en ~30 min. El APK envuelve la URL del subdominio del tenant.
Nombre, ícono y color splash vienen del `manifest.json` de cada subdominio.

**Estado de implementación:**
1. [x] `GET /api/manifest` — `BACKEND/src/modules/tenant/manifest.routes.ts`. Público, sin auth. Lee slug de `X-Tenant-Slug` (lo pone nginx), `?slug=` o subdominio del Host. Devuelve `name`/`short_name`/`theme_color` (= `primaryColor`) del tenant; fallback a Merco/#3b82f6
2. [x] nginx proxea `location = /manifest.json` → backend `/api/manifest`, con fallback al `manifest.json` estático si el backend no responde (`@manifest_static`)
3. [ ] Por cada cliente que pida APK: `bubblewrap init --manifest https://slug.merco.edwsystem.com/manifest.json && bubblewrap build`
4. [ ] Entregar el `.apk` generado — se instala directo en el cel o se sube al Play Store del cliente
5. [ ] Pendiente: íconos por tenant (hoy todos usan los íconos Merco de `/icons/`)

**Costo por tenant:** ~10 min una vez configurado el manifest dinámico.
**Play Store:** $25 USD cuenta de desarrollador (una sola cuenta para todos los tenants, o una por cliente si quieren su propia cuenta).

### Nivel 3 — Nativo white-label: Capacitor (parcialmente montado)
Capacitor 8 ya está instalado en el frontend con proyecto Android generado (`FRONTEND/android/`, appId `com.edwsystem.jjlm`) y plugins network/filesystem/share. Falta: white-label por tenant, push nativo, publicación.
No avanzar más hasta tener volumen real de clientes que lo exijan.

### Decisión por situación
| Cliente pide | Solución |
|---|---|
| "App en el celular" | PWA — InstallModal ya lo resuelve |
| APK para distribuir internamente | TWA con bubblewrap |
| App en Play Store con su logo | TWA publicado en Play Store |
| Funciones nativas (cámara, biometría) | Capacitor (futuro) |
