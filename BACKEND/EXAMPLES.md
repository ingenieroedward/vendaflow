# Ejemplos de Uso de la API

Este documento contiene ejemplos prácticos de cómo usar los endpoints de la API.

## 🔐 Autenticación

### Registrar un nuevo usuario

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123",
    "role": "admin"
  }'
```

**Respuesta:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Iniciar sesión

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

### Obtener usuario actual

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📦 Categorías

### Crear categoría

```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Electrónicos"
  }'
```

### Listar categorías

```bash
curl -X GET http://localhost:3000/api/categories
```

### Obtener categoría por ID

```bash
curl -X GET http://localhost:3000/api/categories/1
```

### Actualizar categoría

```bash
curl -X PUT http://localhost:3000/api/categories/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Electrónicos y Tecnología"
  }'
```

### Eliminar categoría

```bash
curl -X DELETE http://localhost:3000/api/categories/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🏪 Proveedores

### Crear proveedor

```bash
curl -X POST http://localhost:3000/api/suppliers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "TechStore S.A.",
    "contact": "contact@techstore.com",
    "location": "Buenos Aires, Argentina"
  }'
```

### Listar proveedores

```bash
curl -X GET http://localhost:3000/api/suppliers
```

### Obtener proveedor por ID

```bash
curl -X GET http://localhost:3000/api/suppliers/1
```

### Actualizar proveedor

```bash
curl -X PUT http://localhost:3000/api/suppliers/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "TechStore Argentina S.A.",
    "contact": "ventas@techstore.com.ar",
    "location": "CABA, Argentina"
  }'
```

### Eliminar proveedor

```bash
curl -X DELETE http://localhost:3000/api/suppliers/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📦 Productos

### Crear producto

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Laptop Gaming",
    "unit": "unidad",
    "categoryId": 1
  }'
```

### Listar productos

```bash
curl -X GET http://localhost:3000/api/products
```

### Buscar productos por nombre

```bash
curl -X GET "http://localhost:3000/api/products/search?q=laptop"
```

**Respuesta:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Laptop Gaming",
      "unit": "unidad",
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": "Electrónicos"
      },
      "prices": [
        {
          "id": 1,
          "price": 1299.99,
          "supplier": {
            "id": 1,
            "name": "TechStore S.A.",
            "contact": "contact@techstore.com",
            "location": "Buenos Aires, Argentina"
          },
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### Obtener producto por ID

```bash
curl -X GET http://localhost:3000/api/products/1
```

### Productos por categoría

```bash
curl -X GET http://localhost:3000/api/products/category/1
```

### Actualizar producto

```bash
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Laptop Gaming Pro",
    "unit": "unidad",
    "categoryId": 1
  }'
```

### Eliminar producto

```bash
curl -X DELETE http://localhost:3000/api/products/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 💰 Precios

### Crear precio

```bash
curl -X POST http://localhost:3000/api/prices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": 1,
    "supplierId": 1,
    "price": 1299.99
  }'
```

### Listar precios

```bash
curl -X GET http://localhost:3000/api/prices
```

### Obtener precio por ID

```bash
curl -X GET http://localhost:3000/api/prices/1
```

### Precios por producto

```bash
curl -X GET http://localhost:3000/api/prices/product/1
```

### Actualizar precio

```bash
curl -X PUT http://localhost:3000/api/prices/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "price": 1199.99
  }'
```

### Eliminar precio

```bash
curl -X DELETE http://localhost:3000/api/prices/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 👥 Usuarios

### Listar usuarios

```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Obtener usuario por ID

```bash
curl -X GET http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Actualizar usuario

```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "username": "admin_updated",
    "role": "admin"
  }'
```

### Eliminar usuario

```bash
curl -X DELETE http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔍 Ejemplos de Búsqueda Avanzada

### Buscar productos con precios agrupados por proveedor

```bash
curl -X GET "http://localhost:3000/api/products/search?q=gaming"
```

### Paginación

```bash
# Obtener primera página con 10 elementos
curl -X GET "http://localhost:3000/api/products?page=1&limit=10"

# Obtener segunda página con 5 elementos
curl -X GET "http://localhost:3000/api/products?page=2&limit=5"
```

### Productos por categoría con paginación

```bash
curl -X GET "http://localhost:3000/api/products/category/1?page=1&limit=10"
```

## 🚨 Manejo de Errores

### Error de autenticación

```bash
curl -X GET http://localhost:3000/api/users
```

**Respuesta:**
```json
{
  "status": "error",
  "message": "Access token required"
}
```

### Error de validación

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "a",
    "password": "123"
  }'
```

**Respuesta:**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "username",
      "message": "Username must be at least 3 characters"
    },
    {
      "field": "password",
      "message": "Password must be at least 6 characters"
    }
  ]
}
```

### Error de recurso no encontrado

```bash
curl -X GET http://localhost:3000/api/products/999
```

**Respuesta:**
```json
{
  "status": "error",
  "message": "Product not found"
}
```

## 📊 Respuestas de Paginación

Todas las listas incluyen información de paginación:

```json
{
  "status": "success",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

## 🔐 Headers de Autenticación

Para endpoints protegidos, incluye el token JWT en el header:

```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 📝 Notas Importantes

1. **Roles de Usuario**: Solo los usuarios con rol `admin` pueden crear, actualizar y eliminar recursos
2. **Categoría por Defecto**: Se crea automáticamente una categoría "Sin categoría" al inicializar la base de datos
3. **Validación**: Todos los datos de entrada son validados con Zod
4. **Soft Deletes**: Los recursos se eliminan de forma suave (soft delete)
5. **Timestamps**: Todos los recursos incluyen `createdAt` y `updatedAt`
6. **Relaciones**: Los precios están vinculados a productos, proveedores y usuarios que los actualizaron 