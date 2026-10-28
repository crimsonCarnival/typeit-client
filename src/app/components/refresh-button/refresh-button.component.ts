import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-refresh-button',
  templateUrl: './refresh-button.component.html',
  styleUrl: './refresh-button.component.css',
})
export class RefreshButtonComponent {
  readonly refresh = output<void>();
  readonly disabled = input(false);

  isSpinning = false;

  handleClick(): void {
    if (this.disabled() || this.isSpinning) return;
    this.isSpinning = true;
    this.refresh.emit();
  }

  handleAnimationEnd(): void {
    this.isSpinning = false;
  }
}
