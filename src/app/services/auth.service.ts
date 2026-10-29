import { Injectable, computed, inject, signal } from '@angular/core';
import { User } from '../models/models';
import { UserApiService } from './user-api.service';

/**
 * Canonical client-side user shape. The server returns both `_id` and
 * follower/following arrays; the client normalizes to a single `id` and
 * numeric counts so components never branch on the raw shape.
 */
const GOOGLE_NONCE_KEY = 'google-nonce';
const GOOGLE_RETURN_KEY = 'google-return';
const GOOGLE_ERRORS: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled.',
  expired: 'That sign-in took too long. Please try again.',
  'email-unverified': 'Your Google email is not verified.',
  'email-in-use': 'An account with this email already exists. Log in with your password, then link Google in Account settings.',
  'google-in-use': 'That Google account is already linked to another player.',
  banned: 'This account is banned.',
  deactivated: 'This account is deactivated.',
  'no-account': 'Your account could not be found.',
};

export const normalizeUser = (raw: any): User | null => {
  if (!raw) return null;
  return {
    id: raw.id ?? raw._id,
    username: raw.username ?? '',
    displayName: raw.displayName || raw.username || '',
    email: raw.email,
    avatar: raw.avatar,
    bio: raw.bio || '',
    role: raw.role,
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    level: raw.level,
    timezone: raw.timezone,
    timezoneManual: !!raw.timezoneManual,
    hasPassword: raw.hasPassword !== false,
    googleEmail: raw.googleEmail ?? null,
    leaderboardOptOut: !!raw.leaderboardOptOut,
    streakHourOffset: raw.streakHourOffset ?? 0,
    streakOffsetSet: !!raw.streakOffsetSet,
    usernameChangedAt: raw.usernameChangedAt ?? null,
    stats: raw.stats,
    settings: raw.settings ?? {},
    followersCount: Array.isArray(raw.followers)
      ? raw.followers.length
      : typeof raw.followersCount === 'number'
        ? raw.followersCount
        : 0,
    followingCount: Array.isArray(raw.following)
      ? raw.following.length
      : typeof raw.followingCount === 'number'
        ? raw.followingCount
        : 0,
    createdAt: raw.createdAt,
  };
};

export type AuthModalMode = 'login' | 'register';

/**
 * Auth state service. Mirrors the React AuthContext: verifies the stored
 * token on bootstrap, keeps the user in a signal, and persists the client
 * timezone server-side (non-blocking) on login/register/verify.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(UserApiService);

  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  /** Whether the signed-in player holds a permission (the server reports them; it still checks every action). */
  can(permission: string): boolean {
    return !!this.userSignal()?.permissions?.includes(permission);
  }

  /** Which auth dialog is open (rendered once in the app shell), or null. */
  readonly authModal = signal<AuthModalMode | null>(null);

  constructor() {
    void this.bootstrap();
  }

  openAuthModal(mode: AuthModalMode): void {
    this.authModal.set(mode);
  }

  closeAuthModal(): void {
    this.authModal.set(null);
  }

  private async persistTimezone(user: User | null): Promise<void> {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // A zone the player picked in Settings is not overwritten by the browser's.
      if (user && !user.timezoneManual && user.timezone !== tz) {
        await this.api.updateProfile({ timezone: tz });
      }
    } catch {
      // ignore timezone detection errors
    }
  }

  private async bootstrap(): Promise<void> {
    const token = this.api.getToken();
    if (!token) {
      this.loading.set(false);
      return;
    }
    try {
      const response = await this.api.verify(token);
      if (response.success && response.data?.valid) {
        const user = normalizeUser(response.data.user);
        this.userSignal.set(user);
        await this.persistTimezone(user);
      } else {
        this.api.clearToken();
      }
    } catch {
      this.api.clearToken();
    } finally {
      this.loading.set(false);
    }
  }

  async register(userData: { username: string; displayName?: string; email: string; password: string }): Promise<{ success: boolean; error?: string }> {
    this.error.set(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await this.api.register({ ...userData, timezone: tz });
      if (response.success) {
        this.api.setToken(response.data!.token);
        const user = normalizeUser(response.data!.user);
        this.userSignal.set(user);
        await this.persistTimezone(user);
        return { success: true };
      }
      this.error.set(response.error || 'Registration failed');
      return { success: false, error: response.error };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      this.error.set(msg);
      return { success: false, error: msg };
    }
  }

  async login(credentials: { identifier: string; password: string }): Promise<{ success: boolean; error?: string }> {
    this.error.set(null);
    try {
      const payload: { email?: string; username?: string; password: string } = { password: credentials.password };
      if (credentials.identifier.includes('@')) {
        payload.email = credentials.identifier;
      } else {
        payload.username = credentials.identifier;
      }
      const response = await this.api.login(payload);
      if (response.success) {
        this.api.setToken(response.data!.token);
        const user = normalizeUser(response.data!.user);
        this.userSignal.set(user);
        await this.persistTimezone(user);
        return { success: true };
      }
      this.error.set(response.error || 'Login failed');
      return { success: false, error: response.error };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      this.error.set(msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Sends the browser to Google, to sign in or (signed in) to link Google.
   * A random nonce kept in this tab must come back with the result, so a
   * sign-in started elsewhere can't be slipped into this browser.
   */
  async startGoogle(mode: 'login' | 'link', returnTo = '/'): Promise<string | null> {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(GOOGLE_NONCE_KEY, nonce);
    sessionStorage.setItem(GOOGLE_RETURN_KEY, returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/');
    const res = await this.api.googleUrl(mode, nonce);
    if (!res.success || !res.data) return res.error === 'not-configured' ? 'Google sign-in is not set up on this server.' : res.error || 'Could not reach Google.';
    window.location.assign(res.data.url);
    return null;
  }

  /**
   * Finishes a Google round trip from the fragment the server sent back.
   * Returns where to go next, or an error to show.
   */
  async finishGoogle(fragment: string): Promise<{ next: string; error?: string; linked?: boolean }> {
    const params = new URLSearchParams(fragment.replace(/^#/, ''));
    const expected = sessionStorage.getItem(GOOGLE_NONCE_KEY);
    const next = sessionStorage.getItem(GOOGLE_RETURN_KEY) || '/';
    sessionStorage.removeItem(GOOGLE_NONCE_KEY);
    sessionStorage.removeItem(GOOGLE_RETURN_KEY);
    if (!expected || params.get('nonce') !== expected) return { next: '/', error: 'This sign-in was not started from this browser tab. Please try again.' };
    const error = params.get('error');
    if (error) return { next, error: GOOGLE_ERRORS[error] ?? 'Google sign-in failed.' };
    const ticket = params.get('ticket');
    if (ticket) {
      // Linking is completed by this signed-in session, never by the redirect alone.
      const res = await this.api.accountAction('/auth/google/link', { ticket });
      if (!res.success) return { next, error: GOOGLE_ERRORS[res.error ?? ''] ?? 'Could not link Google.' };
      await this.refreshProfile();
      return { next, linked: true };
    }
    const token = params.get('token');
    if (!token) return { next, error: 'Google sign-in failed.' };
    this.api.setToken(token);
    const res = await this.api.verify(token);
    if (!res.success || !res.data?.valid) {
      this.api.clearToken();
      return { next, error: 'Google sign-in failed.' };
    }
    const user = normalizeUser(res.data.user);
    this.userSignal.set(user);
    await this.persistTimezone(user);
    return { next };
  }

  logout(): void {
    this.api.clearToken();
    this.userSignal.set(null);
    this.error.set(null);
  }

  async refreshProfile(): Promise<void> {
    if (!this.api.hasToken()) return;
    try {
      const response = await this.api.getProfile();
      if (response.success) {
        this.userSignal.set(normalizeUser(response.data));
      }
    } catch {
      // error ignored
    }
  }

  async updateProfile(updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatar' | 'timezone' | 'timezoneManual'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.api.updateProfile(updates);
      if (response.success) {
        this.userSignal.set(normalizeUser(response.data));
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
    }
  }

  clearError(): void {
    this.error.set(null);
  }
}
