import { Injectable, inject, signal } from '@angular/core';
import { GameApiService } from '../game-api.service';
import { LiveStats, Results } from '../../models/models';
import { KeystrokeLog } from './keystroke-log';

/** How often keys are streamed while typing. */
export const PROGRESS_INTERVAL_MS = 1000;
/** Races stream faster: opponents' cursors follow the server's replay. */
export const RACE_PROGRESS_INTERVAL_MS = 500;

/**
 * Streams a run's keys to the server and brings back its numbers. The
 * server is the source of truth: live stats come from /game/progress and
 * the results from /game/end; nothing is computed here.
 */
@Injectable({ providedIn: 'root' })
export class RunSyncService {
  private readonly api = inject(GameApiService);

  /** Server-computed stats for the run in progress (null before the first answer). */
  readonly live = signal<LiveStats | null>(null);

  private log: KeystrokeLog | null = null;
  /** Guest session id (signed-in players are identified by their token). */
  private sessionId: string | null = null;
  /** Keys the server holds. */
  private sent = 0;
  private inFlight: Promise<void> | null = null;
  private elapsed: () => number = () => 0;
  private leadMs: number | undefined;

  /** Starts syncing a run whose first `serverKeys` keys the server already has. */
  begin(log: KeystrokeLog, opts: { sessionId: string | null; serverKeys: number; elapsed: () => number; leadMs?: () => number }): void {
    this.log = log;
    this.sessionId = opts.sessionId;
    this.sent = opts.serverKeys;
    this.elapsed = opts.elapsed;
    this.leadMs = opts.leadMs?.();
    this.inFlight = null;
    this.live.set(null);
  }

  stop(): void {
    this.log = null;
    this.inFlight = null;
    this.live.set(null);
  }

  /** Sends keys typed since the last call (one request at a time). */
  flush(): Promise<void> {
    if (this.inFlight || !this.log) return this.inFlight ?? Promise.resolve();
    const log = this.log;
    const from = this.sent;
    const keys = log.from(from);
    if (!keys.length && this.live()) return Promise.resolve();
    const body: Record<string, unknown> = {
      from,
      keys,
      elapsedMs: Math.round(this.elapsed()),
      ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      ...(from === 0 && this.leadMs !== undefined ? { leadMs: this.leadMs } : {}),
    };
    this.inFlight = this.api.progress(body).then((res) => {
      if (this.log !== log) return;
      if (res.success && res.data) {
        this.sent = res.data.keyCount;
        this.live.set(res.data.live);
      } else if (res.data?.keyCount !== undefined) {
        // Offset mismatch: resend from what the server holds.
        this.sent = res.data.keyCount;
      }
    }).finally(() => {
      if (this.log === log) this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Ends the run: the last keys go with the request; the server scores it. */
  async finish(typedText: string, discard = false): Promise<{ results: Results | null; error?: string }> {
    const log = this.log;
    if (!log) return { results: null, error: 'No run in progress' };
    if (this.inFlight) await this.inFlight;
    const send = () =>
      this.api.endGame({
        from: this.sent,
        keys: log.from(this.sent),
        typedText,
        ...(discard ? { discard: true } : {}),
        elapsedMs: Math.max(1000, Math.round(this.elapsed())),
        ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      });
    let res = await send();
    if (!res.success && res.data?.keyCount !== undefined) {
      this.sent = res.data.keyCount;
      res = await send();
    }
    this.stop();
    return res.success ? { results: res.data as Results } : { results: null, error: res.error };
  }
}
