import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { GameService } from './game.service';
import { GameAudioService } from './game/game-audio.service';
import { ApiResponse, OpenRace, RaceChatMessage, RaceEmote, RaceFriend, RaceHistoryEntry, RaceInvite, RaceMistakes, RaceRatingEntry, RaceRoom, RaceSettings } from '../models/models';
import { ls } from '../utils/storage';

const SOCKET_PATH = '/ws/race';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
// Give up after this many failed attempts in a row; `retry()` starts over.
const MAX_RECONNECT_ATTEMPTS = 5;

const ERROR_MESSAGES: Record<string, string> = {
  'room-not-found': 'No race with that code.',
  'room-full': 'That race is full.',
  'already-started': 'That race has already started.',
  'not-host': 'Only the host can do that.',
  'friend-offline': 'Your friend went offline.',
  'not-friends': 'You can only invite friends (people you follow who follow you back).',
  'invite-cooldown': 'Invite already sent. Give them a moment.',
  'bad-settings': 'Those race settings are not allowed.',
  'rated-room': 'Quick-match rules are fixed.',
  'too-many-players': 'More players are in the room than that limit allows.',
  'too-many-attempts': 'Too many wrong codes. Wait a minute and try again.',
  'already-racing': "You're racing in that room.",
  'too-many-spectators': 'That race has as many spectators as it can take.',
  'chat-cooldown': 'Slow down a little.',
  'not-finished': 'The race is still on.',
  banned: "The host removed you from that race, so you can't rejoin it.",
  'cannot-kick-self': "You can't kick yourself.",
  'bad-kick': 'Could not kick that player.',
};

// Chat lines kept on screen.
const CHAT_HISTORY = 50;

/** How each emote is shown. */
export const EMOTES: Record<RaceEmote, string> = {
  wave: '👋',
  fire: '🔥',
  laugh: '😂',
  wow: '😮',
  clap: '👏',
  gg: 'GG',
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
  private readonly audio = inject(GameAudioService);
  private readonly router = inject(Router);
  private startedCode: string | null = null;

  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private failedAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
  /** Quick-match queue state. */
  readonly queue = signal<{ queued: boolean; size: number; rating: number | null }>({ queued: false, size: 0, rating: null });
  /** True while watching a room rather than racing in it. */
  readonly spectating = signal(false);
  readonly chat = signal<RaceChatMessage[]>([]);

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
      if (room?.state !== 'racing' || !room.startAt || room.code === this.startedCode || this.spectating()) return;
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
        if (this.room()?.code !== msg.room.code) this.chat.set([]);
        // A rematch reuses the room code: let the next start load again.
        if (msg.room.state === 'lobby' && this.startedCode === msg.room.code) this.startedCode = null;
        this.spectating.set(!!msg.spectating);
        this.playRoomCues(this.room(), msg.room);
        this.room.set(msg.room);
        this.error.set('');
        break;
      case 'left':
        this.room.set(null);
        this.spectating.set(false);
        this.chat.set([]);
        break;
      case 'kicked':
        this.room.set(null);
        this.spectating.set(false);
        this.chat.set([]);
        this.error.set(`The host removed you from "${msg.name}". You can't rejoin it.`);
        void this.router.navigate(['/race'], { replaceUrl: true });
        break;
      case 'queue':
        this.queue.set({ queued: !!msg.queued, size: msg.size ?? 0, rating: msg.rating ?? this.queue().rating });
        break;
      case 'chat-history':
        this.chat.set((msg.lines as RaceChatMessage[]).slice(-CHAT_HISTORY));
        break;
      case 'chat':
        this.chat.update((lines) => [...lines, msg as RaceChatMessage].slice(-CHAT_HISTORY));
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

  /** A sound when someone joins or leaves the room we're already in (not for our own entry). */
  private playRoomCues(prev: RaceRoom | null, next: RaceRoom): void {
    if (!prev || prev.code !== next.code || this.spectating()) return;
    const before = new Set(prev.players.map((p) => p.userId));
    const after = new Set(next.players.map((p) => p.userId));
    const me = this.myId();
    const joined = next.players.some((p) => p.userId !== me && !before.has(p.userId));
    const left = prev.players.some((p) => p.userId !== me && !after.has(p.userId));
    const muted = this.game.gameState().isMuted;
    if (joined) this.audio.playCue('join', muted);
    else if (left) this.audio.playCue('leave', muted);
  }

  /** Host only: removes a player and bars them from this room for good. */
  kick(userId: string): void {
    this.send({ type: 'kick', userId });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.error.set('Not connected to the race server yet.');
  }

  create(name: string, isPrivate: boolean, settings: RaceSettings): void {
    this.send({ type: 'create', name, isPrivate, ...settings });
  }

  /** Host only; the server unreadies everyone since the rules changed. */
  updateSettings(patch: Partial<RaceSettings>): void {
    this.send({ type: 'settings', ...patch });
  }

  /** Shareable link that opens the lobby and joins this race. */
  linkFor(code: string): string {
    return `${location.origin}/race/${code}`;
  }

  /** Quick match: rated public races against players near your rating. */
  findMatch(): void {
    this.send({ type: 'queue' });
  }

  cancelMatch(): void {
    this.send({ type: 'unqueue' });
  }

  rematch(): void {
    this.send({ type: 'rematch' });
  }

  spectate(code: string): void {
    this.send({ type: 'spectate', code });
  }

  say(text: string): void {
    if (text.trim()) this.send({ type: 'chat', text });
  }

  emote(emote: RaceEmote): void {
    this.send({ type: 'emote', emote });
  }

  /** Every racer's mistakes in a finished race (id, or the room code for its latest race). */
  async loadMistakes(ref: string): Promise<{ data: RaceMistakes | null; error: string }> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<RaceMistakes>>(`${environment.apiUrl}/race/${encodeURIComponent(ref)}/mistakes`)
      );
      return { data: res.data ?? null, error: res.data ? '' : res.error || 'Could not load the comparison' };
    } catch (err) {
      // The race is saved a moment after the last finisher, so an early request can miss it.
      const status = (err as { status?: number }).status;
      return {
        data: null,
        error: status === 404 ? 'This race is still being saved.' : status === 403 ? 'Only the racers can compare mistakes.' : 'Could not load the comparison.',
      };
    }
  }

  /** The player's latest finished races. */
  async loadHistory(): Promise<RaceHistoryEntry[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ races: RaceHistoryEntry[] }>>(`${environment.apiUrl}/race/history`)
      );
      return res.data?.races ?? [];
    } catch {
      return [];
    }
  }

  async loadLeaderboard(): Promise<RaceRatingEntry[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ entries: RaceRatingEntry[] }>>(`${environment.apiUrl}/race/leaderboard`)
      );
      return res.data?.entries ?? [];
    } catch {
      return [];
    }
  }

  join(code: string): void {
    this.send({ type: 'join', code: code.trim() });
  }

  leave(): void {
    this.send({ type: 'leave' });
    this.room.set(null);
    this.spectating.set(false);
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
