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
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  speed: 'Speed',
  accuracy: 'Accuracy',
  habits: 'Habits',
  racing: 'Racing',
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

  readonly rarities: AchievementRarity[] = ['common', 'rare', 'epic'];

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

  iconPaths(a: Achievement): string[] {
    return ICON_PATHS[a.unlocked ? a.icon : 'lock'] ?? ICON_PATHS['lock'];
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
