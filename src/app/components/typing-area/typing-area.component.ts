import { Component, computed, DestroyRef, effect, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { Character, CaretStyle } from '../../models/models';

/** An opponent's cursor (pace bot or another racer) drawn in the text. */
export interface Ghost {
  id: string;
  /** Shown in the small tag above the cursor. */
  label: string;
  /** Characters typed so far: the cursor sits before this character. */
  index: number;
  /** CSS colour, e.g. 'var(--color-avatar-2)' */
  color: string;
}

const INPUT_NEWLINE = '\uE000';
const toInput = (text: string) => text.replace(/\n/g, INPUT_NEWLINE);
// NFC: accented letters arrive as one character, as the server's text has them.
const fromInput = (value: string) => value.split(INPUT_NEWLINE).join('\n').normalize('NFC');

interface GhostMark {
  left: number;
  top: number;
  height: number;
  /** Ghosts sharing this character share one cursor and a row of tags. */
  ghosts: { id: string; label: string; color: string }[];
}

@Component({
  selector: 'app-typing-area',
  templateUrl: './typing-area.component.html',
  styleUrl: './typing-area.component.css',
  host: { '(document:keydown)': 'onDocumentKeydown($event)' },
})
export class TypingAreaComponent {
  readonly characters = input<Character[]>([]);
  readonly currentText = input('');
  readonly caretStyle = input<CaretStyle>('line');
  readonly ghosts = input<Ghost[]>([]);
  /** The line caret glides between letters at this speed instead of jumping. */
  readonly smoothCaret = input<'off' | 'slow' | 'medium' | 'fast'>('off');
  /** One line that scrolls sideways, instead of lines scrolling up. */
  readonly tapeMode = input(false);

  readonly typing = output<string>();
  /** Shift+Enter: end the run now (zen). */
  readonly finish = output<void>();
  readonly focusChange = output<boolean>();

  isFocused = false;
  readonly cursorIdle = signal(false);
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_MS = 2500;

  private readonly textDisplay = viewChild<ElementRef<HTMLElement>>('textDisplay');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  // Maps each character index to the visual line it occupies (computed from
  // actual layout, so it is robust to font/width changes).
  private readonly lineOfIndex = signal<number[]>([]);

  // Safety net: some async loads resolve after the view is already rendered,
  // so retry the layout computation until the rendered spans match the input.
  private readonly refreshKey = signal(0);

  readonly ghostMarks = signal<GhostMark[]>([]);
  /** Where the smooth caret is drawn (null when it is off). */
  readonly caretMark = signal<{ left: number; top: number; height: number } | null>(null);
  readonly smoothOn = computed(() => this.smoothCaret() !== 'off' && this.caretStyle() === 'line');
  readonly caretMs = computed(() => ({ off: 0, slow: 150, medium: 100, fast: 60 })[this.smoothCaret()]);

  /** Start and end (exclusive) of the word the caret is in, for the word highlight. */
  readonly currentWord = computed(() => {
    const chars = this.characters();
    const at = Math.min((this.currentText() ?? '').length, chars.length);
    let start = at;
    while (start > 0 && chars[start - 1].char !== ' ' && chars[start - 1].char !== '\n') start--;
    let end = at;
    while (end < chars.length && chars[end].char !== ' ' && chars[end].char !== '\n') end++;
    return { start, end };
  });

  /**
   * The text in the hidden input. Inputs drop line breaks from their value,
   * so a line break of code text is held there as a private-use character.
   */
  readonly inputValue = computed(() => toInput(this.currentText() ?? ''));

  readonly currentLine = computed(() => {
    const lines = this.lineOfIndex();
    if (lines.length === 0) return -1;
    const safe = typeof this.currentText() === 'string' ? this.currentText() : '';
    const activeIndex = safe.length;
    if (activeIndex >= lines.length) return lines[lines.length - 1];
    return lines[activeIndex] ?? -1;
  });

  constructor() {
    effect(() => {
      this.refreshKey();
      this.currentText();
      this.tapeMode();
      this.smoothOn();
      const el = this.textDisplay()?.nativeElement;
      const target = this.characters().length;
      if (!el || el.querySelectorAll('span').length !== target) {
        requestAnimationFrame(() => this.refreshKey.update(v => v + 1));
        return;
      }
      this.layout(el);
      this.placeCaret(el);
    });

    effect(() => {
      const ghosts = this.ghosts();
      this.refreshKey();
      this.currentText();
      const el = this.textDisplay()?.nativeElement;
      if (!el || ghosts.length === 0) {
        if (this.ghostMarks().length) this.ghostMarks.set([]);
        return;
      }
      if (el.querySelectorAll('span').length !== this.characters().length) {
        requestAnimationFrame(() => this.refreshKey.update(v => v + 1));
        return;
      }
      this.placeGhosts(el, ghosts);
    });
  }

  /**
   * Positions each ghost at its character. Measured with bounding rects
   * relative to the paragraph, so the paragraph's scrolling transform (which
   * moves the spans and the ghosts together) cancels out.
   */
  private placeGhosts(el: HTMLElement, ghosts: Ghost[]): void {
    const spans = Array.from(el.querySelectorAll('span')) as HTMLElement[];
    if (spans.length === 0) {
      this.ghostMarks.set([]);
      return;
    }
    const origin = el.getBoundingClientRect();
    const byIndex = new Map<number, GhostMark>();
    for (const g of ghosts) {
      const index = Math.max(0, Math.min(Math.floor(g.index), spans.length));
      let mark = byIndex.get(index);
      if (!mark) {
        const atEnd = index === spans.length;
        const rect = spans[atEnd ? index - 1 : index].getBoundingClientRect();
        mark = {
          left: (atEnd ? rect.right : rect.left) - origin.left,
          top: rect.top - origin.top,
          height: rect.height,
          ghosts: [],
        };
        byIndex.set(index, mark);
      }
      mark.ghosts.push({ id: g.id, label: g.label, color: g.color });
    }
    this.ghostMarks.set([...byIndex.values()]);
  }

  /** Puts the smooth caret at the active letter (or after the last one). */
  private placeCaret(el: HTMLElement): void {
    if (!this.smoothOn()) {
      if (this.caretMark()) this.caretMark.set(null);
      return;
    }
    const spans = Array.from(el.querySelectorAll('span')) as HTMLElement[];
    if (!spans.length) return;
    const at = Math.min((this.currentText() ?? '').length, spans.length);
    const atEnd = at === spans.length;
    // Relative to the paragraph, so its scrolling transform (which moves letters and caret together) cancels out.
    const origin = el.getBoundingClientRect();
    const rect = spans[atEnd ? at - 1 : at].getBoundingClientRect();
    this.caretMark.set({ left: (atEnd ? rect.right : rect.left) - origin.left, top: rect.top - origin.top, height: rect.height });
  }

  private layout(el: HTMLElement): void {
    const spans = Array.from(el.querySelectorAll('span')) as HTMLElement[];
    if (spans.length === 0) {
      this.lineOfIndex.set([]);
      el.style.transform = 'translateY(0)';
      return;
    }

    if (this.tapeMode()) {
      // One line: keep the caret about a third of the way in, the text sliding left past it.
      this.lineOfIndex.set(spans.map(() => 0));
      const at = Math.min((this.currentText() ?? '').length, spans.length - 1);
      const box = el.parentElement?.clientWidth ?? 0;
      const left = spans[at].getBoundingClientRect().left - el.getBoundingClientRect().left;
      const offset = Math.max(0, left - box * 0.35);
      el.style.transform = `translateX(${-offset}px)`;
      return;
    }

    // Group character spans into visual lines using their layout top.
    const lines: number[] = [];
    const tops: number[] = [];
    let line = 0;
    let lastTop: number | null = null;
    for (const span of spans) {
      const top = span.offsetTop;
      tops.push(top);
      if (lastTop !== null && top !== lastTop) line++;
      lastTop = top;
      lines.push(line);
    }
    this.lineOfIndex.set(lines);

    // Keep the current line vertically centered so the text zone reads as
    // previous lines (top) / current line (middle) / next lines (bottom).
    const safe = typeof this.currentText() === 'string' ? this.currentText() : '';
    const activeIndex = Math.min(safe.length, spans.length - 1);
    const activeLine = activeIndex < 0 ? 0 : lines[activeIndex];

    let lineTop = 0;
    for (let i = 0; i < spans.length; i++) {
      if (lines[i] === activeLine) {
        lineTop = tops[i];
        break;
      }
    }

    // The gap between consecutive visual lines is the real line-box height.
    const distinctTops = [...new Set(tops)].sort((a, b) => a - b);
    const lineBoxHeight =
      distinctTops.length > 1 ? distinctTops[1] - distinctTops[0] : spans[0].offsetHeight;

    const box = el.parentElement;
    if (!box) return;
    const boxHeight = box.clientHeight;
    // Natural (untransformed) top of the paragraph inside the box.
    const naturalP = el.offsetTop;

    // Start at the top of the area; once a previous line exists (we are on
    // the second line or later), keep the current line vertically centered.
    if (activeLine === 0) {
      el.style.transform = 'translateY(0)';
      return;
    }

    const target = naturalP + lineTop - (boxHeight - lineBoxHeight) / 2;
    // Safety floor: never scroll the current line's bottom below the box.
    const minOffset = naturalP + lineTop + lineBoxHeight - boxHeight;
    const offset = Math.max(minOffset, target);
    el.style.transform = `translateY(${-offset}px)`;
  }

  focus(): void {
    const input = this.input()?.nativeElement;
    if (!input) return;
    input.focus({ preventScroll: true });
    // The on-screen keyboard covers the lower half of a phone: bring the text
    // to the top of what is left once it has opened.
    if (matchMedia('(pointer: coarse)').matches) {
      setTimeout(() => this.textDisplay()?.nativeElement.parentElement?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
    }
  }

  /**
   * "Click or start typing": a printable key pressed while nothing else has
   * focus focuses the hidden input, and the browser then delivers that key
   * to it, so the keystroke isn't lost. M is left alone: unfocused, it is
   * the mute shortcut (shortcuts-footer).
   */
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.isFocused || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'm') return;
    const active = document.activeElement as HTMLElement | null;
    const busy = active && active !== document.body && (active.matches('input, textarea, select, [contenteditable]') || !!active.closest('[role="dialog"]'));
    if (busy) return;
    this.focus();
  }

  blur(): void {
    this.input()?.nativeElement.blur();
  }

  charClass(char: Character, index: number): string {
    const safe = typeof this.currentText() === 'string' ? this.currentText() : '';
    const lines = this.lineOfIndex();
    const line = lines[index] ?? -1;
    const current = this.currentLine();
    const classes: string[] = [char.status];
    if (line >= 0 && current >= 0) {
      const distance = Math.abs(line - current);
      if (distance === 0) {
        classes.push('cur-line');
      } else {
        classes.push(line < current ? 'prev-line' : 'next-line');
        classes.push(`blur-${Math.min(distance, 3)}`);
      }
    }
    if (index === safe.length) classes.push('active');
    const word = this.currentWord();
    if (index >= word.start && index < word.end) classes.push('cur-word');
    return classes.join(' ');
  }

  onContainerClick(): void {
    this.focus();
  }

  /** Text always goes in at the end, wherever the caret was left. */
  onBeforeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
  }

  /** True while an IME or dead key is composing a character. */
  private composing = false;

  onCompositionStart(): void {
    this.composing = true;
  }

  /** The composed character (e.g. ´ + u = ú) arrives as one key. */
  onCompositionEnd(event: Event): void {
    this.composing = false;
    this.onInput(event);
  }

  onInput(event: Event): void {
    // Mid-composition values (a lone dead key) aren't keys yet.
    if (this.composing || (event as InputEvent).isComposing) return;
    this.resetIdleTimer();
    const el = event.target as HTMLInputElement;
    this.typing.emit(fromInput(el.value));
    // When the parent rejects an edit (anti-spam guard, race not started yet)
    // the bound value doesn't change, so Angular never rewrites the input and
    // the rejected characters would linger. Re-sync after change detection.
    setTimeout(() => {
      const accepted = toInput(typeof this.currentText() === 'string' ? this.currentText() : '');
      if (el.value !== accepted) el.value = accepted;
      // Typing always continues at the end of the text.
      if (el.selectionStart !== accepted.length) el.setSelectionRange(accepted.length, accepted.length);
    });
  }

  /** Enter types a line break (code text); Shift+Enter finishes the run. */
  onEnter(event: Event): void {
    event.preventDefault();
    if ((event as KeyboardEvent).shiftKey) {
      this.finish.emit();
      return;
    }
    // Only code text has line breaks to type.
    if (!this.characters().some((c) => c.char === '\n')) return;
    this.resetIdleTimer();
    this.typing.emit((this.currentText() ?? '') + '\n');
  }

  private resetIdleTimer(): void {
    this.cursorIdle.set(false);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.cursorIdle.set(true), this.IDLE_MS);
  }

  onFocus(): void {
    this.isFocused = true;
    this.cursorIdle.set(false);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.focusChange.emit(true);
  }

  onBlur(): void {
    this.isFocused = false;
    this.cursorIdle.set(false);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.focusChange.emit(false);
  }
}
