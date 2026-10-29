import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, inject } from '@angular/core';

const SHOW_DELAY_MS = 350;
const GAP = 8;
const EDGE = 8;

/**
 * Replaces the browser's slow, unstyled hover text with the app's own
 * tooltip, for every element that has a `title` (or `data-tip`) attribute.
 * No template needs to change: while a tooltip is showing, the element's
 * title is set aside (so the native one doesn't also appear) and put back
 * when it hides, so screen readers and tools still see a normal title.
 *
 * Shows after a short hover, immediately on keyboard focus, never on touch,
 * and hides on Escape, press, scroll or leaving.
 */
@Injectable({ providedIn: 'root' })
export class TooltipService {
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  private tip: HTMLElement | null = null;
  private target: HTMLElement | null = null;
  private savedTitle: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  /** Starts listening. Safe to call more than once. */
  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    // Listening outside Angular: hovering must not trigger change detection.
    this.zone.runOutsideAngular(() => {
      const on = (type: string, handler: (e: any) => void, capture = false) => this.doc.addEventListener(type, handler, { capture, passive: true });
      on('pointerover', (e: PointerEvent) => e.pointerType !== 'touch' && this.consider(e.target, SHOW_DELAY_MS));
      on('pointerout', (e: PointerEvent) => this.leave(e.target, e.relatedTarget));
      on('focusin', (e: FocusEvent) => {
        // Only for keyboard focus: a click focusing a button should not pop a tip.
        if ((e.target as HTMLElement)?.matches?.(':focus-visible')) this.consider(e.target, 0);
      });
      on('focusout', () => this.hide());
      on('pointerdown', () => this.hide(), true);
      on('keydown', (e: KeyboardEvent) => e.key === 'Escape' && this.hide(), true);
      on('scroll', () => this.hide(), true);
      window.addEventListener('blur', () => this.hide());
    });
  }

  private tipTextOf(el: HTMLElement): string {
    return (el.getAttribute('title') ?? el.dataset['tip'] ?? '').trim();
  }

  private consider(node: EventTarget | null, delay: number): void {
    const el = node instanceof Element ? (node.closest('[title], [data-tip]') as HTMLElement | null) : null;
    if (!el || el === this.target || !this.tipTextOf(el)) return;
    this.hide();
    this.target = el;
    // Take the native title now, so it never gets its own turn.
    if (el.hasAttribute('title')) {
      this.savedTitle = el.getAttribute('title');
      el.removeAttribute('title');
    }
    const text = (this.savedTitle ?? el.dataset['tip'] ?? '').trim();
    this.timer = setTimeout(() => this.show(el, text), delay);
  }

  private leave(from: EventTarget | null, to: EventTarget | null): void {
    if (!this.target) return;
    // Moving within the same element (onto a child) is not leaving it.
    if (to instanceof Node && this.target.contains(to)) return;
    if (from instanceof Node && !this.target.contains(from)) return;
    this.hide();
  }

  private show(el: HTMLElement, text: string): void {
    if (this.target !== el || !el.isConnected) return;
    const tip = this.doc.createElement('div');
    tip.className = 'app-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.id = 'app-tooltip';
    tip.textContent = text;
    this.doc.body.appendChild(tip);
    el.setAttribute('aria-describedby', tip.id);
    this.tip = tip;

    const anchor = el.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const left = Math.max(EDGE, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - EDGE));
    // Above by default, below when there is no room above.
    const above = anchor.top - height - GAP >= EDGE;
    tip.style.left = `${left}px`;
    tip.style.top = `${above ? anchor.top - height - GAP : anchor.bottom + GAP}px`;
    tip.dataset['side'] = above ? 'top' : 'bottom';
    requestAnimationFrame(() => tip.classList.add('visible'));
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.tip?.remove();
    this.tip = null;
    const el = this.target;
    if (el) {
      el.removeAttribute('aria-describedby');
      // Put the title back, unless the app has set a new one in the meantime.
      if (this.savedTitle !== null && !el.hasAttribute('title')) el.setAttribute('title', this.savedTitle);
    }
    this.target = null;
    this.savedTitle = null;
  }
}
