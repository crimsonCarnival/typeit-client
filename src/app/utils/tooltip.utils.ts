import { MDCTooltip, YPosition } from '@material/tooltip';

/**
 * Creates an MDCTooltip anchored to the element.
 * Moves the element to document.body (required by MDC for z-index/overflow correctness).
 * Returns the tooltip instance, or undefined if the element is null.
 */
export function createTooltip(el: HTMLElement | null | undefined): MDCTooltip | undefined {
  if (!el) return undefined;
  document.body.appendChild(el);
  const tooltip = new MDCTooltip(el);
  tooltip.setTooltipPosition({ yPos: YPosition.ABOVE });
  return tooltip;
}

/**
 * Destroys a tooltip and removes its element from the DOM.
 */
export function destroyTooltip(tooltip: MDCTooltip | undefined, el: HTMLElement | null | undefined): void {
  tooltip?.destroy();
  el?.remove();
}
