import { describe, it, expect } from 'vitest';
import { pesosEnLetras } from '../numberToWords';

describe('pesosEnLetras', () => {
  it.each([
    [0, 'CERO PESOS M/CTE'],
    [1, 'UN PESO M/CTE'],
    [21, 'VEINTIÚN PESOS M/CTE'],
    [100, 'CIEN PESOS M/CTE'],
    [101, 'CIENTO UN PESOS M/CTE'],
    [1000, 'MIL PESOS M/CTE'],
    [21000, 'VEINTIÚN MIL PESOS M/CTE'],
    [32000, 'TREINTA Y DOS MIL PESOS M/CTE'],
    [91500, 'NOVENTA Y UN MIL QUINIENTOS PESOS M/CTE'],
    [1000000, 'UN MILLÓN DE PESOS M/CTE'],
    [2500000, 'DOS MILLONES QUINIENTOS MIL PESOS M/CTE'],
    [121000000, 'CIENTO VEINTIÚN MILLONES DE PESOS M/CTE'],
    [1234567, 'UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS M/CTE'],
  ])('%d → %s', (n, esperado) => {
    expect(pesosEnLetras(n)).toBe(esperado);
  });

  it('centavos como fracción', () => {
    expect(pesosEnLetras(1500.5)).toBe('MIL QUINIENTOS PESOS CON 50/100 M/CTE');
  });
});
