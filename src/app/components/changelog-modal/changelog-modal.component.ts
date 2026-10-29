import { Component, ElementRef, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { ChangelogService } from '../../services/changelog.service';
import { TimezoneService } from '../../services/timezone.service';
import { ChangelogEntry, ChangelogRelease } from '../../models/models';

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

/** Day bucket: a weekday label and its entries. */
export interface DayGroup {
  day: string;     // 'YYYY-MM-DD' or '' for entries without a date
  label: string;   // e.g. 'Monday' or 'Other'
  entries: ChangelogEntry[];
}

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

  /**
   * Groups entries in a section by their commit day (newest first).
   * Entries without a `day` fall into a trailing "Other" bucket.
   */
  dayGroups(release: ChangelogRelease, sectionId: string): DayGroup[] {
    const entries = release.sections[sectionId] ?? [];
    const map = new Map<string, ChangelogEntry[]>();
    for (const e of entries) {
      const key = e.day ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    const days = [...map.keys()].sort((a, b) => {
      if (!a) return 1;   // undated last
      if (!b) return -1;
      return a < b ? 1 : a > b ? -1 : 0; // newest first
    });

    return days.map((day) => ({
      day,
      label: day ? this.weekdayLabel(day) : 'Other',
      entries: map.get(day)!,
    }));
  }

  /** Returns `true` when a section has more than one distinct day so the day headers are worth showing. */
  isMultiDay(release: ChangelogRelease, sectionId: string): boolean {
    const entries = release.sections[sectionId] ?? [];
    const days = new Set(entries.map((e) => e.day ?? ''));
    return days.size > 1;
  }

  /** Jumps to a release, loading older ones as far as needed. */
  jump(event: Event): void {
    const version = (event.target as HTMLSelectElement).value;
    const at = this.changelog.releases().findIndex((r) => r.version === version);
    if (at < 0) return;
    if (at >= this.count()) this.count.set(at + 1);
    queueMicrotask(() => document.getElementById(`release-${version}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  private weekdayLabel(iso: string): string {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // Parse as noon UTC to avoid timezone shifting the day.
    const d = new Date(`${iso}T12:00:00Z`);
    return DAYS[d.getUTCDay()] ?? iso;
  }
}
