/**
 * Design-token colours for Chart.js, which needs real colour strings rather
 * than CSS variables. Reading them from styles.css keeps the palette in one
 * place for both charts (results timeline, performance history).
 */
export const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();

/** A hex token colour at the given opacity, for canvas gradients. */
export const tokenAlpha = (name: string, a: number): string => {
  const hex = token(name).replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
