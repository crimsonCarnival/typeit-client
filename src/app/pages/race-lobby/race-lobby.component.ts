import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RaceService } from '../../services/race.service';
import { RaceFriend, RaceMode, RacePlayer, RaceRatingEntry, RaceSettings } from '../../models/models';
import { RaceMistakesComponent } from '../../components/race-mistakes/race-mistakes.component';
import { StaffRingDirective } from '../../components/staff-ring/staff-ring.directive';
import { RaceChatComponent } from '../../components/race-chat/race-chat.component';

// These mirror the server's lists in config/race.js; the server is the one
// that enforces them.
const WORD_COUNTS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500];
const TIME_LIMITS = [15, 30, 60, 120, 180, 300, 600];
const PLAYER_LIMITS = [2, 3, 4, 6, 8];
const COUNTDOWNS = [3, 5, 10, 15];
// Phrases text categories.
const CATEGORIES = [
  { id: 'classics', label: 'Classics' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'speeches', label: 'Speeches' },
  { id: 'gta', label: 'GTA' },
];
const DEFAULT_SETTINGS: RaceSettings = {
  mode: 'words',
  category: 'classics',
  wordCount: 25,
  timeLimit: 30,
  maxPlayers: 4,
  countdownSec: 5,
  punctuation: false,
  numbers: false,
};
const FRIENDS_REFRESH_MS = 15000;

/** Create-form settings from URL query params; anything invalid is ignored. */
const settingsFromQuery = (q: (key: string) => string | null): RaceSettings => {
  const pick = (key: string, allowed: number[], fallback: number) => {
    const n = Number(q(key));
    return allowed.includes(n) ? n : fallback;
  };
  const mode: RaceMode = q('mode') === 'time' || q('mode') === 'phrases' ? (q('mode') as RaceMode) : 'words';
  const category = CATEGORIES.find((c) => c.id === q('cat'))?.id ?? DEFAULT_SETTINGS.category;
  return {
    mode,
    category,
    wordCount: pick('words', WORD_COUNTS, DEFAULT_SETTINGS.wordCount),
    timeLimit: pick('time', TIME_LIMITS, DEFAULT_SETTINGS.timeLimit),
    maxPlayers: pick('players', PLAYER_LIMITS, DEFAULT_SETTINGS.maxPlayers),
    countdownSec: pick('countdown', COUNTDOWNS, DEFAULT_SETTINGS.countdownSec),
    punctuation: q('punct') === '1',
    numbers: q('nums') === '1',
  };
};

@Component({
  selector: 'app-race-lobby',
  imports: [NgTemplateOutlet, RaceChatComponent, RaceMistakesComponent, StaffRingDirective],
  templateUrl: './race-lobby.component.html',
  styleUrl: './race-lobby.component.css',
})
export class RaceLobbyComponent {
  readonly auth = inject(AuthService);
  readonly race = inject(RaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly wordCounts = WORD_COUNTS;
  readonly timeLimits = TIME_LIMITS;
  readonly playerLimits = PLAYER_LIMITS;
  readonly countdowns = COUNTDOWNS;
  readonly categories = CATEGORIES;
  readonly leaderboard = signal<RaceRatingEntry[]>([]);

  private readonly query = this.route.snapshot.queryParamMap;
  /** Invite code from a /race/:code link. */
  readonly linkCode = (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase();

  readonly tab = signal<'create' | 'join'>(this.linkCode ? 'join' : 'create');
  readonly roomName = signal(this.query.get('name') ?? '');
  readonly isPrivate = signal(this.query.get('private') === '1');
  readonly draft = signal<RaceSettings>(settingsFromQuery((k) => this.query.get(k)));
  readonly joinCode = signal(this.linkCode);
  readonly showMistakes = signal(false);
  readonly copied = signal<'' | 'code' | 'link'>('');
  readonly friends = signal<RaceFriend[]>([]);
  readonly invited = signal<Set<string>>(new Set());
  private readonly now = signal(Date.now());

  readonly room = this.race.room;
  readonly inLobby = computed(() => {
    const s = this.room()?.state;
    return s === 'lobby' || s === 'countdown';
  });
  /** Settings shown in the form: the room's while in one, else the draft. */
  readonly settings = computed<RaceSettings>(() => this.room() ?? this.draft());
  /** Who may edit them: anyone creating, only the host once in a room. */
  readonly canEdit = computed(() => (this.room() ? this.race.isHost() && this.inLobby() && !this.room()!.rated : true));

  readonly startsIn = computed(() => {
    const room = this.room();
    if (room?.state !== 'countdown' || !room.startAt) return 0;
    return Math.max(0, Math.ceil((this.race.toLocal(room.startAt) - this.now()) / 1000));
  });

  readonly emptySlots = computed(() =>
    Array.from({ length: Math.max(0, (this.room()?.maxPlayers ?? 0) - (this.room()?.players.length ?? 0)) }, (_, i) => i)
  );

  /** Standings once the race ends: placed finishers by place, then the rest. */
  readonly standings = computed(() => {
    const room = this.room();
    if (room?.state !== 'finished') return [];
    return [...room.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || b.wpm - a.wpm);
  });

  constructor() {
    effect(() => {
      if (this.race.status() === 'online' && this.tab() === 'join') this.race.listOpen();
    });
    effect(() => {
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.loadFriends();
    });

    // Opening a /race/:code link joins that race once the socket is up.
    let linked = false;
    effect(() => {
      if (linked || !this.linkCode || this.race.status() !== 'online' || !this.auth.isAuthenticated()) return;
      linked = true;
      if (this.race.room()?.code !== this.linkCode) this.race.join(this.linkCode);
    });

    // Keep the address bar shareable: the room's link while in one, otherwise
    // the create form's settings as query params.
    effect(() => {
      const room = this.room();
      if (room && room.state !== 'finished') {
        void this.router.navigate(['/race', room.code], { replaceUrl: true });
      } else if (!room && this.tab() === 'create') {
        void this.router.navigate(['/race'], { queryParams: this.draftQuery(), replaceUrl: true });
      }
    });

    void this.race.loadLeaderboard().then((entries) => this.leaderboard.set(entries));

    const tick = setInterval(() => this.now.set(Date.now()), 250);
    const refresh = setInterval(() => {
      if (this.auth.isAuthenticated()) void this.loadFriends();
    }, FRIENDS_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      clearInterval(refresh);
    });
  }

  /** Only values that differ from the defaults, so the URL stays short. */
  private draftQuery(): Record<string, string | number | null> {
    const d = this.draft();
    const base = DEFAULT_SETTINGS;
    return {
      mode: d.mode !== base.mode ? d.mode : null,
      cat: d.mode === 'phrases' && d.category !== base.category ? d.category : null,
      words: d.wordCount !== base.wordCount ? d.wordCount : null,
      time: d.timeLimit !== base.timeLimit ? d.timeLimit : null,
      players: d.maxPlayers !== base.maxPlayers ? d.maxPlayers : null,
      countdown: d.countdownSec !== base.countdownSec ? d.countdownSec : null,
      punct: d.punctuation ? 1 : null,
      nums: d.numbers ? 1 : null,
      private: this.isPrivate() ? 1 : null,
    };
  }

  async loadFriends(): Promise<void> {
    this.friends.set(await this.race.loadFriends());
  }

  /** Applies a settings change: to the draft, or (host) to the live room. */
  change(patch: Partial<RaceSettings>): void {
    if (!this.canEdit()) return;
    if (this.room()) this.race.updateSettings(patch);
    else this.draft.update((d) => ({ ...d, ...patch }));
  }

  create(event: Event): void {
    event.preventDefault();
    this.race.create(this.roomName(), this.isPrivate(), this.draft());
  }

  join(event: Event): void {
    event.preventDefault();
    if (this.joinCode().trim()) this.race.join(this.joinCode());
  }

  leave(): void {
    this.race.leave();
    void this.router.navigate(['/race'], { replaceUrl: true });
  }

  async copy(what: 'code' | 'link'): Promise<void> {
    const code = this.room()?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(what === 'link' ? this.race.linkFor(code) : code);
      this.copied.set(what);
      setTimeout(() => this.copied.set(''), 1500);
    } catch {
      // Clipboard can be blocked; the code is on screen to copy by hand.
    }
  }

  /** Signed rating change for a player after a rated race, e.g. "+12". */
  ratingChange(userId: string): string | null {
    const d = this.room()?.ratingChanges?.[userId];
    return d === undefined ? null : d >= 0 ? `+${d}` : String(d);
  }

  /** A lane's progress through the text, for spectators. */
  progress(p: RacePlayer): number {
    const len = this.room()?.text?.length ?? 0;
    return len ? Math.min(100, (p.index / len) * 100) : 0;
  }

  /** The player whose kick is waiting for a second click. */
  readonly kickArmed = signal<string | null>(null);

  /** Host may remove others before the race and outside rated rooms. */
  canKick(p: RacePlayer): boolean {
    const r = this.room();
    return !!r && this.race.isHost() && !this.race.spectating() && !r.rated && r.state !== 'racing' && p.userId !== this.race.myId();
  }

  kick(p: RacePlayer): void {
    if (this.kickArmed() !== p.userId) {
      this.kickArmed.set(p.userId);
      return;
    }
    this.kickArmed.set(null);
    this.race.kick(p.userId);
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

  /** "25 words" / "30s timed" for summaries. */
  lengthLabel(s: Pick<RaceSettings, 'mode' | 'category' | 'wordCount' | 'timeLimit'>): string {
    if (s.mode === 'phrases') return `${this.categories.find((c) => c.id === s.category)?.label ?? 'Phrases'} phrase`;
    return s.mode === 'time' ? `${s.timeLimit}s timed` : `${s.wordCount} words`;
  }

  onInput(target: 'roomName' | 'joinCode', event: Event): void {
    this[target].set((event.target as HTMLInputElement).value);
  }
}
