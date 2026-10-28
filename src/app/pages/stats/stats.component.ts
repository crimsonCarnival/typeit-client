import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { GameApiService } from '../../services/game-api.service';
import { StatsSectionsComponent } from '../../components/stats-sections/stats-sections.component';
import { SessionHistoryChartComponent } from '../../components/session-history-chart/session-history-chart.component';
import { SessionSummary } from '../../models/models';
import { TimeDisplayService } from '../../services/time-display.service';

@Component({
  selector: 'app-stats',
  imports: [StatsSectionsComponent, SessionHistoryChartComponent],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent {
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);
  private readonly gameService = inject(GameService);
  private readonly gameApi = inject(GameApiService);
  private readonly timeDisplay = inject(TimeDisplayService);

  readonly user            = this.auth.user;
  readonly loading         = this.auth.loading;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly sessions        = signal<SessionSummary[]>([]);
  readonly historyLoading  = signal(true);
  private historyLoaded    = false;

  readonly overall = computed(() => {
    const s = this.user()?.stats || {};
    return [
      { label: 'Games',             value: s.gamesPlayed || 0 },
      { label: 'Best WPM',          value: s.bestWpm || 0 },
      { label: 'High Score',        value: s.highScore || 0 },
      { label: 'Best Accuracy',     value: `${s.bestAccuracy || 0}%` },
      { label: 'Total Time Typing', value: this.timeDisplay.format(s.totalTimeTyping || 0) },
    ];
  });

  readonly averages = computed(() => {
    const sess = this.sessions();
    if (!sess || sess.length === 0) {
      return [
        { label: 'Avg WPM', value: '-' },
        { label: 'Avg Raw WPM', value: '-' },
        { label: 'Avg Accuracy', value: '-' },
        { label: 'Avg Consistency', value: '-' },
      ];
    }

    let wpmSum = 0;
    let rawSum = 0;
    let accSum = 0;
    let consSum = 0;
    let rawCount = 0;
    let consCount = 0;

    for (const s of sess) {
      wpmSum += s.wpm;
      if (s.rawWpm !== undefined) {
        rawSum += s.rawWpm;
        rawCount++;
      } else {
        rawSum += s.wpm;
        rawCount++;
      }
      accSum += s.accuracy;
      if (s.consistency !== undefined) {
        consSum += s.consistency;
        consCount++;
      }
    }

    const n = sess.length;
    return [
      { label: 'Avg WPM', value: Math.round(wpmSum / n) },
      { label: 'Avg Raw WPM', value: rawCount > 0 ? Math.round(rawSum / rawCount) : '-' },
      { label: 'Avg Accuracy', value: `${(accSum / n).toFixed(1)}%` },
      { label: 'Avg Consistency', value: consCount > 0 ? `${(consSum / consCount).toFixed(1)}%` : '-' },
    ];
  });

  constructor() {
    // Refresh profile stats on page load.
    effect(() => {
      if (this.isAuthenticated()) {
        void this.auth.refreshProfile();
      }
    });

    // Redirect unauthenticated visitors.
    effect(() => {
      if (!this.isAuthenticated() && !this.auth.loading()) {
        void this.router.navigate(['/']);
      }
    });

    // Wait for any pending guest migration before fetching session history.
    // The effect fires immediately if isMigrating() is already false, and
    // again once it transitions false→true→false after a migration.
    effect(() => {
      if (!this.gameService.isMigrating() && !this.historyLoaded) {
        void this.loadHistory();
      }
    });
  }

  private async loadHistory(): Promise<void> {
    this.historyLoaded = true;
    this.historyLoading.set(true);
    try {
      const response = await this.gameApi.getSessionHistory();
      if (response.success && response.data) {
        this.sessions.set(response.data.sessions);
      }
    } finally {
      this.historyLoading.set(false);
    }
  }
}
