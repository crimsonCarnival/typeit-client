import { Component, input, output, viewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { MDCTooltip } from '@material/tooltip';
import { createTooltip, destroyTooltip } from '../../utils/tooltip.utils';
import { GameMode } from '../../models/models';

@Component({
  selector: 'app-mode-dropdown',
  templateUrl: './mode-dropdown.component.html',
  styleUrl: './mode-dropdown.component.css',
})
export class ModeDropdownComponent implements AfterViewInit, OnDestroy {
  readonly gameMode = input<GameMode>('phrases');
  readonly isTyping = input(false);
  readonly modeChange = output<GameMode>();

  readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');
  private tooltip?: MDCTooltip;

  isOpen = true;

  ngAfterViewInit() {
    this.tooltip = createTooltip(this.tooltipEl()?.nativeElement);
  }

  ngOnDestroy() {
    destroyTooltip(this.tooltip, this.tooltipEl()?.nativeElement);
  }

  handleModeSelect(mode: GameMode): void {
    if (!this.isTyping()) {
      this.modeChange.emit(mode);
    }
  }

  toggleOpen(event: Event): void {
    event.stopPropagation();
    if (!this.isTyping()) {
      this.isOpen = !this.isOpen;
    }
  }
}
