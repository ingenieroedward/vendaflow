# DOCUMENTACIÓN TÉCNICA DEL PROYECTO JJLM

> Análisis completo de arquitectura, estructura y funcionalidades del sistema
> Última actualización: 2026-03-23

**Ver también:** [CHANGELOG.md](./CHANGELOG.md) · [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## ÍNDICE

1. [Propósito del Sistema](#propósito-del-sistema)
2. [Arquitectura General](#arquitectura-general)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Base de Datos y Modelos](#base-de-datos-y-modelos)
6. [API Endpoints](#api-endpoints)
7. [Sistema de Roles](#sistema-de-roles)
8. [Módulos Principales](#módulos-principales)
9. [Flujos de Trabajo](#flujos-de-trabajo)
10. [Características Técnicas](#características-técnicas)
11. [Configuración y Despliegue](#configuración-y-despliegue)

---

## 🎯 PROPÓSITO DEL SISTEMA

**JJLM es un Sistema de Gestión de Ventas y Comparación de Precios** diseñado para:

- **Comparar precios** de productos entre múltiples proveedores
- **Gestionar ventas** mediante órdenes estructuradas con cálculo automático de totales
- **Controlar acceso** con 3 roles diferenciados (buyer, seller, admin)
- **Centralizar información comercial** de productos, clientes y proveedores
- **Trazabilidad completa** de precios y órdenes

### Casos de Uso Ideales

- Empresas que compran a múltiples proveedores
- Negocios que necesitan comparar precios constantemente
- Equipos de ventas que requieren gestionar órdenes estructuradas
- Organizaciones que necesitan separación de roles (compras vs ventas)

---

## 🏗️ ARQUITECTURA GENERAL

### Estructura del Proyecto

```
JJLM/
├── BACKEND/          # API REST con Node.js + TypeScript
└── FRONTEND/         # Aplicación web con React + TypeScript
```

**Tipo:** Arquitectura cliente-servidor con separación completa entre frontend y backend

**Patrón Backend:** Model-Service-Controller (MSC)

**Patrón Frontend:** Component-Based Architecture con estado global (Zustand)

---

## 🔧 STACK TECNOLÓGICO

### BACKEND

#### Core
- **Node.js** con **TypeScript** (v5.3.3)
- **Express.js** (v4.18.2) - Framework web
- **Sequelize ORM** (v6.35.2) con **sequelize-typescript** - ORM para base de datos
- **MySQL** (v3.6.5) - Base de datos relacional

#### Seguridad
- **JWT (jsonwebtoken)** - Autenticación basada en tokens
- **bcryptjs** - Hash de contraseñas
- **Helmet** - Headers de seguridad HTTP
- **CORS** - Control de origen cruzado
- **express-rate-limit** - Protección contra DDoS

#### Validación y Utilidades
- **Zod** - Validación de esquemas
- **Winston** - Sistema de logging con rotación de archivos
- **Morgan** - Logging HTTP
- **Compression** - Compresión de respuestas

#### DevTools
- **Jest** - Testing
- **ESLint** - Linting
- **Prettier** - Formateo de código
- **Nodemon** - Hot reload en desarrollo
- **Docker** - Containerización

### FRONTEND

#### Core
- **React** (v18.3.1) con **TypeScript**
- **Vite** (v5.4.2) - Build tool y dev server
- **React Router DOM** (v7.6.3) - Enrutamiento SPA

#### Gestión de Estado
- **Zustand** (v5.0.6) - State management ligero

#### UI y Estilos
- **Tailwind CSS** (v3.4.1) - Framework CSS utility-first
- **Lucide React** (v0.344.0) - Iconos
- **PostCSS** + **Autoprefixer**

#### Utilidades
- **Axios** (v1.10.0) - Cliente HTTP
- **React Hook Form** (v7.60.0) - Manejo de formularios
- **date-fns** (v4.1.0) - Manipulación de fechas

#### DevTools
- **ESLint** - Linting
- **TypeScript** (v5.5.3)

---

## 📁 ESTRUCTURA DEL PROYECTO

### Backend

```
BACKEND/
├── src/
│   ├── config/              # Configuración centralizada
│   │   └── index.ts         # Env vars, DB config, JWT config
│   │
│   ├── core/                # Funcionalidades core
│   │   ├── errors/
│   │   │   └── AppError.ts  # Error personalizado
│   │   ├── logger/
│   │   │   └── index.ts     # Winston logger
│   │   ├── middlewares/
│   │   │   ├── auth.ts      # JWT authentication
│   │   │   ├── errorHandler.ts  # Global error handler
│   │   │   ├── logger.ts    # Request logging
│   │   │   └── asyncHandler.ts  # Async/await wrapper
│   │   └── utils/
│   │       └── validation.ts
│   │
│   ├── database/
│   │   └── index.ts         # Sequelize configuration
│   │
│   ├── modules/             # Módulos de negocio
│   │   ├── auth/           # Autenticación
│   │   │   ├── auth.model.ts
│   │   │   ├── auth.dto.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   │
│   │   ├── user/           # Usuarios
│   │   ├── category/       # Categorías
│   │   ├── product/        # Productos
│   │   ├── supplier/       # Proveedores
│   │   ├── price/          # Precios
│   │   ├── customer/       # Clientes
│   │   └── order/          # Órdenes
│   │       └── order-item/ # Items de orden
│   │
│   ├── types/              # Tipos TypeScript globales
│   ├── app.ts              # Express app setup
│   └── server.ts           # HTTP server entry point
│
├── dist/                   # Código compilado
├── logs/                   # Winston logs
├── .env                    # Variables de entorno
├── package.json
├── tsconfig.json
├── Dockerfile
├── Dockerfile.dev
└── docker-compose.yml
```

**Patrón por módulo:**
- `*.model.ts` - Modelo de datos (Sequelize)
- `*.dto.ts` - DTOs de validación (Zod)
- `*.service.ts` - Lógica de negocio
- `*.controller.ts` - Controladores HTTP
- `*.routes.ts` - Definición de rutas Express

### Frontend

```
FRONTEND/
├── src/
│   ├── components/
│   │   ├── features/        # Componentes de features
│   │   │   ├── ProductSearch.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── PriceTable.tsx
│   │   │   ├── OrderPrintView.tsx
│   │   │   ├── CustomerSearch.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── Pagination.tsx
│   │   │
│   │   ├── layout/          # Componentes de layout
│   │   │   ├── Layout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   └── ui/              # Componentes UI reutilizables
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorMessage.tsx
│   │       └── CustomerModal.tsx
│   │
│   ├── pages/               # Páginas de la aplicación
│   │   ├── Login.tsx
│   │   ├── Home.tsx              # Búsqueda de productos
│   │   ├── ProductDetail.tsx
│   │   ├── ProductNew.tsx
│   │   ├── ProductEdit.tsx
│   │   ├── Orders.tsx            # Listado de órdenes
│   │   ├── OrderNew.tsx
│   │   ├── OrderEdit.tsx
│   │   ├── OrderDetail.tsx
│   │   ├── Users.tsx             # Gestión de usuarios
│   │   ├── UserNew.tsx
│   │   └── UserEdit.tsx
│   │
│   ├── routes/
│   │   └── AppRouter.tsx    # Configuración de rutas protegidas
│   │
│   ├── services/            # Servicios API
│   │   ├── api.ts          # Cliente Axios configurado
│   │   ├── auth.ts         # Autenticación
│   │   ├── products.ts     # Productos
│   │   ├── orders.ts       # Órdenes
│   │   ├── customers.ts    # Clientes
│   │   └── users.ts        # Usuarios
│   │
│   ├── store/              # Estado global (Zustand)
│   │   ├── authStore.ts    # Estado de autenticación
│   │   ├── productStore.ts # Estado de productos
│   │   ├── orderStore.ts   # Estado de órdenes
│   │   ├── customerStore.ts
│   │   ├── userStore.ts
│   │   └── uiStore.ts      # Notificaciones
│   │
│   ├── types/              # Tipos TypeScript
│   │   ├── auth.ts
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── customer.ts
│   │   └── api.ts
│   │
│   ├── utils/              # Utilidades
│   │   └── constants.ts
│   │
│   ├── App.tsx             # Componente raíz
│   ├── main.tsx            # Entry point
│   └── index.css           # Tailwind imports
│
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 🗄️ BASE DE DATOS Y MODELOS

### Base de Datos

- **Motor:** MySQL
- **Nombre:** jjlm_db
- **Características:**
  - Soft Deletes en todos los modelos (paranoid: true)
  - Timestamps automáticos (createdAt, updatedAt, deletedAt)
  - Validaciones a nivel de modelo con Sequelize

### Diagrama de Entidades

```
User (usuarios del sistema)
  ├── hasMany → Price (como updatedByUser)
  ├── hasMany → Order (como createdByUser)

Category (categorías)
  └── hasMany → Product

Product (productos)
  ├── belongsTo → Category
  ├── hasMany → Price
  └── hasMany → OrderItem

Supplier (proveedores)
  └── hasMany → Price

Price (precios por proveedor)
  ├── belongsTo → Product
  ├── belongsTo → Supplier
  └── belongsTo → User (updatedBy)

Customer (clientes)
  └── hasMany → Order

Order (órdenes de venta)
  ├── belongsTo → Customer
  ├── belongsTo → User (createdBy)
  └── hasMany → OrderItem

OrderItem (items de la orden)
  ├── belongsTo → Order
  └── belongsTo → Product
```

### Modelos Detallados

#### User (Usuarios)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  username: STRING (UNIQUE, NOT NULL)
  password: STRING (NOT NULL, hasheado con bcrypt)
  role: ENUM('buyer', 'seller', 'admin') (NOT NULL)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### Category (Categorías)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  name: STRING (NOT NULL)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### Product (Productos)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  name: STRING (NOT NULL)
  code: STRING (UNIQUE, NOT NULL)
  unit: STRING (NOT NULL)
  salePrice: DECIMAL(10,2) (NOT NULL)
  categoryId: INTEGER (FK → Category, nullable)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### Supplier (Proveedores)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  name: STRING (NOT NULL)
  contact: STRING (NOT NULL)
  location: STRING (NOT NULL)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### Price (Precios)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  productId: INTEGER (FK → Product, NOT NULL)
  supplierId: INTEGER (FK → Supplier, NOT NULL)
  price: DECIMAL(10,2) (NOT NULL)
  updatedByUserId: INTEGER (FK → User, NOT NULL)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### Customer (Clientes)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  name: STRING (NOT NULL)
  contact: STRING (NOT NULL)
  address: STRING (NOT NULL)
  note: STRING (nullable)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### Order (Órdenes)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  orderNumber: STRING (UNIQUE, NOT NULL)
  customerId: INTEGER (FK → Customer, NOT NULL)
  userId: INTEGER (FK → User, NOT NULL)
  totalAmount: DECIMAL(10,2) (NOT NULL)
  status: ENUM('pending', 'processing', 'completed', 'cancelled')
  notes: TEXT (nullable)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

#### OrderItem (Items de Orden)
```typescript
{
  id: INTEGER (PK, AUTO_INCREMENT)
  orderId: INTEGER (FK → Order, NOT NULL)
  productId: INTEGER (FK → Product, NOT NULL)
  quantity: INTEGER (NOT NULL)
  unitPrice: DECIMAL(10,2) (NOT NULL)
  taxRate: INTEGER (NOT NULL)
  totalPrice: DECIMAL(10,2) (NOT NULL)
  createdAt: DATE
  updatedAt: DATE
  deletedAt: DATE (nullable)
}
```

---

## 🌐 API ENDPOINTS

**Base URL:** `http://localhost:3000/api`

### Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| POST | `/register` | Registrar nuevo usuario | No | - |
| POST | `/login` | Iniciar sesión | No | - |
| GET | `/me` | Obtener usuario actual | Sí | Any |

### Usuarios (`/api/users`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar usuarios | Sí | Admin |
| GET | `/:id` | Obtener usuario por ID | Sí | Admin |
| PUT | `/:id` | Actualizar usuario | Sí | Admin |
| DELETE | `/:id` | Eliminar usuario | Sí | Admin |

### Categorías (`/api/categories`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar categorías | Sí | Any |
| GET | `/:id` | Obtener categoría | Sí | Any |
| POST | `/` | Crear categoría | Sí | Admin |
| PUT | `/:id` | Actualizar categoría | Sí | Admin |
| DELETE | `/:id` | Eliminar categoría | Sí | Admin |

### Productos (`/api/products`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar productos (paginado) | Sí | Any |
| GET | `/prices` | Listar productos con precios | Sí | Any |
| GET | `/search` | Buscar productos | Sí | Any |
| GET | `/search/prices` | Buscar productos con precios | Sí | Any |
| GET | `/:id` | Obtener producto | Sí | Any |
| GET | `/category/:categoryId` | Productos por categoría | Sí | Any |
| POST | `/` | Crear producto | Sí | Auth |
| PUT | `/:id` | Actualizar producto | Sí | Auth |
| DELETE | `/:id` | Eliminar producto | Sí | Admin |

### Proveedores (`/api/suppliers`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar proveedores | Sí | Any |
| GET | `/:id` | Obtener proveedor | Sí | Any |
| POST | `/` | Crear proveedor | Sí | Auth |
| PUT | `/:id` | Actualizar proveedor | Sí | Auth |
| DELETE | `/:id` | Eliminar proveedor | Sí | Admin |

### Precios (`/api/prices`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar precios | Sí | Any |
| GET | `/:id` | Obtener precio | Sí | Any |
| GET | `/product/:productId` | Precios de un producto | Sí | Any |
| GET | `/supplier/:supplierId` | Precios de un proveedor | Sí | Any |
| POST | `/` | Crear precio | Sí | Auth |
| PUT | `/:id` | Actualizar precio | Sí | Auth |
| DELETE | `/:id` | Eliminar precio | Sí | Admin |

### Clientes (`/api/customers`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar clientes | Sí | Any |
| GET | `/search` | Buscar clientes | Sí | Any |
| GET | `/:id` | Obtener cliente | Sí | Any |
| POST | `/` | Crear cliente | Sí | Auth |
| PUT | `/:id` | Actualizar cliente | Sí | Auth |
| DELETE | `/:id` | Eliminar cliente | Sí | Admin |

### Órdenes (`/api/orders`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/` | Listar órdenes | Sí | Any |
| GET | `/search` | Buscar órdenes | Sí | Any |
| GET | `/next-number` | Obtener próximo número | Sí | Seller/Admin |
| GET | `/:id` | Obtener orden con items | Sí | Any |
| GET | `/customer/:customerId` | Órdenes por cliente | Sí | Any |
| POST | `/` | Crear orden | Sí | Seller/Admin |
| PUT | `/:id` | Actualizar orden | Sí | Auth |
| DELETE | `/:id` | Eliminar orden | Sí | Admin |

### Health Check

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/health` | Estado del servidor | No | - |

---

## 👥 SISTEMA DE ROLES

### Roles Definidos

#### 1. **buyer** (Comprador)
**Permisos:**
- Acceso a productos y comparación de precios
- Puede ver, buscar, crear y editar productos
- Puede gestionar categorías y proveedores
- Puede crear y actualizar precios
- NO puede crear órdenes de venta
- NO puede eliminar recursos

**Casos de uso:**
- Equipo de compras
- Analistas de precios
- Gestores de inventario

#### 2. **seller** (Vendedor)
**Permisos:**
- Acceso a órdenes de venta
- Puede crear, editar y gestionar órdenes
- Puede ver y buscar productos
- Puede gestionar clientes
- NO puede eliminar recursos
- NO puede gestionar usuarios

**Casos de uso:**
- Equipo de ventas
- Ejecutivos comerciales
- Atención al cliente

#### 3. **admin** (Administrador)
**Permisos:**
- Acceso completo a todo el sistema
- Gestión de usuarios y asignación de roles
- Puede eliminar cualquier recurso
- Supervisión general del sistema

**Casos de uso:**
- Administradores del sistema
- Gerentes generales
- IT/DevOps

### Middlewares de Autorización

**Archivo:** `BACKEND/src/core/middlewares/auth.ts`

```typescript
// Verifica que el usuario esté autenticado (token JWT válido)
isAuth: (req, res, next) => void

// Solo administradores
isAdmin: (req, res, next) => void

// Vendedores y administradores
isSeller: (req, res, next) => void
```

---

## 📦 MÓDULOS PRINCIPALES

### 1. Módulo de Autenticación

**Ubicación:** `BACKEND/src/modules/auth/`

**Funcionalidades:**
- Registro de usuarios con hash de contraseñas (bcrypt)
- Login con generación de JWT
- Validación de credenciales
- Obtención de usuario actual desde token

**Endpoints:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

**Archivos clave:**
- `auth.service.ts:42` - Lógica de registro
- `auth.service.ts:67` - Lógica de login
- `auth.controller.ts` - Controladores HTTP

---

### 2. Módulo de Productos

**Ubicación:** `BACKEND/src/modules/product/`

**Funcionalidades:**
- CRUD completo de productos
- Búsqueda con filtros (nombre, código)
- Paginación de resultados
- Consulta de productos con precios por proveedor
- Agrupación por categorías
- Estadísticas (total, con precios, cobertura)

**Endpoints principales:**
- `GET /api/products` - Lista paginada
- `GET /api/products/prices` - Con precios de proveedores
- `GET /api/products/search` - Búsqueda
- `POST /api/products` - Crear
- `PUT /api/products/:id` - Actualizar
- `DELETE /api/products/:id` - Eliminar (admin)

**Archivos clave:**
- `product.model.ts` - Modelo Sequelize
- `product.service.ts` - Lógica de negocio
- `product.controller.ts` - Controladores

---

### 3. Módulo de Precios

**Ubicación:** `BACKEND/src/modules/price/`

**Funcionalidades:**
- Gestión de precios por producto y proveedor
- Relación muchos-a-muchos entre productos y proveedores
- Tracking de quién actualizó el precio (updatedByUserId)
- Consultas por producto o proveedor
- Comparación de precios

**Modelo:**
```typescript
Price {
  productId: FK
  supplierId: FK
  price: Decimal
  updatedByUserId: FK
}
```

**Archivos clave:**
- `price.model.ts` - Modelo con relaciones
- `price.service.ts` - Lógica de negocio

---

### 4. Módulo de Órdenes

**Ubicación:** `BACKEND/src/modules/order/`

**Funcionalidades:**
- Creación de órdenes de venta
- Gestión de items de orden (productos + cantidad + precio)
- Cálculo automático de totales e impuestos
- Estados de orden (pending, processing, completed, cancelled)
- Números de orden auto-incrementales
- Búsqueda y filtrado de órdenes
- Consulta de órdenes por cliente

**Modelo Order:**
```typescript
Order {
  orderNumber: string
  customerId: FK
  userId: FK (quien creó)
  totalAmount: Decimal
  status: enum
  notes: text
}
```

**Modelo OrderItem:**
```typescript
OrderItem {
  orderId: FK
  productId: FK
  quantity: int
  unitPrice: Decimal
  taxRate: int
  totalPrice: Decimal
}
```

**Endpoints principales:**
- `POST /api/orders` - Crear orden con items
- `GET /api/orders` - Listar órdenes
- `GET /api/orders/:id` - Detalle con items
- `GET /api/orders/next-number` - Próximo número

**Archivos clave:**
- `order.model.ts` - Modelo de orden
- `order-item/order-item.model.ts` - Modelo de items
- `order.service.ts:89` - Creación de orden con transacciones

---

### 5. Módulo de Clientes

**Ubicación:** `BACKEND/src/modules/customer/`

**Funcionalidades:**
- CRUD de clientes
- Búsqueda por nombre o contacto
- Información de contacto y dirección
- Notas adicionales

**Endpoints:**
- `GET /api/customers/search` - Búsqueda
- `POST /api/customers` - Crear
- `PUT /api/customers/:id` - Actualizar

---

### 6. Módulo de Usuarios

**Ubicación:** `BACKEND/src/modules/user/`

**Funcionalidades:**
- CRUD de usuarios (solo admin)
- Asignación de roles
- Listado de usuarios del sistema

**Restricción:** Solo accesible por administradores

---

## 🔄 FLUJOS DE TRABAJO

### Flujo de Comprador (Buyer)

```
1. Login
   └─> POST /api/auth/login
       └─> Recibe JWT token

2. Buscar Productos
   └─> GET /api/products/search/prices?search=producto
       └─> Visualiza productos con precios de todos los proveedores

3. Comparar Precios
   └─> Analiza tabla comparativa
       └─> Identifica mejor precio por proveedor

4. Actualizar Precio (opcional)
   └─> PUT /api/prices/:id
       └─> Actualiza precio de un proveedor

5. Crear Producto (opcional)
   └─> POST /api/products
       └─> Agrega nuevo producto al catálogo
```

### Flujo de Vendedor (Seller)

```
1. Login
   └─> POST /api/auth/login
       └─> Recibe JWT token

2. Buscar o Crear Cliente
   └─> GET /api/customers/search?search=nombre
       └─> Si no existe:
           └─> POST /api/customers

3. Obtener Próximo Número de Orden
   └─> GET /api/orders/next-number
       └─> Recibe siguiente número disponible

4. Crear Nueva Orden
   └─> POST /api/orders
       Body: {
         orderNumber: "ORD-001",
         customerId: 1,
         status: "pending",
         totalAmount: 1500.00,
         items: [
           {
             productId: 1,
             quantity: 10,
             unitPrice: 100.00,
             taxRate: 19,
             totalPrice: 1190.00
           }
         ]
       }
       └─> Sistema crea orden + items en transacción

5. Imprimir Orden
   └─> Frontend: OrderPrintView component
       └─> Formato de impresión con detalles completos
```

### Flujo de Administrador

```
1. Login
   └─> POST /api/auth/login

2. Gestionar Usuarios
   └─> GET /api/users
       └─> Listar todos los usuarios

   └─> POST /api/users (crear nuevo)
       └─> Asignar rol (buyer/seller/admin)

   └─> PUT /api/users/:id (actualizar)
       └─> Cambiar rol o datos

   └─> DELETE /api/users/:id (eliminar)
       └─> Soft delete del usuario

3. Supervisión General
   └─> Acceso a todos los módulos
   └─> Capacidad de eliminar cualquier recurso
```

---

## ⚙️ CARACTERÍSTICAS TÉCNICAS

### Backend

#### 1. Sistema de Logging (Winston)

**Ubicación:** `BACKEND/src/core/logger/index.ts`

**Características:**
- Logs en archivos con rotación automática
- Niveles: error, warn, info, debug
- Formato JSON para producción
- Formato colorizado para desarrollo
- Archivos separados: `error.log`, `combined.log`

**Uso:**
```typescript
import logger from '@/core/logger';

logger.info('Mensaje informativo');
logger.error('Error crítico', { error });
```

#### 2. Manejo de Errores

**Ubicación:** `BACKEND/src/core/errors/AppError.ts`

**AppError personalizado:**
```typescript
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}
```

**Middleware global:** `BACKEND/src/core/middlewares/errorHandler.ts`

**Características:**
- Diferencia entre errores operacionales y de programación
- Respuestas HTTP estandarizadas
- Logging automático de errores
- Ocultamiento de stack traces en producción

#### 3. Validación con Zod

**Patrón en DTOs:**
```typescript
// auth.dto.ts
export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  role: z.enum(['buyer', 'seller', 'admin'])
});

export type RegisterDTO = z.infer<typeof registerSchema>;
```

**Uso en controladores:**
```typescript
const validated = registerSchema.parse(req.body);
```

#### 4. Middleware de Autenticación

**Ubicación:** `BACKEND/src/core/middlewares/auth.ts`

**Flujo:**
1. Extrae token del header `Authorization: Bearer <token>`
2. Verifica y decodifica JWT
3. Busca usuario en DB
4. Adjunta usuario a `req.user`
5. Verifica rol si es necesario

#### 5. Soft Deletes

**Configuración en modelos:**
```typescript
@Table({
  paranoid: true, // Habilita soft deletes
  timestamps: true
})
class Product extends Model {}
```

**Comportamiento:**
- `DELETE` no elimina físicamente el registro
- Establece `deletedAt` con timestamp actual
- Queries automáticamente excluyen registros eliminados
- Se puede recuperar con `restore()`

#### 6. Transacciones de Base de Datos

**Ejemplo en OrderService:**
```typescript
const order = await sequelize.transaction(async (t) => {
  const newOrder = await Order.create(orderData, { transaction: t });
  const orderItems = await OrderItem.bulkCreate(items, { transaction: t });
  return newOrder;
});
```

#### 7. Rate Limiting

**Configuración:** `BACKEND/src/app.ts`
```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests
});
```

#### 8. Seguridad HTTP (Helmet)

**Headers configurados:**
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

#### 9. Docker Support

**Archivo de deploy (único):** `docker-compose.yml` en la raíz del proyecto.

**Servicios:**
- `backend` — Node.js en puerto 3001, conectado a `jjlm-network` y `dokploy-network`
- `frontend` — nginx en puerto 8080, hace proxy de `/api/` al backend
- `mysql` — MySQL 8.0 en puerto 3307, volumen persistente

**Infraestructura:** VPS con Dokploy + Traefik como reverse proxy.
La red `dokploy-network` es externa y gestionada por Dokploy.

**Dockerfiles:**
- `BACKEND/Dockerfile` — Multi-stage: stage `builder` compila TypeScript,
  stage `production` copia solo `dist/` + dependencias de producción (imagen liviana).
- `FRONTEND/Dockerfile` — Multi-stage: stage `builder` genera el bundle con Vite,
  stage final sirve con nginx usando `nginx.conf` del proyecto.
- `FRONTEND/nginx.conf` — Proxy de `/api/` → `http://backend:3001`, SPA routing con `try_files`.

**Healthchecks:**
- Backend: `GET /health` con `start_period: 60s` (tiempo para conectar con MySQL)
- MySQL: `mysqladmin ping` con 10 reintentos
- Frontend depende de backend `service_healthy` para arrancar

#### 10. Health Check

**Endpoint:** `GET /health`

**Respuesta:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "uptime": 3600
}
```

---

### Frontend

#### 1. Gestión de Estado con Zustand

**Stores principales:**

**authStore.ts:**
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  login: (credentials) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}
```

**productStore.ts:**
```typescript
interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
}
```

**orderStore.ts:**
```typescript
interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  createOrder: (data: OrderCreateDTO) => Promise<void>;
  getNextOrderNumber: () => Promise<string>;
}
```

#### 2. Cliente HTTP (Axios)

**Ubicación:** `FRONTEND/src/services/api.ts`

**Configuración:**
```typescript
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000
});

// Interceptor de request - Agrega token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor de response - Maneja errores
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Auto-logout
      authStore.logout();
    }
    return Promise.reject(error);
  }
);
```

#### 3. Rutas Protegidas

**Ubicación:** `FRONTEND/src/routes/AppRouter.tsx`

**Implementación:**
```typescript
const PrivateRoute = ({ children, requiredRole }) => {
  const { user, token } = useAuthStore();

  if (!token) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" />;
  }

  return children;
};
```

**Rutas:**
```typescript
<Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
<Route path="/orders" element={<PrivateRoute requiredRole="seller"><Orders /></PrivateRoute>} />
<Route path="/users" element={<PrivateRoute requiredRole="admin"><Users /></PrivateRoute>} />
```

#### 4. Sistema de Notificaciones

**Ubicación:** `FRONTEND/src/store/uiStore.ts`

**Store:**
```typescript
interface UIState {
  notifications: Notification[];
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  clearNotification: (id: string) => void;
}
```

#### 5. Búsqueda en Tiempo Real

**Component:** `ProductSearch.tsx`

**Implementación:**
- Debouncing de 300ms
- Búsqueda automática mientras el usuario escribe
- Indicador de loading

#### 6. Paginación

**Component:** `Pagination.tsx`

**Características:**
- Paginación client-side
- Configuración de items por página
- Navegación entre páginas

#### 7. Impresión de Órdenes

**Component:** `OrderPrintView.tsx`

**Funcionalidades:**
- Vista optimizada para impresión
- CSS específico para `@media print`
- Incluye logo, detalles del cliente, items, totales

#### 8. Formularios con React Hook Form

**Ejemplo:**
```typescript
const { register, handleSubmit, formState: { errors } } = useForm({
  defaultValues: product
});

<input {...register('name', { required: true })} />
```

#### 9. Tailwind CSS

**Configuración:** `tailwind.config.js`

**Características:**
- Utility-first approach
- Responsive design
- Custom colors y themes
- Purge automático de CSS no usado

#### 10. PWA Support

**Component:** `InstallButton.tsx`

**Características:**
- Detección de capacidad de instalación
- Prompt de instalación
- Soporte offline (service worker)

---

## 🚀 CONFIGURACIÓN Y DESPLIEGUE

### Variables de Entorno

**Archivo:** `BACKEND/.env`

```bash
# Environment
NODE_ENV=development

# Server
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=jjlm_db
DB_USER=root
DB_PASSWORD=Ed+010918

# JWT
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Instalación y Ejecución

#### Backend

```bash
cd BACKEND

# Instalar dependencias
npm install

# Desarrollo
npm run dev        # Nodemon + TypeScript watch mode

# Producción
npm run build      # Compilar TypeScript
npm start          # Ejecutar dist/server.js

# Testing
npm test           # Jest

# Linting
npm run lint       # ESLint
npm run format     # Prettier
```

#### Frontend

```bash
cd FRONTEND

# Instalar dependencias
npm install

# Desarrollo
npm run dev        # Vite dev server (port 5173)

# Producción
npm run build      # Build para producción
npm run preview    # Preview del build

# Linting
npm run lint       # ESLint
```

### Docker

#### Desarrollo

```bash
docker-compose -f docker-compose.dev.yml up
```

**Servicios:**
- Backend en `http://localhost:3000`
- MySQL en `localhost:3306`
- Hot reload habilitado

#### Producción

```bash
docker-compose up -d
```

**Características:**
- Multi-stage build optimizado
- Volúmenes para persistencia de datos
- Health checks configurados
- Restart automático

### Base de Datos

#### Inicialización

**Automática:** Sequelize crea tablas automáticamente con `sync()`

**Manual:**
```bash
# Conectar a MySQL
mysql -u root -p

# Crear base de datos
CREATE DATABASE jjlm_db;
```

#### Seeders (Opcional)

**Categoría por defecto:**
Creada automáticamente en `BACKEND/src/database/index.ts:25`

```typescript
await Category.findOrCreate({
  where: { name: 'Sin categoría' }
});
```

#### Migrations

**No implementadas actualmente.** El proyecto usa `sequelize.sync()` para desarrollo.

**Para producción se recomienda:**
```bash
npm install -g sequelize-cli
sequelize init
sequelize migration:generate --name initial-schema
```

---

## 📊 ARCHIVOS CLAVE POR FUNCIONALIDAD

### Autenticación y Seguridad

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| auth.service.ts | `BACKEND/src/modules/auth/` | Lógica de login/register |
| auth.middleware.ts | `BACKEND/src/core/middlewares/` | JWT verification |
| authStore.ts | `FRONTEND/src/store/` | Estado global de auth |
| api.ts | `FRONTEND/src/services/` | Interceptores HTTP |

### Productos y Precios

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| product.model.ts | `BACKEND/src/modules/product/` | Modelo de productos |
| product.service.ts | `BACKEND/src/modules/product/` | Búsqueda y CRUD |
| price.model.ts | `BACKEND/src/modules/price/` | Modelo de precios |
| ProductSearch.tsx | `FRONTEND/src/components/features/` | Búsqueda UI |
| PriceTable.tsx | `FRONTEND/src/components/features/` | Tabla comparativa |

### Órdenes y Ventas

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| order.model.ts | `BACKEND/src/modules/order/` | Modelo de órdenes |
| order.service.ts | `BACKEND/src/modules/order/` | Creación con transacciones |
| order-item.model.ts | `BACKEND/src/modules/order/order-item/` | Items de orden |
| OrderNew.tsx | `FRONTEND/src/pages/` | Crear orden UI |
| OrderPrintView.tsx | `FRONTEND/src/components/features/` | Vista de impresión |

### Configuración

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| config/index.ts | `BACKEND/src/config/` | Variables de entorno |
| database/index.ts | `BACKEND/src/database/` | Sequelize setup |
| app.ts | `BACKEND/src/app.ts` | Express configuration |
| AppRouter.tsx | `FRONTEND/src/routes/` | Rutas protegidas |

---

## 🔍 PATRONES Y MEJORES PRÁCTICAS

### Separación de Responsabilidades

**Backend:**
- **Models:** Solo definición de esquema y relaciones
- **Services:** Lógica de negocio pura
- **Controllers:** Manejo de HTTP (request/response)
- **Routes:** Definición de endpoints y middlewares

**Frontend:**
- **Components:** UI pura y presentacional
- **Pages:** Composición de components
- **Services:** Comunicación con API
- **Stores:** Estado global

### Validación en Capas

1. **Frontend:** React Hook Form (validación básica)
2. **Backend DTO:** Zod schemas (validación de datos)
3. **Base de Datos:** Sequelize validators (constraints)

### Manejo de Errores

**Backend:**
```typescript
try {
  // Lógica
} catch (error) {
  throw new AppError('Mensaje claro', 400);
}
```

**Frontend:**
```typescript
try {
  await api.post('/endpoint', data);
  uiStore.showNotification('Éxito', 'success');
} catch (error) {
  uiStore.showNotification(error.message, 'error');
}
```

### Código Limpio

- **TypeScript estricto** en todo el proyecto
- **ESLint + Prettier** configurados
- **Nombres descriptivos** de variables y funciones
- **Comentarios solo cuando es necesario** (código auto-documentado)
- **DRY (Don't Repeat Yourself)** con utilities y helpers

---

## 📈 PRÓXIMAS MEJORAS SUGERIDAS

### Backend

1. **Migrations** con Sequelize CLI para gestión de esquema
2. **Testing** - Implementar tests con Jest
3. **Rate Limiting por usuario** en lugar de global
4. **Caching** con Redis para consultas frecuentes
5. **Auditoría** - Logs de todas las operaciones CRUD
6. **Búsqueda avanzada** con Elasticsearch
7. **Exportación** de reportes a PDF/Excel
8. **Notificaciones** push para órdenes

### Frontend

1. **Tests** con React Testing Library
2. **Storybook** para componentes UI
3. **Optimización** - Code splitting y lazy loading
4. **Accesibilidad** - ARIA labels completos
5. **i18n** - Internacionalización (multi-idioma)
6. **Gráficos** - Dashboard con estadísticas visuales
7. **Modo offline** - Service worker completo
8. **Temas** - Dark mode

### DevOps

1. **CI/CD** con GitHub Actions
2. **Monitoreo** con Prometheus + Grafana
3. **Logs centralizados** con ELK Stack
4. **Backups** automáticos de base de datos
5. **SSL/TLS** para producción
6. **CDN** para assets estáticos

---

## 📚 RECURSOS Y DOCUMENTACIÓN

### Backend

- **Express:** https://expressjs.com/
- **Sequelize:** https://sequelize.org/
- **Zod:** https://zod.dev/
- **Winston:** https://github.com/winstonjs/winston
- **JWT:** https://jwt.io/

### Frontend

- **React:** https://react.dev/
- **Vite:** https://vitejs.dev/
- **Zustand:** https://zustand-demo.pmnd.rs/
- **Tailwind CSS:** https://tailwindcss.com/
- **React Hook Form:** https://react-hook-form.com/

---

## 🤝 CONTRIBUCIÓN

### Workflow de Desarrollo

1. Crear branch desde `dev`
2. Desarrollar feature/fix
3. Commit siguiendo conventional commits
4. Push y crear Pull Request
5. Code review
6. Merge a `dev`
7. Release periódico a `main`

### Conventional Commits

```
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
style: formateo, sin cambios de código
refactor: refactorización
test: agregar tests
chore: tareas de mantenimiento
```

---

## 📝 NOTAS FINALES

- **Versión actual:** En desarrollo
- **Última actualización:** 2026-01-01
- **Estado:** Funcional y listo para producción con mejoras pendientes

**Contacto:** Este documento sirve como memoria técnica del proyecto JJLM.

---

*Documentación generada automáticamente por Claude Code*
