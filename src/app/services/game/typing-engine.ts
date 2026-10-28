import { Character, TypingRules } from '../../models/models';
import { BACKSPACE } from './keystroke-log';

/** Marks a character skipped with "space skips word" (same as the server). */
export const SKIP_CHAR = '\u0000';

export const DEFAULT_RULES: TypingRules = {
  difficulty: 'normal',
  stopOnError: 'off',
  spaceSkips: false,
  spamRun: 5,
  backspaceEvery: 10,
  backspaceSeconds: 0,
  backspacePoints: 1,
};

export type KeyOutcome = 'correct' | 'wrong' | 'rejected' | 'blocked' | 'skip' | 'backspace' | 'ignored';

/**
 * Applies the run's input rules as keys arrive, so the text reacts
 * instantly: which keys are accepted, blocked (mashing one wrong key),
 * refused (stop on error) or skip a word. It mirrors the server's replay
 * (run-engine.js) and keeps no statistics: every number comes from the
 * server, which replays the same keys to score the run.
 */
export class TypingEngine {
  private buf: string[] = [];
  private lastWrongChar: string | null = null;
  private wrongRun = 0;

  constructor(
    readonly text: string,
    readonly rules: TypingRules = DEFAULT_RULES,
    typedPrefix = '',
  ) {
    this.buf = [...typedPrefix].slice(0, text.length);
  }

  /** The aligned typed text (skipped characters included as SKIP_CHAR). */
  get value(): string {
    return this.buf.join('');
  }

  get position(): number {
    return this.buf.length;
  }

  get done(): boolean {
    return this.buf.length >= this.text.length;
  }

  apply(char: string): KeyOutcome {
    if (char === BACKSPACE) {
      this.lastWrongChar = null;
      this.wrongRun = 0;
      if (this.buf.length) {
        this.buf.pop();
        while (this.buf.length && this.buf[this.buf.length - 1] === SKIP_CHAR) this.buf.pop();
      }
      return 'backspace';
    }

    const pos = this.buf.length;
    if (pos >= this.text.length) return 'ignored';
    const expected = this.text[pos];

    if (char !== expected) {
      if (char === this.lastWrongChar) this.wrongRun++;
      else {
        this.lastWrongChar = char;
        this.wrongRun = 1;
      }
      if (this.wrongRun >= this.rules.spamRun) return 'blocked';
    } else {
      this.lastWrongChar = null;
      this.wrongRun = 0;
    }

    if (this.rules.spaceSkips && char === ' ' && expected !== ' ' && pos > 0 && this.buf[pos - 1] !== ' ') {
      const next = this.text.indexOf(' ', pos);
      const end = next === -1 ? this.text.length : next;
      for (let i = pos; i < end; i++) this.buf.push(SKIP_CHAR);
      if (end < this.text.length) this.buf.push(' ');
      return 'skip';
    }

    const wrong = char !== expected;
    const leavesBadWord = this.rules.stopOnError === 'word' && expected === ' ' && this.wordHasErrors(pos);
    if ((wrong && this.rules.stopOnError === 'letter') || leavesBadWord) return 'rejected';

    this.buf.push(char);
    return wrong ? 'wrong' : 'correct';
  }

  private wordHasErrors(pos: number): boolean {
    let start = pos;
    while (start > 0 && this.text[start - 1] !== ' ') start--;
    for (let i = start; i < pos; i++) if (this.buf[i] !== this.text[i]) return true;
    return false;
  }

  /** Display state of every character. */
  characters(): Character[] {
    return [...this.text].map((char, i) => {
      const typed = this.buf[i];
      const status = typed === undefined ? '' : typed === SKIP_CHAR ? 'skipped' : typed === char ? 'correct' : 'incorrect';
      return { char, status };
    });
  }
}
