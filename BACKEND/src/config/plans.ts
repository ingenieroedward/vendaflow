// Precios de planes (COP/mes) y llave Bre-B para recibir pagos.
// Ajustables por env en Dokploy sin tocar código.
export const PLAN_PRICES: Record<string, number> = {
  basic: Number(process.env['PLAN_PRICE_BASIC'] ?? 50000),
  pro: Number(process.env['PLAN_PRICE_PRO'] ?? 100000),
  enterprise: Number(process.env['PLAN_PRICE_ENTERPRISE'] ?? 200000),
};

// Llave Bre-B (celular, cédula o llave alfanumérica) que ven los tenants para pagar
export const BREB_KEY = process.env['BREB_KEY'] ?? '';
export const BREB_HOLDER = process.env['BREB_HOLDER'] ?? 'EDW System';
