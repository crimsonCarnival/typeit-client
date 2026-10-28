import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FollowersFollowingModalComponent } from '../../components/followers-following-modal/followers-following-modal.component';
import { membershipAge } from '../../utils/time';
import { TimeDisplayService } from '../../services/time-display.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, FollowersFollowingModalComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly timeDisplay = inject(TimeDisplayService);

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
    return created ? new Date(created).toLocaleDateString() : '\u2014';
  });

  readonly personalBests = computed(() => {
    const s = this.user()?.stats || {};
    return [
      { label: 'Best WPM', value: s.bestWpm || 0 },
      { label: 'High Score', value: s.highScore || 0 },
      { label: 'Best Accuracy', value: `${s.bestAccuracy || 0}%` },
      { label: 'Games Played', value: s.gamesPlayed || 0 },
      { label: 'Total Time Typing', value: this.timeDisplay.format(s.totalTimeTyping || 0) },
      { label: 'AFK Time', value: this.timeDisplay.format(s.afkTime || 0) },
      { label: 'AFK Periods', value: s.afkPeriods || 0 },
    ];
  });

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
