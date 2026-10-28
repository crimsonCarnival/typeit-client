import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { GameService } from './game.service';
import { ApiResponse, OpenRace, RaceFriend, RaceInvite, RaceRoom } from '../models/models';
import { ls } from '../utils/storage';

const SOCKET_PATH = '/ws/race';
const PROGRESS_INTERVAL_MS = 200;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
// Give up after this many failed attempts in a row; `retry()` starts over.
const MAX_RECONNECT_ATTEMPTS = 5;

const ERROR_MESSAGES: Record<string, string> = {
  'room-not-found': 'No race with that code.',
  'room-full': 'That race is full.',
  'already-started': 'That race has already started.',
  'not-host': 'Only the host can start early.',
  'friend-offline': 'Your friend went offline.',
  'not-friends': 'You can only invite friends (people you follow who follow you back).',
  'invite-cooldown': 'Invite already sent. Give them a moment.',
  'bad-settings': 'Pick a race length.',
  'too-many-attempts': 'Too many wrong codes. Wait a minute and try again.',
};

/**
 * Live-race connection. Signed-in players keep one socket open (that is what
 * "online" means for friends and invites). The server owns all race state;
 * this service mirrors the latest room snapshot it pushes.
 */
@Injectable({ providedIn: 'root' })
export class RaceService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private startedCode: string | null = null;

  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private failedAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProgressAt = 0;
  private pendingProgress: ReturnType<typeof setTimeout> | null = null;
  /** serverTime - localTime, from the latest server message. */
  private clockOffset = 0;

  readonly status = signal<'offline' | 'connecting' | 'online'>('offline');
  /** True once automatic reconnecting stopped; the lobby offers a manual retry. */
  readonly gaveUp = signal(false);
  readonly room = signal<RaceRoom | null>(null);
  readonly openRooms = signal<OpenRace[]>([]);
  readonly invite = signal<RaceInvite | null>(null);
  readonly error = signal('');
  readonly myId = signal<string | null>(null);

  readonly me = computed(() => this.room()?.players.find((p) => p.userId === this.myId()) ?? null);
  readonly isHost = computed(() => !!this.room() && this.room()!.hostId === this.myId());

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) this.connect();
      else this.disconnect();
    });

    // When the server starts our race, load it into the game and open it.
    effect(() => {
      const room = this.room();
      if (room?.state !== 'racing' || !room.startAt || room.code === this.startedCode) return;
      this.startedCode = room.code;
      void this.game.startRace(room.code, this.toLocal(room.startAt)).then(() => this.router.navigate(['/play']));
    });
  }

  /** Converts a server timestamp to the local clock. */
  toLocal(serverMs: number): number {
    return serverMs - this.clockOffset;
  }

  private url(): string {
    if (environment.wsUrl) return environment.wsUrl;
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${location.host}${SOCKET_PATH}`;
  }

  private connect(): void {
    if (this.ws) return;
    const token = ls.get('token');
    if (!token) return;
    this.status.set('connecting');
    const ws = new WebSocket(this.url());
    this.ws = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (event) => this.onMessage(event.data);
    ws.onclose = () => {
      this.ws = null;
      this.status.set('offline');
      if (this.auth.isAuthenticated()) this.scheduleReconnect();
    };
  }

  private disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.failedAttempts = 0;
    this.gaveUp.set(false);
    this.status.set('offline');
    this.room.set(null);
  }

  /** Starts a fresh round of connection attempts (e.g. from a "Retry" button). */
  retry(): void {
    if (this.ws || !this.auth.isAuthenticated()) return;
    this.failedAttempts = 0;
    this.reconnectDelay = RECONNECT_BASE_MS;
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (++this.failedAttempts > MAX_RECONNECT_ATTEMPTS) {
      this.gaveUp.set(true);
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  private onMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'ready':
        this.status.set('online');
        this.gaveUp.set(false);
        this.failedAttempts = 0;
        this.reconnectDelay = RECONNECT_BASE_MS;
        this.myId.set(msg.userId);
        this.clockOffset = msg.serverNow - Date.now();
        break;
      case 'room':
        this.clockOffset = msg.room.serverNow - Date.now();
        this.room.set(msg.room);
        this.error.set('');
        break;
      case 'left':
        this.room.set(null);
        break;
      case 'rooms':
        this.openRooms.set(msg.rooms);
        break;
      case 'invited':
        this.invite.set({ code: msg.code, name: msg.name, from: msg.from });
        break;
      case 'error':
        this.error.set(ERROR_MESSAGES[msg.code] ?? 'Something went wrong.');
        break;
    }
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.error.set('Not connected to the race server yet.');
  }

  create(name: string, wordCount: number, isPrivate: boolean): void {
    this.send({ type: 'create', name, wordCount, isPrivate });
  }

  join(code: string): void {
    this.send({ type: 'join', code: code.trim() });
  }

  leave(): void {
    this.send({ type: 'leave' });
    this.room.set(null);
  }

  setReady(ready: boolean): void {
    this.send({ type: 'ready', ready });
  }

  cancelCountdown(): void {
    this.send({ type: 'cancel' });
  }

  startNow(): void {
    this.send({ type: 'startNow' });
  }

  listOpen(): void {
    this.send({ type: 'list' });
  }

  inviteFriend(userId: string): void {
    this.send({ type: 'invite', userId });
  }

  acceptInvite(): void {
    const invite = this.invite();
    this.invite.set(null);
    if (invite) this.join(invite.code);
  }

  /** Throttled: at most one progress message per PROGRESS_INTERVAL_MS. */
  sendProgress(index: number, accuracy: number): void {
    const flush = () => {
      this.pendingProgress = null;
      this.lastProgressAt = Date.now();
      this.send({ type: 'progress', index, accuracy });
    };
    if (this.pendingProgress) clearTimeout(this.pendingProgress);
    const wait = PROGRESS_INTERVAL_MS - (Date.now() - this.lastProgressAt);
    if (wait <= 0) flush();
    else this.pendingProgress = setTimeout(flush, wait);
  }

  async loadFriends(): Promise<RaceFriend[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ friends: RaceFriend[] }>>(`${environment.apiUrl}/race/friends`)
      );
      return res.data?.friends ?? [];
    } catch {
      return [];
    }
  }
}
