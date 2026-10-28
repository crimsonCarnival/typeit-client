import { Component, input, output } from '@angular/core';
import { GameMode } from '../../models/models';

@Component({
  selector: 'app-mode-dropdown',
  templateUrl: './mode-dropdown.component.html',
  styleUrl: './mode-dropdown.component.css',
})
export class ModeDropdownComponent {
  readonly gameMode = input<GameMode>('phrases');
  readonly isTyping = input(false);
  readonly modeChange = output<GameMode>();

  handleModeSelect(mode: GameMode): void {
    if (!this.isTyping()) {
      this.modeChange.emit(mode);
    }
  }
}
