import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, FollowListUser, PlayerSearchResult, PlayerSettings, BlockedUser, ProfileOverview, PublicProfile, TestOutcomes, User } from '../models/models';
import { ls } from '../utils/storage';

/**
 * User + auth + social HTTP service. Mirrors the React auth.api wrapper:
 * every method resolves to `{ success, data, error }`.
 */
@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private async call<T>(obs: Observable<ApiResponse<T>>): Promise<ApiResponse<T>> {
    try {
      return await firstValueFrom(obs);
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as { error?: string } | undefined;
        return { success: false, error: body?.error || `Request failed (${err.status})` };
      }
      return { success: false, error: 'Network error' };
    }
  }

  getToken(): string | null {
    return ls.get('token');
  }

  setToken(token: string): void {
    ls.set('token', token);
  }

  clearToken(): void {
    ls.remove('token');
  }

  hasToken(): boolean {
    return ls.has('token');
  }

  register(payload: { username: string; email: string; password: string; displayName?: string; timezone?: string }): Promise<ApiResponse<{ token: string; user: User }>> {
    return this.call(this.http.post<ApiResponse<{ token: string; user: User }>>(`${this.base}/auth/register`, payload));
  }

  login(payload: { email?: string; username?: string; password: string }): Promise<ApiResponse<{ token: string; user: User }>> {
    return this.call(this.http.post<ApiResponse<{ token: string; user: User }>>(`${this.base}/auth/login`, payload));
  }

  verify(token: string): Promise<ApiResponse<{ valid: boolean; user?: User }>> {
    return this.call(this.http.post<ApiResponse<{ valid: boolean; user?: User }>>(`${this.base}/auth/verify`, { token }));
  }

  updateSettings(patch: Partial<PlayerSettings>): Promise<ApiResponse<Partial<PlayerSettings>>> {
    return this.call(this.http.patch<ApiResponse<Partial<PlayerSettings>>>(`${this.base}/users/settings`, patch));
  }

  getProfile(): Promise<ApiResponse<User>> {
    return this.call(this.http.get<ApiResponse<User>>(`${this.base}/users/profile`));
  }

  updateProfile(updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatar' | 'timezone' | 'timezoneManual'>>): Promise<ApiResponse<User>> {
    return this.call(this.http.patch<ApiResponse<User>>(`${this.base}/users/profile`, updates));
  }

  getLeaderboard(limit = 10, sortBy = 'highScore'): Promise<ApiResponse<any[]>> {
    return this.call(this.http.get<ApiResponse<any[]>>(`${this.base}/users/leaderboard`, { params: { limit: String(limit), sortBy } }));
  }

  searchUsers(query: string, limit = 20): Promise<ApiResponse<PlayerSearchResult[]>> {
    return this.call(this.http.get<ApiResponse<PlayerSearchResult[]>>(`${this.base}/users/search`, { params: { q: query, limit: String(limit) } }));
  }

  getOverview(userId: string, year?: number | null): Promise<ApiResponse<ProfileOverview>> {
    const query = year ? `?year=${year}` : '';
    return this.call(this.http.get<ApiResponse<ProfileOverview>>(`${this.base}/users/${userId}/overview${query}`));
  }

  /** Wipes the player's progress and keeps the account. `confirm` is their username. */
  resetAccount(confirm: string): Promise<ApiResponse<{ reset: boolean }>> {
    return this.call(this.http.post<ApiResponse<{ reset: boolean }>>(`${this.base}/users/account/reset`, { confirm }));
  }

  /** Deletes the account for good. `confirm` is the player's username. */
  deleteAccount(confirm: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.call(this.http.delete<ApiResponse<{ deleted: boolean }>>(`${this.base}/users/account`, { body: { confirm } }));
  }

  googleEnabled(): Promise<ApiResponse<{ enabled: boolean }>> {
    return this.call(this.http.get<ApiResponse<{ enabled: boolean }>>(`${this.base}/auth/google/enabled`));
  }

  googleUrl(mode: 'login' | 'link', nonce: string): Promise<ApiResponse<{ url: string }>> {
    return this.call(this.http.post<ApiResponse<{ url: string }>>(`${this.base}/auth/google/url`, { mode, nonce }));
  }

  /** Account actions that answer only success or a reason. */
  accountAction(path: string, body: Record<string, unknown> = {}, method: 'post' | 'delete' = 'post'): Promise<ApiResponse<unknown>> {
    const url = `${this.base}${path}`;
    return this.call((method === 'delete' ? this.http.delete<ApiResponse<unknown>>(url) : this.http.post<ApiResponse<unknown>>(url, body)) as Observable<ApiResponse<unknown>>);
  }

  listBlocked(): Promise<ApiResponse<{ users: BlockedUser[] }>> {
    return this.call(this.http.get<ApiResponse<{ users: BlockedUser[] }>>(`${this.base}/users/blocks`));
  }

  setBlocked(userId: string, blocked: boolean): Promise<ApiResponse<unknown>> {
    return this.accountAction(`/users/${userId}/block`, {}, blocked ? 'post' : 'delete');
  }

  getMyOutcomes(): Promise<ApiResponse<TestOutcomes>> {
    return this.call(this.http.get<ApiResponse<TestOutcomes>>(`${this.base}/users/profile/outcomes`));
  }

  getPublicProfile(userId: string): Promise<ApiResponse<PublicProfile>> {
    return this.call(this.http.get<ApiResponse<PublicProfile>>(`${this.base}/users/${userId}`));
  }

  followUser(userId: string): Promise<ApiResponse<{ isFollowing: boolean; followersCount: number }>> {
    return this.call(this.http.post<ApiResponse<{ isFollowing: boolean; followersCount: number }>>(`${this.base}/users/${userId}/follow`, {}));
  }

  unfollowUser(userId: string): Promise<ApiResponse<{ isFollowing: boolean; followersCount: number }>> {
    return this.call(this.http.delete<ApiResponse<{ isFollowing: boolean; followersCount: number }>>(`${this.base}/users/${userId}/follow`));
  }

  getFollowers(userId: string): Promise<ApiResponse<FollowListUser[]>> {
    return this.call(this.http.get<ApiResponse<FollowListUser[]>>(`${this.base}/users/${userId}/followers`));
  }

  getFollowing(userId: string): Promise<ApiResponse<FollowListUser[]>> {
    return this.call(this.http.get<ApiResponse<FollowListUser[]>>(`${this.base}/users/${userId}/following`));
  }
}
