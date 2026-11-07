// Deriva del color de marca del tenant las variantes que garantizan contraste
// AA (4.5:1) sin que cada tenant tenga que elegir bien su color:
//  - ink:     para texto de color sobre fondo blanco (text-primary)
//  - fill:    relleno de botones/badges sólidos (bg-primary)
//  - onFill:  texto encima de fill (blanco o casi negro)
// Un rosa como #eb244b (4.3:1 con blanco) se oscurece un poco; un amarillo
// claro mantiene su relleno y pasa a texto oscuro encima.

type RGB = [number, number, number];

const DARK: RGB = [17, 24, 39]; // gray-900
const WHITE: RGB = [255, 255, 255];

export function hexToRgb(hex: string): RGB | null {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function luminance([r, g, b]: RGB): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Mezcla hacia negro en pasos de 4% hasta lograr el contraste pedido con blanco
function darkenUntil(c: RGB, target: number, maxSteps = 25): { color: RGB; steps: number } {
  let cur = c;
  for (let i = 0; i <= maxSteps; i++) {
    if (contrast(cur, WHITE) >= target) return { color: cur, steps: i };
    cur = cur.map(v => Math.round(v * 0.96)) as RGB;
  }
  return { color: cur, steps: maxSteps };
}

export interface ThemeColors { base: RGB; ink: RGB; fill: RGB; onFill: RGB }

export function deriveThemeColors(hex: string): ThemeColors | null {
  const base = hexToRgb(hex);
  if (!base) return null;
  const ink = darkenUntil(base, 4.5).color;
  // Si basta un ajuste leve (≤3 pasos ≈ 12% más oscuro), el botón conserva
  // texto blanco con un relleno casi idéntico a la marca; si el color es muy
  // claro, se respeta el relleno de marca y el texto encima pasa a oscuro.
  const tweak = darkenUntil(base, 4.5, 3);
  const fill = contrast(tweak.color, WHITE) >= 4.5 ? tweak.color : base;
  const onFill = contrast(fill, WHITE) >= 4.5 ? WHITE : DARK;
  return { base, ink, fill, onFill };
}

export const toChannels = (c: RGB) => `${c[0]} ${c[1]} ${c[2]}`;
