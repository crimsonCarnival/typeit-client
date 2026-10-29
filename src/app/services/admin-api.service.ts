import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, AdminAudit, AdminRoom, AdminUser, AdminUsersPage, PermissionCatalog, Role } from '../models/models';

/** Admin area endpoints. Every call resolves to `{ success, data, error }`. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

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

  permissions(): Promise<ApiResponse<PermissionCatalog>> {
    return this.call(this.http.get<ApiResponse<PermissionCatalog>>(`${this.base}/permissions`));
  }

  users(page: number, filters: { search?: string; role?: string; status?: string }): Promise<ApiResponse<AdminUsersPage>> {
    let params = new HttpParams().set('page', page).set('limit', 15);
    for (const [k, v] of Object.entries(filters)) if (v) params = params.set(k, v);
    return this.call(this.http.get<ApiResponse<AdminUsersPage>>(`${this.base}/users`, { params }));
  }

  warn(userId: string, reason: string): Promise<ApiResponse<unknown>> {
    return this.call(this.http.post(`${this.base}/users/${userId}/warn`, { reason }) as Observable<ApiResponse<unknown>>);
  }

  setStatus(userId: string, status: 'active' | 'deactivated' | 'banned', reason: string): Promise<ApiResponse<AdminUser>> {
    return this.call(this.http.patch<ApiResponse<AdminUser>>(`${this.base}/users/${userId}/status`, { status, reason }));
  }

  setRole(userId: string, role: Role): Promise<ApiResponse<AdminUser>> {
    return this.call(this.http.patch<ApiResponse<AdminUser>>(`${this.base}/users/${userId}/role`, { role }));
  }

  setPermissions(userId: string, grants: string[], revokes: string[]): Promise<ApiResponse<{ user: AdminUser; permissions: string[] }>> {
    return this.call(this.http.put<ApiResponse<{ user: AdminUser; permissions: string[] }>>(`${this.base}/users/${userId}/permissions`, { grants, revokes }));
  }

  resetProfile(userId: string, fields: string[], reason: string): Promise<ApiResponse<AdminUser>> {
    return this.call(this.http.post<ApiResponse<AdminUser>>(`${this.base}/users/${userId}/profile-reset`, { fields, reason }));
  }

  grantXp(userId: string, amount: number, reason: string): Promise<ApiResponse<{ xp: number; level: number; levelBefore: number }>> {
    return this.call(this.http.post<ApiResponse<{ xp: number; level: number; levelBefore: number }>>(`${this.base}/users/${userId}/xp`, { amount, reason }));
  }

  rooms(): Promise<ApiResponse<{ rooms: AdminRoom[] }>> {
    return this.call(this.http.get<ApiResponse<{ rooms: AdminRoom[] }>>(`${this.base}/races`));
  }

  moderateRoom(code: string, action: 'kick' | 'mute' | 'unmute', userId: string, reason: string): Promise<ApiResponse<unknown>> {
    return this.call(this.http.post(`${this.base}/races/${encodeURIComponent(code)}/moderate`, { action, userId, reason }) as Observable<ApiResponse<unknown>>);
  }

  refreshChangelog(): Promise<ApiResponse<{ releases: number; commits: number }>> {
    return this.call(this.http.post<ApiResponse<{ releases: number; commits: number }>>(`${this.base}/changelog/refresh`, {}));
  }

  audit(page: number): Promise<ApiResponse<AdminAudit>> {
    return this.call(this.http.get<ApiResponse<AdminAudit>>(`${this.base}/audit`, { params: { page, limit: 25 } }));
  }
}
