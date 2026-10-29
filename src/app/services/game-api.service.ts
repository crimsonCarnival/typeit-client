import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Achievement, ApiResponse, ErrorTrends, GhostTimeline, LiveStats, Replay, DailyOverview, DailyDay, ErrorMap, LearnOverview, PracticeKind, WordList, RankingQuery, ResultRow, RankingsResponse, SessionHistoryResponse } from '../models/models';

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
        const body = err.error as { error?: string; data?: T } | undefined;
        return { success: false, error: body?.error || `Request failed (${err.status})`, data: body?.data };
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
    const params = new HttpParams({ fromObject: { ...query, time: String(query.time ?? 60) } });
    return this.call(this.http.get<ApiResponse<RankingsResponse>>(`${this.base}/rankings`, { params }));
  }

  getResultRows(): Promise<ApiResponse<{ results: ResultRow[]; capped: boolean }>> {
    return this.call(this.http.get<ApiResponse<{ results: ResultRow[]; capped: boolean }>>(`${this.base}/stats/results`));
  }

  getAchievements(): Promise<ApiResponse<{ achievements: Achievement[] }>> {
    return this.call(this.http.get<ApiResponse<{ achievements: Achievement[] }>>(`${this.base}/achievements`));
  }

  getErrorMap(runs: number): Promise<ApiResponse<ErrorMap>> {
    return this.call(this.http.get<ApiResponse<ErrorMap>>(`${this.base}/error-map`, { params: { runs: String(runs) } }));
  }

  getErrorTrends(weeks: number): Promise<ApiResponse<ErrorTrends>> {
    return this.call(this.http.get<ApiResponse<ErrorTrends>>(`${this.base}/error-map/trends`, { params: { weeks: String(weeks) } }));
  }

  /** Practice run weighted toward the caller's weakest keys and digraphs. */
  startWeakKeys(): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/weak-keys`, {}));
  }

  startDrill(target: string): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/game/drill`, { target }));
  }

  getLearn(): Promise<ApiResponse<LearnOverview>> {
    return this.call(this.http.get<ApiResponse<LearnOverview>>(`${this.base}/learn`));
  }

  startPractice(kind: Exclude<PracticeKind, 'drill'>, id?: string): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/learn/start`, { kind, id }));
  }

  createWordList(list: { name: string; words: string }): Promise<ApiResponse<WordList>> {
    return this.call(this.http.post<ApiResponse<WordList>>(`${this.base}/learn/lists`, list));
  }

  updateWordList(id: string, list: { name: string; words: string }): Promise<ApiResponse<WordList>> {
    return this.call(this.http.put<ApiResponse<WordList>>(`${this.base}/learn/lists/${encodeURIComponent(id)}`, list));
  }

  deleteWordList(id: string): Promise<ApiResponse<null>> {
    return this.call(this.http.delete<ApiResponse<null>>(`${this.base}/learn/lists/${encodeURIComponent(id)}`));
  }

  getDaily(): Promise<ApiResponse<DailyOverview>> {
    return this.call(this.http.get<ApiResponse<DailyOverview>>(`${this.base}/daily`));
  }

  getDailyDay(date: string): Promise<ApiResponse<DailyDay>> {
    return this.call(this.http.get<ApiResponse<DailyDay>>(`${this.base}/daily/day/${encodeURIComponent(date)}`));
  }

  getReplay(resultId: string): Promise<ApiResponse<Replay>> {
    return this.call(this.http.get<ApiResponse<Replay>>(`${this.base}/replays/${encodeURIComponent(resultId)}`));
  }

  /** Your best ranked run for these settings as a ghost (null data when there is none). */
  getPbGhost(gameMode: string, timeMax: number): Promise<ApiResponse<{ resultId: string; wpm: number; timeline: GhostTimeline } | null>> {
    return this.call(this.http.get<ApiResponse<{ resultId: string; wpm: number; timeline: GhostTimeline } | null>>(`${this.base}/replays/ghost/pb`, {
      params: { gameMode, timeMax: String(timeMax) },
    }));
  }

  /** Practice run on a day's text against its winner's ghost. */
  startDailyGhost(date?: string): Promise<ApiResponse<{ state: any; ghost: { label: string; wpm: number; timeline: GhostTimeline } }>> {
    return this.call(this.http.post<ApiResponse<{ state: any; ghost: { label: string; wpm: number; timeline: GhostTimeline } }>>(`${this.base}/daily/ghost`, date ? { date } : {}));
  }

  startDaily(): Promise<ApiResponse<any>> {
    return this.call(this.http.post<ApiResponse<any>>(`${this.base}/daily/start`, {}));
  }

  /** Streams keys of the run in progress; answers server-computed live stats. */
  progress(body: Record<string, unknown>): Promise<ApiResponse<{ keyCount: number; live: LiveStats }>> {
    return this.call(this.http.post<ApiResponse<{ keyCount: number; live: LiveStats }>>(`${this.base}/game/progress`, body));
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
