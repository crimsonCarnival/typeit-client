import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { RaceService } from '../../services/race.service';
import { RaceFriend, RacePlayer } from '../../models/models';

const LENGTHS = [25, 50, 75];
const MAX_PLAYERS = 4; // mirrors the server's RACE_MAX_PLAYERS
const FRIENDS_REFRESH_MS = 15000;

@Component({
  selector: 'app-race-lobby',
  templateUrl: './race-lobby.component.html',
  styleUrl: './race-lobby.component.css',
})
export class RaceLobbyComponent {
  readonly auth = inject(AuthService);
  readonly race = inject(RaceService);

  readonly lengths = LENGTHS;
  readonly maxPlayers = MAX_PLAYERS;

  readonly tab = signal<'create' | 'join'>('create');
  readonly roomName = signal('');
  readonly wordCount = signal(25);
  readonly isPrivate = signal(true);
  readonly joinCode = signal('');
  readonly copied = signal(false);
  readonly friends = signal<RaceFriend[]>([]);
  readonly invited = signal<Set<string>>(new Set());
  private readonly now = signal(Date.now());

  readonly room = this.race.room;
  readonly inLobby = computed(() => {
    const s = this.room()?.state;
    return s === 'lobby' || s === 'countdown';
  });

  readonly startsIn = computed(() => {
    const room = this.room();
    if (room?.state !== 'countdown' || !room.startAt) return 0;
    return Math.max(0, Math.ceil((this.race.toLocal(room.startAt) - this.now()) / 1000));
  });

  readonly emptySlots = computed(() =>
    Array.from({ length: Math.max(0, MAX_PLAYERS - (this.room()?.players.length ?? 0)) }, (_, i) => i)
  );

  constructor() {
    effect(() => {
      if (this.race.status() === 'online' && this.tab() === 'join') this.race.listOpen();
    });
    effect(() => {
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.loadFriends();
    });

    const tick = setInterval(() => this.now.set(Date.now()), 250);
    const refresh = setInterval(() => {
      if (this.auth.isAuthenticated()) void this.loadFriends();
    }, FRIENDS_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      clearInterval(refresh);
    });
  }

  async loadFriends(): Promise<void> {
    this.friends.set(await this.race.loadFriends());
  }

  create(event: Event): void {
    event.preventDefault();
    this.race.create(this.roomName(), this.wordCount(), this.isPrivate());
  }

  join(event: Event): void {
    event.preventDefault();
    if (this.joinCode().trim()) this.race.join(this.joinCode());
  }

  async copyCode(): Promise<void> {
    const code = this.room()?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is on screen to copy by hand.
    }
  }

  invite(friend: RaceFriend): void {
    this.race.inviteFriend(friend.userId);
    this.invited.update((s) => new Set(s).add(friend.userId));
  }

  isMe(p: RacePlayer): boolean {
    return p.userId === this.race.myId();
  }

  initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  avatarColor(index: number, p: RacePlayer): string {
    return this.isMe(p) ? 'var(--color-primary)' : `var(--color-avatar-${(index % 7) + 2})`;
  }

  onInput(target: 'roomName' | 'joinCode', event: Event): void {
    this[target].set((event.target as HTMLInputElement).value);
  }
}
