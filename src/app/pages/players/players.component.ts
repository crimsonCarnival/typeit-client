import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserApiService } from '../../services/user-api.service';
import { PlayerSearchResult } from '../../models/models';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;
const AVATAR_COLORS = 8; // --color-avatar-1 .. --color-avatar-8

/**
 * Find players by username or display name and open their profiles. The
 * query lives in the URL (?q=) so a search can be shared or reloaded.
 */
import { StaffRingDirective } from '../../components/staff-ring/staff-ring.directive';
@Component({
  selector: 'app-players',
  imports: [RouterLink, StaffRingDirective],
  templateUrl: './players.component.html',
  styleUrl: './players.component.css',
})
export class PlayersComponent {
  private readonly api = inject(UserApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly query = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly results = signal<PlayerSearchResult[]>([]);
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly error = signal('');
  readonly minQuery = MIN_QUERY;

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Ignores answers to queries that were typed over. */
  private latest = 0;

  constructor() {
    if (this.query().trim().length >= MIN_QUERY) void this.search(this.query());
    // Ready to type on arrival (autofocus only works on a full page load).
    afterNextRender(() => this.input()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(value), DEBOUNCE_MS);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.timer) clearTimeout(this.timer);
    const first = this.results()[0];
    // Enter on an exact username opens that profile straight away.
    if (first && first.username.toLowerCase() === this.query().trim().replace(/^@/, '').toLowerCase()) {
      void this.router.navigate(['/user', first.id]);
      return;
    }
    void this.search(this.query());
  }

  async search(raw: string): Promise<void> {
    const q = raw.trim();
    void this.router.navigate([], { queryParams: { q: q || null }, replaceUrl: true });
    if (q.replace(/^@/, '').length < MIN_QUERY) {
      this.results.set([]);
      this.searched.set(false);
      this.error.set('');
      return;
    }
    const ticket = ++this.latest;
    this.loading.set(true);
    const res = await this.api.searchUsers(q, 30);
    if (ticket !== this.latest) return;
    this.loading.set(false);
    this.searched.set(true);
    if (res.success) {
      this.results.set(res.data ?? []);
      this.error.set('');
    } else {
      this.error.set(res.error || 'Search failed');
    }
  }

  initial(p: PlayerSearchResult): string {
    return (p.displayName || p.username).charAt(0).toUpperCase();
  }

  avatarColor(p: PlayerSearchResult): string {
    let hash = 0;
    for (const ch of p.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `var(--color-avatar-${(hash % AVATAR_COLORS) + 1})`;
  }
}
