import { Component, inject, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextGeneratorService } from '../../services/text-generator.service';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-vocab-modal',
  imports: [FormsModule],
  templateUrl: './vocab-modal.component.html',
  styleUrl: './vocab-modal.component.css',
})
export class VocabModalComponent implements OnInit {
  private readonly textGenerator = inject(TextGeneratorService);
  private readonly game = inject(GameService);

  readonly close = output<void>();

  nouns = '';
  adjectives = '';
  templates = '';

  ngOnInit(): void {
    this.nouns = this.textGenerator.vocabState.nouns;
    this.adjectives = this.textGenerator.vocabState.adjectives;
    this.templates = this.textGenerator.vocabState.templates;
  }

  applyVocabulary(): void {
    this.textGenerator.extendVocabulary(this.nouns, this.adjectives, this.templates);
    this.game.setGeneratorConfig({});
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  handleOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }
}
