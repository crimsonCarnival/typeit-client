import { Component, ElementRef, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { SettingsService } from '../../services/settings.service';
import { THEMES, Theme, applyTheme } from '../../utils/themes';

/**
 * Searchable list of every theme. Hovering or arrowing onto one previews it
 * on the whole page; choosing it saves it; leaving without choosing puts the
 * current theme back.
 */
@Component({
  selector: 'app-theme-picker',
  templateUrl: './theme-picker.component.html',
  styleUrl: './theme-picker.component.css',
})
export class ThemePickerComponent {
  private readonly settings = inject(SettingsService);
  readonly closed = output<void>();

  readonly query = signal('');
  readonly active = signal(0);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  readonly current = computed(() => this.settings.settings().theme);

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? THEMES.filter((t) => t.name.includes(q) || t.id.includes(q)) : THEMES;
  });

  constructor() {
    effect(() => {
      const el = this.input()?.nativeElement;
      if (el) queueMicrotask(() => el.focus());
    });
    // Start on the theme in use.
    const at = THEMES.findIndex((t) => t.id === this.settings.settings().theme);
    this.active.set(Math.max(0, at));
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
    this.preview(this.results()[0]);
  }

  preview(theme: Theme | undefined): void {
    if (theme) applyTheme(document.documentElement, theme.id);
  }

  /** Back to the saved theme (nothing chosen). */
  restore(): void {
    applyTheme(document.documentElement, this.current());
  }

  hover(index: number): void {
    this.active.set(index);
    this.preview(this.results()[index]);
  }

  choose(theme: Theme): void {
    this.settings.update({ theme: theme.id });
    this.closed.emit();
  }

  cancel(): void {
    this.restore();
    this.closed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    const n = this.results().length;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const t = this.results()[this.active()];
      if (t) this.choose(t);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!n) return;
    const next = (this.active() + (event.key === 'ArrowDown' ? 1 : -1) + n) % n;
    this.active.set(next);
    this.preview(this.results()[next]);
    queueMicrotask(() => this.list()?.nativeElement.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' }));
  }
}
