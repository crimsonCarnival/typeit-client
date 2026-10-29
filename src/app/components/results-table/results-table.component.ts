import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResultRow } from '../../models/models';
import { TimezoneService } from '../../services/timezone.service';
import { personalBestIds } from '../../utils/stats-math';

const PAGE = 50;

/** Every saved result, newest first: speed, accuracy, characters, what was typed and when. */
@Component({
  selector: 'app-results-table',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './results-table.component.html',
  styleUrl: './results-table.component.css',
})
export class ResultsTableComponent {
  private readonly tz = inject(TimezoneService);

  /** Results to list, oldest first (already filtered). */
  readonly rows = input.required<ResultRow[]>();
  /** All of the player's results, oldest first, to tell which set a personal best. */
  readonly history = input.required<ResultRow[]>();

  readonly shownCount = signal(PAGE);
  readonly bests = computed(() => personalBestIds(this.history()));
  readonly newestFirst = computed(() => [...this.rows()].reverse());
  readonly visible = computed(() => this.newestFirst().slice(0, this.shownCount()));
  readonly hasMore = computed(() => this.shownCount() < this.newestFirst().length);

  more(): void {
    this.shownCount.update((n) => n + PAGE);
  }

  /** "words 50 · 60s", "phrases", "code · 60s". */
  modeLabel(r: ResultRow): string {
    if (r.mode === 'phrases') return 'phrases';
    return r.mode === 'words' ? `words ${r.words} · ${r.timeMax}s` : `${r.mode} · ${r.timeMax}s`;
  }

  date(r: ResultRow): string {
    return this.tz.date(r.t);
  }

  time(r: ResultRow): string {
    return this.tz.date(r.t, { dateStyle: undefined, timeStyle: 'short' });
  }

  /** Short notes on what kind of run it was, for the info column. */
  info(r: ResultRow): { text: string; title: string }[] {
    const notes: { text: string; title: string }[] = [];
    if (r.lang) notes.push({ text: r.lang.slice(0, 2).toUpperCase(), title: `Language: ${r.lang}` });
    if (r.mods === 'punctuation' || r.mods === 'both') notes.push({ text: '.,', title: 'Punctuation on' });
    if (r.mods === 'numbers' || r.mods === 'both') notes.push({ text: '123', title: 'Numbers on' });
    if (r.practice) notes.push({ text: 'practice', title: `Practice run (${r.practice}), not ranked` });
    if (r.daily) notes.push({ text: 'daily', title: 'Daily challenge' });
    if (r.flagged) notes.push({ text: 'flagged', title: 'The integrity checks flagged this run' });
    else if (r.verified) notes.push({ text: 'verified', title: 'Passed the integrity checks and counts for rankings' });
    return notes;
  }
}
