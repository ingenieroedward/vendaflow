import { describe, it, expect } from 'vitest';
import { deriveThemeColors, contrast, hexToRgb } from '../themeColors';

const WHITE: [number, number, number] = [255, 255, 255];

describe('deriveThemeColors', () => {
  it('deja intacto un color que ya tiene contraste (azul Merco)', () => {
    const c = deriveThemeColors('#0057ff')!;
    expect(c.fill).toEqual(hexToRgb('#0057ff'));
    expect(c.onFill).toEqual(WHITE);
  });

  it('oscurece levemente un rosa de 4.3:1 para que el texto blanco pase AA', () => {
    const c = deriveThemeColors('#eb244b')!;
    expect(contrast(c.fill, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(c.onFill).toEqual(WHITE);
    expect(contrast(c.ink, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('con un color muy claro conserva el relleno y usa texto oscuro encima', () => {
    const c = deriveThemeColors('#facc15')!;
    expect(c.fill).toEqual(hexToRgb('#facc15'));
    expect(c.onFill).not.toEqual(WHITE);
    expect(contrast(c.fill, c.onFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.ink, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('rechaza colores inválidos', () => {
    expect(deriveThemeColors('rosa')).toBeNull();
  });
});
