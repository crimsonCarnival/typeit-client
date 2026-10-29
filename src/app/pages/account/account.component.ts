import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, GOOGLE_REAUTH_KEY } from '../../services/auth.service';
import { TimezoneService } from '../../services/timezone.service';
import { UserApiService } from '../../services/user-api.service';
import { GameService } from '../../services/game.service';
import { StepperComponent } from '../../components/stepper/stepper.component';
import { BlockedUser } from '../../models/models';

type Tab = 'account' | 'authentication' | 'blocked' | 'danger';

/**
 * Every account action: dialogs ask for what each needs. Irreversible ones
 * need the username typed; security ones the current password.
 */
type DialogKind = 'username' | 'streak' | 'optout' | 'resetpbs' | 'password' | 'email' | 'link' | 'unlink' | 'revoke' | 'reset' | 'delete';

const DIALOGS: Record<DialogKind, { title: string; confirm: string; text: string; typeName?: boolean; danger?: boolean }> = {
  username: { title: 'Update username', confirm: 'Update', text: 'You can only do this once every 30 days.' },
  streak: { title: 'Set streak hour offset', confirm: 'Set offset', text: 'Hours added to UTC to decide where your day starts for streaks. You can only do this once!', danger: true },
  optout: { title: 'Opt out of leaderboards', confirm: 'Opt out', text: 'Your runs will never appear on any leaderboard again. You can\'t undo this action!', typeName: true, danger: true },
  resetpbs: { title: 'Reset personal bests', confirm: 'Reset personal bests', text: 'Clears all your personal bests. Your test history stays. You can\'t undo this!', typeName: true, danger: true },
  password: { title: 'Password', confirm: 'Save password', text: '' },
  email: { title: 'Update email', confirm: 'Update email', text: 'Enter your password to change the email you sign in with.' },
  link: { title: 'Add Google authentication', confirm: 'Continue to Google', text: 'Enter your password to link a Google account.' },
  unlink: { title: 'Remove Google authentication', confirm: 'Remove', text: 'You will sign in with your username or email and password only.' },
  revoke: { title: 'Revoke all tokens', confirm: 'Revoke all tokens', text: 'Signs your account out on every device, including this one.', danger: true },
  reset: { title: 'Reset account', confirm: 'Reset account', text: 'This erases all your progress and cannot be undone.', typeName: true, danger: true },
  delete: { title: 'Delete account', confirm: 'Delete account', text: 'This deletes your account and everything connected to it, and cannot be undone.', typeName: true, danger: true },
};

@Component({
  selector: 'app-account',
  imports: [RouterLink, StepperComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css',
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(UserApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tz = inject(TimezoneService);
  private readonly game = inject(GameService);

  readonly user = this.auth.user;
  readonly dialogs = DIALOGS;
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'blocked', label: 'Blocked users' },
    { id: 'danger', label: 'Danger zone' },
  ];
  readonly tab = signal<Tab>(this.tabFromUrl());

  readonly dialog = signal<DialogKind | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly googleEnabled = signal(false);
  readonly showEmail = signal(false);
  private readonly dialogEl = viewChild<ElementRef<HTMLElement>>('dialogEl');
  private opener: HTMLElement | null = null;

  // Dialog fields
  readonly typed = signal('');
  readonly current = signal('');
  readonly next = signal('');
  readonly repeat = signal('');
  readonly field = signal('');
  readonly hours = signal('0');

  readonly joined = computed(() => {
    const created = this.user()?.createdAt;
    return created ? this.tz.date(created) : '';
  });

  /** "g•••••@g••••.com": enough to recognise, not enough to read off a shoulder. */
  readonly maskedGoogle = computed(() => {
    const email = this.user()?.googleEmail;
    if (!email) return '';
    const [name, domain = ''] = email.split('@');
    const dot = domain.lastIndexOf('.');
    const host = dot > 0 ? domain.slice(0, dot) : domain;
    const tld = dot > 0 ? domain.slice(dot) : '';
    return `${name[0]}•••••@${host[0] ?? ''}••••${tld}`;
  });

  /** When the username may change again, or '' if now. */
  readonly usernameWait = computed(() => {
    const at = this.user()?.usernameChangedAt;
    if (!at) return '';
    const next = new Date(at).getTime() + 30 * 86_400_000;
    return next > Date.now() ? this.tz.date(next) : '';
  });

  readonly canSubmit = computed(() => {
    const kind = this.dialog();
    const u = this.user();
    if (!kind || !u || this.busy()) return false;
    if (DIALOGS[kind].typeName) return this.typed() === u.username;
    switch (kind) {
      case 'username': return /^[A-Za-z0-9_.-]{3,20}$/.test(this.field()) && this.field() !== u.username;
      case 'streak': return /^-?\d{1,2}$/.test(this.hours()) && Number(this.hours()) >= -11 && Number(this.hours()) <= 12;
      case 'password': return this.next().length >= 6 && this.next() === this.repeat() && (!u.hasPassword || this.current().length > 0);
      case 'email': return this.current().length > 0 && this.field().includes('@');
      case 'link': return this.current().length > 0;
      default: return true;
    }
  });

  constructor() {
    effect(() => {
      if (!this.auth.loading() && !this.auth.isAuthenticated()) void this.router.navigate(['/']);
    });
    effect(() => {
      const el = this.dialogEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.querySelector<HTMLElement>('input') ?? el).focus());
    });
    void this.api.googleEnabled().then((res) => this.googleEnabled.set(!!res.data?.enabled));
    // Back from confirming with Google to add a password.
    if (sessionStorage.getItem(GOOGLE_REAUTH_KEY)) queueMicrotask(() => this.open('password'));
    if (this.tab() === 'blocked') void this.loadBlocked();
  }

  private tabFromUrl(): Tab {
    const t = this.route.snapshot.queryParamMap.get('tab');
    return t === 'authentication' || t === 'blocked' || t === 'danger' ? t : 'account';
  }

  show(tab: Tab): void {
    this.tab.set(tab);
    this.notice.set('');
    if (tab === 'blocked') void this.loadBlocked();
    void this.router.navigate([], { queryParams: { tab: tab === 'account' ? null : tab }, replaceUrl: true });
  }

  open(kind: DialogKind): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    for (const s of [this.typed, this.current, this.next, this.repeat]) s.set('');
    this.field.set(kind === 'username' ? this.user()?.username ?? '' : '');
    this.hours.set(String(this.user()?.streakHourOffset ?? 0));
    this.error.set('');
    this.notice.set('');
    this.dialog.set(kind);
  }

  close(): void {
    if (this.busy()) return;
    this.dialog.set(null);
    this.opener?.focus?.();
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
    }
  }

  readonly blocked = signal<BlockedUser[] | null>(null);

  async loadBlocked(): Promise<void> {
    const res = await this.api.listBlocked();
    this.blocked.set(res.data?.users ?? []);
  }

  async unblock(u: BlockedUser): Promise<void> {
    const res = await this.api.setBlocked(u.userId, false);
    if (!res.success) return this.notice.set(res.error || 'Could not unblock.');
    this.blocked.update((list) => (list ?? []).filter((x) => x.userId !== u.userId));
    this.notice.set(`Unblocked ${u.displayName}.`);
  }

  when(iso: string): string {
    return this.tz.date(iso);
  }

  /** Linking needs the password when there is one: a session alone must not add a way in. */
  async linkGoogle(): Promise<void> {
    if (this.user()?.hasPassword) {
      this.open('link');
      return;
    }
    const error = await this.auth.startGoogle('link', '/account?tab=authentication');
    if (error) this.notice.set(error);
  }

  /** A Google-only account adds its first password after confirming with Google. */
  async addPassword(): Promise<void> {
    if (this.user()?.hasPassword || sessionStorage.getItem(GOOGLE_REAUTH_KEY)) {
      this.open('password');
      return;
    }
    const error = await this.auth.startGoogle('reauth', '/account?tab=authentication');
    if (error) this.notice.set(error);
  }

  async confirm(): Promise<void> {
    const kind = this.dialog();
    const u = this.user();
    if (!kind || !u || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set('');
    const call = (path: string, body: Record<string, unknown> = {}, method: 'post' | 'delete' = 'post') => this.api.accountAction(path, body, method);
    let res: { success: boolean; error?: string };
    let done = '';
    switch (kind) {
      case 'username': res = await call('/users/account/username', { username: this.field() }); done = 'Username updated.'; break;
      case 'streak': res = await call('/users/account/streak-offset', { hours: Number(this.hours()) }); done = 'Streak offset set.'; break;
      case 'optout': res = await call('/users/account/leaderboard-opt-out'); done = 'You are off the leaderboards.'; break;
      case 'resetpbs': res = await call('/users/account/reset-pbs'); done = 'Personal bests reset.'; break;
      case 'password': {
        const reauth = sessionStorage.getItem(GOOGLE_REAUTH_KEY) ?? undefined;
        res = await call('/auth/password', { current: this.current() || undefined, next: this.next(), reauth });
        if (res.success) sessionStorage.removeItem(GOOGLE_REAUTH_KEY);
        done = 'Password saved. Other devices were signed out.';
        break;
      }
      case 'link': {
        this.busy.set(false);
        const error = await this.auth.startGoogle('link', '/account?tab=authentication', this.current());
        if (error) this.error.set(error);
        return;
      }
      case 'email': res = await call('/auth/email', { password: this.current(), email: this.field() }); done = 'Email updated. Other devices were signed out.'; break;
      case 'unlink': res = await call('/auth/google', {}, 'delete'); done = 'Google removed. Other devices were signed out.'; break;
      case 'revoke': res = await call('/auth/revoke-all'); break;
      case 'reset': res = await this.api.resetAccount(u.username); done = 'Your account was reset.'; break;
      case 'delete': res = await this.api.deleteAccount(u.username); break;
    }
    this.busy.set(false);
    if (!res.success) {
      this.error.set(res.error || 'That did not work');
      return;
    }
    this.dialog.set(null);
    if (kind === 'delete' || kind === 'revoke') {
      this.auth.logout();
      void this.router.navigate(['/']);
      return;
    }
    if (kind === 'reset') void this.game.resetGame();
    await this.auth.refreshProfile();
    this.notice.set(done);
  }
}
