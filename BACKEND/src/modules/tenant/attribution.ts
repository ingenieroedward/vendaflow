// Atribución del embudo público: de dónde viene cada visita/solicitud.
// Lista CERRADA de orígenes — el input del cliente nunca se guarda tal cual,
// así las llaves de metrics_daily no crecen sin control ni aceptan basura.

export const SOURCES = [
  'facebook', 'instagram', 'google', 'bing', 'whatsapp', 'tiktok', 'youtube',
  'linkedin', 'chatgpt', 'ia', 'email', 'otro', 'directo',
] as const;
export type Source = typeof SOURCES[number];

// Coincidencia por fragmento: sirve igual para utm_source ("fb", "ig_ads")
// y para el hostname del referrer ("l.facebook.com", "lm.instagram.com").
const RULES: Array<[RegExp, Source]> = [
  [/(^|[^a-z])(ig|insta)([^a-z]|$)|instagram/, 'instagram'],
  [/(^|[^a-z])(fb|meta)([^a-z]|$)|facebook|fbclid/, 'facebook'],
  [/whatsapp|(^|[^a-z])wa([^a-z]|$)|wa\.me/, 'whatsapp'],
  [/chatgpt|openai/, 'chatgpt'],
  [/claude|perplexity|gemini|copilot|deepseek/, 'ia'],
  [/google|gclid|adwords/, 'google'],
  [/bing|msn/, 'bing'],
  [/tiktok/, 'tiktok'],
  [/youtube|youtu\.be/, 'youtube'],
  [/linkedin|lnkd/, 'linkedin'],
  [/mail|newsletter/, 'email'],
];

/** Normaliza un origen crudo (utm_source, hostname del referrer, etc.) a la lista cerrada. */
export function normalizeSource(raw: unknown): Source {
  if (typeof raw !== 'string') return 'directo';
  const s = raw.trim().toLowerCase().slice(0, 100);
  if (!s || s === 'directo' || s === 'direct' || s === '(direct)') return 'directo';
  for (const [re, source] of RULES) if (re.test(s)) return source;
  return 'otro';
}

/** Nombre de campaña (utm_campaign) saneado: [a-z0-9_-], máx. 50 chars, o null. */
export function sanitizeCampaign(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 50);
  return s || null;
}

export interface SourceFunnelRow {
  source: string; // un valor de SOURCES, o 'sin_dato' (solicitudes previas al seguimiento)
  landingViews: number;
  registroViews: number;
  requests: number;
  approved: number;
}

/**
 * Desglose del embudo por origen. Visitas/registro salen de metrics_daily
 * (llaves `evento:origen`; las llaves sin origen son el total y se ignoran acá),
 * solicitudes/aprobadas de tenant_requests.source.
 * Orden: más solicitudes primero, luego más registros, luego más visitas.
 */
export function aggregateBySource(
  metrics: Array<{ key: string; count: number }>,
  requests: Array<{ source: string | null; status: string }>,
): SourceFunnelRow[] {
  const map = new Map<string, SourceFunnelRow>();
  const bucket = (source: string) => {
    let b = map.get(source);
    if (!b) { b = { source, landingViews: 0, registroViews: 0, requests: 0, approved: 0 }; map.set(source, b); }
    return b;
  };
  for (const m of metrics) {
    const [event, source] = m.key.split(':');
    if (!source) continue;
    if (event === 'landing_view') bucket(source).landingViews += m.count;
    else if (event === 'registro_view') bucket(source).registroViews += m.count;
  }
  for (const r of requests) {
    const b = bucket(r.source ?? 'sin_dato');
    b.requests += 1;
    if (r.status === 'approved') b.approved += 1;
  }
  return [...map.values()].sort(
    (a, b) => b.requests - a.requests || b.registroViews - a.registroViews || b.landingViews - a.landingViews,
  );
}
