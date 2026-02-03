# Database Migrations

Este directorio contiene las migraciones de la base de datos local.

## Versiones
- **v1**: Schema inicial (SPEC-001)
- **v2**: (Futuro) Agregar campos adicionales según necesidades

## Cómo agregar una migración

```typescript
// En LocalDatabase.ts
this.version(2).stores({
  // Schema actualizado
}).upgrade(trans => {
  // Código de migración
  return trans.products.toCollection().modify(product => {
    product.newField = 'default';
  });
});
```

## Notas
- Dexie maneja migraciones automáticamente
- Nunca eliminar versiones anteriores
- Siempre incrementar el número de versión
