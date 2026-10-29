import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { GameService } from '../../services/game.service';
import { UserApiService } from '../../services/user-api.service';
import { ProfileOverview, ResultRow } from '../../models/models';
import { ProfileOverviewComponent, clock } from '../../components/profile-overview/profile-overview.component';
import { StatsChartsComponent } from '../../components/stats-charts/stats-charts.component';
import { ResultsTableComponent } from '../../components/results-table/results-table.component';
import { StatsSectionsComponent } from '../../components/stats-sections/stats-sections.component';
import { NO_FILTERS, RECENT_TESTS, StatsFilters, filterRows, summarize, toCsv } from '../../utils/stats-math';

const RANGES: { id: StatsFilters['range']; label: string }[] = [
  { id: 'day', label: 'Last day' },
  { id: 'week', label: 'Last week' },
  { id: 'month', label: 'Last month' },
  { id: '3months', label: 'Last 3 months' },
  { id: 'all', label: 'All time' },
];

/**
 * The player's own statistics: totals, personal bests and activity, then
 * every result charted, filtered and listed. The numbers are the same ones a
 * profile shows, with the history behind them.
 */
@Component({
  selector: 'app-stats',
  imports: [DecimalPipe, ProfileOverviewComponent, StatsChartsComponent, ResultsTableComponent, StatsSectionsComponent],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly gameApi = inject(GameApiService);
  private readonly userApi = inject(UserApiService);
  private readonly gameService = inject(GameService);

  readonly user = this.auth.user;
  readonly loading = this.auth.loading;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly ranges = RANGES;
  readonly overview = signal<ProfileOverview | null>(null);
  readonly rows = signal<ResultRow[]>([]);
  readonly capped = signal(false);
  readonly resultsLoading = signal(true);
  readonly error = signal('');
  readonly filters = signal<StatsFilters>({ ...NO_FILTERS });
  private year: number | null = null;
  private loaded = false;

  /** Results after the filters, oldest first. */
  readonly filtered = computed(() => filterRows(this.rows(), this.filters()));
  readonly summary = computed(() => summarize(this.filtered()));
  readonly filtering = computed(() => JSON.stringify(this.filters()) !== JSON.stringify(NO_FILTERS));
  readonly recentLabel = `last ${RECENT_TESTS} tests`;

  // What there is to choose from, taken from the player's own results.
  readonly timeLimits = computed(() => [...new Set(this.rows().map((r) => r.timeMax))].sort((a, b) => a - b));
  readonly wordCounts = computed(() => [...new Set(this.rows().filter((r) => r.mode === 'words').map((r) => r.words))].sort((a, b) => a - b));
  readonly languages = computed(() => [...new Set(this.rows().map((r) => r.lang ?? 'none'))].sort());

  constructor() {
    effect(() => {
      if (this.isAuthenticated()) void this.auth.refreshProfile();
    });
    // Redirect unauthenticated visitors.
    effect(() => {
      if (!this.isAuthenticated() && !this.auth.loading()) void this.router.navigate(['/']);
    });
    // Wait for any pending guest migration (it adds results) before loading.
    effect(() => {
      const id = this.user()?.id;
      if (id && !this.gameService.isMigrating() && !this.loaded) {
        this.loaded = true;
        void this.loadOverview(id);
        void this.loadRows();
      }
    });
  }

  private async loadOverview(id: string): Promise<void> {
    const res = await this.userApi.getOverview(id, this.year);
    if (res.success && res.data) this.overview.set(res.data);
    else this.error.set(res.error || 'Could not load your statistics');
  }

  private async loadRows(): Promise<void> {
    this.resultsLoading.set(true);
    try {
      const res = await this.gameApi.getResultRows();
      if (res.success && res.data) {
        this.rows.set(res.data.results);
        this.capped.set(res.data.capped);
      } else this.error.set(res.error || 'Could not load your results');
    } finally {
      this.resultsLoading.set(false);
    }
  }

  onYear(year: number | null): void {
    this.year = year;
    const id = this.user()?.id;
    if (id) void this.loadOverview(id);
  }

  setFilter<K extends keyof StatsFilters>(key: K, value: StatsFilters[K]): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  /** A <select>'s value to a filter value: numbers stay numbers, '' means no filter. */
  onSelect<K extends 'mode' | 'time' | 'words' | 'mods' | 'lang' | 'verified' | 'kind'>(key: K, event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    const value = raw === 'all' ? 'all' : key === 'time' || key === 'words' ? Number(raw) : raw;
    this.setFilter(key, value as StatsFilters[K]);
  }

  resetFilters(): void {
    this.filters.set({ ...NO_FILTERS });
  }

  pct(n: number): string {
    return `${Math.round(n)}%`;
  }

  clock(seconds: number): string {
    return clock(seconds);
  }

  /** Downloads the filtered results as a CSV file. */
  exportCsv(): void {
    const blob = new Blob([toCsv(this.filtered())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `typeit-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
