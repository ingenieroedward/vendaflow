# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proyecto: **Merco** (vendaflow).

**Otros documentos del repo:** `CHANGELOG.md` (historial de cambios, formato Keep a Changelog), `CONTRIBUTING.md` (flujo git — parcialmente desactualizado, ver nota de rama abajo), `PROGRESO-OFFLINE-FIRST.md` (avance del modo offline), `PLAN-FEATURES-Y-POS.md` (plan: feature-gating por plan + módulo POS, próximo a iniciar).

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
- Superadmin: **app separada en `https://admin.merco.edwsystem.com`** — proyecto Vite propio en `ADMIN/` (contenedor y `Dockerfile`/`nginx.conf` propios, ver `ARQUITECTURA GENERAL`; login propio sin tenantSlug). Hasta ago 2026 era un build multi-entry (`admin.html`+`src/admin.tsx`) dentro de `FRONTEND/` — ya no queda rastro de eso ahí. La app de tenants NO contiene código superadmin
- **Dominios AUTOMÁTICOS (v1.13.1)**: al crear/aprobar un tenant, `core/dokploy.ts` crea el subdominio vía API de Dokploy (`domain.create` + `compose.redeploy`, ~2 min) y avisa por push el resultado. Requiere `DOKPLOY_API_TOKEN` en el entorno (passthrough en compose; `DOKPLOY_URL` default http://dokploy:3000 interno, `DOKPLOY_COMPOSE_ID` default hardcodeado). Sin token → aviso de hacerlo a mano: Dokploy → compose Merco → Domains (frontend, puerto 80, HTTPS/letsencrypt) + redeploy. El "wildcard" del docker-compose no funciona (sintaxis Traefik v2 en un Traefik v3)

**Rama de despliegue:** `feature/multitenant-phase1` — Dokploy escucha esta rama y despliega automáticamente en cada push. (Ojo: CONTRIBUTING.md describe un flujo `main`/`dev` que ya no refleja la práctica actual — la rama activa de trabajo y deploy es esta.)

---

## ARQUITECTURA GENERAL

```
vendaflow/
├── BACKEND/    # Node.js + TypeScript, Express, Sequelize ORM, MySQL
├── FRONTEND/   # React + TypeScript, Vite, Zustand, Tailwind CSS — app de tenants
├── ADMIN/      # React + TypeScript, Vite, Zustand, Tailwind CSS — panel superadmin, proyecto aparte (ago 2026)
└── docker-compose.yml
```

**Backend:** patrón MSC (Model → Service → Controller → Routes → DTO).

**Frontend (tenants):** Component-Based + Zustand. `pages/` → `components/` (ui/ layout/ features/), `services/` → API REST, `store/` → estado global, `repositories/` → abstracción offline-first.

**Admin (superadmin, ago 2026):** proyecto Vite propio en `ADMIN/` — antes vivía como build multi-entry (`admin.html`/`admin.tsx`) dentro de `FRONTEND/`, compartiendo dependencias y tooling con la app de tenants sin necesitarlo (sin IndexedDB, sin offline, sin theming por tenant). Build/deploy propios: `Dockerfile` + `nginx.conf` + entrada dedicada en `docker-compose.yml`, servido en `admin.merco.edwsystem.com` vía su propio router de Traefik (prioridad explícita sobre el wildcard de tenants). El `admin.html`/`src/admin.tsx`/`src/pages/Superadmin.tsx`/`src/services/tenantAdmin.ts` viejos ya se quitaron de `FRONTEND/` (y su bloque de nginx, y la entrada multi-entry de `vite.config.ts`) una vez confirmado que el servicio nuevo servía en producción — no quedan dos copias divergiendo.

Estructura interna (dividida por sección, ago 2026): `src/pages/Superadmin.tsx` es solo el shell (~260 líneas) — sidebar/nav, estado global compartido entre secciones (tenants/finance/requests/payments/payCfg/funnel/platform/auditLogs — todo lo que también alimenta los badges del sidebar), `load()` (fetch único al montar) y los dos modales verdaderamente globales (`RegisterPaymentModal` vía `payTenant`, disparado tanto desde Tenants como desde Finanzas; `BroadcastModal` vía el botón "Anuncio" del sidebar). Cada sección vive en `src/pages/sections/` como componente propio que recibe los datos que necesita por props y **posee su propio estado de UI** (filtros, formularios, modales que solo ella dispara) en vez de que todo cuelgue del shell. `src/components/` tiene los modales reutilizables (`CreateTenantForm`, `EditTenantModal`, `BroadcastModal`, `ApproveRequestModal`, `RegisterPaymentModal`, `TenantDetailModal`, `UsagePill`). `src/utils/adminHelpers.ts` centraliza `PLAN_LABELS`/`STATUS_STYLE`/`STATUS_LABELS`/`daysUntil`/`tenantAppUrl`/el tipo `SectionKey` para que no diverjan entre secciones.

**Menú reorganizado + tarjeta "Para hoy" (ago 2026, tras revisión de un agente experto en SaaS)**: el menú original (Dashboard/Tenants/Solicitudes/Pagos/Finanzas/Auditoría) mezclaba en "Pagos" tres cosas de frecuencia distinta (config de Bre-B/precios/features del plan, 2FA de la propia cuenta, y la cola de aprobación de pagos) y repartía "algo espera mi decisión" en dos badges de colores distintos. Reorganizado a **Dashboard → Bandeja → Tenants → Finanzas → Auditoría → Configuración**:
- `sections/Bandeja.tsx` fusiona Solicitudes de registro + cola de aprobación de pagos (compone `Solicitudes.tsx` + `ColaPagos.tsx`, cada uno con su propio estado/handlers) — un solo badge de sidebar (`pendingRequests.length + pendingPayments.length`) en vez de dos.
- `sections/Configuracion.tsx` — llave/titular Bre-B, precios y features por plan, y el bloque de 2FA — todo lo que se toca una vez al mes o menos, separado de la cola operativa diaria.
- `sections/Dashboard.tsx` gana una tarjeta **"Para hoy"** al tope: reúne solicitudes pendientes, pagos pendientes, morosos (con monto) y trials por vencer — todo dato que ya estaba en memoria del shell, sin endpoint nuevo — cada ítem navega directo a su sección (`onNavigate: (s: SectionKey) => void`, pasado desde el shell). Si no hay nada pendiente, muestra un estado "al día" en vez de la tarjeta.
- Corregidos de paso 2 bugs de consistencia de color señalados por la revisión de diseño: el badge de "Pagos" pendientes usaba verde (mismo color que "Aprobado", significado opuesto) — ahora ámbar, igual que Solicitudes; `RegisterPaymentModal` tenía `focus:ring-indigo-500` suelto — ahora azul, como el resto del panel.

Verificado en cada paso: typecheck/lint/build limpios, probado en navegador sin errores de consola, deploy confirmado en producción antes de seguir al siguiente cambio.

**Ruteo real por sección (ago 2026)**: la sección activa vivía solo en `useState` — un reload o un link directo siempre volvía a Dashboard. `Superadmin.tsx` ahora deriva `section` de `useLocation().pathname` (con fallback a `dashboard` si la ruta no es una de `SECTION_KEYS`) y `setSection` es `navigate(`/${s}`)`; `main.tsx` no necesitó cambios (su `<Route path="*" .../>` ya cubre cualquier ruta, con o sin sesión). `document.title` se actualiza por sección (`Merco · Bandeja`, etc., vía `SECTION_TITLES` en `adminHelpers.ts`). `nginx.conf` del admin ya tenía `try_files $uri /index.html` así que las rutas nuevas no requirieron cambios de servidor.

**3 fixes de robustez (ago 2026, tras revisión de un agente sobre push/passkeys/features)**: agente recomendó NO implementar passkeys todavía (el riesgo real es la falta de recuperación del TOTP, no ausencia de WebAuthn — queda pendiente para más adelante) y sí estos tres, de bajo esfuerzo y alto impacto para un operador solo:
- `usePushNotifications.ts` (ADMIN): `toggle()` tenía un `try/finally` sin `catch` — si el navegador bloqueaba el permiso o `subscribe()` fallaba, el botón de campana no hacía nada visible. Ahora expone `isDenied`/`error`/`clearError`; el botón cambia de color/tooltip si está bloqueado a nivel navegador, y un banner ámbar (mismo patrón que el banner de error rojo existente) muestra el mensaje.
- Botón de recarga global (`RefreshCw`, llama a `load()`) agregado al header del sidebar y a la barra móvil — antes solo Tenants y Bandeja podían refrescar sus datos; Dashboard/Finanzas/Auditoría dependían de un F5 completo.
- `load()` en `Superadmin.tsx` ya no traga errores en silencio: un helper `track(key, promise, setter, fallback)` registra en `loadErrors: Record<string, boolean>` cuál fetch secundario falló. `Finanzas.tsx` (que antes se quedaba en "Cargando finanzas…" para siempre si `getFinance()` fallaba) y `Auditoria.tsx` (donde "sin logs" y "no cargó" se veían igual) ahora reciben `failed`/`onReload` y muestran un estado "no se pudo cargar — reintentar" en vez del loader eterno o el empty state ambiguo.

**Códigos de respaldo para el TOTP (ago 2026)** — cierra el riesgo real que el agente había señalado: sin esto, perder el dispositivo con la app autenticadora dejaba la cuenta de superadmin bloqueada para siempre (el login exige el código y `totpDisable` requiere `isAuth`, así que no hay forma de llegar ahí sin haber podido iniciar sesión antes).
- `core/totp.ts`: `generateBackupCodes()` (10 códigos `XXXX-XXXX`, 8 hex), `hashBackupCode()` (SHA-256, nunca se guarda texto plano), `findBackupCodeIndex()` (constant-time, tolera mayúsculas/espacios). `users.totpBackupCodes` (TEXT, JSON array de hashes, `ensureSchema`).
- `auth.service.ts login()`: si el TOTP no matchea, prueba contra los códigos de respaldo — si matchea, lo consume (lo remueve del array y persiste) y deja pasar el login. Un código de respaldo usado en login **no desactiva el 2FA**, solo abre esa sesión para poder reconfigurarlo.
- `totpEnable` genera y devuelve los 10 códigos en texto plano **una sola vez** (solo se guardan los hashes). Nueva ruta `POST /auth/totp/backup/regenerate` (exige un TOTP válido, no un código de respaldo, para que quien roba un solo código no pueda regenerar el resto) — invalida los anteriores y devuelve un set nuevo. `totpDisable` acepta TOTP o código de respaldo. `totpStatus` devuelve `backupCodesRemaining`.
- `ADMIN/src/pages/sections/Configuracion.tsx`: `BackupCodesModal` (grilla monoespaciada + copiar todos, "no se van a volver a mostrar") se muestra al activar 2FA y al regenerar; contador de códigos restantes con aviso ámbar si quedan ≤2 y botón "Regenerar" siempre visible con 2FA activo.
- Verificado con una prueba de integración real (Docker local + usuario superadmin desechable, sin tocar la cuenta real que ya tiene 2FA activo en producción): activar → login con código de respaldo → reintentar el mismo código falla (consumido) → regenerar invalida los viejos → desactivar con un código de respaldo también funciona → login vuelve a ser normal. Los 10 pasos se comportaron exactamente como se diseñaron.

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
npm test             # Jest — 76 tests: DTOs de orden/cotización, tenantScope (cache), getNextCode, TOTP, features, POS, suscripción
npx jest <ruta>      # Un solo archivo de test
npm run seed         # Puebla datos demo (src/seeders/seed.ts, conexión directa a MySQL)
```

### Frontend (`cd FRONTEND`)
```bash
npm run dev          # Vite dev server (puerto 5173)
npm run build        # Build de producción
npm run lint
npm test             # vitest — 82 tests offline-first (LocalDatabase, Product/Order/QuoteRepository)
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
| `quote/` | `/api/quotes` | Cotizaciones (feature `quotes`) — no descuentan stock, convertibles a orden |
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
| `/profile` | Profile | cualquier rol autenticado |
| `/settings` | TenantSettings | admin |

---

## PERFIL PROPIO Y NOMBRE DE USUARIO (ago 2026)

- `users.name` (STRING(255), nullable, `ensureSchema`) — nombre completo, distinto del `username` (que sigue siendo el identificador de login). Se usa en `Sidebar`/`Header` (`user.name || user.username`) y en la lista/formularios de `Users`/`UserNew`/`UserEdit` (admin gestionando otros usuarios del tenant).
- **Página `/profile`** (`FRONTEND/src/pages/Profile.tsx`) — cualquier rol autenticado (no solo admin) puede ver/editar su propio nombre y username, ver su rol (solo lectura) y abrir el `ChangePasswordModal` existente. Enlazada desde el menú de usuario en `Sidebar.tsx` (desktop) y `Header.tsx` (móvil), junto a "Cambiar contraseña".
- Backend: `GET/PUT /users/me` (`isAuth`, sin `isAdmin` — montadas antes del guard de admin en `user.routes.ts`, mismo patrón que `PUT /users/me/password`). El `id`/`tenantId` salen siempre del JWT, nunca de la URL o el body — nadie puede leer/editar el perfil de otro usuario.
- **`updateOwnProfileSchema` (Zod) excluye a propósito `role` y `password`** — el cambio de contraseña ya tiene su propio endpoint con verificación de la actual, y dejar `role` editable ahí habría sido una escalada de privilegios trivial (cualquier buyer mandando `{role:'admin'}`). Zod descarta cualquier campo no declarado en el schema al validar, sin importar lo que venga en el body — verificado con una prueba de integración real (Docker local): un usuario `buyer` mandó `{name, role:'admin', password}` a `PUT /users/me` y el backend solo aplicó el cambio de nombre, el rol se quedó intacto.
- `authStore.setUser()` (nuevo) actualiza el usuario en memoria y `localStorage` tras guardar el perfil, sin necesitar relogin.
- **Consolidación del menú de usuario**: "Cambiar contraseña" y "Notificaciones" vivían sueltos en `Sidebar`/`Header` (además, en `Header` las notificaciones eran un ícono aparte en la barra superior, no un ítem del dropdown) — se movieron dentro de `/profile` como dos cards ("Contraseña" con el mismo `ChangePasswordModal` de siempre; "Notificaciones" con activar/desactivar + estado si el navegador las bloqueó). `Sidebar`/`Header` quedan solo con "Mi perfil" y "Cerrar sesión" en esa sección. De paso, `FRONTEND/src/hooks/usePushNotifications.ts` (copia separada de la del ADMIN) tenía el mismo bug ya corregido ahí: `toggle()` sin `catch` — ahora expone `isDenied`/`error`/`clearError` igual que la del panel de superadmin.

## COTIZACIONES + PDF CARTA/TICKET — portado de JJLM (ago/sep 2026)

Dos features grandes portadas del repo hermano `JJLM` (single-tenant, sin franquicia por
plan — mismo origen que Merco), implementadas en 4 fases secuenciales (plan en
`~/.claude/plans/snoopy-inventing-starlight.md` de la sesión que lo hizo). Decisiones
tomadas con el usuario: cotizaciones lleva offline-first completo desde el día uno (mismo
patrón que Orders), es una feature gateada por plan, los datos fiscales los edita el propio
admin del tenant, y la impresión térmica directa se agrega también en POS.

**Fase A — Datos fiscales del tenant** (base para el PDF carta nuevo, que necesita NIT/
dirección/ciudad del negocio):
- `tenants.nit`/`address`/`city` (STRING, nullable, `ensureSchema`) — no son "marca" (a
  diferencia de `logoUrl`, que sí exige la feature `custom_branding`), son datos de
  facturación libres en todos los planes.
- Self-service: se agregaron al mismo endpoint que ya editaba logo/color/nombre
  (`PUT /tenants/me/theme`, `tenantService.updateTheme()`, admin del propio tenant) — no un
  módulo nuevo. `GET /tenants/me` (`tenantService.getInfo()`) los expone junto con
  `contactPhone` (ya existía en el modelo, antes solo editable por superadmin — ahora
  también legible por el tenant para mostrarlo en sus PDF).
- **Bug cerrado de paso**: `PUT /tenants/me/theme` pasaba `req.body` directo a
  `tenant.update()` sin ningún allowlist — un admin de tenant podía mandar
  `{plan:'enterprise', maxUsers:9999}` y `tenant.update()` lo aplicaba igual (Sequelize no
  filtra por su cuenta). Se agregó `updateThemeSchema` (Zod, allowlist explícito de
  name/primaryColor/logoUrl/nit/address/city — nada de plan/límites/status) en el
  controller, mismo patrón que `updateOwnProfileSchema` ya usa en `/users/me`. Verificado
  con una prueba de integración real (Docker local): un admin de tenant mandó
  `{plan:'enterprise', maxUsers:9999}` a `/tenants/me/theme` y el backend no cambió ni el
  plan ni el límite.
- `FRONTEND/src/pages/TenantSettings.tsx`: 3 inputs nuevos en la card "Identidad" (junto a
  nombre/logo), guardados por el mismo submit existente.

**Fase B — PDF carta nativo + impresión térmica directa** (Órdenes y POS; Cotizaciones lo
hereda igual en Fase D):
- **PDF carta nativo** (reemplaza `html2canvas` + el hack de medir filas del DOM que tenía
  `OrderDetail.tsx::handlePrintCarta`, con el bug de raíz de siempre: hueco en blanco al
  final de órdenes cortas / texto sobre las líneas de la tabla). Nuevo
  `FRONTEND/src/utils/generateCartaPdf.ts` — dibujo vectorial directo con `jsPDF` (texto,
  líneas, rects) + `jspdf-autotable` (nueva dependencia, `^5.0.8`) para la tabla de
  productos, que maneja paginación/alto de fila/header repetido sola, sin medir el DOM.
  `urlToDataUrl()` en el mismo archivo resuelve `tenant.logoUrl` (URL remota) a data-URL
  antes de `addImage()` — a diferencia de JJLM (single-tenant, logo ya en base64);
  tolerante a que la URL no tenga CORS o falle (`null`, PDF sigue sin logo).
  `OrderPrintViewCarta.tsx` eliminado (sin más referencias).
- **Impresión térmica directa** (ticket 80mm, botón "Imprimir" en el navegador de
  escritorio — oculto en la app nativa): `window.print()` sobre la vista off-screen ya
  existente (`OrderPrintView`), en vez de generar/descargar un PDF primero. La impresora
  Bluetooth emparejada aparece en el diálogo nativo de impresión como una impresora más.
  `#print-root` (`index.html`, hermano de `#root`) + bloque `@media print` completo en
  `index.css` — portal de React (no `position:absolute`, que Chrome no pagina si excede una
  página), ancho real imprimible 72mm flush-left (no 80mm centrado — el resto es franja
  física no imprimible de fábrica), `@page { size: 80mm 600mm }` (el driver de la térmica
  necesita un largo fijo, "auto" trunca), `color:#000` forzado solo en impresión física (las
  térmicas son de 1 bit, los grises de jerarquía visual se ven "borrosos" por dithering —
  el PDF descargado, generado aparte vía `html2canvas`, no pasa por este CSS y conserva los
  grises). Nota: `@page` es global de la hoja de estilos — cualquier Ctrl+P del navegador en
  cualquier página de Merco queda con ese tamaño de papel mientras esté cargada (trade-off
  heredado de JJLM, no una regresión nueva). Aplicado en `OrderDetail.tsx` y en `Pos.tsx`
  (POS reusa el mismo `OrderPrintView` para su ticket — `PosPaymentModal` gana un botón
  secundario "Imprimir directo en térmica" en la vista de confirmación post-venta).
- Portado de JJLM (repo hermano), probado ahí con una impresora térmica Bluetooth física
  real — sin impresora física en este entorno para repetir esa prueba, verificado con
  typecheck/tests/build limpios y revisión del código portado línea por línea.
- **Bug real cerrado de paso**: el PDF carta necesita `customer.nit`/`.code` (cajita de
  cliente), pero `OrderResponseDto`/`mapToResponseDto` en `order.service.ts` nunca los
  incluían (solo id/name/contact/address) — el NIT del cliente habría salido en blanco en
  todo PDF carta generado. Corregido: DTO + los 6 sitios que incluyen `Customer` en
  `order.service.ts` (algunos con `attributes` explícito que ni siquiera traía esas
  columnas de la BD).

**Fase C — Backend de cotizaciones (v1.15.3)**: nuevo módulo `BACKEND/src/modules/quote/`
calcado de `order/` (mismo patrón MSC), con las adaptaciones multi-tenant que JJLM (single-
tenant) no necesita:
- `quote.model.ts`/`quote-item.model.ts`: mismos campos que JJLM (`quoteNumber`,
  `customerId`, `userId`, `totalAmount`, `status: draft|sent|accepted|rejected|expired|
  converted`, `notes`, `validUntil`, `convertedOrderId`) + `tenantId` (índice único
  compuesto `[tenantId, quoteNumber]` desde el modelo — la numeración por tenant es un
  fix que Orders tuvo que aplicar después, acá se aplica desde el día uno) + `clientRef`
  (idempotencia offline-first, para la Fase D, mismo patrón que `orders.clientRef`).
- `quote.service.ts`: mismo algoritmo de numeración robusta (`MAX` numérico, no orden
  alfabético) que `order.service.ts::generateOrderNumber`, filtrado por tenant. Cliente/
  productos siempre validados contra el `tenantId` del JWT (mismo fix de IDOR de Orders —
  verificado con una prueba de integración real: un tenant no puede leer la cotización de
  otro, ni referenciar un producto ajeno al crear una). `totalAmount`/`totalPrice` usan
  `computeOrderTotal`/`lineTotal` de `order-totals.ts` (IVA incluido por línea) — el
  `quote.service.ts` original de JJLM sumaba sin IVA, un desajuste que ya se había
  corregido para Orders (ver "Auditoría ago 2026"); no tenía sentido reintroducirlo acá.
  `convertToOrder()` reusa `OrderService.createOrder()` íntegro — mismo patrón que
  `PosService.sale()` — descuenta stock ahí (crear la cotización NO toca stock, es
  propuesta, no venta), marca `converted` después de comittear la orden.
- **Bug real cerrado durante la verificación**: el guard de "cotización ya convertida"
  (portado de JJLM) solo bloqueaba cambiar `status`/`items`, pero dejaba pasar `notes`/
  `customerId`/`validUntil` sin más — probado en Docker local: `PUT` con solo `{notes:...}`
  sobre una cotización `converted` se aplicaba igual. Una cotización convertida es un
  registro histórico (la venta real ya vive en la orden generada); el guard ahora bloquea
  cualquier campo, no una lista angosta que hay que mantener sincronizada con el DTO.
- `GET /api/quotes/*` montado en `app.ts` como `tenantGuard, requireFeature('quotes')`
  (mismo patrón que `pos`). Nueva feature `quotes` en `ALL_FEATURES`/`PLAN_FEATURES`
  (`config/features.ts`) — trial y pro/enterprise, no basic (mismo criterio que
  `custom_branding`); replicado en `ADMIN/src/services/tenantAdmin.ts` (copia frontend de
  `ALL_FEATURES`, debe reflejar el backend) y en `FEATURE_INFO` de `TenantSettings.tsx`.
- Tablas nuevas (`quotes`, `quote_items`) — no requieren `ensureSchema`, `sync()` ya las
  crea por ser tablas nuevas.
- Verificado con una prueba de integración real (Docker local, 2 tenants + roles):
  feature-gating (403 en plan sin `quotes`), creación con IVA correcto, conversión a orden
  (stock descontado, `ORD-####` generado, cotización marcada `converted`), doble
  conversión bloqueada (409), edición post-conversión bloqueada (409, tras el fix), IDOR
  cruzado bloqueado (cotización y producto ajenos → 404), numeración `COT-####` aislada
  por tenant.

**Fase D — Frontend de cotizaciones, offline-first (v1.15.4)**: mirror completo del patrón
de Orders en cada capa, sin la parte de descuento de stock (no aplica a una cotización):
- `LocalDatabase.ts` `version(4)`: tablas `quotes`/`quoteItems` (mismo shape de índices que
  `orders`/`orderItems`), `LocalQuote`/`LocalQuoteItem` (+ `_clientRef` como `LocalOrder`),
  `'quote'`/`'quote_item'` sumados al union type de `SyncQueueItem.entityType`. La limpieza
  de IndexedDB al cambiar de tenant (`db.resetDatabase()`, borra todas las tablas) ya cubre
  las nuevas sin cambios — se verificó que no era una limpieza tabla-por-tabla.
- `database/models/Quote.ts` + `repositories/QuoteRepository.ts` (mirror de
  `OrderRepository.ts`: `createQuoteWithItems`/`updateQuoteWithItems`/
  `deleteQuoteWithItems`/`saveQuoteWithItemsFromServer`/`search`/`getByCustomer`/
  `getByStatus`/`getNextQuoteNumber`/`getAllWithRelations`/`getByIdWithRelations`/
  `getStats`) + `store/quoteStore.ts` (mirror de `orderStore.ts`: creación con
  `_clientRef`, fallback local si falla la red, `syncPendingQuotes()` con el mismo
  `navigator.locks` entre pestañas, `seedAllQuotes()`, contador `pendingSync`). Nuevo
  `convertToOrder()` en el store — exige conexión (igual alcance deliberado que POS: el
  refuerzo offline de un endpoint que descuenta stock real queda fuera, ver nota en
  `Pos.tsx`). `App.tsx` llama `syncPendingQuotes`/`seedAllQuotes` igual que las de Orders
  para todos los tenants — si el plan no incluye `quotes` simplemente no hay nada que
  sincronizar (la UI de crear está detrás de `FeatureGate`) y el seed del servidor falla en
  silencio (403).
- `types/quote.ts` + `services/quotes.ts` (mirror de `types/order.ts`/`services/orders.ts`).
- Páginas (`Quotes.tsx`, `QuoteNew.tsx`, `QuoteDetail.tsx`, `QuoteEdit.tsx`) construidas
  sobre el patrón visual de las páginas Order de Merco (no transplantadas de JJLM).
  `QuoteDetail.tsx` suma el botón "Convertir a orden" (modal de confirmación,
  `POST /quotes/:id/convert`, navega a la orden creada) y los mismos botones de impresión
  que Fase B (ticket directo + PDF ticket + PDF carta vía `generateCartaPdf` con
  `docTypeLabel: 'Cotización'`, `totalLabel: 'Total Cotizado'`, `footerNote: 'Este
  documento no constituye una factura'`). `QuotePrintView.tsx` mirror de
  `OrderPrintView.tsx` (ticket 80mm, mismo portal a `#print-root`).
- Rutas `/quotes`, `/quotes/new`, `/quotes/:id`, `/quotes/:id/edit` en `AppRouter.tsx`:
  `<SellerRoute><FeatureGate feature="quotes">...</FeatureGate></SellerRoute>` (mismo
  patrón que `/pos`). Ítem "Cotizaciones" en `Sidebar.tsx`/`BottomNav.tsx` — el filtro de
  items gateados por feature se generalizó (antes hardcodeado a `item.feature !== 'pos' ||
  hasPos`) a `!item.feature || tenant?.features?.includes(item.feature)`, para no repetir
  el caso especial con cada feature nueva.
- Verificado: typecheck/build limpios; 15 tests nuevos de `QuoteRepository.test.ts`
  (mirror recortado de los 39 de `OrderRepository.test.ts` — un caso representativo por
  método en vez de cada variante, ya que reusa el mismo `BaseRepository`/transacciones
  Dexie) cubriendo create/update/delete con items, numeración, búsqueda, filtros,
  estadísticas y upsert desde servidor — passing en la primera corrida.

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
- **Ciclo de suscripción (v1.11.0)**: `tenants.paidUntil` (DATEONLY, null = cortesía/legado exento del ciclo) + `suspendedReason` (trial_expired|nonpayment|manual — un pago reactiva las dos primeras, NUNCA la manual). Registro manual de pagos por superadmin: `POST /tenants/:id/payments` (crea PlanPayment approved source=superadmin con REC-#### y extiende paidUntil vía `applyPaymentToTenant`, misma ruta de código que aprobar un pago reportado). `plan_payments` ganó source/method/months/paidAt/periodStart/periodEnd/notes. Job `subscriptionRenewal` (dailyScheduler): avisa al tenant a warnDays y 1 día, gracia configurable, suspende por no pago con push a ambos lados; `renewal_warn_days`/`grace_days` en platform_settings (default 5/5). Sección **Finanzas** en superadmin: MRR, cobrado/mes, morosos, próximos vencimientos, sin-fecha (lista de trabajo post-deploy), histórico por tenant; modal "Registrar pago" (botón $ en la fila y en cada tabla). Lógica de fechas pura en `modules/tenant/subscription.ts` (testeada: clamp fin de mes, ancla vigente/vencido). **Banner en el Sidebar (sep 2026)**: antes el aviso de renovación solo llegaba por push/email — nada lo mostraba dentro de la app. `Sidebar.tsx` (solo admin, `paidUntil` de `GET /tenants/me`, mismo cálculo que `subscriptionRenewal.ts` en el backend) agrega un banner igual al de trial (mismo componente/posición, mutuamente excluyentes — un tenant no está en ambos planes a la vez): ámbar si faltan ≤7 días, rojo si ya venció. Un tenant realmente suspendido por no pago no lo ve — login y `tenantScope` ya lo bloquean antes de llegar al Sidebar; esto cubre la ventana en que todavía puede entrar (por vencer, o vencido y en gracia). `paidUntil` agregado al tipo `Tenant` del frontend (antes solo `plan`/`trialEndsAt`, faltaba este campo aunque el backend ya lo devolvía). El cálculo (antes duplicado en el propio `Sidebar.tsx`) se extrajo a `hooks/useTenantRenewalStatus.ts` para compartirlo con `Header.tsx`: en mobile no hay espacio para el bloque lateral, así que ahí es una franja angosta siempre visible debajo de la barra superior (no escondida en el menú de usuario, que solo se ve si el admin lo abre) — mismos mensajes/colores, mismo destino `/settings`
- **Email de respaldo (v1.12.0)**: `core/email.ts` — nodemailer SMTP, activo solo si `SMTP_HOST/USER/PASS` están en el entorno (Dokploy + passthrough en compose; `SMTP_FROM` opcional). `sendEmail()` es no-op sin config y tolerante a fallos. Se envía además del push en: avisos de renovación/vencido/suspensión (subscriptionRenewal), recibos de pago (manual y aprobado), y fin de trial. Destinatario: `tenants.contactEmail`. Campos `contactName/contactEmail/contactPhone` en tenants (ensureSchema) — `approveRequest` los copia de la solicitud (antes se perdían), editables en el modal del superadmin. Botón WhatsApp (wa.me con mensaje de cobro prellenado) en la tabla de morosos de Finanzas
- **Gestión avanzada superadmin (v1.13.0)**: (1) **Audit log** — tabla `platform_audit_logs` (sync la crea), `logAudit()` best-effort desde tenant.controller en impersonar/pagos/suspensiones/cancelaciones/broadcast/export; `GET /tenants/platform/audit` + sección Auditoría en el panel. (2) **2FA TOTP** para superadmin — `core/totp.ts` (RFC 6238 con crypto nativo, testeado con vectores RFC), `users.totpSecret` (ensureSchema), login exige código si está activo (error `TOTP_REQUIRED` → AdminLogin muestra el campo), rutas `/auth/totp/{status,setup,enable,disable}`, card en sección Pagos. (3) **Recibo imprimible** — `GET /api/receipts/:id?t=<hmac>` (público con token firmado, HTML print-ready); `receiptUrl` en listPayments/getBilling y en los emails de recibo. (4) **Offboarding** — `tenants.cancelledAt`, `POST /:id/cancel` (conserva datos 90 días) y `DELETE /:id/purge` (solo cancelados; borra todo menos tenant y plan_payments); botones en la fila. (5) **Digest semanal** — `core/jobs/weeklyDigest.ts` (lunes vía dailyScheduler): MRR, cobrado, vencimientos, morosos, trials, tenants sin ventas 14 días y cancelados +90d, por push y email (`DIGEST_EMAIL` ?? `SMTP_USER`)
- **Reporte mensual en Excel (v1.12.1)**: `GET /orders/report/monthly` devuelve .xlsx (exceljs) con 4 hojas — Resumen (KPIs del mes: base/IVA/total, costo/utilidad/margen, contado vs crédito, cobrado/por cobrar, top producto/cliente), Órdenes (con abonado/saldo, canceladas tachadas), Productos (ranking con % de ventas y stock) y Clientes. Utilidad sobre base sin IVA. `getMonthlyReportCsv` fue reemplazado
- **Abonos parciales**: tabla `order_payments`; `POST/GET /orders/:id/payments` (isSeller); auto-marca `paidAt` al completar; receivables usa saldo (total − abonado). UI en OrderDetail
- **Recibo de pago del tenant rediseñado (sep 2026)**: el HTML de `receipt.routes.ts` era una tarjeta pelada (logo + badge "PAGADO" + tabla) — usuario lo reportó como "raro". Ahora usa el mismo lenguaje visual de "factura formal" (cajitas con borde/fondo celeste) que `generateCartaPdf.ts` ya estableció para los PDF de venta — cajita "Recibido de" (nombre/NIT/dirección/ciudad/teléfono del tenant, mismos campos de la Fase A de cotizaciones) + cajita "Detalles del pago", caja de total destacada. Aclaración explícita en el pie ("no constituye una factura electrónica") — no pretende ser factura DIAN, sigue siendo comprobante de pago; facturación electrónica real (CUFE, proveedor tecnológico certificado) queda fuera de alcance hasta que el usuario confirme que la necesita (decisión de su contador, no de ingeniería). Merco (el emisor) no tiene NIT propio cargado todavía — esa línea se omite en vez de mostrar un campo vacío
- **Branding PWA**: si el tenant tiene `logoUrl`, el manifest usa su logo como ícono de instalación
- **Búsqueda de órdenes**: con ≥2 chars y online, Orders consulta `GET /orders/search` (debounce 400ms); offline filtra local
- **Superadmin lazy**: `React.lazy` en AppRouter — su bundle no se envía a usuarios tenant
- **Embudo comercial**: tabla `metrics_daily` (contadores diarios, sin cookies). `POST /api/onboarding/track` (público, eventos `landing_view`/`registro_view` — Landing y Registro lo disparan al montar); `GET /tenants/platform/funnel` (superadmin, 30 días): visitas → registro → solicitudes → aprobadas con % de conversión. Card "Embudo comercial" en el dashboard del superadmin

## FEATURE-GATING POR PLAN (v1.14.0)

Ver plan completo en `PLAN-FEATURES-Y-POS.md` — este es el Punto 2 (base para vender módulos como el POS).

- Catálogo en `BACKEND/src/config/features.ts`: `ALL_FEATURES` + `PLAN_FEATURES` (default por plan). `resolveFeatures(tenant, planFeatures?)` es lógica pura y testeada (10 tests) — customFeatures del tenant manda completo sobre el default si está seteado
- `tenants.customFeatures` (STRING(500), JSON array; `null` = usa el default del plan) — override por tenant, mismo patrón que `customPrice`. Editable en el modal del superadmin (checkbox "Funciones especiales")
- Features por plan son **configurables desde el superadmin sin deploy**: `PlanConfig.planFeatures` en `config/plans.ts`, persistido en `platform_settings` como `features_<plan>` (CSV), mismo patrón que `renewal_warn_days`/`grace_days`. Grilla de checkboxes en Superadmin → Pagos → "Funciones incluidas por plan"
- Middleware `requireFeature(key)` en `core/middlewares/auth.ts` — 403 con mensaje de upgrade si el tenant no la tiene; `superadmin` siempre pasa. Se monta después de `isAuth`: `router.use('/pos', tenantGuard, requireFeature('pos'), posRoutes)`
- `GET /tenants/me` expone `features: string[]` (resuelto server-side). Frontend: `useFeature('pos')` (hook) y `<FeatureGate feature="pos" planLabel="Pro">` (bloquea con card de venta, no oculta sin explicar). `App.tsx` refresca el tenant completo vía `getMyTenant()` al autenticar — el login no trae `features`
- Features actuales: `pos` (trial y ↑), `custom_branding` (pro ↑), `multi_warehouse`/`api_access` (enterprise) — ninguna tiene UI/rutas reales aún, solo el gating listo para usarse

**POS — Fase 1 (v1.14.1)**: módulo `BACKEND/src/modules/pos/` — `CashSession` (tabla nueva `cash_register_sessions`, la crea `sync`) con turno de caja: `openingAmount` declarado al abrir, `countedCash`/`expectedCash`/`difference` al cerrar. v1 es **una sola caja por tenant a la vez** (sin multi-caja simultánea — cualquier vendedor puede operar el turno abierto, es relevo de cajero, no error). `expectedCash` en Fase 1 = solo la base inicial (sin ventas integradas todavía; Fase 3 sumará las ventas en efectivo del turno). Rutas `/api/pos/sessions*` (`isSeller`) montadas en `app.ts` tras `tenantGuard` + `requireFeature('pos')` — primer uso real del feature-gating. Sin UI todavía (llega en Fase 2 junto con el endpoint de venta)

**POS — Fase 2 (v1.14.2)**: `POST /api/pos/sale` — reusa `OrderService.createOrder()` completo (mismo motor de stock/IVA/cuota/idempotencia que Orders), exige caja abierta, marca `orders.source='pos'` + `orders.cashSessionId`. Sin `customerId` → resuelve/crea automáticamente un cliente **"Consumidor final"** por tenant (`Customer.findOrCreate`). `orders.source` (ENUM orders|pos, default orders) + `orders.cashSessionId` nuevas columnas (`ensureSchema`); nota del movimiento de stock distingue "Venta POS" de "Orden de venta" en el kardex. Numeración de orden compartida con Orders (mismo `ORD-####`, sin prefijo propio). **Frontend**: `pages/Pos.tsx` (ruta `/pos`, envuelta en `<SellerRoute><FeatureGate feature="pos">`) — abrir caja → buscar/agregar al carrito (filtro local sobre productos ya cargados) → cobrar en efectivo (sin vueltos, llega en Fase 3) → cerrar caja con conteo y diferencia (UI mínima, se pulirá en Fase 3). Ítem de menú "Punto de venta" en Sidebar y BottomNav, oculto si el tenant no tiene la feature (`useFeature('pos')`)

**POS — Fase 3 (v1.14.3)**: pago mixto + vueltos + cierre de caja real. `order-totals.ts` (nuevo) extrae `computeOrderTotal`/`lineTotal` — única fórmula compartida entre Orders y POS (antes vivía solo dentro de `order.service.ts`). `orders.changeGiven` (informativo, no afecta el total). Tabla nueva `pos_sale_payments` (tenantId, orderId, **cashSessionId** duplicado desde la orden para sumar por turno sin join, method, amount) — deliberadamente separada de `order_payments` (abonos a crédito) para no arriesgar la lógica de cartera ya probada. `PosService.sale()` exige que `payments[]` sume exacto al total (tolerancia 1 centavo) **antes** de tocar stock/crear la orden — si no cuadra, falla limpio sin dejar nada a medias; `cashReceived` opcional calcula `changeGiven` solo sobre la porción en efectivo. Inserción de `pos_sale_payments` es best-effort tras crear la orden (si falla, la venta ya está cobrada y válida — solo se pierde el desglose fino). `closeSession` ahora usa `expectedCash = openingAmount + ventas en efectivo reales del turno` (antes Fase 1/2 solo consideraba la base). `getCurrentSession`/`closeSession` devuelven `salesByMethod` (breakdown cash/card/transfer/other) vía `sumByMethod()`. **Frontend**: `components/features/PosPaymentModal.tsx` — una línea 'cash' por el total por defecto (cobro de un clic sigue intacto), "Agregar método" habilita mixto, campo "Efectivo recibido" solo aparece con línea cash y calcula vuelto en vivo; `Pos.tsx` muestra el desglose por método antes de cerrar caja

**POS — Fase 4, parcial (v1.14.4)**: **código de barras** ✅ — `handleSearchKeyDown` en `Pos.tsx`: Enter con match exacto de código agrega directo al carrito (sin clic); con un único resultado por nombre, también; con varios, deja elegir. El buscador recupera el foco tras cada acción (agregar al carrito, +/- de cantidad, cerrar cualquier modal) — necesario porque un lector de código de barras es un teclado que escribe en el input con foco. **Offline reforzado** ⏸️ deliberadamente NO incluido — requeriría replicar toda la maquinaria de `orderStore.ts` (IndexedDB, `clientRef`, cola, `navigator.locks`) para un endpoint con forma distinta (sesión de caja + pagos mixtos + vueltos, sin mapeo directo a `LocalOrder`); construirlo de prisa arriesga bugs de doble cobro en dinero real. Queda como tarea propia con diseño dedicado, no como deuda oculta.

**POS — Ticket 80mm (v1.14.5)**: "Imprimir ticket" tras cada venta reusa exactamente el mecanismo de `OrderDetail.tsx` (html2canvas + jsPDF a 80mm, `Capacitor.isNativePlatform()` → share sheet / web → descarga) — no es ESC/POS crudo ni WebUSB, es el mismo PDF de 80mm ya probado en producción para Orders, aplicado a la venta recién creada. `PosPaymentModal` gana una vista de confirmación post-venta (número, total, vuelto, botones Imprimir/Nueva venta) en vez de cerrar directo.

**Marca propia — gating real (v1.14.5)**: `logoUrl` ahora exige la feature `custom_branding` — validado en el **backend** (`updateTheme`, 403 si no la tiene) y no solo escondido en la UI; `primaryColor` sigue libre para todos los planes (no cuesta infraestructura). `OrderPrintView`/`OrderPrintViewCarta` (los PDFs de Orders, y ahora también el ticket del POS) mostraban "Merco" fijo — ahora usan `tenant.name`/`logoUrl` desde `useTenantStore`, con fallback a "Merco" si no hay tenant (venta desde el propio Merco). `TenantSettings` muestra un aviso "Disponible en el plan Pro" en vez del campo cuando el tenant no tiene la feature.

**POS — bug real de cobro corregido (v1.14.5)**: `pos.service.ts` inicializaba `changeGiven = null` y lo pasaba tal cual a `OrderService.createOrder()`, cuyo DTO (`changeGiven: z.number().optional()`) acepta ausente pero **rechaza null explícito** con "Expected number, received null" — rompía el cobro de cualquier venta sin "efectivo recibido" diligenciado (o sea, casi cualquier venta, incluido el flujo rápido de un clic). Corregido a `undefined` internamente (convertido a `null` solo en la respuesta al frontend, que sí espera `number | null`). `pos.service.test.ts` no lo detectó porque mockea `OrderService.createOrder` entero — se agregó un test de regresión que corre el `createOrderSchema` real (sin mockear) sobre el payload exacto que arma el service, para que este tipo de desajuste de contrato no vuelva a pasar los tests con un mock que oculta la validación real.

**Banner de actualización conectado (v1.14.5)**: `serviceWorkerRegistration.ts` ya tenía el callback `onUpdate` sin usar — ahora dispara un `CustomEvent('sw-update-available')` (más un getter `getPendingUpdate()` para el caso raro de que el componente monte después del evento). `UpdateNotification.tsx` (existía pero estaba desconectado, escuchaba un `postMessage` que el Service Worker nunca enviaba) se reescribió para consumir el evento real y se montó en `App.tsx`. No fuerza el reload — el usuario decide cuándo actualizar.

**Rebrand — logo/isotipo nuevo + theme_color (v1.14.6/7)**: logo completo e isotipo (favicon, apple-touch-icon, íconos PWA 72-512px + maskable) regenerados desde diseño nuevo (`public/brand/logo-full.png` e isotipo aplanado sobre su propio azul, full-bleed para que iOS/Android apliquen su máscara). `logo-full.webp`/`isotipo.webp` agregados; Landing/Registro sirven el logo con `<picture>` + fallback png (emails/recibos se quedan en png, sin soporte webp confiable ahí). `theme-color` de `index.html`/`manifest.json`/`DEFAULT_THEME_COLOR` (fallback del manifest dinámico por tenant en `manifest.routes.ts`) actualizado de `#3b82f6` a `#0057ff` (azul real del logo, muestreado de los assets). El `primaryColor` default de tenants nuevos (`#2563eb`, en `tenant.service.ts`/seed/emails/recibos) se dejó igual a propósito — es el color de marca *del tenant*, no el de Merco, cambiarlo es una decisión aparte.

**Funciones del plan visibles en Configuración (v1.14.7)**: `TenantSettings.tsx` — la card "Plan y límites" ahora lista las 4 features (`FEATURE_INFO`, debe reflejar `ALL_FEATURES`/`PLAN_FEATURES` del backend) con check si el tenant la tiene o candado + "Disponible en el plan X" si no — antes un ítem de menú sin la feature simplemente no aparecía, sin explicar por qué. `multi_warehouse`/`api_access` se marcan "(próximamente)" porque el gating existe pero no hay UI/rutas reales todavía (ver más abajo) — evita mostrar un check sin nada que abrir detrás.

**Color primario hardcodeado en azul, corregido (v1.14.8)**: un tenant con `primaryColor` propio (ej. demo, rosa `#eb244b`) tenía el sidebar/botones bien temados pero precios, códigos de producto, badges y decenas de elementos más seguían en azul Tailwind hardcodeado (`text-blue-600`, `bg-blue-50`, etc.) en vez de usar el token `primary` (`rgb(var(--vf-primary))`, ver `index.css`) — mezcla inconsistente reportada por el usuario. Reemplazo mecánico de ~39 archivos tenant-facing (`bg/text/border/ring/from/to-blue-NNN` → sus equivalentes `primary`/`primary/NN` de opacidad) vía script, **excluyendo a propósito** `Superadmin.tsx`/`admin.tsx` (panel superadmin, tema oscuro fijo `#0f172a`, no es por-tenant) y `Landing.tsx`/`Registro.tsx` (marca pública de Merco, azul `#0057ff` real del logo nuevo, no debe seguir el color de ningún tenant). Colores semánticos (verde=éxito, rojo=error, ámbar=advertencia) no se tocaron, solo el azul que hacía de "primario" por defecto.

## INVENTARIO Y KARDEX (ago 2026)

- **DECIMAL como número**: `dialectOptions: { decimalNumbers: true }` en `database/index.ts` — sin esto MySQL devuelve DECIMAL como string y las sumas concatenan texto (bug real: recibir compra dejaba stock "-1620"). `createMovement` además valida/coacciona `quantity`
- **Todo cambio de stock deja movimiento**: ventas/compras ya lo hacían; ahora también `PATCH /products/:id/stock` y editar `stock` en `PUT /products/:id` generan movimiento `adjustment` (vía `StockMovementService`, transaccional). No sobreescribir stock en silencio
- **Kardex visible**: pestaña "Movimientos" en Inventario (`components/features/InventoryMovements.tsx`) — tipo (Venta/Compra/Ajuste), cantidad, stock antes→después, detalle, "Cargar más"
- **Numeración por tenant**: ORD-#### y POC-#### se generan filtrando por `tenantId` (el índice único ya era compuesto). Antes eran globales y los consecutivos saltaban entre clientes
- **Seguridad**: `GET /stock-movements` y `GET /stock-movements/product/:id` filtran por `tenantId` del JWT (antes exponían movimientos de todos los tenants)
- **Valor de stock a costo (ago 2026)**: pestaña Inventario de Reports mostraba el valor del stock solo a precio de venta. `ProductService.getCostMap(tenantId)` (último costo de compra recibida; si no hay, el menor precio de proveedor — misma lógica que ya usaba `OrderService` para el COGS de Rentabilidad, ahora extraída ahí para no duplicarla) se expone en `GET /products/costs` (`isSeller`, mismo nivel de visibilidad que `/orders/stats/profit`). `Reports.tsx` la consume igual que `profit` (fetch solo si `navigator.onLine`, `null` si falla — offline el tab de Inventario simplemente no muestra costo, sin romper el resto). Nueva card "Valor del inventario" (venta / costo / utilidad potencial + margen, mismo layout de 3 columnas que "Este mes" en Rentabilidad) y costo por línea en "Top productos por valor en stock"; aviso ámbar si hay productos sin costo registrado (no suman al total, igual que en COGS).

## ÓRDENES DE COMPRA — affectsStock

- `affectsStock` (boolean, default true) en `purchase_orders`: si es false, al recibir la orden NO se crean movimientos de stock — para registrar compras por costos cuando el inventario ya fue cargado (ej. carga inicial del cliente)
- Checkbox "Sumar al inventario al recibir" en PurchaseOrderNew; badge "No suma inventario" en el detalle

## ÓRDENES A CRÉDITO (plazo de pago)

- Campos en `orders`: `paymentType` (cash|credit), `paymentDueDate` (DATEONLY), `reminderDays` (días antes para recordar, default 3), `paidAt` (null = por cobrar)
- Endpoints: `GET /orders/receivables` (cartera, isSeller), `PATCH /orders/:id/pay` (marcar pagada / body `{paid:false}` revierte, isSeller)
- Frontend: selector Contado/Crédito en OrderNew (chips 7/15/30/60 días + fecha + recordatorio), banner de cartera y badges en Orders, card de pago con "Marcar pagada" en OrderDetail
- Recordatorios: `BACKEND/src/core/jobs/paymentReminders.ts` — corre 1 min tras el arranque y luego cada 24h; usa `pushService.notifyUsers()`
- **Bug real corregido (sep 2026)**: el tab "Activas" de `Orders.tsx` filtraba solo `status !== 'completed'` — una orden `cancelled` nunca calzaba con "Entregadas" (`status === 'completed'`) así que se quedaba en Activas para siempre. `CLOSED_ORDER_STATUSES = ['completed', 'cancelled']` (ambos cierran el ciclo de la orden por igual) + el tab se renombró a "Cerradas" (antes "Entregadas", que era impreciso para una cancelada) — mismo patrón que ya usa `Quotes.tsx` (`CLOSED_STATUSES`/tab "Cerradas").

---

## FEATURE OFFLINE-FIRST

**Archivos clave:**
- `src/database/LocalDatabase.ts` — Dexie.js, 11 tablas locales (incluye `quotes`/`quoteItems`, ago 2026)
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
