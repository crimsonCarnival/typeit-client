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

/** One line in the notes. The same subject committed to both repos is one item with two refs. */
type Item = { scope: string | null; text: string; breaking: boolean; prs: number[]; refs: { hash: string; repo: string | null }[]; at: string };
type ScopeGroup = { scope: string | null; items: Item[] };
type DaySection = { id: string; title: string; note?: string; scopes: ScopeGroup[] };
type Day = { key: string; weekday: string; date: string; sections: DaySection[] };
type ReleaseView = { version: string; range: string; total: number; days: Day[] };

/** The release notes: every version, newest first, split by weekday, then by kind of change. */
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
  readonly count = signal(PAGE);
  readonly releases = computed(() => this.changelog.releases().slice(0, this.count()).map((r) => this.view(r)));
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

  /** Jumps to a release, loading older ones as far as needed. */
  jump(event: Event): void {
    const version = (event.target as HTMLSelectElement).value;
    const at = this.changelog.releases().findIndex((r) => r.version === version);
    if (at < 0) return;
    if (at >= this.count()) this.count.set(at + 1);
    queueMicrotask(() => document.getElementById(`release-${version}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** A release as days (newest first), each with its sections and the entries grouped by scope. */
  private view(release: ChangelogRelease): ReleaseView {
    const days = new Map<string, Map<string, Map<string, Item>>>();
    let total = 0;
    for (const s of SECTIONS) {
      for (const e of release.sections[s.id] ?? []) {
        const key = this.dayOf(e, release.date);
        const sections = days.get(key) ?? days.set(key, new Map()).get(key)!;
        const items = sections.get(s.id) ?? sections.set(s.id, new Map()).get(s.id)!;
        // Same scope and subject on the same day is the same change (often one commit per repo).
        // fix(security) lands in Security already: its scope would only repeat the heading.
        const id = `${e.scope ?? ''}\u0000${e.text.trim().toLowerCase()}`;
        const item = items.get(id);
        if (item) {
          if (!item.refs.some((r) => r.hash === e.hash)) item.refs.push({ hash: e.hash, repo: e.repo });
          if (e.pr && !item.prs.includes(e.pr)) item.prs.push(e.pr);
          item.breaking ||= e.breaking;
          continue;
        }
        items.set(id, { scope: e.scope === s.id ? null : e.scope, text: e.text.charAt(0).toUpperCase() + e.text.slice(1), breaking: e.breaking, prs: e.pr ? [e.pr] : [], refs: [{ hash: e.hash, repo: e.repo }], at: e.at ?? '' });
        total++;
      }
    }

    const keys = [...days.keys()].sort().reverse();
    return {
      version: release.version,
      range: this.range(keys),
      total,
      days: keys.map((key) => ({
        key,
        weekday: this.label(key, { weekday: 'long' }),
        date: this.label(key, { month: 'short', day: 'numeric' }),
        sections: SECTIONS.filter((s) => days.get(key)!.has(s.id)).map((s) => ({ ...s, scopes: this.byScope([...days.get(key)!.get(s.id)!.values()]) })),
      })),
    };
  }

  /** Scoped entries first, alphabetically by scope; within a scope, newest first. */
  private byScope(items: Item[]): ScopeGroup[] {
    const groups = new Map<string | null, Item[]>();
    for (const item of items) {
      (groups.get(item.scope) ?? groups.set(item.scope, []).get(item.scope)!).push(item);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
      .map(([scope, list]) => ({ scope, items: list.sort((x, y) => y.at.localeCompare(x.at)) }));
  }

  /** The player's local day of a commit; older notes only carry the UTC day. */
  private dayOf(e: ChangelogEntry, fallback: string): string {
    if (e.at) {
      // en-CA formats as YYYY-MM-DD, which also sorts.
      return new Intl.DateTimeFormat('en-CA', { timeZone: this.tz.zone(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(e.at));
    }
    return e.day ?? fallback;
  }

  private label(key: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
  }

  private range(keys: string[]): string {
    if (!keys.length) return '';
    const first = keys[keys.length - 1];
    const last = keys[0];
    const fmt = (k: string) => this.label(k, { month: 'short', day: 'numeric' });
    return first === last ? fmt(last) : `${fmt(first)} – ${fmt(last)}`;
  }
}
