import { Component, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FollowListUser } from '../../models/models';
import { UserApiService } from '../../services/user-api.service';

@Component({
  selector: 'app-followers-following-modal',
  imports: [RouterLink],
  templateUrl: './followers-following-modal.component.html',
  styleUrl: './followers-following-modal.component.css',
})
export class FollowersFollowingModalComponent {
  private readonly api = inject(UserApiService);

  readonly title = input('Followers');
  readonly userId = input('');
  readonly close = output<void>();

  readonly users = signal<FollowListUser[] | null>(null);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const id = this.userId();
      if (!id) return;
      let cancelled = false;

      this.users.set(null);
      this.error.set('');

      const request = this.title() === 'Followers'
        ? this.api.getFollowers(id)
        : this.api.getFollowing(id);

      request
        .then((response) => {
          if (cancelled) return;
          if (response.success) this.users.set(response.data || []);
          else this.error.set(response.error || 'Failed to load users');
        })
        .catch((err) => {
          if (!cancelled) this.error.set(err?.message || 'Failed to load users');
        });

      return () => {
        cancelled = true;
      };
    });
  }

  handleOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  avatarText(user: FollowListUser): string {
    return (user.displayName || user.username || '?').charAt(0).toUpperCase();
  }
}
