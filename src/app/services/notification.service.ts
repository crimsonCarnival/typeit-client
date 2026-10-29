import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ChangelogService } from './changelog.service';
import { ApiResponse, AppNotification, NotificationPrefs } from '../models/models';

const PAGE = 30;
const TOAST_MS = 6000;
// Where notices stored before every type carried a link lead.
const FALLBACK_LINK: Record<string, string> = { account: '/account' };

/** The inbox: loaded when signed in, kept current by notifications pushed over the race socket. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly changelog = inject(ChangelogService);
  private readonly base = `${environment.apiUrl}/notifications`;

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  readonly loading = signal(false);
  readonly hasMore = signal(false);
  /** New arrivals shown briefly on screen. */
  readonly toasts = signal<AppNotification[]>([]);
  readonly prefs = signal<NotificationPrefs | null>(null);

  readonly hasUnread = computed(() => this.unread() > 0);

  constructor() {
    effect(() => {
      if (this.auth.loading()) return;
      if (this.auth.isAuthenticated()) void this.load();
      else this.reset();
    });
  }

  private reset(): void {
    this.items.set([]);
    this.unread.set(0);
    this.toasts.set([]);
    this.prefs.set(null);
    this.hasMore.set(false);
  }

  /** Loads the newest page. The server also sends anything the player hasn't been told yet. */
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<ApiResponse<{ notifications: AppNotification[]; unread: number }>>(`${this.base}?limit=${PAGE}`));
      this.items.set(res.data?.notifications ?? []);
      this.unread.set(res.data?.unread ?? 0);
      this.hasMore.set((res.data?.notifications.length ?? 0) === PAGE);
    } catch {
      // The bell just stays as it was; the next load retries.
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const last = this.items().at(-1);
    if (!last || this.loading()) return;
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<ApiResponse<{ notifications: AppNotification[]; unread: number }>>(`${this.base}?limit=${PAGE}&before=${last.id}`));
      const more = res.data?.notifications ?? [];
      this.items.update((list) => [...list, ...more]);
      this.hasMore.set(more.length === PAGE);
    } catch {
      // keep what we have
    } finally {
      this.loading.set(false);
    }
  }

  /** Whether clicking the notification leads anywhere. */
  opens(n: AppNotification): boolean {
    return n.type === 'changelog' || !!this.linkOf(n);
  }

  /** Opens what the notification is about (a page, or the release notes), and marks it read. */
  open(n: AppNotification): void {
    if (!n.read) void this.markRead([n.id]);
    const link = this.linkOf(n);
    if (n.type === 'changelog') this.changelog.open.set(true);
    else if (link) void this.router.navigateByUrl(link);
  }

  private linkOf(n: AppNotification): string | null {
    return n.link ?? FALLBACK_LINK[n.type] ?? null;
  }

  /** A notification pushed live. */
  receive(n: AppNotification): void {
    if (this.items().some((x) => x.id === n.id)) return;
    this.items.update((list) => [n, ...list]);
    this.unread.update((c) => c + 1);
    // The notes loaded at startup predate the release just announced.
    if (n.type === 'changelog') void this.changelog.load(true);
    this.toasts.update((list) => [...list, n].slice(-3));
    setTimeout(() => this.dismissToast(n.id), TOAST_MS);
  }

  dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  async markRead(ids?: string[]): Promise<void> {
    const target = ids ?? this.items().filter((n) => !n.read).map((n) => n.id);
    if (!target.length && ids === undefined && this.unread() === 0) return;
    const set = new Set(target);
    this.items.update((list) => list.map((n) => (ids === undefined || set.has(n.id) ? { ...n, read: true } : n)));
    try {
      const res = await firstValueFrom(this.http.post<ApiResponse<{ unread: number }>>(`${this.base}/read`, ids === undefined ? {} : { ids }));
      this.unread.set(res.data?.unread ?? 0);
    } catch {
      void this.load();
    }
  }

  async loadPrefs(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<ApiResponse<NotificationPrefs>>(`${this.base}/preferences`));
      if (res.data) this.prefs.set(res.data);
    } catch {
      // settings shows nothing until it works
    }
  }

  async setPref(key: keyof NotificationPrefs, value: boolean): Promise<void> {
    const before = this.prefs();
    if (before) this.prefs.set({ ...before, [key]: value });
    try {
      const res = await firstValueFrom(this.http.put<ApiResponse<NotificationPrefs>>(`${this.base}/preferences`, { [key]: value }));
      if (res.data) this.prefs.set(res.data);
    } catch {
      this.prefs.set(before);
    }
  }
}
