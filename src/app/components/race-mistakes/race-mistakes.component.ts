import { Component, effect, inject, input, signal } from '@angular/core';
import { RaceService } from '../../services/race.service';
import { RaceMistakes, RaceMistakePlayer } from '../../models/models';

/** Errors in a word, bucketed for the heat strip (0 none, 1 one, 2 two or more). */
type Heat = 0 | 1 | 2;

/**
 * Every racer's mistakes in a finished race, side by side: totals, worst keys,
 * and a strip with one cell per word of the shared text.
 */
@Component({
  selector: 'app-race-mistakes',
  templateUrl: './race-mistakes.component.html',
  styleUrl: './race-mistakes.component.css',
})
export class RaceMistakesComponent {
  private readonly race = inject(RaceService);

  /** Race id, or the invite code of the room's latest race. */
  readonly raceRef = input.required<string>();

  readonly data = signal<RaceMistakes | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const ref = this.raceRef();
      let stale = false;
      void this.load(ref, () => stale);
      return () => (stale = true);
    });
  }

  async load(ref = this.raceRef(), isStale: () => boolean = () => false): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const res = await this.race.loadMistakes(ref);
    if (isStale()) return;
    this.loading.set(false);
    if (res.data) this.data.set(res.data);
    else this.error.set(res.error);
  }

  heat(player: RaceMistakePlayer, index: number): Heat {
    const n = player.wordErrors?.[index] ?? 0;
    return n >= 2 ? 2 : n === 1 ? 1 : 0;
  }

  /** "the (2 mistakes)" for a cell's tooltip. */
  cellTitle(player: RaceMistakePlayer, word: string, index: number): string {
    const n = player.wordErrors?.[index] ?? 0;
    return n === 0 ? word : `${word}: ${n} mistake${n === 1 ? '' : 's'}`;
  }

  /** The racer with the fewest mistakes among those with data. */
  cleanest(): string | null {
    const withData = (this.data()?.players ?? []).filter((p) => p.hasData);
    if (withData.length < 2) return null;
    return withData.reduce((a, b) => ((b.mistakes ?? 0) < (a.mistakes ?? 0) ? b : a)).userId;
  }
}
