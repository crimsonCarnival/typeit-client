import { Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { MenuItem, MenuService } from './menu.service';

const EDGE = 8;

/** Renders the open menu (once, at the app root) and handles its keyboard and dismissal. */
@Component({
  selector: 'app-menu-host',
  templateUrl: './menu-host.component.html',
  styleUrl: './menu-host.component.css',
})
export class MenuHostComponent {
  readonly menu = inject(MenuService);
  private readonly el = viewChild<ElementRef<HTMLElement>>('panel');

  /** Where the panel ended up after being fitted to the window. */
  readonly pos = signal({ x: 0, y: 0, ready: false });
  private typed = '';
  private typedAt = 0;

  constructor() {
    // Fit the menu inside the window once it has been drawn, then focus its first item.
    effect(() => {
      const panel = this.el()?.nativeElement;
      const state = this.menu.state();
      if (!panel || !state) {
        this.pos.set({ x: 0, y: 0, ready: false });
        return;
      }
      untracked(() => {
        const { width, height } = panel.getBoundingClientRect();
        const x = Math.max(EDGE, Math.min(state.x, window.innerWidth - width - EDGE));
        // Flip above the anchor when there is no room below it.
        const below = state.y + height + EDGE <= window.innerHeight;
        const flipTo = state.anchor ? state.anchor.getBoundingClientRect().top - height - 4 : state.y - height;
        const y = Math.max(EDGE, below ? state.y : Math.min(flipTo, window.innerHeight - height - EDGE));
        this.pos.set({ x, y, ready: true });
        queueMicrotask(() => this.focusItem(0));
      });
    });

    // Anything that moves the page away from the menu closes it.
    effect((onCleanup) => {
      if (!this.menu.state()) return;
      const close = () => this.menu.close(false);
      const outside = (event: Event) => {
        if (!this.el()?.nativeElement.contains(event.target as Node)) {
          // A click on the button that opened it should close it, not reopen it.
          const anchor = this.menu.state()?.anchor;
          this.menu.close(false);
          if (anchor?.contains(event.target as Node)) this.menu.noteDismissedBy(anchor);
        }
      };
      document.addEventListener('pointerdown', outside, true);
      window.addEventListener('resize', close);
      window.addEventListener('blur', close);
      // The page scrolling away closes the menu; the menu scrolling itself does not.
      const onScroll = (event: Event) => {
        if (!this.el()?.nativeElement.contains(event.target as Node)) close();
      };
      window.addEventListener('scroll', onScroll, true);
      onCleanup(() => {
        document.removeEventListener('pointerdown', outside, true);
        window.removeEventListener('resize', close);
        window.removeEventListener('blur', close);
        window.removeEventListener('scroll', onScroll, true);
      });
    });
  }

  private buttons(): HTMLElement[] {
    return Array.from(this.el()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
  }

  private focusItem(index: number): void {
    const items = this.buttons();
    if (!items.length) return;
    items[((index % items.length) + items.length) % items.length].focus();
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.buttons();
    const at = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        this.focusItem(at + 1);
        break;
      case 'ArrowUp':
        this.focusItem(at <= 0 ? -1 : at - 1);
        break;
      case 'Home':
        this.focusItem(0);
        break;
      case 'End':
        this.focusItem(-1);
        break;
      case 'Escape':
        this.menu.close();
        break;
      case 'Tab':
        this.menu.close(false);
        return;
      default:
        // Typing a letter jumps to the next item starting with it.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now();
          this.typed = now - this.typedAt > 700 ? event.key.toLowerCase() : this.typed + event.key.toLowerCase();
          this.typedAt = now;
          const from = this.typed.length === 1 ? at + 1 : at;
          const ordered = [...items.slice(from), ...items.slice(0, from)];
          ordered.find((b) => b.textContent?.trim().toLowerCase().startsWith(this.typed))?.focus();
          return;
        }
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  choose(item: MenuItem): void {
    if (item.disabled || item.separator || item.heading) return;
    this.menu.close();
    item.action?.();
  }
}
