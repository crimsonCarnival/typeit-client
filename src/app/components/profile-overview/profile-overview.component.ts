import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { ProfileOverview } from '../../models/models';
import { ActivityHeatmapComponent } from '../activity-heatmap/activity-heatmap.component';

/** Seconds as hh:mm:ss. */
export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

// The slots the server fills, in order (mirrors PB_TIME_LIMITS / PB_WORD_COUNTS in the server's stats.service.js).
const TIME_LIMITS = [15, 30, 60, 90, 120];
const WORD_COUNTS = [10, 25, 50, 75, 100];

/**
 * What every profile shows: tests started and completed, time typing, the
 * best speed and accuracy per time limit and word count, and the activity
 * graph. The same numbers for the player's own profile, a public profile and
 * the stats page.
 */
@Component({
  selector: 'app-profile-overview',
  imports: [ActivityHeatmapComponent, DecimalPipe],
  templateUrl: './profile-overview.component.html',
  styleUrl: './profile-overview.component.css',
})
export class ProfileOverviewComponent {
  readonly overview = input.required<ProfileOverview>();
  /** Lets the activity graph switch between the last 12 months and a calendar year. */
  readonly yearChange = output<number | null>();

  readonly totals = computed(() => this.overview().totals);
  readonly timeTyping = computed(() => clock(this.totals().timeTyping));

  readonly groups = computed(() => [
    { id: 'time', title: 'By time limit', unit: ' seconds', limits: TIME_LIMITS, slots: this.overview().personalBests.time },
    { id: 'words', title: 'By word count', unit: ' words', limits: WORD_COUNTS, slots: this.overview().personalBests.words },
  ]);

  /** Whether the player has a personal best anywhere. */
  readonly hasBests = computed(() => this.groups().some((g) => g.slots.some((s) => s)));
}
