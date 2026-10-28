import { Injectable, computed, inject, signal } from '@angular/core';
import { User } from '../models/models';
import { UserApiService } from './user-api.service';

/**
 * Canonical client-side user shape. The server returns both `_id` and
 * follower/following arrays; the client normalizes to a single `id` and
 * numeric counts so components never branch on the raw shape.
 */
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
    timezone: raw.timezone,
    stats: raw.stats,
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
      if (user && user.timezone !== tz) {
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

  async updateProfile(updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatar' | 'timezone'>>): Promise<{ success: boolean; error?: string }> {
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
