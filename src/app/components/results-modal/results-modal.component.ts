import { Component, computed, DestroyRef, inject, input, output } from '@angular/core';
import { GameState, PerformancePoint, Results } from '../../models/models';
import { PerformanceChartComponent } from '../performance-chart/performance-chart.component';

@Component({
  selector: 'app-results-modal',
  imports: [PerformanceChartComponent],
  templateUrl: './results-modal.component.html',
  styleUrl: './results-modal.component.css',
})
export class ResultsModalComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly gameState = input<GameState | null>(null);
  readonly results = input<Results | null>(null);
  readonly performance = input<PerformancePoint[]>([]);
  readonly isAuthenticated = input(false);

  readonly close = output<void>();
  readonly loginClick = output<void>();

  readonly elapsed = computed(() => (this.gameState()?.timeMax ?? 0) - (this.gameState()?.timeLeft ?? 0));
  readonly afkTime = computed(() => this.results()?.afkTime || 0);
  readonly afkCount = computed(() => this.results()?.afkCount || 0);

  readonly configCaption = computed(() => {
    const gs = this.gameState();
    if (!gs) return '';
    const mode = gs.gameMode === 'words' ? `words · ${gs.wordCount}` : 'phrases';
    return `${mode} · ${gs.timeMax}s`;
  });

  readonly heroStats = computed(() => {
    const gs = this.gameState();
    const r = this.results();
    const wpm = r?.wpm ?? gs?.lastWpm ?? 0;
    return [
      {
        label: 'WPM',
        value: wpm,
        highlight: true,
        wpmTier: this.getWpmTier(wpm),
        tooltip: 'Net words per minute — correct characters only, divided by 5. Backspaces and typos are excluded from this count.',
      },
      {
        label: 'Accuracy',
        value: `${r?.accuracy ?? gs?.accuracy ?? 0}%`,
        tooltip: 'Percentage of correctly typed characters out of total keystrokes (including backspaces).',
      },
      {
        label: 'Raw WPM',
        value: r?.rawWpm ?? 0,
        tooltip: 'All keystrokes per minute divided by 5, regardless of mistakes. Reflects raw typing speed before error correction.',
      },
      {
        label: 'Consistency',
        value: `${r?.consistency || 0}%`,
        tooltip: 'How stable your speed was throughout the test. 100% means perfectly constant pace; lower values indicate more variation between fast and slow moments.',
      },
    ];
  });

  private getWpmTier(wpm: number) {
    if (wpm <= 25) {
      return {
        category: 'Low Speed',
        label: 'Beginner / Hunt & Peck',
        desc: '0–25 WPM – Often uses a few fingers, looking at the keyboard constantly.',
        color: '#9ca3af',
        bg: 'rgba(156, 163, 175, 0.12)',
        borderColor: 'rgba(156, 163, 175, 0.35)',
      };
    }
    if (wpm <= 39) {
      return {
        category: 'Low Speed',
        label: 'Slow / Learning',
        desc: '26–39 WPM – Basic functional typing, building muscle memory.',
        color: '#9ca3af',
        bg: 'rgba(156, 163, 175, 0.15)',
        borderColor: 'rgba(156, 163, 175, 0.4)',
      };
    }
    if (wpm <= 59) {
      return {
        category: 'Medium Speed',
        label: 'Average',
        desc: '40–59 WPM – Typical range for everyday adults, good for emails and basic tasks.',
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.14)',
        borderColor: 'rgba(34, 197, 94, 0.45)',
      };
    }
    if (wpm <= 79) {
      return {
        category: 'Medium Speed',
        label: 'Good / Professional',
        desc: '60–79 WPM – Smooth and above average, ideal for standard office jobs.',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.14)',
        borderColor: 'rgba(59, 130, 246, 0.45)',
      };
    }
    if (wpm <= 99) {
      return {
        category: 'High Speed',
        label: 'Advanced / Expert',
        desc: '80–100 WPM – Found among professional transcriptionists, coders, and data entry clerks.',
        color: '#a855f7',
        bg: 'rgba(168, 85, 247, 0.14)',
        borderColor: 'rgba(168, 85, 247, 0.45)',
      };
    }
    if (wpm <= 119) {
      return {
        category: 'High Speed',
        label: 'Competitive',
        desc: '100–120 WPM – Speeds reached by specialized typists and keyboard enthusiasts.',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.14)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
      };
    }
    return {
      category: 'High Speed',
      label: 'Elite',
      desc: '120+ WPM – Top-tier speeds reached by specialized typists and keyboard enthusiasts.',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.16)',
      borderColor: 'rgba(239, 68, 68, 0.5)',
    };
  }

  readonly stats = computed(() => {
    const gs = this.gameState();
    const r = this.results();
    const elapsed = (gs?.timeMax ?? 0) - (gs?.timeLeft ?? 0);
    
    const mistakes = r?.mistakes ?? gs?.mistakes ?? 0;
    const timeSecs = r?.elapsedTime ?? elapsed ?? 1;
    const errorRate = timeSecs > 0 ? (mistakes / (timeSecs / 60)).toFixed(1) : '0.0';

    return [
      { label: 'Score', value: gs?.score ?? 0, tooltip: 'Overall score based on WPM, accuracy, and combo multipliers' },
      { label: 'Highest WPM', value: r?.highestWpm ?? gs?.lastWpm ?? 0, tooltip: 'Peak words per minute reached at any point during the test' },
      { label: 'CPM', value: r?.cpm ?? gs?.lastCpm ?? 0, tooltip: 'Correct characters typed per minute' },
      { label: 'Char', value: `${r?.successes ?? gs?.successes ?? 0} / ${mistakes} / 0 / ${r?.missed ?? 0}`, tooltip: 'Correct / Incorrect / Extra / Missed characters' },
      { label: 'Error Rate', value: errorRate, tooltip: 'Average number of errors per minute' },
      { label: 'Errors', value: mistakes, tooltip: 'Total incorrect keystrokes' },
      { label: 'Words', value: r?.totalWords ?? gs?.totalWords ?? 0, tooltip: 'Total number of words completed during the test' },
      { label: 'Time', value: `${r?.elapsedTime ?? elapsed}s`, tooltip: 'How long you were actively typing' },
    ];
  });

  constructor() {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close.emit();
      }
    };
    window.addEventListener('keydown', handleEsc);
    this.destroyRef.onDestroy(() => window.removeEventListener('keydown', handleEsc));
  }
}
