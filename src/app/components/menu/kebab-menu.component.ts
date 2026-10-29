import { Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { MenuItem, MenuService } from './menu.service';

/** The ⋯ button: the keyboard- and touch-friendly way to the same menu a right-click opens. */
@Component({
  selector: 'app-kebab',
  template: `
    <button
      #button
      type="button"
      class="kebab"
      aria-haspopup="menu"
      [attr.aria-expanded]="menu.state()?.anchor === button"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .kebab {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--color-text-subtle);
      cursor: pointer;
    }

    .kebab:hover:not(:disabled),
    .kebab[aria-expanded='true'] {
      background: var(--color-surface-raised);
      color: var(--color-text);
    }

    .kebab:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    .kebab:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,
})
export class KebabMenuComponent {
  readonly menu = inject(MenuService);
  readonly items = input<MenuItem[] | (() => MenuItem[])>([]);
  /** What the button is for, read out by screen readers: "Actions for ana". */
  readonly label = input('More actions');
  readonly disabled = input(false);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  toggle(): void {
    const anchor = this.button().nativeElement;
    // The press that closed the menu already did the toggling.
    if (this.menu.wasJustDismissedBy(anchor)) return;
    const items = this.items();
    this.menu.openFor(anchor, typeof items === 'function' ? items() : items);
  }
}
