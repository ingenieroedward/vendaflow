// Atribución del embudo público: de dónde llegó el visitante (anuncio, Google,
// WhatsApp…). Primer contacto: se guarda la primera fuente vista por 30 días,
// así quien vuelve "directo" días después sigue contando para el anuncio que lo
// trajo. El backend normaliza el valor a una lista cerrada (attribution.ts) —
// acá solo se recoge la pista cruda. Sin cookies, sin datos personales.

const STORAGE_KEY = 'merco_attr';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OWN_HOST = /(^|\.)merco\.edwsystem\.com$/;

export interface Attribution {
  source: string;
  campaign?: string;
}

/** Pista de origen de la visita actual, o null si no trae ninguna. */
export function detectCurrentSource(url: string, referrer: string): Attribution | null {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    params = new URLSearchParams();
  }
  const campaign = params.get('utm_campaign') ?? undefined;
  const utm = params.get('utm_source');
  if (utm) return { source: utm, ...(campaign && { campaign }) };
  if (params.has('fbclid')) return { source: 'facebook', ...(campaign && { campaign }) };
  if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return { source: 'google', ...(campaign && { campaign }) };
  if (params.has('ttclid')) return { source: 'tiktok', ...(campaign && { campaign }) };

  if (referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (host && !OWN_HOST.test(host)) return { source: host };
    } catch {
      // referrer inválido — se ignora
    }
  }
  return null;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Origen atribuido a una visita (primer contacto vigente). Si la visita trae
 * pista y no hay una guardada vigente, la guarda. Sin pista ni guardada → 'directo'.
 */
export function resolveAttribution(url: string, referrer: string, storage: StorageLike | null, now: number): Attribution {
  const current = detectCurrentSource(url, referrer);
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Attribution & { at: number }) : null;
    if (saved && typeof saved.source === 'string' && now - saved.at < TTL_MS) {
      return { source: saved.source, ...(saved.campaign && { campaign: saved.campaign }) };
    }
    if (current) storage?.setItem(STORAGE_KEY, JSON.stringify({ ...current, at: now }));
  } catch {
    // localStorage bloqueado (modo privado, etc.) o dato corrupto — se usa la pista de esta visita
  }
  return current ?? { source: 'directo' };
}

/** Origen atribuido a la visita actual del navegador. */
export function getAttribution(): Attribution {
  let storage: StorageLike | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // acceso a localStorage bloqueado
  }
  return resolveAttribution(window.location.href, document.referrer, storage, Date.now());
}
