import { Component, input, output, viewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { MDCTooltip } from '@material/tooltip';
import { createTooltip, destroyTooltip } from '../../utils/tooltip.utils';

@Component({
  selector: 'app-sound-toggle',
  templateUrl: './sound-toggle.component.html',
  styleUrl: './sound-toggle.component.css',
})
export class SoundToggleComponent implements AfterViewInit, OnDestroy {
  readonly isMuted = input(false);
  readonly disabled = input(false);
  readonly toggle = output<void>();

  readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');
  private tooltip?: MDCTooltip;

  ngAfterViewInit() {
    this.tooltip = createTooltip(this.tooltipEl()?.nativeElement);
  }

  ngOnDestroy() {
    destroyTooltip(this.tooltip, this.tooltipEl()?.nativeElement);
  }

  onClick(): void {
    if (!this.disabled()) {
      this.toggle.emit();
    }
  }
}
