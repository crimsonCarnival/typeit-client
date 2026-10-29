import { Injectable, computed, signal } from '@angular/core';
import { ChangelogRelease } from '../models/models';
import { environment } from '../../environments/environment';

/**
 * The release notes shown from the footer. The server compiles them from the
 * repos' conventional commit messages every week (founders can recompile from
 * the admin area).
 */
@Injectable({ providedIn: 'root' })
export class ChangelogService {
  readonly releases = signal<ChangelogRelease[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly latest = computed(() => this.releases()[0]?.version ?? null);
  private started = false;

  /** Loads the notes once. Safe to call from several places. */
  async load(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      const res = await fetch(`${environment.apiUrl}/changelog`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data?: { releases?: ChangelogRelease[] } };
      this.releases.set(Array.isArray(body.data?.releases) ? body.data!.releases! : []);
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }
}
