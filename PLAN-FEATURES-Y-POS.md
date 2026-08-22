# 🎯 Plan: Planes por Feature + Módulo POS

**Fecha:** 2026-08-20 (actualizado 2026-08-21)
**Estado:** Punto 2 completado y desplegado (v1.14.0). Punto 1 (POS) próximo, por fases.
**Punto 3 (actualizaciones):** resuelto solo con entendimiento — ver nota al final. Hallazgo aparte: `UpdateNotification.tsx` existe pero está desconectado (no importado, SW no emite el mensaje) — pendiente opcional.

---

## 🔑 PUNTO 2: Sistema de features por plan (base para vender módulos) ✅ COMPLETADO (v1.14.0)

**Por qué primero:** el POS necesita algo que lo gatee por plan. Construir esto primero significa que el POS nace ya vendible, en vez de meterlo y luego tener que enchufarle el gating por encima.

**Estado hoy:** `PLAN_LIMITS` en `BACKEND/src/modules/tenant/tenant.service.ts:24-29` solo limita **cantidades** (`maxUsers`, `maxProducts`, `maxOrdersPerMonth`). No existe ningún concepto de feature booleana on/off por plan.

### Diseño

**Backend — nuevo archivo `BACKEND/src/config/features.ts`:**
```ts
export const ALL_FEATURES = ['pos', 'custom_branding', 'multi_warehouse', 'api_access'] as const;
export type FeatureKey = typeof ALL_FEATURES[number];

// Default por plan — igual patrón que PLAN_LIMITS
export const PLAN_FEATURES: Record<TenantPlan, FeatureKey[]> = {
  trial:      ['pos'],
  basic:      [],
  pro:        ['pos', 'custom_branding'],
  enterprise: ['pos', 'custom_branding', 'multi_warehouse', 'api_access'],
};
```

**`tenants` — nueva columna (patrón `ensureSchema`, igual que `customPrice`):**
```ts
customFeatures: string | null; // JSON array — override por tenant, null = usa PLAN_FEATURES del plan
```
Permite vender POS a un tenant en plan Basic si se negocia (igual lógica que `customPrice`).

**Helper de resolución** (`tenant.service.ts` o `features.ts`):
```ts
function resolveFeatures(tenant: Tenant): Set<FeatureKey> {
  if (tenant.customFeatures) return new Set(JSON.parse(tenant.customFeatures));
  return new Set(PLAN_FEATURES[tenant.plan]);
}
```

**Middleware `requireFeature(key)`** en `core/middlewares/auth.ts` (mismo patrón que `isSeller`/`isAdmin`):
- Carga el tenant del JWT, resuelve features, 403 con mensaje claro (`"Esta función requiere el plan Pro"`) si no la tiene.
- Se monta en las rutas nuevas del POS: `router.use('/pos', tenantGuard, requireFeature('pos'), posRoutes)`.

**Exponer al frontend:** agregar `features: string[]` a la respuesta de `GET /tenants/me` (`tenant.service.ts` → `getInfo()`), calculado con `resolveFeatures`.

**Frontend:**
- `useTenantStore` guarda `features` junto a `plan`.
- Hook `useFeature('pos')` → boolean.
- Componente `<FeatureGate feature="pos">` que muestra el contenido si está habilitado, o un card "Disponible en plan Pro — mejora tu plan" con link a Configuración si no. Esto es venta, no solo bloqueo — que el usuario vea lo que se pierde.
- Ítem del sidebar (POS) se oculta o se muestra con badge "Pro" si no lo tiene el tenant, según se decida en el momento.

**Superadmin — UI para gestionar features por plan:**
- Sección Configuración de pagos ya tiene el formulario de precios (`FRONTEND/src/pages/Superadmin.tsx`, sección `pagos`) — agregar ahí una grilla de checkboxes: filas = features, columnas = planes. Guarda en `platform_settings` igual que `renewal_warn_days`/`grace_days` (mismo patrón ya usado).
- Modal de edición de tenant (`EditTenantModal`) gana un campo opcional "Features especiales" (checkboxes) que escribe `customFeatures`.

### Archivos a tocar
| Archivo | Cambio |
|---|---|
| `BACKEND/src/config/features.ts` | **Nuevo** — catálogo y defaults por plan |
| `BACKEND/src/modules/tenant/tenant.model.ts` | + columna `customFeatures` |
| `BACKEND/src/core/startup/ensureSchema.ts` | + migración de la columna |
| `BACKEND/src/modules/tenant/tenant.service.ts` | `resolveFeatures()`, incluir en `getInfo()`/`getPlatformSettings()` |
| `BACKEND/src/core/middlewares/auth.ts` | `requireFeature(key)` |
| `FRONTEND/src/store/tenantStore.ts` | guardar `features` |
| `FRONTEND/src/hooks/useFeature.ts` | **Nuevo** |
| `FRONTEND/src/components/ui/FeatureGate.tsx` | **Nuevo** |
| `FRONTEND/src/pages/Superadmin.tsx` | grilla de features por plan + checkboxes en EditTenantModal |

### Verificación antes de dar por cerrado
- [ ] Tests backend: `resolveFeatures` con plan puro, con `customFeatures`, con plan inexistente (fallback seguro a `[]`)
- [ ] Tenant en plan Basic sin `pos` → 403 al pegarle a `/api/pos/*`
- [ ] Tenant en plan Basic con `customFeatures: '["pos"]'` → sí pasa
- [ ] `demo` y `platform` no se ven afectados por accidente

**Esfuerzo estimado:** medio día — es la pieza más simple de las dos, por eso va primero.

---

## 🛒 PUNTO 1: Módulo POS (venta rápida de mostrador)

**Alcance de v1 (lo vendible):** pantalla POS + apertura/cierre de caja + pago mixto con vueltos + búsqueda rápida/código de barras. **Fuera de v1:** impresora térmica ESC/POS, multi-caja simultánea, propinas — eso es v2 si hay demanda.

### Lo que ya existe y se reutiliza
- Productos con stock y precio (`Product`), kardex (`StockMovementService` — el POS usa `type: 'sale'` igual que Orders)
- Clientes (`Customer`) — el POS permite venta sin cliente (consumidor final) o con cliente existente
- `Order` + `OrderItem` con IVA por línea — la venta del POS **es una Order** con un flag de origen, no una tabla paralela
- `order_payments` (abonos) — se reutiliza el concepto para pago mixto
- Offline-first (`orderStore.ts`, `syncQueue`) — el POS hereda el mismo mecanismo, reforzado (ver Fase 4)
- jsPDF ya en el stack — sirve de base para el ticket, aunque el formato cambia (80mm vs carta)

### Lo que falta — nuevo

**1. Modelo de datos — apertura/cierre de caja (nuevo, no existe nada parecido hoy):**
```ts
// cash_register_sessions
{ id, tenantId, userId, openedAt, closedAt,
  openingAmount,       // base inicial declarada
  expectedCash,        // calculado: openingAmount + ventas efectivo del turno
  countedCash,         // lo que el cajero cuenta físicamente al cerrar
  difference,          // countedCash - expectedCash (faltante/sobrante)
  status: 'open' | 'closed', notes }
```
Toda `Order` creada desde el POS lleva `cashSessionId` (columna nueva en `orders`, nullable — las órdenes normales de Orders no la usan).

**2. `Order` gana campos de origen y pago mixto:**
- `source: 'orders' | 'pos'` (default `'orders'`) — para reportes separados y para que el flujo de crédito/plazo no aplique al POS (POS siempre es contado, con posible pago mixto).
- Tabla `order_payment_methods` (o reusar `order_payments` agregando `method: 'cash'|'card'|'transfer'`) — una orden de POS puede tener 2 líneas: `$30.000 efectivo + $20.000 tarjeta`.
- `changeGiven` (vueltos) en la orden — informativo, no afecta el total.

**3. Backend — nuevo módulo `pos/`:**
- `POST /api/pos/sessions` (abrir caja), `PATCH /api/pos/sessions/:id/close` (cerrar con conteo)
- `GET /api/pos/sessions/current` (¿hay caja abierta para este usuario?)
- `POST /api/pos/sale` — variante rápida de `createOrder`: sin plazo de crédito, valida sesión de caja abierta, acepta pago mixto, más rápida en validaciones (menos round-trips que Orders normal)
- Reusa `StockMovementService`, `Order`/`OrderItem` — no duplica lógica de negocio, solo el flujo de entrada

**4. Frontend — pantalla POS nueva (`/pos`, feature-gated):**
- Layout distinto a OrderNew: buscador grande arriba (autofocus permanente, para que un lector de código de barras "escriba" ahí sin que el cajero tenga que hacer clic), grilla de resultados táctil, carrito lateral siempre visible, botón "Cobrar" grande.
- Modal de cobro: efectivo (con teclado numérico grande + botones de "monto exacto" $5.000/$10.000/$20.000/$50.000), tarjeta, mixto — calcula vuelto en vivo.
- Banner de sesión de caja: si no hay caja abierta, pide monto inicial antes de dejar vender (fricción intencional — es lo que da control real).
- Pantalla de cierre de caja: ventas del turno por método, efectivo esperado, campo para contar físicamente, diferencia resaltada en rojo/verde.
- Lector de código de barras: es solo un input de teclado rápido — el buscador ya funciona, hay que asegurar que el foco nunca se pierda y que Enter dispare "agregar al carrito" si hay un solo resultado exacto por código.

**5. Offline reforzado para el POS específicamente:**
- El POS NO puede mostrarle un error de red al cajero a media venta — si falla el POST, debe caer local silenciosamente (ya existe el mecanismo en `orderStore`, pero para POS hay que asegurar que la UI nunca bloquee el flujo de cobro esperando confirmación del servidor).
- La sesión de caja también debe poder abrirse offline y sincronizar al reconectar.

### Fases de implementación (para ir mostrando avance, no todo de una)

| Fase | Contenido | Depende de |
|---|---|---|
| **Fase 0** | Feature-gating (Punto 2 completo) | — |
| **Fase 1** | Modelo de caja (apertura/cierre) + endpoints, sin UI aún — probado con curl/Postman | Fase 0 |
| **Fase 2** | Pantalla POS básica: buscar, carrito, cobrar solo en efectivo (sin vueltos aún), descuenta stock | Fase 1 |
| **Fase 3** | Pago mixto + cálculo de vueltos + pantalla de cierre de caja con diferencia | Fase 2 |
| **Fase 4** | Código de barras (foco persistente + Enter) + refuerzo offline específico del POS | Fase 3 |
| **Fase 5** *(opcional, v2)* | Ticket térmico 80mm (print CSS o WebUSB ESC/POS) | Fase 4 |

### Archivos nuevos esperados
```
BACKEND/src/modules/pos/
  cash-session.model.ts
  pos.service.ts
  pos.controller.ts
  pos.routes.ts
FRONTEND/src/pages/Pos.tsx
FRONTEND/src/pages/PosCloseSession.tsx
FRONTEND/src/components/features/PosCart.tsx
FRONTEND/src/components/features/PosPaymentModal.tsx
FRONTEND/src/store/posStore.ts
```

### Verificación antes de dar por cerrada cada fase
- Fase 1: no se puede vender por POS sin sesión abierta; cerrar calcula bien `expectedCash` con ventas mixtas de prueba
- Fase 2: venta por POS descuenta stock igual que Orders (mismo kardex, mismo `StockMovementService`)
- Fase 3: pago mixto suma exacto al total; vuelto se calcula solo cuando hay componente en efectivo
- Fase 4: escanear un código dispara agregar al carrito sin clic; el buscador recupera el foco tras cada acción
- Todas las fases: tests backend nuevos + `npm test` completo (backend y frontend) en verde antes de cada deploy, como siempre

**Esfuerzo estimado:** varios días reales repartidos en las fases — no es un módulo chico, es el más grande construido hasta ahora en Merco.

---

## 📝 PUNTO 3: Actualizaciones — resuelto por entendimiento

Sin trabajo pendiente. Resumen para no repetir el análisis:

- Merco es PWA servida desde el servidor — no existe "versión anterior instalada" como en un app store. Cada deploy actualiza a todos los tenants.
- El Service Worker cachea, pero se refresca solo (típicamente al abrir/recargar la app) — nadie queda forzado a mitad de una operación.
- Fijar versiones por tenant significaría mantener múltiples backends vivos a la vez — riesgo de seguridad innecesario para el modelo de negocio actual. Se descarta.
- **Pendiente opcional, no solicitado aún:** banner discreto "Nueva versión disponible — Actualizar" cuando el Service Worker detecta un cambio, para que nadie pierda una venta a media escritura por un refresh inesperado. Si se quiere, es ~1-2h de trabajo — avisar cuando se quiera meter en el radar.

---

## Orden de arranque mañana

1. Leer este documento primero (`PLAN-FEATURES-Y-POS.md` en la raíz del repo).
2. Empezar por **Punto 2** (feature-gating) completo — es la base y es rápido.
3. Seguir con **Punto 1 (POS) Fase 1** — modelo de caja, sin UI, probado a mano.
4. Ir fase por fase del POS, mostrando cada una antes de seguir con la siguiente.
