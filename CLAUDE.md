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
- Superadmin: **app separada en `https://admin.merco.edwsystem.com`** (build multi-entry: `admin.html` + `src/admin.tsx`; login propio sin tenantSlug). La app de tenants NO contiene código superadmin
- **IMPORTANTE — dominios**: cada subdominio (tenants nuevos incluidos) debe registrarse a mano en Dokploy → compose Merco → Domains (frontend, puerto 80, HTTPS/letsencrypt) + redeploy. El "wildcard" del docker-compose no funciona (sintaxis Traefik v2 en un Traefik v3)

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
- El middleware `tenantScope` (`BACKEND/src/core/middlewares/tenantScope.ts`) se monta como `tenantGuard` (= `isAuth` + `tenantScope`) en todas las rutas de negocio en app.ts: bloquea tenants suspendidos/cancelados con cache de 60s. El filtro de datos por `tenantId` lo hace cada service

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
npm test             # Jest — 21 tests: DTOs de orden (crédito), tenantScope (cache), getNextCode
npx jest <ruta>      # Un solo archivo de test
npm run seed         # Puebla datos demo (src/seeders/seed.ts, conexión directa a MySQL)
```

### Frontend (`cd FRONTEND`)
```bash
npm run dev          # Vite dev server (puerto 5173)
npm run build        # Build de producción
npm run lint
npm test             # vitest — 67 tests offline-first (LocalDatabase, Product/OrderRepository)
                     # Config en vitest.config.ts + setup en src/tests/vitest.setup.ts
                     # (fake-indexeddb + stub de localStorage: el de Node ≥22 no es funcional)
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

### Backups de MySQL (configurado jul 2026)
- Script en el VPS: `/usr/local/bin/merco-backup-db.sh` — dump de `merco-mysql`, `jjlm-mysql` y `jjlm-staging-mysql` (credenciales desde el env de cada contenedor, sin secretos en el script)
- Cron (root): diario 02:30, log en `/var/log/merco-backup.log`
- Local: `/var/backups/merco/` (retención 7 días) · Off-site: Backblaze `b2-jjlm:jjlm-backups/db/` (retención 30 días, mismo patrón rclone que SIPGR)
- Acceso VPS: `ssh -i ~/.ssh/id_ed25519_personal ubuntu@158.69.219.152` (docker/rclone requieren `sudo`)
- **Restaurar**: `gunzip -c archivo.sql.gz | sudo docker exec -i merco-mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" merco_db'` (descargar de B2 con `rclone copy b2-jjlm:jjlm-backups/db/<archivo> .`)

### CI (configurado jul 2026)
- Los tests corren dentro del Docker build (`RUN npm test` en ambos Dockerfiles): si fallan, el build falla y **Dokploy aborta el deploy** — queda corriendo la versión anterior
- `/health` expone `version` (bump manual en app.ts) para verificar desde fuera qué build está en producción

### Monitoreo (configurado jul 2026)
- Watchdog en el VPS: `/usr/local/bin/merco-healthcheck.sh` — cron cada 5 min, log en `/var/log/merco-health.log`
- Vigila: API (`/health`), frontend (demo), backup fresco (<26h) y disco (<85%)
- Alertas push vía **ntfy.sh**, canal `merco-alertas-0e4f4a1cec56` — suscribirse en la app ntfy (Android/iOS) o en `https://ntfy.sh/merco-alertas-0e4f4a1cec56`. Avisa caída (tras 2 fallos consecutivos = >5 min) y recuperación; backup/disco máximo 1 alerta al día
- Estado anti-spam en `/var/run/merco-health/` (se limpia al reiniciar el VPS, inofensivo)
- Pendiente opcional: Sentry para stack traces de errores 500 (requiere crear cuenta)

---

## STARTUP HOOKS (server.ts)

Al arrancar el backend:
1. `initializeDatabase()` — sync Sequelize, crea categoría "Sin categoría"
2. `ensureSchema()` — agrega columnas nuevas a tablas existentes (mini-migración: `sync({alter:false})` no agrega columnas). Al agregar una columna a un modelo, registrarla también aquí
3. `ensureSuperadmin()` — crea/actualiza superadmin desde vars de entorno
4. `ensureDemoData()` — si `DEMO_ADMIN_PASSWORD` está seteado, garantiza tenant `demo` + `demo_admin`
5. `startPaymentReminderJob()` — job diario: push a admin/sellers del tenant con órdenes a crédito por vencer (ventana = `reminderDays` de cada orden) o vencidas
6. `startTrialExpiryJob()` — job diario (`core/jobs/trialExpiry.ts`): suspende tenants con trial vencido (el slug `demo` está exento) y avisa por push al admin del tenant y a los superadmins desde 3 días antes. El login ya rechaza tenants suspendidos

## REGISTRO PÚBLICO Y PAGOS (jul 2026)

- **/registro** (frontend, cualquier subdominio): solicitud pública → `POST /api/onboarding/request` con captcha propio (HMAC con JWT_SECRET, `GET /api/onboarding/captcha`), honeypot `website` y rate limit 10/h. NO crea tenant: push al superadmin, quien aprueba desde la sección Solicitudes (crea tenant con slug/admin) o rechaza. El antiguo `/register` público fue eliminado
- **Pagos Bre-B**: precios por env (`PLAN_PRICE_BASIC/PRO/ENTERPRISE`, defaults 50k/100k/200k COP) + `BREB_KEY`/`BREB_HOLDER` en `config/plans.ts`. Tenant reporta pago con comprobante (base64 ≤2MB) desde Configuración → push al superadmin → aprueba en sección Pagos (activa plan, recibo `REC-####`, push al tenant) o rechaza con motivo. Tablas `tenant_requests` y `plan_payments` (sync las crea solo)
- **Ciclo de suscripción (v1.11.0)**: `tenants.paidUntil` (DATEONLY, null = cortesía/legado exento del ciclo) + `suspendedReason` (trial_expired|nonpayment|manual — un pago reactiva las dos primeras, NUNCA la manual). Registro manual de pagos por superadmin: `POST /tenants/:id/payments` (crea PlanPayment approved source=superadmin con REC-#### y extiende paidUntil vía `applyPaymentToTenant`, misma ruta de código que aprobar un pago reportado). `plan_payments` ganó source/method/months/paidAt/periodStart/periodEnd/notes. Job `subscriptionRenewal` (dailyScheduler): avisa al tenant a warnDays y 1 día, gracia configurable, suspende por no pago con push a ambos lados; `renewal_warn_days`/`grace_days` en platform_settings (default 5/5). Sección **Finanzas** en superadmin: MRR, cobrado/mes, morosos, próximos vencimientos, sin-fecha (lista de trabajo post-deploy), histórico por tenant; modal "Registrar pago" (botón $ en la fila y en cada tabla). Lógica de fechas pura en `modules/tenant/subscription.ts` (testeada: clamp fin de mes, ancla vigente/vencido)
- **Email de respaldo (v1.12.0)**: `core/email.ts` — nodemailer SMTP, activo solo si `SMTP_HOST/USER/PASS` están en el entorno (Dokploy + passthrough en compose; `SMTP_FROM` opcional). `sendEmail()` es no-op sin config y tolerante a fallos. Se envía además del push en: avisos de renovación/vencido/suspensión (subscriptionRenewal), recibos de pago (manual y aprobado), y fin de trial. Destinatario: `tenants.contactEmail`. Campos `contactName/contactEmail/contactPhone` en tenants (ensureSchema) — `approveRequest` los copia de la solicitud (antes se perdían), editables en el modal del superadmin. Botón WhatsApp (wa.me con mensaje de cobro prellenado) en la tabla de morosos de Finanzas
- **Reporte mensual en Excel (v1.12.1)**: `GET /orders/report/monthly` devuelve .xlsx (exceljs) con 4 hojas — Resumen (KPIs del mes: base/IVA/total, costo/utilidad/margen, contado vs crédito, cobrado/por cobrar, top producto/cliente), Órdenes (con abonado/saldo, canceladas tachadas), Productos (ranking con % de ventas y stock) y Clientes. Utilidad sobre base sin IVA. `getMonthlyReportCsv` fue reemplazado
- **Abonos parciales**: tabla `order_payments`; `POST/GET /orders/:id/payments` (isSeller); auto-marca `paidAt` al completar; receivables usa saldo (total − abonado). UI en OrderDetail
- **Branding PWA**: si el tenant tiene `logoUrl`, el manifest usa su logo como ícono de instalación
- **Búsqueda de órdenes**: con ≥2 chars y online, Orders consulta `GET /orders/search` (debounce 400ms); offline filtra local
- **Superadmin lazy**: `React.lazy` en AppRouter — su bundle no se envía a usuarios tenant
- **Embudo comercial**: tabla `metrics_daily` (contadores diarios, sin cookies). `POST /api/onboarding/track` (público, eventos `landing_view`/`registro_view` — Landing y Registro lo disparan al montar); `GET /tenants/platform/funnel` (superadmin, 30 días): visitas → registro → solicitudes → aprobadas con % de conversión. Card "Embudo comercial" en el dashboard del superadmin

## INVENTARIO Y KARDEX (ago 2026)

- **DECIMAL como número**: `dialectOptions: { decimalNumbers: true }` en `database/index.ts` — sin esto MySQL devuelve DECIMAL como string y las sumas concatenan texto (bug real: recibir compra dejaba stock "-1620"). `createMovement` además valida/coacciona `quantity`
- **Todo cambio de stock deja movimiento**: ventas/compras ya lo hacían; ahora también `PATCH /products/:id/stock` y editar `stock` en `PUT /products/:id` generan movimiento `adjustment` (vía `StockMovementService`, transaccional). No sobreescribir stock en silencio
- **Kardex visible**: pestaña "Movimientos" en Inventario (`components/features/InventoryMovements.tsx`) — tipo (Venta/Compra/Ajuste), cantidad, stock antes→después, detalle, "Cargar más"
- **Numeración por tenant**: ORD-#### y POC-#### se generan filtrando por `tenantId` (el índice único ya era compuesto). Antes eran globales y los consecutivos saltaban entre clientes
- **Seguridad**: `GET /stock-movements` y `GET /stock-movements/product/:id` filtran por `tenantId` del JWT (antes exponían movimientos de todos los tenants)

## ÓRDENES DE COMPRA — affectsStock

- `affectsStock` (boolean, default true) en `purchase_orders`: si es false, al recibir la orden NO se crean movimientos de stock — para registrar compras por costos cuando el inventario ya fue cargado (ej. carga inicial del cliente)
- Checkbox "Sumar al inventario al recibir" en PurchaseOrderNew; badge "No suma inventario" en el detalle

## ÓRDENES A CRÉDITO (plazo de pago)

- Campos en `orders`: `paymentType` (cash|credit), `paymentDueDate` (DATEONLY), `reminderDays` (días antes para recordar, default 3), `paidAt` (null = por cobrar)
- Endpoints: `GET /orders/receivables` (cartera, isSeller), `PATCH /orders/:id/pay` (marcar pagada / body `{paid:false}` revierte, isSeller)
- Frontend: selector Contado/Crédito en OrderNew (chips 7/15/30/60 días + fecha + recordatorio), banner de cartera y badges en Orders, card de pago con "Marcar pagada" en OrderDetail
- Recordatorios: `BACKEND/src/core/jobs/paymentReminders.ts` — corre 1 min tras el arranque y luego cada 24h; usa `pushService.notifyUsers()`

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

### Auditoría ago 2026 (v1.8.0) — corregido
- Purchase-orders: TODO el módulo filtraba sin `tenantId` (list/get/update/delete exponían y mutaban datos de otros tenants) — cerrado
- Order create: `customerId`/`productId` se validan contra el tenant del JWT (antes IDOR: cliente/producto ajeno)
- `createMovement` filtra producto por tenant y usa `lock: t.LOCK.UPDATE` (evita lost updates concurrentes)
- Push de precios: `notifyTenant()` (antes `notifyAll` mandaba precios de un tenant a TODA la plataforma); `unsubscribe` solo borra suscripciones propias
- `JWT_SECRET` ausente en producción → `process.exit(1)` (antes fallback público del repo)
- IndexedDB: al hacer login con un tenant distinto al último usado en el dispositivo, se limpia la BD local (aislamiento en equipos compartidos)
- Totales de orden **incluyen IVA por línea** (antes la BD guardaba base y factura/cartera/pagos no cuadraban; reportes de utilidad siguen sobre base sin IVA)
- Stock se reconcilia al editar/cancelar/eliminar/restaurar órdenes (movimientos `adjustment` con nota; antes el stock quedaba descuadrado para siempre)
- Cuotas de plan aplicadas: `maxUsers`/`maxProducts`/`maxOrdersPerMonth` se verifican en cada create (409 con mensaje de upgrade)
- Ruta `/customers/trash` antes de `/:id` (Express casa por orden; la papelera era inalcanzable)
### Auditoría ronda 3 (v1.10.0) — corregido
- **Errores de API como `Error` real** (`ApiRequestError` en `services/api.ts`): antes el interceptor rechazaba con objeto literal y TODOS los mensajes del backend caían al genérico. `isNetworkError` marca red caída/timeout/502-504 → habilita el fallback offline de órdenes (estaba muerto). El 401 de `/auth/login` ya NO recarga la página
- **Idempotencia de órdenes**: `clientRef` (STRING(64) en orders + ensureSchema) — el cliente genera UUID por orden; POST repetido devuelve la existente. Lock `navigator.locks` entre pestañas en syncPendingOrders
- **Abonos endurecidos**: rechaza NaN/negativos/exceso sobre saldo/órdenes canceladas; `DELETE /orders/:id/payments/:paymentId` (isAdmin) para corregir; editar orden a crédito recalcula `paidAt` contra abonos (la deuda ya no desaparece de cartera)
- **creditBalance de clientes y receivable de superadmin restan abonos** (igual que cartera)
- **Jobs diarios**: `core/jobs/dailyScheduler.ts` — corre ≥7:00 hora local con dedup persistido en platform_settings (`job_last_run_*`): un redeploy ya no re-envía los push del día. `TZ: America/Bogota` en compose + tzdata en Dockerfile; paymentReminders calcula la fecha en JS (no CURDATE de MySQL en UTC)
- **syncQueue**: deletes y conteos filtran por `entityType` (antes borrar una orden local podía matar la entrada de un cliente con el mismo id local y dejarlo pendiente para siempre)
- **nginx**: X-Frame-Options/nosniff/Referrer-Policy en ambos server blocks + `client_max_body_size 8m` (los comprobantes base64 daban 413 con el default 1m). `BACKEND/nginx/` (config muerta) eliminado
- **Impersonar**: `window.open` síncrono (el bloqueador de popups lo mataba en silencio)
- `FRONTEND/src/utils/backgroundSync.ts` (código muerto roto) eliminado
- **Cambio de contraseña propia** (v1.9.0): `PUT /users/me/password` (isAuth, cualquier rol; exige currentPassword) — la ruta va ANTES del `router.use(isAuth, isAdmin)`. UI: `ChangePasswordModal` accesible desde Sidebar (desktop) y menú de usuario del Header (móvil)
- **Sentry** (v1.8.x): `@sentry/node` init en `core/sentry.ts` solo si `SENTRY_DSN` está seteado (Dokploy + passthrough en docker-compose). errorHandler reporta 500s con url/método/usuario/tenant. Proyecto `merco-backend` en edwsystem.sentry.io, GitHub app instalada solo en el repo vendaflow (suspect commits + stack trace linking)

- `PUT /orders/:id` debe tener `isSeller` (sin él, cualquier buyer puede modificar órdenes) — aplicado
- No poner contraseñas con fallback hardcodeado en docker-compose (`:-valor`) — el fallback `:-Demo2024!` fue eliminado; `DEMO_ADMIN_PASSWORD` debe estar seteado en Dokploy
- `ensureSuperadmin` actualiza la contraseña desde el env var si el usuario ya existe (permite rotarla con redeploy)
- Rate limiting: `/api/auth` 20/15min + límite general `/api` 3000/15min por IP (alto a propósito para no afectar uso normal)
- `GET /tenants/slug/:slug` (público) solo expone id/slug/name/status/logoUrl/primaryColor — plan y límites requieren auth (`/tenants/me`)

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
- [x] Stats de uso real por tenant: columna "Uso" (`usado/límite` de usuarios, productos y órdenes del mes) con alerta ámbar ≥70% y roja ≥100%. `GET /tenants` incluye `usage` (3 queries agrupadas, sin N+1)
- [x] KPI cards de plataforma (tenants con desglose, órdenes del mes, usuarios totales, trials por vencer) + panel "Actividad del mes" (top 5 tenants por órdenes con barras)
- [x] **Impersonar**: `POST /tenants/:id/impersonate` genera JWT del primer admin del tenant; el panel abre `https://slug…/login?impersonate=<token>` y Login.tsx lo consume (sesión completa sin contraseña)
- [x] **Extender trial 1-click**: chip "+7d" en la fila (suma sobre la fecha actual o hoy); extender un trial vencido **reactiva** el tenant suspendido automáticamente (lógica en `tenantService.update`)
- [x] **Detalle por tenant** (ojo en la fila): usuarios, órdenes por mes (6m), cartera pendiente + acciones export/impersonar
- [x] **Anuncio push** (`POST /tenants/broadcast`): a toda la plataforma o a un tenant, opcional solo admins
- [x] **Crecimiento**: órdenes/mes de la plataforma y tenants nuevos/mes (`GET /tenants/platform/stats`)
- [x] **Card Sistema**: versión desplegada (`APP_VERSION` en `config/version.ts` — bump manual) + última corrida de los jobs diarios (`core/jobs/jobStatus.ts`)
- [x] **Export de tenant**: `GET /tenants/:id/export` → JSON completo (users sin password, productos, órdenes, etc.) para offboarding

### Home del cliente (`/`)
- DECISIÓN (jul 2026): se probó un dashboard de KPIs en el Home y se revirtió — el Home es la página de búsqueda de productos y el dashboard le estorbaba. NO volver a ponerlo ahí; si se quiere dashboard del tenant, hacerlo como página aparte
- El backend `GET /orders/stats/home` (isSeller: pendientes, ventas del mes, últimas 5 órdenes) quedó desplegado y disponible para esa futura página. `productService.getStockAlerts()` y `getHomeStats()` siguen en los services del frontend

### Seguridad (hardening)
- [x] Rate limiting general en todos los endpoints (3000/15min por IP)
- [x] `ensureSuperadmin` actualiza contraseña si el usuario ya existe
- [x] Eliminar fallback `:-Demo2024!` del docker-compose
- [x] Filtrar plan/límites del endpoint público `GET /tenants/slug/:slug`
- [x] Middleware `tenantScope` en todas las rutas de negocio (`tenantGuard` en app.ts) — bloquea tenants suspendidos aunque el JWT siga vigente. Cache en memoria 60s del estado del tenant (una suspensión tarda ≤60s en aplicar)

### UX general
- [x] Breadcrumbs en páginas de detalle (`components/ui/Breadcrumbs.tsx` — OrderDetail y ProductDetail)
- [x] Confirmación antes de acciones destructivas (ya existía en la mayoría de páginas)
- [x] Empty states descriptivos con acciones sugeridas (Customers era el único sin CTA)
- [x] Órdenes: botón "Cargar más" acumulativo (reemplaza paginación prev/next)

### Seguridad — lecturas por rol (aplicado)
- Los `GET` de negocio ahora exigen rol, no solo token: orders/customers/purchase-orders/stock-movements → `isSeller`; prices → `isBuyer`. Products y categories quedan con `isAuth` (ambos roles los necesitan)

### Cartera (Informes)
- Pestaña "Cartera" en Reports: KPIs (por cobrar, órdenes, vencidas), deuda por cliente con barras y detalle de órdenes con vencimiento. Fuente: `GET /orders/receivables`

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
3. [x] Digital Asset Links: `GET /api/assetlinks` (`assetlinks.routes.ts`) + nginx proxea `/.well-known/assetlinks.json`. Registro de APKs por tenant en el mapa `TWA_APPS` — al generar un APK nuevo, agregar ahí packageId + huella SHA-256 del keystore
4. [x] APK demo generado: `apk-builds/demo/` (gitignored — contiene keystore y su contraseña). Proceso: `twa-manifest.json` a mano (evita el wizard) + `bubblewrap update --skipVersionUpgrade` + `bubblewrap build --skipPwaValidation`. Requiere `~/.bubblewrap/config.json` con jdkPath (bundle raíz, sin /Contents/Home) y androidSdkPath (dir con cmdline-tools en la raíz); `local.properties` del proyecto apunta al SDK completo de Android Studio
5. [ ] Por cada cliente nuevo: repetir el proceso de `apk-builds/demo/` con su slug/color, registrar huella en `TWA_APPS`, entregar el `.apk` o subirlo al Play Store del cliente
6. [ ] Pendiente: íconos por tenant (hoy todos usan los íconos Merco de `/icons/`)

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
