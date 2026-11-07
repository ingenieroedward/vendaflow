# CHANGELOG

Todos los cambios relevantes del proyecto JJLM se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

## [1.20.0] — 2026-11-07 — Rediseño UX/UI, fase 3 (cierre del prototipo)

### Added

- Menú lateral con atajos **Vender** y **Orden** y el estado de sincronización siempre visible
  ("Sincronizado", "N sin enviar" o "Sin conexión").
- Productos:
  - columna de **margen**;
  - filtro **Stock bajo** (solo productos con stock mínimo configurado);
  - en el celular, filas compactas en vez de tarjetas grandes.
- Panel de producto:
  - **últimos movimientos** del kardex;
  - **Ajustar stock** con el conteo real y un motivo (queda como ajuste en el kardex);
  - **Agregar a una orden**, que abre Nueva orden con el producto ya agregado.
- Órdenes:
  - franja de cartera (por cobrar, **vencidas** —que filtra la lista—, y vencen en 7 días), en vez
    del aviso que se podía ocultar;
  - filtro por forma de pago.
- Nueva orden y Nueva cotización:
  - saldo por cobrar y última compra del cliente;
  - "Lo que más compra este cliente" para agregar con un toque (a partir de las órdenes guardadas
    en el equipo, funciona sin conexión).
- POS: **asignar cliente** a la venta (sin cliente sigue siendo "Consumidor final").
- Tipografía IBM Plex Sans / Mono empaquetada con la app (funciona sin conexión).

### Changed

- Editar orden y Editar cotización con el mismo diseño de Nueva orden: buscador siempre listo,
  +/− por línea, resumen lateral y barra fija en el celular.

## [1.19.1] — 2026-11-07 — IVA incluido en el precio, por producto

### Added

- **"El precio de venta ya incluye el IVA"** en la ficha del producto (`products.priceIncludesTax`,
  `ensureSchema`; los productos existentes quedan en sí).
  - Órdenes y cotizaciones: si el precio incluye IVA se cobra el precio tal cual y el IVA se
    desglosa por dentro (base = precio / (1 + IVA)); si no lo incluye, se suma encima.
  - POS: con IVA incluido cobra igual que siempre; si no lo incluye, suma el IVA (el carrito usa
    la misma fórmula que el backend para que el cobro cuadre).

### Fixed

- Desde v1.18.0 órdenes y cotizaciones sumaban el IVA del producto encima de precios que ya lo
  incluían (un producto de $ 32.000 al 19 % salía a $ 38.080).
- Editar orden y editar cotización no tomaban el IVA del producto: una línea vieja lo volvía a 0.

## [1.19.0] — 2026-11-07 — Rediseño UX/UI, fase 2

### Added

- **Color del negocio con contraste garantizado** (`utils/themeColors.ts`): del color elegido se
  derivan un tono para texto (`text-primary`), uno para rellenos (`bg-primary`) y el color del
  texto encima (`text-on-primary`, blanco u oscuro). Un rosa se oscurece levemente y un amarillo
  lleva texto oscuro en sus botones.
- `SegmentedTabs`: un solo control de pestañas para Órdenes, Informes e Inventario.
- Órdenes en escritorio como tabla con forma de pago, vencimiento y **saldo** (neto de abonos);
  la pestaña de órdenes locales se llama "Sin enviar".
- POS: la grilla muestra productos sin escribir, con los más vendidos en esa caja primero.

### Changed

- **Nueva orden y Nueva cotización rediseñadas**: el buscador siempre está listo y Enter (o un
  lector de código de barras) agrega el producto con cantidad 1, precio e IVA de la ficha; si ya
  está, suma una unidad. Cantidad con +/− de 44 px, aviso de stock, resumen fijo a la derecha en
  escritorio y barra fija abajo en el celular. El botón dice el total ("Crear orden por $ X") y qué
  falta si no se puede crear.
- Panel de producto acoplado a la derecha en pantallas anchas (≥1280 px): ya no tapa la lista.
- Encabezados de página alineados a la izquierda y compactos en todas las secciones.
- Compras, Informes, Login y el selector buscable usan el color del negocio (antes índigo fijo);
  se quitaron los degradados.

### Accessibility

- Textos grises claros subidos a contraste AA en toda la app.

## [1.18.0] — 2026-11-07 — IVA por producto y arreglos rápidos de UX

### Added

- **IVA por producto** (`products.taxRate`, vía `ensureSchema`): la ficha del producto tiene un
  selector de IVA (19 % general, 5 %, 0 % exento/excluido) y órdenes y cotizaciones (nuevas y
  editadas) lo toman por defecto en cada línea. Antes el IVA arrancaba en 0 y el vendedor tenía
  que digitar 19 a mano en cada producto. Al desplegar, cada producto existente toma el IVA de su
  última venta; los nunca vendidos quedan en 0. Productos nuevos arrancan en 19 %.
- Productos: columna de stock en la tabla (alerta de bajo/agotado solo si hay stock mínimo
  configurado) y la tabla se opera con teclado.
- POS: billetes rápidos ("Exacto", $ 50.000…) y el vuelto en grande al cobrar.

### Changed

- Menú lateral agrupado en Vender / Catálogo / Negocio, con scroll (en pantallas de 768 px se
  cortaba). En el celular, "Vender" (POS) y "Órdenes" quedan en la barra inferior.
- Roles en español (Administrador, Vendedor, Comprador).
- Estado "En proceso" en color fijo (antes tomaba el color del negocio y con el rosa parecía un
  error); "Cancelada" en gris.
- POS: botones de cantidad de 44 px (antes 24 px).
- Inventario usa el color del negocio en vez de índigo fijo.

### Removed

- Indicadores "Con precios" y "Cobertura" de Productos: contaban solo la página visible y
  dividían por el total (cifras incorrectas). Queda el conteo de productos.

### Accessibility

- Modal con `role="dialog"`, foco al abrir y al cerrar, y botón de cerrar etiquetado.
- Etiquetas en botones de ícono e inputs del POS, cobro y Nueva orden; contraste de textos grises
  subido a AA en menú, barra inferior y POS.

## [1.17.0] — 2026-11-07 — Seguridad: resto de la auditoría

### Security

- **Impersonar sin JWT en la URL**: el panel ahora abre `/login?impersonate=<código>` con un código
  de un solo uso que vence en 2 minutos; la app lo borra de la URL y lo canjea por
  `POST /auth/impersonate` (el slug del subdominio debe coincidir). La sesión dura 2h, no 24h.
- **Bloqueo por cuenta**: 10 intentos fallidos en 15 min bloquean ese usuario 15 min (429), además
  del límite por IP que ya existía.
- **Contraseñas de mínimo 8 caracteres** al crear o cambiar (las existentes siguen entrando).
- `transferTo` al borrar un usuario debe ser un admin del mismo tenant.
- Comprobante de pago: solo imágenes (JPG, PNG, WEBP, GIF, HEIC).
- Push: no se puede tomar la suscripción de otro usuario conociendo su `endpoint`.
- Captcha de registro de un solo uso.
- CORS: el comodín de subdominios solo acepta `https://`.
- Dependencias: `npm audit fix` en los 3 proyectos, nodemailer 10, imagen base Node 22.

### Fixed

- Borrar definitivamente un usuario que había vendido algo fallaba con 500 (la FK de
  `stock_movements`); ahora se reasigna todo su historial al admin indicado.

## [1.16.9] — 2026-11-07 — Seguridad: aislamiento entre tenants y revocación de sesiones

### Security

- **[ALTA] Fuga de datos entre tenants al editar** (auditoría nov 2026, confirmada con ataque real):
  crear validaba cliente/productos/proveedor contra el tenant, editar no. Un admin o vendedor podía
  poner un `customerId`/`productId` ajeno en su orden, o un `supplierId` ajeno en su compra, y el
  detalle exponía nombre, teléfono, NIT y dirección de clientes y proveedores de otros tenants (IDs
  consecutivos → enumerables). `updateOrder` valida cliente y productos nuevos o cambiados (los ítems
  que no cambian se respetan aunque el producto esté archivado); `updatePurchaseOrder` valida
  proveedor. Ambos → 404.
- **[ALTA] Sesiones no revocables**: el JWT (24h) se aceptaba sin mirar la BD — un usuario eliminado
  seguía entrando, uno degradado de admin seguía con permisos de admin y cambiar la contraseña no
  cerraba sesiones. Ahora `isAuth` compara el token contra el usuario actual
  (`core/auth/sessionCache.ts`, caché 60s invalidada al instante): debe existir, ser del mismo
  tenant, tener el mismo rol y el mismo `users.tokenVersion` (claim `tv`; nueva columna vía
  `ensureSchema`). `tokenVersion` sube al eliminar, cambiar rol o contraseña. Tokens previos sin
  `tv` cuentan como 0 → nadie pierde la sesión al desplegar. Cambiar la propia contraseña devuelve
  un token nuevo (el frontend lo guarda) y cierra las demás sesiones.

## [1.16.8] — 2026-10-05 — Productos: tarjetas en mobile

### Changed

- **Inicio en mobile vuelve a tarjetas** (decisión del usuario): la lista en tabla + panel lateral
  de la v1.16.7 queda **solo en desktop** (≥768px). En mobile, `ProductCard` restaurado con el
  encabezado corregido (nombre completo en su propio renglón, código · unidad · fecha debajo) y su
  botón de editar funcionando; tocar una tarjeta abre la ficha (`/products/:id`), como antes.

## [1.16.7] — 2026-10-05 — Lista de productos con panel de detalles

### Changed

- **Inicio (`/`)**: la grilla de tarjetas (10 por página, nombres cortados en "AMORTIG…") pasa a una
  **lista**: tabla en desktop (código, producto, unidad, precio venta, menor costo, proveedores,
  actualizado) y filas compactas en mobile, **25 por página**.
- Clic en un producto (o en un resultado del buscador) abre un **panel lateral derecho**
  (`components/features/ProductDetailsPanel.tsx`) con precio de venta, stock, menor costo, margen y
  proveedores ordenados por precio, y botones **Editar** (directo a `/products/:id/edit`) y Ver ficha.
  Cierra con Esc, la X o clic afuera; en mobile ocupa toda la pantalla.
- `ProductCard.tsx` eliminado (solo lo usaba el inicio; su botón de editar no hacía nada).

## [1.16.6] — 2026-10-05 — Eliminar productos con historial

### Fixed

- **No se podía eliminar un producto que ya se había vendido/comprado** (producción: `DELETE
  /api/products/156` → 500). `deleteProduct` borraba con `force: true` y las FK de `order_items`,
  `quote_items`, `purchase_order_items` y `stock_movements` (sin cascada) lo impedían.
  - Ahora es **borrado lógico** (el modelo ya era `paranoid`): sale del catálogo, búsquedas y ventas
    nuevas; el código pasa a `<código> (eliminado #id)` (`archivedProductCode`) para **liberar el
    original** — el índice único `(tenantId, code)` incluye filas eliminadas. Precios se siguen
    borrando.
  - Historial intacto: los `include` de Product en órdenes, cotizaciones, compras, reporte mensual y
    kardex usan `paranoid: false`. `createMovement` también, para que cancelar/editar/restaurar una
    orden vieja o recibir una compra vieja siga ajustando stock.
  - Editar una cotización ya no revalida los ítems que no cambian (antes una cotización con un
    producto archivado quedaba ineditable). Ítems nuevos con un archivado → 404 claro.
  - Frontend: al eliminar se borra también del caché offline (Dexie) con sus precios; el texto de
    confirmación explica que el historial se conserva y el código queda libre.

## [1.16.5] — 2026-10-05 — Orden atascada por producto eliminado

### Fixed

- **Orden/cotización atascada con un producto eliminado** (reportado en producción: `POST /api/orders`
  → 404 "Product with ID 327 not found"). El formulario restaura un borrador de `localStorage`; si un
  producto del borrador se había eliminado (`deleteProduct` borra con `force: true`), cada intento de
  guardar fallaba con un mensaje en inglés y el borrador —que no se limpia al fallar— volvía a traer
  el mismo producto.
  - Backend: `modules/product/product-errors.ts` (`productNotFoundError`) — 404 en español que termina
    en `(ID n)`, usado en órdenes, cotizaciones (crear y editar) y órdenes de compra.
  - Frontend: `utils/missingProduct.ts` — `OrderNew`/`QuoteNew` quitan ese ítem del formulario (y por
    ende del borrador), avisan cuál fue y limpian el error crudo; el siguiente intento se guarda.

## [1.16.4] — 2026-10-03 — Embudo comercial por origen

### Added

- **Atribución del embudo público**: cada visita a la landing/registro y cada solicitud de
  registro guardan de dónde llegó (Facebook, Instagram, Google, WhatsApp, ChatGPT, etc.).
  - Navegador (`FRONTEND/src/utils/attribution.ts`): `utm_source`/`utm_campaign`, click IDs
    de anuncios (`fbclid`, `gclid`, `ttclid`) o el referrer externo. Primer contacto
    guardado 30 días en `localStorage` (sin cookies ni datos personales).
  - Backend (`modules/tenant/attribution.ts`): normaliza a una lista cerrada de orígenes —
    el texto del cliente nunca se guarda tal cual. `/onboarding/track` cuenta además
    `<evento>:<origen>` en `metrics_daily`; `tenant_requests.source`/`campaign` (nuevas
    columnas, `ensureSchema`). `GET /tenants/platform/funnel` devuelve `bySource`.
  - Panel superadmin: tabla "Por origen" en la card Embudo comercial y "vía <origen>
    (campaña)" en cada solicitud de la Bandeja.

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
