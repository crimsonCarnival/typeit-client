import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { GameService } from '../../services/game.service';
import { ErrorMap, ErrorMapKey, ErrorTrends, PlayerSettings } from '../../models/models';
import { SettingsService } from '../../services/settings.service';

/** Letter rows per keyboard layout (settings); the error map draws the player's own. */
const KEY_ROWS: Record<PlayerSettings['keyboardLayout'], string[][]> = {
  qwerty: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row) => row.split('')),
  dvorak: ["',.pyfgcrl", 'aoeuidhtns', ';qjkxbmwvz'].map((row) => row.split('')),
  colemak: ['qwfpgjluy;', 'arstdhneio', 'zxcvbkm'].map((row) => row.split('')),
};
// Heat gradient stops, matching --color-heat-0..3 in styles.css.
const HEAT_STOPS = [0, 0.4, 0.7, 1];
const TYPED_INSTEAD_SHOWN = 3;

type View = 'keys' | 'digraphs';

@Component({
  selector: 'app-error-map',
  templateUrl: './error-map.component.html',
  styleUrl: './error-map.component.css',
})
export class ErrorMapComponent {
  readonly auth = inject(AuthService);
  private readonly gameApi = inject(GameApiService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  private readonly settings = inject(SettingsService);
  readonly keyRows = computed(() => KEY_ROWS[this.settings.settings().keyboardLayout] ?? KEY_ROWS.qwerty);
  readonly runOptions = [10, 20, 50];

  readonly view = signal<View>('keys');
  readonly runs = signal(20);
  readonly map = signal<ErrorMap | null>(null);
  readonly error = signal('');
  readonly selected = signal<string | null>(null);
  readonly drilling = signal(false);

  private readonly byKey = computed(() => new Map((this.map()?.keys ?? []).map((k) => [k.key, k])));
  private readonly maxKeyErrors = computed(() => Math.max(1, ...(this.map()?.keys ?? []).map((k) => k.errors)));
  private readonly maxPairErrors = computed(() => Math.max(1, ...(this.map()?.digraphs ?? []).map((d) => d.errors)));

  readonly hasData = computed(() => (this.map()?.totalPresses ?? 0) > 0);

  /** The selected key's stats, defaulting to the worst key. */
  readonly detail = computed<ErrorMapKey | null>(() => {
    const sel = this.selected();
    if (this.view() === 'keys') {
      if (sel !== null && sel.length === 1) return this.byKey().get(sel) ?? null;
      return this.map()?.keys.find((k) => k.errors > 0) ?? null;
    }
    return null;
  });

  readonly selectedPair = computed(() => {
    if (this.view() !== 'digraphs') return null;
    const pairs = this.map()?.digraphs ?? [];
    return pairs.find((p) => p.pair === this.selected()) ?? pairs[0] ?? null;
  });

  readonly typedInstead = computed(() => {
    const d = this.detail();
    if (!d || d.errors === 0) return [];
    const top = d.typedInstead.slice(0, TYPED_INSTEAD_SHOWN);
    const rest = d.typedInstead.slice(TYPED_INSTEAD_SHOWN).reduce((n, t) => n + t.count, 0);
    const rows = top.map((t) => ({ label: this.keyLabel(t.typed), percent: Math.round((t.count / d.errors) * 100) }));
    if (rest > 0) rows.push({ label: 'Other', percent: Math.round((rest / d.errors) * 100) });
    return rows;
  });

  readonly weakestPairs = computed(() => (this.map()?.digraphs ?? []).slice(0, 4));

  constructor() {
    effect(() => {
      const runs = this.runs();
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.load(runs);
    });
    effect(() => {
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.loadTrends();
    });
  }

  async load(runs = this.runs()): Promise<void> {
    this.error.set('');
    const res = await this.gameApi.getErrorMap(runs);
    if (res.success && res.data) this.map.set(res.data);
    else this.error.set(res.error || 'Could not load the error map');
  }

  setView(view: View): void {
    this.view.set(view);
    this.selected.set(null);
  }

  onRunsChange(event: Event): void {
    this.runs.set(Number((event.target as HTMLSelectElement).value));
  }

  keyStats(key: string): ErrorMapKey | undefined {
    return this.byKey().get(key);
  }

  isSelected(key: string): boolean {
    return (this.selected() ?? this.detail()?.key) === key;
  }

  keyBackground(key: string): string {
    const stats = this.byKey().get(key);
    if (!stats) return 'var(--color-surface-raised)';
    return this.heat(stats.errors / this.maxKeyErrors());
  }

  pairBackground(errors: number): string {
    return this.heat(errors / this.maxPairErrors());
  }

  /** Blends the heat tokens; keeps colours defined in one place (styles.css). */
  private heat(t: number): string {
    const v = Math.min(1, Math.max(0, t));
    const i = Math.max(0, HEAT_STOPS.findIndex((stop) => v <= stop) - 1);
    const span = HEAT_STOPS[i + 1] - HEAT_STOPS[i];
    const pct = Math.round(((v - HEAT_STOPS[i]) / span) * 100);
    return `color-mix(in srgb, var(--color-heat-${i + 1}) ${pct}%, var(--color-heat-${i}))`;
  }

  keyLabel(key: string): string {
    return key === ' ' ? 'Space' : key.toUpperCase();
  }

  readonly trends = signal<ErrorTrends | null>(null);
  private readonly maxTrendRate = computed(() =>
    Math.max(1, ...(this.trends()?.weeks ?? []).map((w) => w.errorRate ?? 0))
  );

  async loadTrends(): Promise<void> {
    const res = await this.gameApi.getErrorTrends(8);
    if (res.success && res.data) this.trends.set(res.data);
  }

  trendHeight(rate: number | null): number {
    return rate === null ? 0 : Math.max(4, Math.round((rate / this.maxTrendRate()) * 100));
  }

  /** "26 Oct" for a week's Monday. */
  weekLabel(week: string): string {
    const d = new Date(`${week}T00:00:00Z`);
    return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
  }

  async practiceWeakKeys(): Promise<void> {
    if (this.drilling()) return;
    this.drilling.set(true);
    const res = await this.game.startWeakKeys();
    this.drilling.set(false);
    if (res.success) void this.router.navigate(['/play/practice']);
    else this.error.set(res.error || 'Could not start the practice run');
  }

  async drill(target: string): Promise<void> {
    if (this.drilling()) return;
    this.drilling.set(true);
    const res = await this.game.startDrill(target);
    this.drilling.set(false);
    if (res.success) void this.router.navigate(['/play/practice']);
    else this.error.set(res.error || 'Could not start the drill');
  }
}
