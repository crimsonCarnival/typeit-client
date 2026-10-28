import { Component, effect, ElementRef, input, output, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { MDCTooltip } from '@material/tooltip';
import { createTooltip, destroyTooltip } from '../../utils/tooltip.utils';

const PRESET_TIMES = [30, 60, 90, 120];

@Component({
  selector: 'app-custom-time-dropdown',
  templateUrl: './custom-time-dropdown.component.html',
  styleUrl: './custom-time-dropdown.component.css',
})
export class CustomTimeDropdownComponent {
  readonly timeMax = input(120);
  readonly timeLeft = input(120);
  readonly isTyping = input(false);
  readonly disabled = input(false);
  readonly timeSelect = output<number>();

  readonly PRESET_TIMES = PRESET_TIMES;
  readonly isOpen = signal(true);
  readonly customValue = signal('');
  readonly showCustomInput = signal(false);
  readonly isCustomTime = signal(false);

  private readonly customInput = viewChild<ElementRef<HTMLInputElement>>('customInput');
  readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');
  private tooltip?: MDCTooltip;

  readonly settingsTooltipEl = viewChild<ElementRef<HTMLElement>>('settingsTooltipEl');
  private settingsTooltip?: MDCTooltip;

  constructor() {
    effect(() => {
      this.isCustomTime.set(!PRESET_TIMES.includes(this.timeMax()));
    });
    effect(() => {
      if (this.showCustomInput()) {
        this.customInput()?.nativeElement.focus();
      }
    });
  }

  ngAfterViewInit() {
    this.tooltip = createTooltip(this.tooltipEl()?.nativeElement);
    this.settingsTooltip = createTooltip(this.settingsTooltipEl()?.nativeElement);
  }

  ngOnDestroy() {
    destroyTooltip(this.tooltip, this.tooltipEl()?.nativeElement);
    destroyTooltip(this.settingsTooltip, this.settingsTooltipEl()?.nativeElement);
  }

  handleTimeSelect(time: number): void {
    if (this.isTyping() || this.disabled()) return;
    this.timeSelect.emit(time);
    this.showCustomInput.set(false);
    this.customValue.set('');
  }

  handleCustomClick(event: Event): void {
    event.stopPropagation();
    if (!this.isTyping() && !this.disabled()) {
      this.showCustomInput.set(true);
    }
  }

  handleCustomSubmit(event: Event): void {
    event.preventDefault();
    const value = parseInt(this.customValue(), 10);
    if (!isNaN(value) && value >= 10 && value <= 600) {
      this.handleTimeSelect(value);
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

  toggleIcon(event: Event): void {
    event.stopPropagation();
    if (!this.disabled()) {
      this.isOpen.update((value) => !value);
    }
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
