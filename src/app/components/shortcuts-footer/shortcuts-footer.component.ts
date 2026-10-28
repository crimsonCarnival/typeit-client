import { Component, DestroyRef, effect, inject, output, signal } from '@angular/core';
import { ls } from '../../utils/storage';

@Component({
  selector: 'app-shortcuts-footer',
  templateUrl: './shortcuts-footer.component.html',
  styleUrl: './shortcuts-footer.component.css',
})
export class ShortcutsFooterComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly reset = output<void>();
  readonly muteToggle = output<void>();
  readonly restartSame = output<void>();

  readonly isVisible = signal(ls.get('shortcutsVisible') !== 'false');

  constructor() {
    effect(() => {
      ls.set('shortcutsVisible', String(this.isVisible()));
    });

    const handleKeyPress = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInInputField = !!activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.classList.contains('input-field') ||
        activeEl.classList.contains('hidden-input')
      );

      if (e.key === 'Escape') {
        e.preventDefault();
        this.reset.emit();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        this.restartSame.emit();
        return;
      }

      if (!isInInputField) {
        if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          this.muteToggle.emit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    this.destroyRef.onDestroy(() => document.removeEventListener('keydown', handleKeyPress));
  }

  toggleVisible(): void {
    this.isVisible.update((value) => !value);
  }
}
