import { Injectable, signal } from '@angular/core';

/** One line of a menu. `separator` and `heading` are structure, not actions. */
export type MenuItem = {
  label?: string;
  action?: () => void;
  disabled?: boolean;
  /** Destructive: drawn in the warning colour. */
  danger?: boolean;
  /** Small secondary text on the right, e.g. a shortcut or a reason it is disabled. */
  hint?: string;
  separator?: boolean;
  heading?: boolean;
};

export type MenuState = {
  items: MenuItem[];
  x: number;
  y: number;
  /** What had focus when the menu opened, so closing can give it back. */
  origin: HTMLElement | null;
  /** The element the menu hangs from (a ⋯ button), if any. */
  anchor: HTMLElement | null;
};

/**
 * The single popup menu of the app: right-click menus (at the pointer) and
 * ⋯ menus (under a button). Only one is open at a time; the host component
 * (menu-host) renders it.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  readonly state = signal<MenuState | null>(null);

  /** Opens at a point, e.g. where the player right-clicked. */
  openAt(x: number, y: number, items: MenuItem[]): void {
    this.open({ items, x, y, anchor: null });
  }

  /** Opens just under an element, left edge aligned. */
  openFor(anchor: HTMLElement, items: MenuItem[]): void {
    const rect = anchor.getBoundingClientRect();
    this.open({ items, x: rect.left, y: rect.bottom + 4, anchor });
  }

  private open(state: Omit<MenuState, 'origin'>): void {
    if (!state.items.some((i) => !i.separator && !i.heading)) return;
    const active = document.activeElement;
    this.state.set({ ...state, origin: active instanceof HTMLElement ? active : null });
  }

  private dismissed: { anchor: HTMLElement; at: number } | null = null;

  /** A press on an open menu's own button closed it; its click must not open it again. */
  noteDismissedBy(anchor: HTMLElement): void {
    this.dismissed = { anchor, at: Date.now() };
  }

  wasJustDismissedBy(anchor: HTMLElement): boolean {
    const hit = this.dismissed?.anchor === anchor && Date.now() - this.dismissed.at < 400;
    this.dismissed = null;
    return hit;
  }

  /** Closes the menu. By default focus goes back to where it was. */
  close(restoreFocus = true): void {
    const current = this.state();
    if (!current) return;
    this.state.set(null);
    if (restoreFocus) current.origin?.focus?.();
  }
}
