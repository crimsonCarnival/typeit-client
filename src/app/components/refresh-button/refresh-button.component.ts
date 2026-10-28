import { Component, input, output, viewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { MDCTooltip } from '@material/tooltip';
import { createTooltip, destroyTooltip } from '../../utils/tooltip.utils';

@Component({
  selector: 'app-refresh-button',
  templateUrl: './refresh-button.component.html',
  styleUrl: './refresh-button.component.css',
})
export class RefreshButtonComponent implements AfterViewInit, OnDestroy {
  readonly refresh = output<void>();
  readonly disabled = input(false);

  readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');
  private tooltip?: MDCTooltip;

  isSpinning = false;

  ngAfterViewInit() {
    this.tooltip = createTooltip(this.tooltipEl()?.nativeElement);
  }

  ngOnDestroy() {
    destroyTooltip(this.tooltip, this.tooltipEl()?.nativeElement);
  }

  handleClick(): void {
    if (this.disabled() || this.isSpinning) return;
    this.isSpinning = true;
    this.refresh.emit();
  }

  handleAnimationEnd(): void {
    this.isSpinning = false;
  }
}
