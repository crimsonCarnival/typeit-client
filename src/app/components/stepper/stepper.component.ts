import { Component, ElementRef, inject } from '@angular/core';

/**
 * Up and down arrows for a number input, drawn in the app's style instead of
 * the browser's. Wrap the input:
 *
 *   <app-stepper><input type="number" min="1" max="500" /></app-stepper>
 *
 * The input keeps all its own behaviour (typing, min, max, step, arrow keys
 * and every existing handler): the buttons just step it and fire the same
 * `input` and `change` events a spin would. They are skipped by Tab, since
 * the keyboard already has the arrow keys on the field itself.
 */
@Component({
  selector: 'app-stepper',
  template: `
    <ng-content />
    <span class="steps">
      <button type="button" tabindex="-1" aria-label="Increase" (pointerdown)="$event.preventDefault()" (click)="step(1)">
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 6.5 3-3 3 3"></path></svg>
      </button>
      <button type="button" tabindex="-1" aria-label="Decrease" (pointerdown)="$event.preventDefault()" (click)="step(-1)">
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 3.5 3 3 3-3"></path></svg>
      </button>
    </span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      align-items: stretch;
    }

    .steps {
      position: absolute;
      top: 3px;
      right: 3px;
      bottom: 3px;
      width: 22px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    button {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 5px;
      background: var(--color-surface-raised);
      color: var(--color-text-muted);
      cursor: pointer;
    }

    button:hover {
      background: var(--color-primary);
      color: #fff;
    }

    button:active {
      transform: scale(0.94);
    }
  `,
})
export class StepperComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  step(direction: 1 | -1): void {
    const input = this.host.nativeElement.querySelector<HTMLInputElement>('input[type="number"]');
    if (!input || input.disabled || input.readOnly) return;
    if (direction === 1) input.stepUp();
    else input.stepDown();
    // stepUp/stepDown change the value without telling anyone.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }
}
