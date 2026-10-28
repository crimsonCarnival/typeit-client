// Matches the server's MAX_KEYSTROKES; keys beyond it are not recorded.
export const MAX_KEYSTROKES = 8000;
export const BACKSPACE = '\b';

export type Keystroke = [gapMs: number, char: string];

/**
 * Keys that turn input value `prev` into `next`: backspaces down to their
 * common prefix, then the new characters. Covers single keys, word deletion
 * (Ctrl+Backspace) and replacements alike. Indexed by UTF-16 unit, not code
 * point: the server expects 1-length chars.
 */
export const inputKeys = (prev: string, next: string): string[] => {
  let common = 0;
  while (common < prev.length && common < next.length && prev[common] === next[common]) common++;
  const keys: string[] = [];
  for (let i = prev.length; i > common; i--) keys.push(BACKSPACE);
  for (let i = common; i < next.length; i++) keys.push(next[i]);
  return keys;
};

/**
 * The run's keystroke log as [gapMs, char] pairs, streamed to the server,
 * which replays it to score the run. `base` is the number of keys the
 * server already held when this log started (a resumed run).
 */
export class KeystrokeLog {
  private entries: Keystroke[] = [];
  private lastKeyTime: number | null = null;
  private base = 0;

  /** Keys in the whole run, including those from before a resume. */
  get total(): number {
    return this.base + this.entries.length;
  }

  reset(base = 0): void {
    this.entries = [];
    this.lastKeyTime = null;
    this.base = base;
  }

  /** Records keys that arrived together (they share one timestamp). */
  push(chars: string[], now = Date.now()): void {
    let gap = this.lastKeyTime === null ? 0 : now - this.lastKeyTime;
    this.lastKeyTime = now;
    for (const char of chars) {
      if (this.total >= MAX_KEYSTROKES) return;
      this.entries.push([gap, char]);
      gap = 0;
    }
  }

  /** Keys from absolute index `from` on (empty if they predate this log). */
  from(from: number): Keystroke[] {
    return this.entries.slice(Math.max(0, from - this.base));
  }
}
