import { Component, input, output } from '@angular/core';
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
