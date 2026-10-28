// Matches the server's MAX_KEYSTROKES; a longer log is cut off (and the run left unranked).
export const MAX_KEYSTROKES = 8000;
export const BACKSPACE = '\b';

export type Keystroke = [gapMs: number, char: string];

/**
 * Keystroke log sent to the server as [gapMs, char] pairs (BACKSPACE for a
 * deletion). The server replays it against the text to score the run, derive
 * per-key errors and check the run's integrity.
 */
export class KeystrokeLog {
  private entries: Keystroke[] = [];
  private lastKeyTime: number | null = null;

  get keys(): readonly Keystroke[] {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }

  reset(): void {
    this.entries = [];
    this.lastKeyTime = null;
  }

  /**
   * Appends the edit from `prev` to `next`. A prefix diff covers single keys,
   * word deletion (Ctrl+Backspace) and replacements alike.
   */
  record(prev: string, next: string, now = Date.now()): Keystroke[] {
    let common = 0;
    while (common < prev.length && common < next.length && prev[common] === next[common]) common++;

    let gap = this.lastKeyTime === null ? 0 : now - this.lastKeyTime;
    this.lastKeyTime = now;

    const added: Keystroke[] = [];
    const push = (char: string) => {
      if (this.entries.length >= MAX_KEYSTROKES) return;
      const key: Keystroke = [gap, char];
      this.entries.push(key);
      added.push(key);
      gap = 0; // keys landing in the same input event share one timestamp
    };
    for (let i = prev.length; i > common; i--) push(BACKSPACE);
    // Index by UTF-16 unit, not code point: the server expects 1-length chars.
    for (let i = common; i < next.length; i++) push(next[i]);
    return added;
  }
}
