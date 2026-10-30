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
    this.resumeAction();
    // The recommendation is optional: no key data simply hides the banner.
    this.weakest.set(map.success ? map.data?.keys.find((k) => k.errors > 0) ?? null : null);
  }

  keyLabel(key: string): string {
    return key === ' ' ? 'Space' : key.toUpperCase();
  }

  /** Asks a guest to sign up; once signed in, `action` runs (see resumeAction) or `returnTo` opens. */
  private requireAccount(action?: string, returnTo = '/learn'): boolean {
    if (this.auth.isAuthenticated()) return true;
    this.auth.openAuthModal('register', returnTo, action && `learn:${action}`);
    return false;
  }

  /** Runs what a guest clicked before signing in, once the lessons are loaded. */
  private resumeAction(): void {
    const action = this.auth.takeAction('learn:');
    if (action === 'common') this.startCommonWords();
    else if (action === 'review') this.startReview();
    else if (action?.startsWith('lesson:')) {
      const id = action.slice('lesson:'.length);
      this.startLesson(this.overview()?.lessons.find((l) => l.id === id) ?? this.nextLesson());
    }
  }

  private async run(id: string, start: () => Promise<{ success: boolean; error?: string }>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(id);
    const res = await start();
    this.busy.set(null);
    if (res.success) void this.router.navigate(['/play/practice']);
    else this.error.set(res.error || 'Could not start');
  }

  startLesson(lesson: Lesson | null = this.nextLesson()): void {
    if (!this.requireAccount(`lesson:${lesson?.id ?? ''}`)) return;
    const label = lesson ? `Lesson ${lesson.number}/12 · ${lesson.title}` : 'Lesson';
    void this.run(`lesson:${lesson?.id ?? 'next'}`, () => this.game.startPractice('lesson', lesson?.id, label));
  }

  startCommonWords(): void {
    if (!this.requireAccount('common')) return;
    void this.run('common', () => this.game.startPractice('common-words', undefined, 'Common words'));
  }

  startReview(): void {
    if (!this.requireAccount('review')) return;
    void this.run('review', () => this.game.startPractice('review', undefined));
  }

  /** "today", "tomorrow" or "in N days" for the next review. */
  nextReview(at: string | null): string {
    if (!at) return 'soon';
    const days = Math.ceil((Date.parse(at) - Date.now()) / 86_400_000);
    return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  }

  drillWeakest(): void {
    const key = this.weakest()?.key;
    if (key === undefined) return;
    void this.run('drill', () => this.game.startDrill(key));
  }

  raceBot(): void {
    this.game.setBot(this.botWpm());
    void this.router.navigate(['/play/bot-race']);
  }

  openLists(): void {
    if (!this.requireAccount(undefined, '/learn/lists')) return;
    void this.router.navigate(['/learn/lists']);
  }
}
