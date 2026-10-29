import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StaffRingDirective } from '../../components/staff-ring/staff-ring.directive';
import { AuthService } from '../../services/auth.service';
import { FollowersFollowingModalComponent } from '../../components/followers-following-modal/followers-following-modal.component';
import { membershipAge } from '../../utils/time';
import { RaceService } from '../../services/race.service';
import { RaceMistakesComponent } from '../../components/race-mistakes/race-mistakes.component';
import { TimezoneService } from '../../services/timezone.service';
import { TimeDisplayService } from '../../services/time-display.service';
import { UserApiService } from '../../services/user-api.service';
import { ProfileOverviewComponent } from '../../components/profile-overview/profile-overview.component';
import { ProfileOverview, RaceHistoryEntry, TestOutcomes, UserStats } from '../../models/models';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, FollowersFollowingModalComponent, RaceMistakesComponent, StaffRingDirective, ProfileOverviewComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly timeDisplay = inject(TimeDisplayService);
  private readonly tz = inject(TimezoneService);
  private readonly userApi = inject(UserApiService);

  /** Started / abandoned / finished (approved, failed), from the server. */
  readonly outcomes = signal<TestOutcomes | null>(null);
  /** Totals, personal bests and the activity graph. */
  readonly overview = signal<ProfileOverview | null>(null);
  private year: number | null = null;

  async loadOverview(): Promise<void> {
    const id = this.user()?.id;
    if (!id) return;
    const res = await this.userApi.getOverview(id, this.year);
    if (res.success && res.data) this.overview.set(res.data);
  }

  onYear(year: number | null): void {
    this.year = year;
    void this.loadOverview();
  }
  private readonly raceService = inject(RaceService);

  readonly races = signal<RaceHistoryEntry[]>([]);
  /** The race whose mistake comparison is expanded. */
  readonly openRace = signal<string | null>(null);

  raceDate(value: string): string {
    return this.tz.dateTime(value);
  }

  raceLength(r: RaceHistoryEntry): string {
    return r.mode === 'time' ? `${r.timeLimit}s timed` : r.mode === 'phrases' ? 'Phrase' : `${r.wordCount} words`;
  }

  readonly user = this.auth.user;
  readonly loading = this.auth.loading;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly formatMode = this.timeDisplay.formatMode;

  toggleTimeFormat(): void {
    this.timeDisplay.toggleFormat();
  }

  readonly displayName = computed(() => this.user()?.displayName || this.user()?.username || '');
  readonly age = computed(() => membershipAge(this.user()?.createdAt));
  readonly joined = computed(() => {
    const created = this.user()?.createdAt;
    return created ? this.tz.date(created) : '\u2014';
  });

  readonly s = computed<Partial<UserStats>>(() => this.user()?.stats ?? {});

  /** Durations in the chosen time format (1m 24s or 84s). */
  fmt(seconds: number): string {
    return this.timeDisplay.format(seconds);
  }

  readonly editing = signal(false);
  readonly editDisplayName = signal('');
  readonly editBio = signal('');
  readonly editError = signal('');
  readonly saving = signal(false);
  readonly modal = signal<'followers' | 'following' | null>(null);

  constructor() {
    effect(() => {
      if (this.isAuthenticated()) {
        void this.auth.refreshProfile();
        void this.raceService.loadHistory().then((races) => this.races.set(races));
        void this.userApi.getMyOutcomes().then((res) => res.data && this.outcomes.set(res.data));
        void this.loadOverview();
      }
    });
    effect(() => {
      if (!this.isAuthenticated() && !this.auth.loading()) {
        void this.router.navigate(['/']);
      }
    });
    effect(() => {
      if (this.editing() && this.user()) {
        this.editDisplayName.set(this.user()?.displayName || this.user()?.username || '');
        this.editBio.set(this.user()?.bio || '');
      }
    });
  }

  onEditDisplayName(event: Event): void {
    this.editDisplayName.set((event.target as HTMLInputElement).value);
  }

  onEditBio(event: Event): void {
    this.editBio.set((event.target as HTMLInputElement).value);
  }

  async handleSave(event: Event): Promise<void> {
    event.preventDefault();
    this.editError.set('');
    this.saving.set(true);
    try {
      const result = await this.auth.updateProfile({
        displayName: this.editDisplayName().trim() || this.user()?.username || '',
        bio: this.editBio().trim(),
      });
      if (result.success) {
        this.editing.set(false);
        void this.auth.refreshProfile();
      } else {
        this.editError.set(result.error || 'Failed to save');
      }
    } catch (err) {
      this.editError.set(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      this.saving.set(false);
    }
  }
}
