import { Component, ElementRef, inject, signal } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { AppNotification } from '../../models/models';
import { ContextMenuDirective } from '../menu/context-menu.directive';
import { MenuItem } from '../menu/menu.service';

/** Header bell: unread count, and a panel with the inbox. */
@Component({
  selector: 'app-notification-bell',
  imports: [ContextMenuDirective],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class NotificationBellComponent {
  readonly notifications = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = signal(false);

  toggle(): void {
    this.open.update((o) => !o);
  }

  onDocumentClick(event: Event): void {
    const target = event.target as Element;
    // A click inside the popup menu (opened from an item here) is not a click away from the panel.
    if (this.open() && !this.host.nativeElement.contains(target) && !target.closest?.('app-menu-host')) this.open.set(false);
  }

  /** Opens what the notification is about, and marks it read. */
  go(n: AppNotification): void {
    if (this.notifications.opens(n)) this.open.set(false);
    this.notifications.open(n);
  }

  menuFor = (n: AppNotification): MenuItem[] => [
    ...(this.notifications.opens(n) ? [{ label: 'Open', action: () => this.go(n) }] : []),
    { label: 'Mark as read', disabled: n.read, action: () => void this.notifications.markRead([n.id]) },
    { label: 'Mark all as read', disabled: !this.notifications.hasUnread(), action: () => void this.notifications.markRead() },
  ];

  /** "5m", "3h", "2d": how long ago, short. */
  ago(iso: string): string {
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }

  label(): string {
    const n = this.notifications.unread();
    return n ? `Notifications, ${n} unread` : 'Notifications';
  }
}
