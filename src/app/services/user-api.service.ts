import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, FollowListUser, PublicProfile, User } from '../models/models';
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

  getProfile(): Promise<ApiResponse<User>> {
    return this.call(this.http.get<ApiResponse<User>>(`${this.base}/users/profile`));
  }

  updateProfile(updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatar' | 'timezone'>>): Promise<ApiResponse<User>> {
    return this.call(this.http.patch<ApiResponse<User>>(`${this.base}/users/profile`, updates));
  }

  deleteAccount(): Promise<ApiResponse<null>> {
    return this.call(this.http.delete<ApiResponse<null>>(`${this.base}/users/account`));
  }

  getLeaderboard(limit = 10, sortBy = 'highScore'): Promise<ApiResponse<any[]>> {
    return this.call(this.http.get<ApiResponse<any[]>>(`${this.base}/users/leaderboard`, { params: { limit: String(limit), sortBy } }));
  }

  searchUsers(query: string, limit = 20): Promise<ApiResponse<any[]>> {
    return this.call(this.http.get<ApiResponse<any[]>>(`${this.base}/users/search`, { params: { q: query, limit: String(limit) } }));
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
