import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { ls } from '../utils/storage';
import { AuthService } from './auth.service';
import { UserApiService } from './user-api.service';

const ID_KEY = 'usageId';
/** The player's explicit choice ('on' | 'off'); absent means the default. */
const CHOICE_KEY = 'usageTracking';
const FLUSH_MS = 10_000;

/** Events the browser reports itself; the server counts runs and races where they happen. */
export type UsageEvent = 'page.rankings' | 'page.error-map' | 'page.replays' | 'page.achievements' | 'page.stats' | 'page.players' | 'page.learn' | 'daily:past-day';

const PAGE_VIEWS: [RegExp, UsageEvent][] = [
  [/^\/ranks(\/|$)/, 'page.rankings'],
  [/^\/error-map(\/|$)/, 'page.error-map'],
  [/^\/replay\//, 'page.replays'],
  [/^\/achievements(\/|$)/, 'page.achievements'],
  [/^\/stats(\/|$)/, 'page.stats'],
  [/^\/players(\/|$)/, 'page.players'],
  [/^\/learn$/, 'page.learn'],
];

/** Global Privacy Control: a browser-wide "don't track me" makes the default off. */
const gpc = (): boolean => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

const readChoice = (): 'on' | 'off' | null => {
  const v = ls.get(CHOICE_KEY);
  return v === 'on' || v === 'off' ? v : null;
};

/**
 * This device's visitor id, created on first use; null when tracking is off.
 * A plain function so the HTTP interceptor can use it without injecting
 * UsageService (which needs AuthService, which needs HTTP).
 */
export const usageId = (): string | null => {
  if ((readChoice() ?? (gpc() ? 'off' : 'on')) !== 'on') return null;
  let id = ls.get(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    ls.set(ID_KEY, id);
  }
  return id;
};

/**
 * Anonymous usage statistics. A random id stays on this device so the server
 * can count different people; only a keyed hash of it is stored there.
 *
 * On by default (off under GPC). "Off" wins: an account that opted out turns
 * this device off, and an explicit "off" here is written to the account; an
 * account's "on" never turns a device back on.
 */
@Injectable({ providedIn: 'root' })
export class UsageService {
  private readonly auth = inject(AuthService);
  private readonly userApi = inject(UserApiService);
  private readonly choice = signal<'on' | 'off' | null>(readChoice());
  private queue = new Set<UsageEvent>();

  readonly enabled = computed(() => (this.choice() ?? (gpc() ? 'off' : 'on')) === 'on');

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      untracked(() => {
        if (user.usageOptOut && this.enabled()) this.store('off');
        else if (!user.usageOptOut && this.choice() === 'off') void this.userApi.accountAction('/users/account/usage-opt-out', { optOut: true });
      });
    });

    const router = inject(Router);
    const sub = router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      const hit = PAGE_VIEWS.find(([re]) => re.test(path));
      if (hit) this.track(hit[1]);
    });
    const timer = setInterval(() => this.flush(), FLUSH_MS);
    const onHide = () => this.flush();
    addEventListener('pagehide', onHide);
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      clearInterval(timer);
      removeEventListener('pagehide', onHide);
    });
  }

  id(): string | null {
    return usageId();
  }

  track(event: UsageEvent): void {
    if (this.enabled()) this.queue.add(event);
  }

  /** The Settings toggle: an explicit choice, kept on the account too when signed in. */
  async setEnabled(on: boolean): Promise<void> {
    this.store(on ? 'on' : 'off');
    if (this.auth.isAuthenticated()) await this.userApi.accountAction('/users/account/usage-opt-out', { optOut: !on });
  }

  private store(choice: 'on' | 'off'): void {
    ls.set(CHOICE_KEY, choice);
    this.choice.set(choice);
    if (choice === 'off') {
      ls.remove(ID_KEY);
      this.queue.clear();
    }
  }

  // `fetch` with keepalive, not sendBeacon: the request must carry the sign-in
  // token so the server can tell guests from players and honour an account opt-out.
  private flush(): void {
    const visitorId = this.id();
    if (!visitorId || !this.queue.size) return;
    const events = [...this.queue].map((key) => ({ key }));
    this.queue.clear();
    const token = ls.get('token');
    void fetch(`${environment.apiUrl}/usage/events`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ visitorId, events }),
    }).catch(() => {});
  }
}
