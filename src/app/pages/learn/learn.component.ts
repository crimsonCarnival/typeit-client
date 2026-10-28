import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { GameService } from '../../services/game.service';
import { ErrorMapKey, LearnOverview, Lesson } from '../../models/models';

const BOT_SPEEDS = [40, 60, 80, 100];
// The recommendation looks at the same window as the error map's default.
const RECOMMEND_RUNS = 20;

@Component({
  selector: 'app-learn',
  imports: [RouterLink],
  templateUrl: './learn.component.html',
  styleUrl: './learn.component.css',
})
export class LearnComponent {
  readonly auth = inject(AuthService);
  private readonly gameApi = inject(GameApiService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly botSpeeds = BOT_SPEEDS;
  readonly botWpm = signal(60);

  readonly overview = signal<LearnOverview | null>(null);
  readonly weakest = signal<ErrorMapKey | null>(null);
  readonly error = signal('');
  readonly busy = signal<string | null>(null);

  readonly nextLesson = computed<Lesson | null>(() => {
    const o = this.overview();
    return o?.lessons.find((l) => l.id === o.nextLessonId) ?? null;
  });
  readonly lessonsDone = computed(() => this.overview()?.lessons.filter((l) => l.completed).length ?? 0);

  constructor() {
    effect(() => {
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.load();
    });
  }

  async load(): Promise<void> {
    this.error.set('');
    const [learn, map] = await Promise.all([this.gameApi.getLearn(), this.gameApi.getErrorMap(RECOMMEND_RUNS)]);
    if (learn.success && learn.data) this.overview.set(learn.data);
    else this.error.set(learn.error || 'Could not load lessons');
    // The recommendation is optional: no key data simply hides the banner.
    this.weakest.set(map.success ? map.data?.keys.find((k) => k.errors > 0) ?? null : null);
  }

  keyLabel(key: string): string {
    return key === ' ' ? 'Space' : key.toUpperCase();
  }

  private requireAccount(): boolean {
    if (this.auth.isAuthenticated()) return true;
    this.auth.openAuthModal('register');
    return false;
  }

  private async run(id: string, start: () => Promise<{ success: boolean; error?: string }>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(id);
    const res = await start();
    this.busy.set(null);
    if (res.success) void this.router.navigate(['/play']);
    else this.error.set(res.error || 'Could not start');
  }

  startLesson(lesson: Lesson | null = this.nextLesson()): void {
    if (!this.requireAccount()) return;
    const label = lesson ? `Lesson ${lesson.number}/12 · ${lesson.title}` : 'Lesson';
    void this.run(`lesson:${lesson?.id ?? 'next'}`, () => this.game.startPractice('lesson', lesson?.id, label));
  }

  startCommonWords(): void {
    if (!this.requireAccount()) return;
    void this.run('common', () => this.game.startPractice('common-words', undefined, 'Common words'));
  }

  drillWeakest(): void {
    const key = this.weakest()?.key;
    if (key === undefined) return;
    void this.run('drill', () => this.game.startDrill(key));
  }

  raceBot(): void {
    this.game.setBot(this.botWpm());
    void this.router.navigate(['/play']);
  }

  openLists(): void {
    if (!this.requireAccount()) return;
    void this.router.navigate(['/learn/lists']);
  }
}
