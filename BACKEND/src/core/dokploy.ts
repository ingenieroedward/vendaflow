import logger from '@/core/logger';

// Integración con la API de Dokploy: crear el subdominio del tenant al
// aprobarlo (antes era el único paso manual del onboarding).
// Activa solo si DOKPLOY_API_TOKEN está en el entorno.
const DOKPLOY_URL = process.env['DOKPLOY_URL'] ?? 'http://dokploy:3000';
const TOKEN = process.env['DOKPLOY_API_TOKEN'];
const COMPOSE_ID = process.env['DOKPLOY_COMPOSE_ID'] ?? 'fRFCqlfP25dO1If1jmo8I';

export const dokployEnabled = Boolean(TOKEN);

async function api(path: string, body: unknown): Promise<Response> {
  return fetch(`${DOKPLOY_URL}/api/${path}`, {
    method: 'POST',
    headers: { 'x-api-key': TOKEN!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

/**
 * Crea el dominio <slug>.merco.edwsystem.com en el compose de Merco y dispara
 * el redeploy que lo aplica en Traefik (verificado: sin redeploy no sirve).
 * El redeploy corre async en Dokploy (~3-5 min con CI); el certificado
 * letsencrypt se emite solo al primer acceso.
 */
export async function registerTenantDomain(slug: string): Promise<{ ok: boolean; detail: string }> {
  if (!TOKEN) return { ok: false, detail: 'DOKPLOY_API_TOKEN no configurado — crea el dominio a mano' };
  const host = `${slug}.merco.edwsystem.com`;
  try {
    const create = await api('domain.create', {
      host,
      serviceName: 'frontend',
      port: 80,
      https: true,
      certificateType: 'letsencrypt',
      domainType: 'compose',
      composeId: COMPOSE_ID,
      path: '/',
    });
    if (!create.ok) {
      const text = (await create.text()).slice(0, 200);
      logger.error(`[dokploy] domain.create ${host} falló (${create.status}): ${text}`);
      return { ok: false, detail: `No se pudo crear el dominio (${create.status}) — créalo a mano en Dokploy` };
    }

    const redeploy = await api('compose.redeploy', { composeId: COMPOSE_ID });
    if (!redeploy.ok) {
      logger.error(`[dokploy] compose.redeploy falló (${redeploy.status})`);
      return { ok: true, detail: `Dominio ${host} creado, pero el redeploy falló — dispáralo a mano en Dokploy` };
    }

    logger.info(`[dokploy] Dominio ${host} creado y redeploy disparado`);
    return { ok: true, detail: `Dominio ${host} creado — estará activo en ~5 minutos (redeploy en curso)` };
  } catch (err) {
    logger.error(`[dokploy] Error registrando dominio ${host}:`, err);
    return { ok: false, detail: 'Dokploy no respondió — crea el dominio a mano' };
  }
}
