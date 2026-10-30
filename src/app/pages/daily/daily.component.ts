import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { GameService } from '../../services/game.service';
import { DISPLAY_LOCALE, TimezoneService } from '../../services/timezone.service';
import { DailyDayModalComponent } from '../../components/daily-day-modal/daily-day-modal.component';
import { DailyOverview } from '../../models/models';
import { UsageService } from '../../services/usage.service';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

@Component({
  selector: 'app-daily',
  imports: [RouterLink, DailyDayModalComponent],
  templateUrl: './daily.component.html',
  styleUrl: './daily.component.css',
  host: { '(document:keydown.enter)': 'onEnter($event)' },
})
export class DailyComponent {
  readonly auth = inject(AuthService);
  private readonly gameApi = inject(GameApiService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly tz = inject(TimezoneService);
  private readonly usage = inject(UsageService);

  readonly data = signal<DailyOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly starting = signal(false);
  readonly startError = signal('');
  private readonly now = signal(Date.now());

  readonly status = computed(() => {
    if (!this.auth.isAuthenticated()) return 'guest';
    return this.data()?.me?.status ?? 'not-played';
  });

  readonly countdown = computed(() => {
    const d = this.data();
    if (!d) return '';
    const ms = Math.max(0, Date.parse(d.resetsAt) - this.now());
    const s = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  });

  /** When the next challenge starts on the player's clock, e.g. "02:00 GMT+2". */
  readonly resetLocal = computed(() => {
    const d = this.data();
    if (!d) return '';
    const at = new Date(d.resetsAt);
    return `${new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeStyle: 'short', timeZone: this.tz.zone() }).format(at)} ${this.tz.label(at)}`;
  });

  readonly modifierLabel = computed(() => {
    const s = this.data()?.settings;
    if (!s) return '';
    if (s.punctuationEnabled && s.numbersEnabled) return 'Punct + num';
    if (s.punctuationEnabled) return 'Punct.';
    if (s.numbersEnabled) return 'Numbers';
    return 'None';
  });

  constructor() {
    effect(() => {
      // Reload when sign-in state changes: `me` depends on it.
      this.auth.isAuthenticated();
      void this.load();
    });

    const tick = setInterval(() => {
      this.now.set(Date.now());
      // Day rolled over while the page was open: fetch the new challenge.
      const d = this.data();
      if (d && Date.now() >= Date.parse(d.resetsAt) && !this.loading()) void this.load();
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const res = await this.gameApi.getDaily();
    this.loading.set(false);
    if (res.success && res.data) {
      this.data.set(res.data);
      // Signed in from the Start button: start now that we know whether today is still open.
      if (this.auth.isAuthenticated() && this.auth.takeAction('daily:start') !== null) void this.start();
    } else this.error.set(res.error || 'Could not load the daily challenge');
  }

  async start(): Promise<void> {
    if (this.status() === 'guest') {
      this.auth.openAuthModal('login', '/daily', 'daily:start');
      return;
    }
    if (this.status() !== 'not-played' || this.starting()) return;
    this.starting.set(true);
    this.startError.set('');
    const res = await this.game.startDaily();
    this.starting.set(false);
    if (res.success) {
      void this.router.navigate(['/play/daily']);
    } else {
      this.startError.set(res.error || 'Could not start the challenge');
      void this.load();
    }
  }

  /** The past day whose details are open ('YYYY-MM-DD'), or null. */
  readonly openedDay = signal<string | null>(null);

  openDay(date: string): void {
    this.openedDay.set(date);
    this.usage.track('daily:past-day');
  }

  readonly startingGhost = signal(false);
  readonly ghostError = signal('');

  /** Practice run on today's text against the leader's ghost (after your attempt). */
  async raceGhost(): Promise<void> {
    if (this.startingGhost()) return;
    this.startingGhost.set(true);
    this.ghostError.set('');
    const res = await this.game.raceDailyGhost();
    this.startingGhost.set(false);
    if (res.success) void this.router.navigate(['/play/daily']);
    else this.ghostError.set(res.error || 'Could not start the ghost race');
  }

  onEnter(event: Event): void {
    const target = event.target as HTMLElement | null;
    // Leave Enter alone in form fields and on focused buttons/links.
    if (target?.closest('input, textarea, select, button, a, [contenteditable]')) return;
    if (this.auth.authModal()) return;
    void this.start();
  }

  dayLabel(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
  }

  longDate(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    const day = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][d.getUTCDay()];
    return `${day} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  dayNumber(date: string): number {
    return new Date(`${date}T00:00:00Z`).getUTCDate();
  }

  /** Past days are shown oldest first, ending with today. */
  pastDaysChronological() {
    return [...(this.data()?.pastDays ?? [])].reverse();
  }
}
