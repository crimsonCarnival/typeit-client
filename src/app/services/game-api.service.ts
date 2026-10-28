import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, RankingQuery, RankingsResponse, SessionHistoryResponse } from '../models/models';

/**
 * Game HTTP service. Mirrors the React typeIt.api wrapper: every method
 * resolves to `{ success, data, error }`.
 */
@Injectable({ providedIn: 'root' })
export class GameApiService {
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

  startGame(options: Record<string, unknown>): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/start`, options));
  }

  getGameState(sessionData: Record<string, unknown> = {}): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/state`, { sessionData }));
  }

  getRankings(query: RankingQuery): Promise<ApiResponse<RankingsResponse>> {
    const params = new HttpParams({ fromObject: { ...query, time: String(query.time) } });
    return this.call(this.http.get<ApiResponse<RankingsResponse>>(`${this.base}/rankings`, { params }));
  }

  beginGame(): Promise<ApiResponse<unknown>> {
    return this.call(this.http.post<ApiResponse<unknown>>(`${this.base}/game/begin`, {}));
  }

  endGame(gameData: Record<string, unknown>): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/end`, gameData));
  }

  resetGame(gameSettings: Record<string, unknown> = {}): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/reset`, gameSettings));
  }

  refreshText(gameSettings: Record<string, unknown> = {}): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/refresh`, gameSettings));
  }

  updateSettings(settings: Record<string, unknown>): Promise<ApiResponse<any>> {
    return this.call(this.http.patch<ApiResponse<any>>(`${this.base}/game/settings`, settings));
  }

  saveSessionState(state: Record<string, unknown>): Promise<ApiResponse<any>> {
    return this.call(this.http.patch<ApiResponse<any>>(`${this.base}/game/session`, state));
  }

  migrateGame(payload: Record<string, unknown>): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/migrate`, payload));
  }

  deleteGame(): Promise<ApiResponse<null>> {
    return this.call(this.http.delete<ApiResponse<null>>(`${this.base}/game/delete`));
  }

  getSessionHistory(params?: { limit?: number; gameMode?: string; timeMax?: number }): Promise<ApiResponse<SessionHistoryResponse>> {
    let httpParams = new HttpParams();
    if (params?.limit)    httpParams = httpParams.set('limit', String(params.limit));
    if (params?.gameMode) httpParams = httpParams.set('gameMode', params.gameMode);
    if (params?.timeMax)  httpParams = httpParams.set('timeMax', String(params.timeMax));
    return this.call(this.http.get<ApiResponse<SessionHistoryResponse>>(`${this.base}/stats/history`, { params: httpParams }));
  }
}
