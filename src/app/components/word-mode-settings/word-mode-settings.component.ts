import { Component, input, output, viewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { MDCTooltip } from '@material/tooltip';
import { createTooltip, destroyTooltip } from '../../utils/tooltip.utils';
import { GameMode } from '../../models/models';

@Component({
  selector: 'app-word-mode-settings',
  templateUrl: './word-mode-settings.component.html',
  styleUrl: './word-mode-settings.component.css',
})
export class WordModeSettingsComponent {
  readonly punctuationEnabled = input(false);
  readonly numbersEnabled = input(false);
  readonly disabled = input(false);
  readonly gameMode = input<GameMode>('phrases');
  readonly punctuationToggle = output<void>();
  readonly numbersToggle = output<void>();

  readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');
  private tooltip?: MDCTooltip;

  isOpen = true;

  ngAfterViewInit() {
    this.tooltip = createTooltip(this.tooltipEl()?.nativeElement);
  }

  ngOnDestroy() {
    destroyTooltip(this.tooltip, this.tooltipEl()?.nativeElement);
  }

  toggleIcon(event: Event): void {
    event.stopPropagation();
    if (!this.disabled()) {
      this.isOpen = !this.isOpen;
    }
  }

  onPunctuation(): void {
    if (!this.disabled()) {
      this.punctuationToggle.emit();
    }
  }

  onNumbers(): void {
    if (!this.disabled()) {
      this.numbersToggle.emit();
    }
  }
}
