import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-sound-toggle',
  templateUrl: './sound-toggle.component.html',
  styleUrl: './sound-toggle.component.css',
})
export class SoundToggleComponent {
  readonly isMuted = input(false);
  readonly disabled = input(false);
  readonly toggle = output<void>();

  onClick(): void {
    if (!this.disabled()) {
      this.toggle.emit();
    }
  }
}
