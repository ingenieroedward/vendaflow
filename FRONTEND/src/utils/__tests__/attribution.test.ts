import { describe, it, expect } from 'vitest';
import { detectCurrentSource, resolveAttribution } from '../attribution';

describe('detectCurrentSource', () => {
  const base = 'https://merco.edwsystem.com/';

  it('utm_source manda, con campaña', () => {
    expect(detectCurrentSource(`${base}?utm_source=facebook&utm_campaign=lanzamiento&fbclid=x`, ''))
      .toEqual({ source: 'facebook', campaign: 'lanzamiento' });
  });

  it('click IDs de anuncios', () => {
    expect(detectCurrentSource(`${base}?fbclid=abc`, '')).toEqual({ source: 'facebook' });
    expect(detectCurrentSource(`${base}?gclid=abc`, '')).toEqual({ source: 'google' });
    expect(detectCurrentSource(`${base}?ttclid=abc`, '')).toEqual({ source: 'tiktok' });
  });

  it('referrer externo → hostname; propio → ignorado', () => {
    expect(detectCurrentSource(base, 'https://www.google.com/')).toEqual({ source: 'www.google.com' });
    expect(detectCurrentSource(`${base}registro`, 'https://merco.edwsystem.com/')).toBeNull();
    expect(detectCurrentSource(base, 'https://demo.merco.edwsystem.com/x')).toBeNull();
  });

  it('sin pistas → null', () => {
    expect(detectCurrentSource(base, '')).toBeNull();
    expect(detectCurrentSource('no-es-url', 'tampoco')).toBeNull();
  });
});

describe('resolveAttribution (primer contacto)', () => {
  const memStorage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };
  const now = Date.UTC(2026, 9, 3);
  const base = 'https://merco.edwsystem.com/';

  it('sin pista ni guardada → directo', () => {
    expect(resolveAttribution(base, '', memStorage(), now)).toEqual({ source: 'directo' });
  });

  it('guarda la primera pista y la mantiene en visitas posteriores', () => {
    const st = memStorage();
    expect(resolveAttribution(`${base}?utm_source=facebook&utm_campaign=promo`, '', st, now)).toEqual({ source: 'facebook', campaign: 'promo' });
    expect(resolveAttribution(`${base}registro?utm_source=google`, '', st, now + 864e5)).toEqual({ source: 'facebook', campaign: 'promo' });
    expect(resolveAttribution(`${base}registro`, base, st, now + 2 * 864e5)).toEqual({ source: 'facebook', campaign: 'promo' });
  });

  it('una guardada vencida (>30 días) se reemplaza', () => {
    const st = memStorage();
    st.setItem('merco_attr', JSON.stringify({ source: 'facebook', at: now - 31 * 864e5 }));
    expect(resolveAttribution(`${base}?utm_source=whatsapp`, '', st, now)).toEqual({ source: 'whatsapp' });
  });

  it('storage roto o ausente no rompe', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(resolveAttribution(`${base}?fbclid=x`, '', broken, now)).toEqual({ source: 'facebook' });
    expect(resolveAttribution(base, '', null, now)).toEqual({ source: 'directo' });
    const corrupt = memStorage(); corrupt.setItem('merco_attr', '{no-json');
    expect(resolveAttribution(base, 'https://l.facebook.com/', corrupt, now)).toEqual({ source: 'l.facebook.com' });
  });
});
