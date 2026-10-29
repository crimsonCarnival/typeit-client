import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { StaffRingDirective } from '../../components/staff-ring/staff-ring.directive';
import { ProfileOverviewComponent } from '../../components/profile-overview/profile-overview.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { TimezoneService } from '../../services/timezone.service';
import { AuthService } from '../../services/auth.service';
import { UserApiService } from '../../services/user-api.service';
import { ProfileOverview, PublicProfile } from '../../models/models';
import { FollowersFollowingModalComponent } from '../../components/followers-following-modal/followers-following-modal.component';
import { StatsSectionsComponent } from '../../components/stats-sections/stats-sections.component';
import { membershipAge } from '../../utils/time';

@Component({
  selector: 'app-public-profile',
  imports: [RouterLink, FollowersFollowingModalComponent, StatsSectionsComponent, StaffRingDirective, ProfileOverviewComponent],
  templateUrl: './public-profile.component.html',
  styleUrl: './public-profile.component.css',
})
export class PublicProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly tz = inject(TimezoneService);
  private readonly api = inject(UserApiService);

  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly profile = signal<PublicProfile | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);
  readonly modal = signal<'followers' | 'following' | null>(null);
  readonly copied = signal(false);
  followingPending = false;

  private readonly userId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('userId') || ''))
  );

  readonly age = computed(() => membershipAge(this.profile()?.createdAt));
  readonly joined = computed(() => {
    const created = this.profile()?.createdAt;
    return created ? this.tz.date(created) : '';
  });

  readonly publicStats = computed(() => {
    const s = this.profile()?.stats || {};
    const o = this.profile()?.outcomes;
    return [
      { label: 'Best WPM', value: s.bestWpm || 0 },
      { label: 'High Score', value: s.highScore || 0 },
      { label: 'Best Accuracy', value: `${s.bestAccuracy || 0}%` },
      ...(o
        ? [
            { label: 'Abandoned', value: o.abandoned },
            { label: 'Approved', value: o.approved },
            { label: 'Failed', value: o.failed },
          ]
        : [{ label: 'Tests finished', value: s.gamesPlayed || 0 }]),
    ];
  });

  /** Totals, personal bests and the activity graph. */
  readonly overview = signal<ProfileOverview | null>(null);
  private year: number | null = null;

  private loadOverview(id: string): void {
    void this.api.getOverview(id, this.year).then((res) => {
      // A slow answer for the player we just left must not replace the one on screen.
      if (res.success && res.data && this.userId() === id) this.overview.set(res.data);
    });
  }

  onYear(year: number | null): void {
    this.year = year;
    const id = this.userId();
    if (id) this.loadOverview(id);
  }

  constructor() {
    effect(() => {
      const id = this.userId();
      if (!id) return;
      let cancelled = false;
      this.overview.set(null);
      this.year = null;
      this.loadOverview(id);

      this.loading.set(true);
      this.error.set('');

      this.api
        .getPublicProfile(id)
        .then((response) => {
          if (cancelled) return;
          if (response.success) this.profile.set(response.data ?? null);
          else this.error.set(response.error || 'User not found');
        })
        .catch((err) => {
          if (!cancelled) this.error.set(err?.message || 'User not found');
        })
        .finally(() => {
          if (!cancelled) this.loading.set(false);
        });

      return () => {
        cancelled = true;
      };
    });
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard can be blocked; the URL is in the address bar.
    }
  }

  readonly blockPending = signal(false);

  /**
   * Blocks or unblocks this player. Blocking asks first: it also removes
   * follows both ways, and stops race invites and chat between you.
   */
  async toggleBlock(): Promise<void> {
    const p = this.profile();
    if (!p || p.isOwner || this.blockPending()) return;
    const next = !p.isBlocked;
    if (next && !confirm(`Block ${p.displayName}? You will stop following each other, and you won't see their race chat or invites.`)) return;
    this.blockPending.set(true);
    const res = await this.api.setBlocked(p.id, next);
    this.blockPending.set(false);
    if (!res.success) {
      this.error.set(res.error || 'Something went wrong');
      return;
    }
    this.profile.update((prev) => prev && { ...prev, isBlocked: next, isFollowing: next ? false : prev.isFollowing });
    void this.auth.refreshProfile();
  }

  async handleFollowToggle(): Promise<void> {
    const profile = this.profile();
    if (!this.isAuthenticated() || !profile || profile.isOwner) return;
    this.followingPending = true;
    try {
      const response = profile.isFollowing
        ? await this.api.unfollowUser(profile.id)
        : await this.api.followUser(profile.id);
      if (response.success) {
        this.profile.update((prev) => prev && ({
          ...prev,
          isFollowing: response.data!.isFollowing,
          followersCount: response.data!.followersCount,
        }));
        void this.auth.refreshProfile();
      } else {
        this.error.set(response.error || 'Something went wrong');
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      this.followingPending = false;
    }
  }
}
