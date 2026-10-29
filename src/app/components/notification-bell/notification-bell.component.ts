import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { AppNotification } from '../../models/models';

/** Header bell: unread count, and a panel with the inbox. */
@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class NotificationBellComponent {
  readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = signal(false);

  toggle(): void {
    this.open.update((o) => !o);
  }

  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  /** Opens what the notification is about, and marks it read. */
  go(n: AppNotification): void {
    if (!n.read) void this.notifications.markRead([n.id]);
    if (n.link) {
      this.open.set(false);
      void this.router.navigateByUrl(n.link);
    }
  }

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
