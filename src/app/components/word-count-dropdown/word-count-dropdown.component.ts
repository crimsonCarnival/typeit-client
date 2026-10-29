import { StepperComponent } from '../stepper/stepper.component';
import { Component, effect, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { GameMode } from '../../models/models';

const PRESET_COUNTS = [25, 50, 75, 100];

@Component({
  selector: 'app-word-count-dropdown',
  imports: [StepperComponent],
  templateUrl: './word-count-dropdown.component.html',
  styleUrl: './word-count-dropdown.component.css',
})
export class WordCountDropdownComponent {
  readonly wordCount = input(50);
  readonly gameMode = input<GameMode>('phrases');
  readonly isTyping = input(false);
  readonly wordCountChange = output<number>();

  readonly PRESET_COUNTS = PRESET_COUNTS;
  readonly customValue = signal('');
  readonly showCustomInput = signal(false);
  readonly isCustomCount = signal(false);

  private readonly customInput = viewChild<ElementRef<HTMLInputElement>>('customInput');

  constructor() {
    effect(() => {
      this.isCustomCount.set(!PRESET_COUNTS.includes(this.wordCount()));
    });
    effect(() => {
      if (this.showCustomInput()) {
        this.customInput()?.nativeElement.focus();
      }
    });
  }

  handleCountSelect(count: number): void {
    if (this.isTyping()) return;
    this.wordCountChange.emit(count);
    this.showCustomInput.set(false);
    this.customValue.set('');
  }

  handleCustomClick(event: Event): void {
    event.stopPropagation();
    if (!this.isTyping()) {
      this.showCustomInput.set(true);
    }
  }

  handleCustomSubmit(event: Event): void {
    event.preventDefault();
    const value = parseInt(this.customValue(), 10);
    if (!isNaN(value) && value >= 5 && value <= 500) {
      this.handleCountSelect(value);
    }
  }

  handleCustomKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.showCustomInput.set(false);
      this.customValue.set('');
    }
  }

  onCustomInput(event: Event): void {
    this.customValue.set((event.target as HTMLInputElement).value);
  }
}
