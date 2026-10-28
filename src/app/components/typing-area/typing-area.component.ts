import { Component, computed, DestroyRef, effect, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { Character, CaretStyle } from '../../models/models';

@Component({
  selector: 'app-typing-area',
  templateUrl: './typing-area.component.html',
  styleUrl: './typing-area.component.css',
})
export class TypingAreaComponent {
  readonly characters = input<Character[]>([]);
  readonly currentText = input('');
  readonly caretStyle = input<CaretStyle>('line');

  readonly typing = output<string>();
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
      const el = this.textDisplay()?.nativeElement;
      const target = this.characters().length;
      if (!el || el.querySelectorAll('span').length !== target) {
        requestAnimationFrame(() => this.refreshKey.update(v => v + 1));
        return;
      }
      this.layout(el);
    });
  }

  private layout(el: HTMLElement): void {
    const spans = Array.from(el.querySelectorAll('span')) as HTMLElement[];
    if (spans.length === 0) {
      this.lineOfIndex.set([]);
      el.style.transform = 'translateY(0)';
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
    this.input()?.nativeElement.focus();
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
    return classes.join(' ');
  }

  onContainerClick(): void {
    this.focus();
  }

  onInput(event: Event): void {
    this.resetIdleTimer();
    this.typing.emit((event.target as HTMLInputElement).value);
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
