import { Component, ElementRef, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { ChangelogService } from '../../services/changelog.service';
import { TimezoneService } from '../../services/timezone.service';
import { ChangelogRelease } from '../../models/models';

// In the order they are shown (mirrors SECTIONS in the server's changelog-lib.js).
const SECTIONS: { id: string; title: string; note?: string }[] = [
  { id: 'breaking', title: 'Breaking changes', note: 'Changes that work differently from before.' },
  { id: 'features', title: 'Features' },
  { id: 'improvements', title: 'Improvements' },
  { id: 'design', title: 'Design' },
  { id: 'performance', title: 'Performance' },
  { id: 'security', title: 'Security' },
  { id: 'fixes', title: 'Fixes' },
  { id: 'reverts', title: 'Reverts' },
  { id: 'documentation', title: 'Documentation' },
  { id: 'dependencies', title: 'Dependencies' },
  { id: 'nerd', title: 'Behind the scenes', note: "Work on the code itself. You won't notice these while playing, but they are part of the release." },
];

const PAGE = 5;

/** The release notes: every version, newest first, grouped into features, fixes, security and more. */
@Component({
  selector: 'app-changelog-modal',
  templateUrl: './changelog-modal.component.html',
  styleUrl: './changelog-modal.component.css',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ChangelogModalComponent {
  readonly changelog = inject(ChangelogService);
  private readonly tz = inject(TimezoneService);

  readonly closed = output<void>();
  readonly sections = SECTIONS;
  readonly count = signal(PAGE);
  readonly visible = computed(() => this.changelog.releases().slice(0, this.count()));
  readonly hasMore = computed(() => this.count() < this.changelog.releases().length);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  constructor() {
    void this.changelog.load();
    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (el) queueMicrotask(() => el.focus());
    });
  }

  more(): void {
    this.count.update((n) => n + PAGE);
  }

  date(iso: string): string {
    return this.tz.date(`${iso}T12:00:00Z`);
  }

  /** Whether a release has anything in a section. */
  has(release: ChangelogRelease, id: string): boolean {
    return (release.sections[id]?.length ?? 0) > 0;
  }

  /** Jumps to a release, loading older ones as far as needed. */
  jump(event: Event): void {
    const version = (event.target as HTMLSelectElement).value;
    const at = this.changelog.releases().findIndex((r) => r.version === version);
    if (at < 0) return;
    if (at >= this.count()) this.count.set(at + 1);
    queueMicrotask(() => document.getElementById(`release-${version}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
