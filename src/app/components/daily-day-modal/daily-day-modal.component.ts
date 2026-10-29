import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { DailyDay } from '../../models/models';

/** A past daily challenge's settings, turnout and leaderboard. */
@Component({
  selector: 'app-daily-day-modal',
  imports: [RouterLink],
  templateUrl: './daily-day-modal.component.html',
  styleUrl: './daily-day-modal.component.css',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class DailyDayModalComponent {
  private readonly api = inject(GameApiService);
  readonly auth = inject(AuthService);

  /** 'YYYY-MM-DD' (UTC). */
  readonly date = input.required<string>();
  /** Heading, formatted by the page in the player's time zone. */
  readonly title = input('');
  readonly closed = output<void>();

  readonly day = signal<DailyDay | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly finishRate = computed(() => {
    const d = this.day();
    return d && d.started ? Math.round((d.finished / d.started) * 100) : null;
  });

  readonly modifiers = computed(() => {
    const s = this.day()?.settings;
    if (!s) return '';
    if (s.punctuationEnabled && s.numbersEnabled) return 'punctuation + numbers';
    if (s.punctuationEnabled) return 'punctuation';
    if (s.numbersEnabled) return 'numbers';
    return 'plain words';
  });

  constructor() {
    effect(() => {
      const date = this.date();
      let stale = false;
      this.loading.set(true);
      this.error.set('');
      void this.api.getDailyDay(date).then((res) => {
        if (stale) return;
        this.loading.set(false);
        if (res.success && res.data) this.day.set(res.data);
        else this.error.set(res.error || 'Could not load that day');
      });
      return () => (stale = true);
    });
  }
}
