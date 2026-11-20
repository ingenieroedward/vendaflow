// Monto en letras (español de Colombia) para la línea "SON: … PESOS M/CTE"
// de la plantilla carta moderna. Soporta hasta 999.999.999.999; los centavos
// se expresan como "con NN/100".

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function hasta999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) {
    if (r < 30) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10), u = r % 10;
      partes.push(u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d]);
    }
  }
  return partes.join(' ');
}

// "uno" → "un" delante de mil/millón/pesos ("veintiún mil", "un millón")
const apocopar = (s: string) => s.replace(/veintiuno$/, 'veintiún').replace(/(^|\s)uno$/, '$1un');

function enteroEnLetras(n: number): string {
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) {
    partes.push(millones === 1 ? 'un millón' : `${apocopar(enteroEnLetras(millones))} millones`);
  }
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(hasta999(miles))} mil`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(' ');
}

export function pesosEnLetras(monto: number): string {
  const valor = Math.round(Math.abs(monto) * 100) / 100;
  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);
  let letras = apocopar(enteroEnLetras(entero));
  // "un millón de pesos", "dos millones de pesos" (millón exacto lleva "de")
  const de = entero > 0 && entero % 1_000_000 === 0 ? ' de' : '';
  letras = `${letras}${de} ${entero === 1 ? 'peso' : 'pesos'}`;
  if (centavos) letras += ` con ${String(centavos).padStart(2, '0')}/100`;
  return `${letras.toUpperCase()} M/CTE`;
}
