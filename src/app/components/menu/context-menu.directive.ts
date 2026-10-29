import { Directive, ElementRef, inject, input } from '@angular/core';
import { MenuItem, MenuService } from './menu.service';

/**
 * A right-click (or the keyboard's menu key / Shift+F10) opens the app's own
 * menu instead of the browser's. Give it the items, or a function that
 * builds them when the menu opens, so they reflect the current state.
 *
 *   <li [appContextMenu]="menuFor(row)">
 *
 * Fields where the browser's own menu is needed (paste, spell check) and
 * links (open in a new tab) are left alone.
 */
@Directive({
  selector: '[appContextMenu]',
  host: {
    '(contextmenu)': 'onContextMenu($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ContextMenuDirective {
  readonly items = input<MenuItem[] | (() => MenuItem[])>([], { alias: 'appContextMenu' });
  private readonly menu = inject(MenuService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private resolve(): MenuItem[] {
    const items = this.items();
    return typeof items === 'function' ? items() : items;
  }

  /** Native menus stay for text fields and links. */
  private keepsNativeMenu(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], a[href]');
  }

  onContextMenu(event: MouseEvent): void {
    if (this.keepsNativeMenu(event.target)) return;
    const items = this.resolve();
    if (!items.some((i) => !i.separator && !i.heading)) return;
    event.preventDefault();
    this.menu.openAt(event.clientX, event.clientY, items);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.target !== this.host.nativeElement && this.keepsNativeMenu(event.target)) return;
    if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
    const items = this.resolve();
    if (!items.some((i) => !i.separator && !i.heading)) return;
    event.preventDefault();
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.menu.openAt(rect.left + 16, rect.top + Math.min(rect.height, 40), items);
  }
}
