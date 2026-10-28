import { Component, DestroyRef, computed, inject, signal, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameApiService } from '../../services/game-api.service';
import { Character, PerformancePoint, Replay } from '../../models/models';
import { DEFAULT_RULES, TypingEngine } from '../../services/game/typing-engine';

const SPEEDS = [0.5, 1, 2, 4];

/**
 * Plays a recorded run back key by key: the keystroke log is replayed
 * through the same input rules the run was typed under. Numbers shown are
 * the server's per-second samples of that run.
 */
@Component({
  selector: 'app-replay',
  imports: [RouterLink],
  templateUrl: './replay.component.html',
  styleUrl: './replay.component.css',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ReplayComponent {
  private readonly api = inject(GameApiService);

  private readonly route = inject(ActivatedRoute);
  private readonly resultId = toSignal(this.route.paramMap.pipe(map((params) => params.get('resultId') || '')), { initialValue: '' });

  readonly replay = signal<Replay | null>(null);
  readonly error = signal('');
  readonly playing = signal(false);
  readonly speed = signal(1);
  readonly speeds = SPEEDS;
  /** Playhead in ms from the run's start. */
  readonly playhead = signal(0);
  readonly characters = signal<Character[]>([]);
  readonly caret = signal(0);

  private engine = new TypingEngine('');
  /** Absolute time of each key, and how many keys the engine has applied. */
  private keyTimes: number[] = [];
  private applied = 0;
  private frame: number | null = null;
  private lastFrameAt = 0;

  readonly duration = computed(() => {
    const r = this.replay();
    if (!r) return 0;
    const last = this.keyTimesOf(r).at(-1) ?? 0;
    return Math.max(last, (r.performance.at(-1)?.timestamp ?? 0) * 1000);
  });

  /** The server's sample for the second the playhead is in. */
  readonly sample = computed<PerformancePoint | null>(() => {
    const perf = this.replay()?.performance ?? [];
    const second = Math.floor(this.playhead() / 1000);
    return second > 0 ? perf[Math.min(second, perf.length) - 1] ?? null : null;
  });

  readonly clock = computed(() => (this.playhead() / 1000).toFixed(1));

  constructor() {
    effect(() => {
      const id = this.resultId();
      if (id) untracked(() => void this.load(id));
    });
    inject(DestroyRef).onDestroy(() => this.pause());
  }

  private keyTimesOf(r: Replay): number[] {
    let t = r.leadMs || 0;
    return r.keystrokes.map(([gap]) => (t += gap));
  }

  async load(id: string): Promise<void> {
    this.pause();
    this.error.set('');
    const res = await this.api.getReplay(id);
    if (!res.success || !res.data) {
      this.error.set(res.error || 'Replay not found');
      return;
    }
    this.replay.set(res.data);
    this.keyTimes = this.keyTimesOf(res.data);
    this.seek(0);
  }

  /** Rebuilds the text as it stood at `ms`. */
  seek(ms: number): void {
    const r = this.replay();
    if (!r) return;
    const target = Math.max(0, Math.min(ms, this.duration()));
    if (target < this.playhead() || this.applied === 0) {
      this.engine = new TypingEngine(r.text, { ...DEFAULT_RULES, ...r.rules });
      this.applied = 0;
    }
    while (this.applied < this.keyTimes.length && this.keyTimes[this.applied] <= target) {
      this.engine.apply(r.keystrokes[this.applied][1]);
      this.applied++;
    }
    this.playhead.set(target);
    this.characters.set(this.engine.characters());
    this.caret.set(this.engine.position);
  }

  play(): void {
    if (!this.replay()) return;
    if (this.playhead() >= this.duration()) this.restart();
    this.playing.set(true);
    this.lastFrameAt = performance.now();
    const step = (now: number) => {
      if (!this.playing()) return;
      this.seek(this.playhead() + (now - this.lastFrameAt) * this.speed());
      this.lastFrameAt = now;
      if (this.playhead() >= this.duration()) {
        this.playing.set(false);
        return;
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  pause(): void {
    this.playing.set(false);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  toggle(): void {
    if (this.playing()) this.pause();
    else this.play();
  }

  restart(): void {
    this.applied = 0;
    this.playhead.set(0);
    this.seek(0);
  }

  onScrub(event: Event): void {
    this.seek(Number((event.target as HTMLInputElement).value));
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.target as HTMLElement)?.closest('input, button, a')) return;
    if (event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }
  }

  charClass(c: Character, i: number): string {
    return i === this.caret() ? `${c.status} active` : c.status;
  }
}
