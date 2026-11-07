// Nombre visible de cada rol (en la BD siguen en inglés)
export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Administrador',
  seller: 'Vendedor',
  buyer: 'Comprador',
};

export const roleLabel = (role?: string | null): string => (role ? ROLE_LABELS[role] ?? role : '');
