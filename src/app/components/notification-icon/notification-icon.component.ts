import { Component, input } from '@angular/core';

/** The icon of a notification type, shared by the bell's inbox and the toasts. */
@Component({
  selector: 'app-notification-icon',
  template: `
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      @switch (type()) {
        @case ('follow') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path>
        }
        @case ('race-invite') {
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><path d="M4 22v-7"></path>
        }
        @case ('race-result') {
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
        }
        @case ('achievement') {
          <circle cx="12" cy="8" r="6"></circle><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"></path>
        }
        @case ('level-up') {
          <path d="m22 7-8.5 8.5-5-5L2 17"></path><path d="M16 7h6v6"></path>
        }
        @case ('daily-expiring') {
          <circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>
        }
        @case ('daily-rank') {
          <rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>
        }
        @case ('account') {
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        }
        @case ('changelog') {
          <path d="m3 11 18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>
        }
        @default {
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        }
      }
    </svg>
  `,
  styles: `
    :host {
      flex: none;
      display: inline-flex;
      color: var(--color-text-subtle);
    }
  `,
})
export class NotificationIconComponent {
  readonly type = input.required<string>();
}
