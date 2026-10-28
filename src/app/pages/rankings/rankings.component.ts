import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import {
  GameMode,
  RankingEntry,
  RankingModifiers,
  RankingQuery,
  RankingRegion,
  RankingsResponse,
} from '../../models/models';

type Tab = 'global' | 'monthly' | 'modifiers';

const TIME_LIMITS = [30, 60, 90, 120];
const AVATAR_COLORS = 8; // --color-avatar-1 .. --color-avatar-8

@Component({
  selector: 'app-rankings',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './rankings.component.html',
  styleUrl: './rankings.component.css',
})
export class RankingsComponent {
  readonly auth = inject(AuthService);
  private readonly gameApi = inject(GameApiService);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'global', label: 'Global' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'modifiers', label: 'Mode-specific' },
  ];
  readonly modes: { id: GameMode; label: string }[] = [
    { id: 'words', label: 'Words' },
    { id: 'phrases', label: 'Phrases' },
  ];
  readonly timeLimits = TIME_LIMITS;
  // Plain runs ('none') are what Global and Monthly rank; this tab covers the rest.
  readonly modifierOptions: { id: RankingModifiers; label: string }[] = [
    { id: 'punctuation', label: 'Punctuation' },
    { id: 'numbers', label: 'Numbers' },
    { id: 'both', label: 'Punct + Numbers' },
  ];
  readonly regions: { id: RankingRegion; label: string }[] = [
    { id: 'all', label: 'All regions' },
    { id: 'africa', label: 'Africa' },
    { id: 'americas', label: 'Americas' },
    { id: 'asia', label: 'Asia' },
    { id: 'europe', label: 'Europe' },
    { id: 'oceania', label: 'Oceania' },
  ];

  readonly tab = signal<Tab>('global');
  readonly mode = signal<GameMode>('words');
  readonly time = signal(60);
  readonly modifiers = signal<RankingModifiers>('punctuation');
  readonly region = signal<RankingRegion>('all');

  readonly data = signal<RankingsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly query = computed<RankingQuery>(() => ({
    period: this.tab() === 'monthly' ? 'month' : 'all',
    mode: this.mode(),
    time: this.time(),
    modifiers: this.tab() === 'modifiers' ? this.modifiers() : 'none',
    region: this.region(),
  }));

  /** Own row, pinned under the table when it isn't already on this page. */
  readonly pinnedMe = computed(() => {
    const d = this.data();
    if (!d?.me) return null;
    return d.entries.some((e) => e.userId === d.me!.userId) ? null : d.me;
  });

  private requestId = 0;

  constructor() {
    effect(() => {
      // Re-fetch when the query changes, or when sign-in state changes
      // (the server only returns `me` for signed-in players).
      const query = this.query();
      this.auth.isAuthenticated();
      void this.load(query);
    });
  }

  async load(query = this.query()): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    const res = await this.gameApi.getRankings(query);
    // A slower response for an older filter must not overwrite a newer one.
    if (id !== this.requestId) return;
    this.loading.set(false);
    if (res.success && res.data) {
      this.data.set(res.data);
    } else {
      this.data.set(null);
      this.error.set(res.error || 'Could not load rankings');
    }
  }

  isMe(entry: RankingEntry): boolean {
    return entry.userId === this.data()?.me?.userId;
  }

  avatarColor(entry: RankingEntry): string {
    let hash = 0;
    for (const ch of entry.userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `var(--color-avatar-${(hash % AVATAR_COLORS) + 1})`;
  }

  initial(entry: RankingEntry): string {
    return (entry.displayName || entry.username).charAt(0).toUpperCase();
  }

  boardLabel(): string {
    const mode = this.mode() === 'words' ? 'words' : 'phrases';
    return `${this.time()}s ${mode}`;
  }

  onRegionChange(event: Event): void {
    this.region.set((event.target as HTMLSelectElement).value as RankingRegion);
  }
}
