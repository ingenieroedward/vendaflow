# Guía de Contribución — JJLM

---

## Flujo de trabajo

```
main          ← producción (solo merges desde dev)
 └── dev      ← rama de desarrollo principal
      └── feature/fix/... ← ramas opcionales para cambios grandes
```

1. Trabajar siempre desde `dev`
2. Para cambios grandes, crear una rama desde `dev`
3. Hacer PR o merge directo a `dev`
4. Cuando `dev` esté estable → merge a `main` + push

```bash
git checkout dev
git pull origin dev

# ... hacer cambios ...

git add <archivos>
git commit -m "feat: descripción del cambio"
git push origin dev

# Merge a main cuando esté listo
git checkout main
git merge dev --no-ff
git push origin main
git checkout dev
```

---

## Conventional Commits

Todos los commits deben seguir este formato:

```
<tipo>: <descripción corta en presente>
```

| Tipo | Cuándo usarlo |
|------|--------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo cambios de documentación |
| `style` | Formato, sin cambios de lógica |
| `refactor` | Refactorización sin cambio de comportamiento |
| `chore` | Tareas de mantenimiento (deps, docker, config) |
| `test` | Agregar o modificar tests |

**Ejemplos:**
```bash
git commit -m "feat: reassign orders to admin on hard delete user"
git commit -m "fix: include soft-deleted records before hard delete FK cleanup"
git commit -m "docs: add JSDoc to OrderService complex methods"
git commit -m "chore: refactor backend Dockerfile to multi-stage build"
```

---

## Estructura del proyecto

```
JJLM/
├── BACKEND/          # API REST Node.js + TypeScript + Express
│   ├── src/
│   │   ├── modules/  # auth, user, product, price, order, customer, supplier
│   │   ├── core/     # middlewares, errors, logger, utils
│   │   ├── config/   # variables de entorno
│   │   └── database/ # configuración Sequelize
│   └── Dockerfile    # multi-stage: builder + production
│
├── FRONTEND/         # React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── pages/    # pantallas de la aplicación
│   │   ├── components/
│   │   ├── store/    # Zustand (estado global)
│   │   ├── services/ # cliente HTTP (Axios)
│   │   └── types/    # tipos TypeScript
│   ├── Dockerfile    # multi-stage: builder (Vite) + nginx
│   └── nginx.conf    # proxy /api → backend, SPA routing
│
├── docker-compose.yml  # único archivo de deploy (MySQL + backend + frontend)
├── CLAUDE.md           # documentación técnica completa del proyecto
├── CHANGELOG.md        # historial de cambios
└── CONTRIBUTING.md     # esta guía
```

---

## Desarrollo local

### Backend
```bash
cd BACKEND
npm install
cp .env.example .env   # configurar variables
npm run dev            # hot reload con nodemon en puerto 3000
```

### Frontend
```bash
cd FRONTEND
npm install
npm run dev            # Vite dev server en puerto 5173
```

### Verificar antes de commit
```bash
# Backend
cd BACKEND && npm run build   # debe compilar sin errores

# Frontend
cd FRONTEND && npx tsc --noEmit   # debe pasar sin errores
```

---

## Deploy en producción (VPS + Dokploy + Traefik)

El deploy se gestiona desde Dokploy. Al pushear a `main`, el servidor actualiza con:

```bash
git pull origin main
docker compose down
docker compose up --build -d
```

**Archivos clave de deploy:**
- `docker-compose.yml` — único compose de producción (raíz del proyecto)
- `BACKEND/Dockerfile` — multi-stage build (builder + production)
- `FRONTEND/Dockerfile` — multi-stage build (Vite builder + nginx)
- `FRONTEND/nginx.conf` — proxy `/api/` → `http://backend:3001`, SPA routing

**Red Docker:** `dokploy-network` (externa, gestionada por Dokploy/Traefik)

---

## Patrones de código

### Backend — patrón por módulo
```
modules/<nombre>/
  ├── <nombre>.model.ts       # Sequelize model + asociaciones
  ├── <nombre>.dto.ts         # Zod schemas de validación
  ├── <nombre>.service.ts     # lógica de negocio
  ├── <nombre>.controller.ts  # handlers HTTP
  └── <nombre>.routes.ts      # definición de rutas y middlewares
```

### Frontend — separación de responsabilidades
- **`pages/`** — composición de componentes, lógica de pantalla
- **`components/`** — UI reutilizable sin lógica de negocio
- **`store/`** — estado global Zustand (incluye lógica offline/IndexedDB)
- **`services/`** — solo comunicación HTTP con la API

### Manejo de errores
```typescript
// Backend
throw new AppError('Mensaje claro', 400);   // operacional
throw new NotFoundError('Recurso no encontrado');
throw new ConflictError('Ya existe');

// Frontend
try {
  await store.action();
  addNotification({ type: 'success', ... });
} catch {
  // el store ya setea el error
}
```

### Soft deletes
Todos los modelos usan `paranoid: true`. Al hacer hard delete de un usuario,
**siempre** pasar `transferToAdminId` para reasignar precios y órdenes
(incluyendo soft-deleted) antes del `force: true` — evita errores de FK en MySQL.

---

## Roles del sistema

| Rol | Puede |
|-----|-------|
| `buyer` | Ver productos, gestionar precios y proveedores |
| `seller` | Crear y gestionar órdenes y clientes |
| `admin` | Todo lo anterior + gestión de usuarios y eliminaciones |
