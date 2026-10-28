import { Component, input, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameMode, GameState } from '../../models/models';
import { GameService } from '../../services/game.service';
import { VocabModalComponent } from '../vocab-modal/vocab-modal.component';

@Component({
  selector: 'app-text-source-dropdown',
  imports: [FormsModule, VocabModalComponent],
  templateUrl: './text-source-dropdown.component.html',
  styleUrl: './text-source-dropdown.component.css',
})
export class TextSourceDropdownComponent implements OnDestroy {
  private readonly game = inject(GameService);

  readonly gameMode       = input<GameMode>('phrases');
  readonly textSource     = input<GameState['textSource']>('default');
  readonly generatorUnit  = input<GameState['generatorUnit']>('sentence');
  readonly generatorCount = input<number>(3);
  readonly loremMin       = input<number>(20);
  readonly loremMax       = input<number>(60);
  readonly disabled       = input<boolean>(false);

  // Vocabulary modal state
  vocabModalOpen = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  setSource(source: GameState['textSource']): void {
    if (this.disabled()) return;
    this.game.setGeneratorConfig({ textSource: source });
  }

  setUnit(unit: GameState['generatorUnit']): void {
    if (this.disabled()) return;
    this.game.setGeneratorConfig({ generatorUnit: unit });
  }

  adjustCount(delta: number): void {
    if (this.disabled()) return;
    const next = Math.min(10, Math.max(1, this.generatorCount() + delta));
    this.debounced(() => this.game.setGeneratorConfig({ generatorCount: next }));
  }

  adjustLoremMin(delta: number): void {
    if (this.disabled()) return;
    const max  = this.loremMax();
    const next = Math.min(max, Math.max(5, this.loremMin() + delta));
    this.debounced(() => this.game.setGeneratorConfig({ loremMin: next }));
  }

  adjustLoremMax(delta: number): void {
    if (this.disabled()) return;
    const min  = this.loremMin();
    const next = Math.max(min, Math.max(5, this.loremMax() + delta));
    this.debounced(() => this.game.setGeneratorConfig({ loremMax: next }));
  }

  private debounced(fn: () => void): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(fn, 300);
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}

