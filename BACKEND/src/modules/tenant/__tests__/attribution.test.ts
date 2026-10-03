import { normalizeSource, sanitizeCampaign, aggregateBySource, SOURCES } from '../attribution';

describe('normalizeSource', () => {
  it.each([
    ['facebook', 'facebook'], ['fb', 'facebook'], ['FB_Ads', 'facebook'], ['l.facebook.com', 'facebook'], ['m.facebook.com', 'facebook'],
    ['instagram', 'instagram'], ['ig', 'instagram'], ['lm.instagram.com', 'instagram'],
    ['google', 'google'], ['www.google.com.co', 'google'], ['gclid', 'google'],
    ['bing', 'bing'], ['www.bing.com', 'bing'],
    ['whatsapp', 'whatsapp'], ['wa', 'whatsapp'], ['wa.me', 'whatsapp'],
    ['chatgpt.com', 'chatgpt'], ['claude.ai', 'ia'], ['www.perplexity.ai', 'ia'],
    ['tiktok', 'tiktok'], ['youtube', 'youtube'], ['linkedin', 'linkedin'],
    ['newsletter', 'email'], ['correo-mail', 'email'],
    ['directo', 'directo'], ['', 'directo'], ['   ', 'directo'],
    ['algun-blog.com', 'otro'], ['metaverso.io', 'otro'], ['meta_ads', 'facebook'], ['meta', 'facebook'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeSource(raw)).toBe(expected);
  });

  it('no-string → directo', () => {
    expect(normalizeSource(undefined)).toBe('directo');
    expect(normalizeSource(123)).toBe('directo');
    expect(normalizeSource({ x: 1 })).toBe('directo');
  });

  it('nunca devuelve algo fuera de la lista cerrada', () => {
    for (const raw of ['<script>', 'x'.repeat(500), 'DROP TABLE', 'metaverso.io']) {
      expect(SOURCES).toContain(normalizeSource(raw));
    }
  });

  it('llave de metrics_daily cabe en STRING(40)', () => {
    for (const s of SOURCES) expect(`registro_view:${s}`.length).toBeLessThanOrEqual(40);
  });
});

describe('sanitizeCampaign', () => {
  it('normaliza y limita', () => {
    expect(sanitizeCampaign('Lanzamiento Octubre')).toBe('lanzamiento-octubre');
    expect(sanitizeCampaign('promo_2026!')).toBe('promo_2026');
    expect(sanitizeCampaign('a'.repeat(80))).toHaveLength(50);
  });
  it('vacío o inválido → null', () => {
    expect(sanitizeCampaign('')).toBeNull();
    expect(sanitizeCampaign('¡¿!')).toBeNull();
    expect(sanitizeCampaign(undefined)).toBeNull();
  });
});

describe('aggregateBySource', () => {
  const metrics = [
    { key: 'landing_view', count: 100 },          // total — se ignora en el desglose
    { key: 'landing_view:facebook', count: 60 },
    { key: 'landing_view:facebook', count: 10 },  // otro día, se suma
    { key: 'landing_view:google', count: 30 },
    { key: 'registro_view', count: 20 },
    { key: 'registro_view:facebook', count: 12 },
    { key: 'registro_view:google', count: 8 },
    { key: 'otro_evento:facebook', count: 99 },   // evento desconocido — ignorado
  ];
  const requests = [
    { source: 'facebook', status: 'approved' },
    { source: 'facebook', status: 'pending' },
    { source: 'whatsapp', status: 'approved' },
    { source: null, status: 'approved' },          // previa al seguimiento
  ];

  it('suma por origen y combina métricas con solicitudes', () => {
    const rows = aggregateBySource(metrics, requests);
    const fb = rows.find(r => r.source === 'facebook');
    expect(fb).toEqual({ source: 'facebook', landingViews: 70, registroViews: 12, requests: 2, approved: 1 });
    expect(rows.find(r => r.source === 'google')).toEqual({ source: 'google', landingViews: 30, registroViews: 8, requests: 0, approved: 0 });
    expect(rows.find(r => r.source === 'whatsapp')).toEqual({ source: 'whatsapp', landingViews: 0, registroViews: 0, requests: 1, approved: 1 });
    expect(rows.find(r => r.source === 'sin_dato')).toEqual({ source: 'sin_dato', landingViews: 0, registroViews: 0, requests: 1, approved: 1 });
  });

  it('ordena por solicitudes, luego registros, luego visitas', () => {
    expect(aggregateBySource(metrics, requests).map(r => r.source)).toEqual(['facebook', 'whatsapp', 'sin_dato', 'google']);
  });

  it('sin datos → lista vacía', () => {
    expect(aggregateBySource([], [])).toEqual([]);
    expect(aggregateBySource([{ key: 'landing_view', count: 5 }], [])).toEqual([]);
  });
});
