import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { Achievement, AchievementCategory, AchievementRarity } from '../../models/models';

/** Inline stroke icons (24x24 viewBox) keyed by the server's `icon` name. */
const ICON_PATHS: Record<string, string[]> = {
  keyboard: ['M2 6h20v12H2z', 'M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  flame: ['M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z'],
  rocket: ['M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2', 'M9 15l-3-3c1-4 4-8 10-9 0 6-5 9-9 10z', 'M15 9h.01'],
  gem: ['M6 3h12l4 6-10 12L2 9z', 'M2 9h20M12 21 8 9l4-6 4 6z'],
  target: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  pulse: ['M3 12h4l3-8 4 16 3-8h4'],
  calendar: ['M3 5h18v16H3z', 'M3 10h18M8 3v4M16 3v4'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
  stopwatch: ['M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M12 11v3M10 2h4M19 7l-1.5 1.5'],
  sun: ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'],
  flag: ['M4 22V4', 'M4 4h13l-2 4 2 4H4'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  skull: ['M12 2a8 8 0 0 0-8 8c0 3 1.5 5 3 6v4h10v-4c1.5-1 3-3 3-6a8 8 0 0 0-8-8z', 'M9 11h.01M15 11h.01M10 20v-3M14 20v-3'],
  trophy: ['M8 21h8M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4'],
  book: ['M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4z', 'M20 4h-6M20 4v15h-8'],
  cap: ['M2 9l10-5 10 5-10 5z', 'M6 11v5c3 2 9 2 12 0v-5', 'M22 9v6'],
  drill: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v4l3 2', 'M4 4l3 3M20 4l-3 3'],
  list: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
};

/** One card on the page: a single badge, or a tier family shown at its next tier. */
interface BadgeCard {
  key: string;
  /** The badge the card shows: the next tier to earn, or the top tier once all are earned. */
  shown: Achievement;
  /** Every tier of the family, lowest first (null for a single badge). */
  tiers: Achievement[] | null;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  speed: 'Speed',
  accuracy: 'Accuracy',
  habits: 'Habits',
  racing: 'Racing',
  learning: 'Learning',
};

@Component({
  selector: 'app-achievements',
  imports: [RouterLink],
  templateUrl: './achievements.component.html',
  styleUrl: './achievements.component.css',
})
export class AchievementsComponent {
  readonly auth = inject(AuthService);
  private readonly gameApi = inject(GameApiService);

  readonly achievements = signal<Achievement[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');

  readonly rarities: AchievementRarity[] = ['common', 'rare', 'epic', 'legendary'];

  readonly unlockedCount = computed(() => this.achievements().filter((a) => a.unlocked).length);
  readonly percent = computed(() => {
    const total = this.achievements().length;
    return total ? Math.round((this.unlockedCount() / total) * 100) : 0;
  });

  readonly categories = computed(() =>
    (Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map((id) => {
      const inCat = this.achievements().filter((a) => a.category === id);
      const unlocked = inCat.filter((a) => a.unlocked).length;
      return {
        id,
        label: CATEGORY_LABELS[id],
        unlocked,
        total: inCat.length,
        percent: inCat.length ? Math.round((unlocked / inCat.length) * 100) : 0,
      };
    })
  );

  /** Tier families collapse into one card; single badges keep their own. */
  readonly cards = computed<BadgeCard[]>(() => {
    const cards: BadgeCard[] = [];
    const families = new Map<string, BadgeCard>();
    for (const a of this.achievements()) {
      if (!a.family) {
        cards.push({ key: a.id, shown: a, tiers: null });
        continue;
      }
      let card = families.get(a.family);
      if (!card) {
        card = { key: a.family, shown: a, tiers: [] };
        families.set(a.family, card);
        cards.push(card);
      }
      card.tiers!.push(a);
    }
    for (const card of families.values()) {
      card.tiers!.sort((x, y) => (x.tier ?? 0) - (y.tier ?? 0));
      card.shown = card.tiers!.find((t) => !t.unlocked) ?? card.tiers![card.tiers!.length - 1];
    }
    return cards;
  });

  /** Tiers earned in a family card. */
  tiersDone(card: BadgeCard): number {
    return card.tiers?.filter((t) => t.unlocked).length ?? 0;
  }

  constructor() {
    effect(() => {
      // Only signed-in players have badges; wait for auth to settle.
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const res = await this.gameApi.getAchievements();
    this.loading.set(false);
    if (res.success && res.data) {
      this.achievements.set(res.data.achievements);
      this.loaded.set(true);
    } else {
      this.error.set(res.error || 'Could not load achievements');
    }
  }

  /** The badge's icon once earned (or once a lower tier is), else a lock. */
  iconPaths(a: Achievement, tierEarned = false): string[] {
    return ICON_PATHS[a.unlocked || tierEarned ? a.icon : 'lock'] ?? ICON_PATHS['lock'];
  }

  categoryLabel(c: AchievementCategory): string {
    return CATEGORY_LABELS[c];
  }

  progressPercent(a: Achievement): number {
    return a.target ? Math.min(100, Math.round((a.value / a.target) * 100)) : 0;
  }

  progressLabel(a: Achievement): string {
    return `${Math.floor(a.value)} / ${a.target} ${a.unit}`;
  }
}
