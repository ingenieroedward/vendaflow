# Backend Escalable con Express y TypeScript

Un backend robusto y escalable construido con Express.js, TypeScript, Sequelize ORM y MySQL, siguiendo el patrón Modelo-Servicio-Controlador.

## 🚀 Características

- **TypeScript**: Código completamente tipado
- **Sequelize ORM**: Sin CLI, modelos definidos manualmente
- **MySQL**: Base de datos relacional
- **JWT**: Autenticación con tokens
- **bcrypt**: Hasheo seguro de contraseñas
- **Zod**: Validación de datos robusta
- **Patrón MVC**: Arquitectura limpia y modular
- **Middleware**: Manejo de errores, logging, rate limiting
- **Docker**: Configuración para desarrollo y producción

## 📋 Modelos de Base de Datos

### User
- `id`: number (PK)
- `username`: string (único)
- `password`: string (hasheado)
- `role`: 'buyer' | 'admin'

### Category
- `id`: number
- `name`: string
- Categoría por defecto: "Sin categoría"

### Product
- `id`: number
- `name`: string
- `unit`: string
- `categoryId`: number | null (FK → Category)

### Supplier
- `id`: number
- `name`: string
- `contact`: string
- `location`: string

### Price
- `id`: number
- `productId`: number (FK → Product)
- `supplierId`: number (FK → Supplier)
- `price`: number
- `updatedByUserId`: number (FK → User)
- `updatedAt`: Date

## 🔐 Autenticación

### Endpoints de Autenticación

- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual (protegido)

### Roles de Usuario

- **buyer**: Usuario comprador (acceso limitado)
- **admin**: Administrador (acceso completo)

## 📦 Endpoints API

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/search?q=query` - Buscar productos por nombre
- `GET /api/products/:id` - Obtener producto por ID
- `GET /api/products/category/:categoryId` - Productos por categoría
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Actualizar producto (admin)
- `DELETE /api/products/:id` - Eliminar producto (admin)

### Categorías
- `GET /api/categories` - Listar categorías
- `GET /api/categories/:id` - Obtener categoría por ID
- `POST /api/categories` - Crear categoría (admin)
- `PUT /api/categories/:id` - Actualizar categoría (admin)
- `DELETE /api/categories/:id` - Eliminar categoría (admin)

### Proveedores
- `GET /api/suppliers` - Listar proveedores
- `GET /api/suppliers/:id` - Obtener proveedor por ID
- `POST /api/suppliers` - Crear proveedor (admin)
- `PUT /api/suppliers/:id` - Actualizar proveedor (admin)
- `DELETE /api/suppliers/:id` - Eliminar proveedor (admin)

### Precios
- `GET /api/prices` - Listar precios
- `GET /api/prices/:id` - Obtener precio por ID
- `GET /api/prices/product/:productId` - Precios por producto
- `POST /api/prices` - Crear precio (admin)
- `PUT /api/prices/:id` - Actualizar precio (admin)
- `DELETE /api/prices/:id` - Eliminar precio (admin)

### Usuarios
- `GET /api/users` - Listar usuarios (admin)
- `GET /api/users/:id` - Obtener usuario por ID (admin)
- `PUT /api/users/:id` - Actualizar usuario (admin)
- `DELETE /api/users/:id` - Eliminar usuario (admin)

## 🛠️ Instalación y Configuración

### Prerrequisitos

- Node.js (v16 o superior)
- MySQL (v8.0 o superior)
- Docker (opcional)

### Configuración del Entorno

1. Clona el repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Copia el archivo de configuración:
   ```bash
   cp env.example .env
   ```

4. Configura las variables de entorno en `.env`:
   ```env
   # Server
   PORT=3000
   NODE_ENV=development

   # Database
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=express_ts_db
   DB_USER=root
   DB_PASSWORD=your_password
   DB_DIALECT=mysql

   # JWT
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=24h

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # CORS
   CORS_ORIGIN=http://localhost:3000
   ```

### Desarrollo

```bash
# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Ejecutar tests con coverage
npm run test:coverage
```

### Docker

```bash
# Desarrollo con Docker
npm run docker:dev

# Producción con Docker
npm run docker:prod

# Ver logs
npm run docker:logs
```

## 📁 Estructura del Proyecto

```
src/
├── config/           # Configuración de la aplicación
├── core/            # Utilidades core (middlewares, errores, etc.)
├── database/        # Configuración de base de datos
├── modules/         # Módulos de la aplicación
│   ├── auth/        # Autenticación
│   ├── user/        # Gestión de usuarios
│   ├── category/    # Gestión de categorías
│   ├── product/     # Gestión de productos
│   ├── supplier/    # Gestión de proveedores
│   └── price/       # Gestión de precios
├── types/           # Tipos TypeScript globales
├── app.ts           # Configuración de Express
└── server.ts        # Servidor HTTP
```

## 🔧 Scripts Disponibles

- `npm run dev` - Desarrollo con nodemon
- `npm run build` - Compilar TypeScript
- `npm start` - Ejecutar en producción
- `npm test` - Ejecutar tests
- `npm run test:watch` - Tests en modo watch
- `npm run test:coverage` - Tests con coverage
- `npm run lint` - Linting del código
- `npm run format` - Formatear código

## 🧪 Testing

El proyecto incluye tests unitarios e integración:

```bash
# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Todos los tests
npm test
```

## 📊 Logging

El sistema utiliza Winston para logging con rotación de archivos:

- Logs de aplicación en `logs/app.log`
- Logs de errores en `logs/error.log`
- Logs de acceso HTTP en `logs/access.log`

## 🔒 Seguridad

- **Helmet**: Headers de seguridad
- **CORS**: Configuración de origen cruzado
- **Rate Limiting**: Protección contra ataques DDoS
- **bcrypt**: Hasheo seguro de contraseñas
- **JWT**: Tokens de autenticación seguros
- **Validación**: Zod para validación de datos

## 🚀 Despliegue

### Producción

1. Configura las variables de entorno para producción
2. Compila el proyecto: `npm run build`
3. Ejecuta: `npm start`

### Docker

```bash
# Construir imagen
docker build -t express-ts-api .

# Ejecutar contenedor
docker run -p 3000:3000 express-ts-api
```

## 📝 Licencia

MIT License

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request 