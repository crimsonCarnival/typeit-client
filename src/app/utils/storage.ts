/**
 * Centralised localStorage wrapper for TypeIt.
 *
 * All keys are namespaced with the `typeit:` prefix so they never clash
 * with other apps or browser extensions sharing the same origin.
 *
 * Usage:
 *   ls.get('caretStyle')          // reads  "typeit:caretStyle"
 *   ls.set('caretStyle', 'block') // writes "typeit:caretStyle"
 *   ls.remove('caretStyle')       // deletes "typeit:caretStyle"
 */

const PREFIX = 'typeit:';

function key(k: string): string {
  return `${PREFIX}${k}`;
}

export const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(key(k));
    } catch {
      return null;
    }
  },

  set(k: string, value: string): void {
    try {
      localStorage.setItem(key(k), value);
    } catch {
      /* storage full or unavailable — silent fail */
    }
  },

  remove(k: string): void {
    try {
      localStorage.removeItem(key(k));
    } catch { /* noop */ }
  },

  has(k: string): boolean {
    try {
      return localStorage.getItem(key(k)) !== null;
    } catch {
      return false;
    }
  },

  /** Read a boolean-ish value stored as "true"/"false". */
  bool(k: string): boolean {
    return ls.get(k) === 'true';
  },

  /** Read an integer with an optional fallback. */
  int(k: string, fallback: number): number {
    const v = ls.get(k);
    if (v === null) return fallback;
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  },
} as const;
