import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { PerformanceChartComponent } from '../../components/performance-chart/performance-chart.component';

type Help = 'wpm' | 'accuracy' | 'raw' | 'consistency' | null;

const HELP_TEXT: Record<Exclude<Help, null>, string> = {
  wpm: 'Net words per minute: correct characters only, divided by 5. Typos are excluded.',
  accuracy: 'Correctly typed characters out of every key pressed, including corrected mistakes.',
  raw: 'Every key pressed per minute, divided by 5, before mistakes are taken out.',
  consistency: 'How steady your speed was. 100% is a perfectly even pace; lower means more bursts and stalls.',
};

/** Speed bands for the WPM badge (unchanged from the old results modal). */
const SPEED_TIERS: { max: number; label: string }[] = [
  { max: 25, label: 'Low speed · beginner' },
  { max: 39, label: 'Low speed · still learning' },
  { max: 59, label: 'Medium speed · average' },
  { max: 79, label: 'Medium speed · professional' },
  { max: 99, label: 'High speed · advanced' },
  { max: 119, label: 'High speed · competitive' },
  { max: Infinity, label: 'High speed · elite' },
];

/**
 * Results of the run that just finished (replaces the results modal).
 * Leaving the page by any route starts a fresh text, so the game is never
 * left sitting in a finished state.
 */
@Component({
  selector: 'app-results',
  imports: [PerformanceChartComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ResultsComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly gameState = this.game.gameState;
  readonly results = this.game.results;
  readonly performance = this.game.performance;
  readonly botOutcome = this.game.lastBotOutcome;

  readonly help = signal<Help>(null);
  readonly helpText = computed(() => {
    const h = this.help();
    return h ? HELP_TEXT[h] : '';
  });

  private leaving = false;

  readonly wpm = computed(() => this.results()?.wpm ?? this.gameState().lastWpm ?? 0);
  readonly tier = computed(() => SPEED_TIERS.find((t) => this.wpm() <= t.max)!.label);
  readonly personalBest = computed(() => this.auth.user()?.stats?.bestWpm ?? null);

  readonly elapsed = computed(() => this.results()?.elapsedTime ?? this.gameState().timeMax - this.gameState().timeLeft);
  readonly mistakes = computed(() => this.results()?.mistakes ?? this.gameState().mistakes ?? 0);
  readonly errorRate = computed(() => {
    const secs = this.elapsed();
    return secs > 0 ? (this.mistakes() / (secs / 60)).toFixed(1) : '0.0';
  });
  readonly afkSeconds = computed(() => Number(this.results()?.afkTime ?? 0).toFixed(2));
  readonly afkCount = computed(() => this.results()?.afkCount ?? 0);

  constructor() {
    // Nothing to show (direct visit, reload): back to the game.
    if (!this.gameState().isFinished) {
      this.leaving = true;
      void this.router.navigate(['/play'], { replaceUrl: true });
    }

    // Signing in from here ("Log in & save") resets the game while the guest
    // run is adopted into the account; there's nothing left to show.
    effect(() => {
      if (!this.gameState().isFinished && !this.leaving) {
        this.leaving = true;
        void this.router.navigate(['/play']);
      }
    });
  }

  ngOnDestroy(): void {
    // Back button or nav link: don't leave the game stuck on a finished run.
    if (!this.leaving && this.gameState().isFinished) void this.game.resetGame();
  }

  toggleHelp(h: Exclude<Help, null>): void {
    this.help.set(this.help() === h ? null : h);
  }

  async next(): Promise<void> {
    this.leaving = true;
    this.game.lastBotOutcome.set(null);
    await this.game.resetGame();
    void this.auth.refreshProfile();
    void this.router.navigate(['/play']);
  }

  async retry(): Promise<void> {
    this.leaving = true;
    this.game.lastBotOutcome.set(null);
    await this.game.retrySame();
    void this.auth.refreshProfile();
    void this.router.navigate(['/play']);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.auth.authModal()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      void this.next();
    } else if (event.key === 'Tab' && !event.shiftKey && (document.activeElement === document.body || !document.activeElement)) {
      // Tab retries only when nothing is focused, so keyboard users can still
      // tab through the page's buttons.
      event.preventDefault();
      void this.retry();
    }
  }
}
