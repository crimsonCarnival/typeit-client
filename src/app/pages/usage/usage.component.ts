import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Chart } from 'chart.js/auto';
import { map } from 'rxjs';
import { AdminApiService } from '../../services/admin-api.service';
import { token, tokenAlpha } from '../../utils/chart-tokens';
import { UsageFeature, UsageRange, UsageRow, UsageSeries, UsageSummary, UsageWho } from '../../models/models';

type Tab = 'features' | 'trends';
type Change = { pct: number; diff: number; dir: 'up' | 'down' | 'flat' };

const RANGES: UsageRange[] = [7, 30, 90];
const WHOS: { id: UsageWho; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'guests', label: 'Guests' },
  { id: 'signed-in', label: 'Signed in' },
];
const GROUPS: { id: UsageFeature['group']; label: string }[] = [
  { id: 'tests', label: 'Tests' },
  { id: 'features', label: 'Modes & features' },
  { id: 'pages', label: 'Pages viewed' },
];
/** More lines than this tangle and their colours stop being told apart. */
const MAX_LINES = 5;
const SERIES_TOKENS = ['wpm', 'accuracy', 'consistency', 'raw', 'pb'];
const DAY_MS = 86_400_000;
const shortDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS) + 1;

/**
 * Admin usage statistics: which features get used, by how many different
 * people, and whether that is growing. Two tabs on their own URLs
 * (/admin/usage/features, /admin/usage/trends); range and audience live in
 * the query string so a link opens the same view.
 */
@Component({
  selector: 'app-usage',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './usage.component.html',
  styleUrl: './usage.component.css',
})
export class UsageComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly ranges = RANGES;
  readonly whos = WHOS;
  readonly maxLines = MAX_LINES;

  readonly tab = toSignal(this.route.paramMap.pipe(map((p): Tab => (p.get('tab') === 'trends' ? 'trends' : 'features'))), { initialValue: 'features' as Tab });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly range = computed<UsageRange>(() => {
    const n = Number(this.query().get('range')?.replace(/d$/, ''));
    return RANGES.includes(n as UsageRange) ? (n as UsageRange) : 30;
  });
  readonly who = computed<UsageWho>(() => WHOS.find((w) => w.id === this.query().get('who'))?.id ?? 'all');

  readonly summary = signal<UsageSummary | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly open = signal<Set<string>>(new Set());

  readonly groups = computed(() => {
    const rows = this.summary()?.rows ?? [];
    return GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.id).sort((a, b) => b.people - a.people) }));
  });

  // People over time
  readonly picked = signal<string[]>([]);
  readonly series = signal<UsageSeries | null>(null);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('trend');
  private chart: Chart | undefined;

  /** Everything the chart can plot: features and their details, grouped like the other tab. */
  readonly choices = computed(() =>
    this.groups().map((g) => ({
      ...g,
      items: g.rows.flatMap((f) => [
        { key: f.key, label: f.label, sub: false },
        ...f.children.flatMap((c) => c.rows.map((r) => ({ key: r.key, label: r.label, sub: true }))),
      ]),
    }))
  );

  constructor() {
    effect(() => {
      const [range, who] = [this.range(), this.who()];
      untracked(() => void this.load(range, who));
    });
    effect(() => {
      const [tab, keys, range, who] = [this.tab(), this.picked(), this.range(), this.who()];
      if (tab !== 'trends' || !keys.length) {
        this.series.set(null);
        return;
      }
      untracked(() => void this.loadSeries(keys, range, who));
    });
    effect(() => this.draw(this.series(), this.canvas()?.nativeElement));
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private async load(range: UsageRange, who: UsageWho): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const res = await this.api.usageSummary(range, who);
    this.loading.set(false);
    if (!res.success || !res.data) {
      this.error.set(res.error || 'Could not load usage statistics');
      return;
    }
    this.summary.set(res.data);
    // Start the chart on the three most used features.
    if (!this.picked().length) {
      this.picked.set([...res.data.rows].sort((a, b) => b.people - a.people).slice(0, 3).filter((r) => r.people > 0).map((r) => r.key));
    }
  }

  private async loadSeries(keys: string[], range: UsageRange, who: UsageWho): Promise<void> {
    const res = await this.api.usageSeries(keys, range, who);
    if (res.success && res.data) this.series.set(res.data);
    else this.error.set(res.error || 'Could not load the chart');
  }

  setQuery(change: { range?: UsageRange; who?: UsageWho }): void {
    const range = change.range ?? this.range();
    const who = change.who ?? this.who();
    void this.router.navigate([], { queryParams: { range: `${range}d`, who }, replaceUrl: true });
  }

  toggleOpen(key: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  togglePick(key: string): void {
    this.picked.update((p) => (p.includes(key) ? p.filter((k) => k !== key) : p.length < MAX_LINES ? [...p, key] : p));
  }

  colorOf(key: string): string | null {
    const i = this.picked().indexOf(key);
    return i < 0 ? null : `var(--color-${SERIES_TOKENS[i]})`;
  }

  change(row: UsageRow): Change | null {
    if (row.prev === null) return null;
    const diff = row.people - row.prev;
    const pct = row.prev ? Math.round((diff / row.prev) * 100) : row.people ? 100 : 0;
    return { pct: Math.abs(pct), diff, dir: Math.abs(pct) < 3 ? 'flat' : diff > 0 ? 'up' : 'down' };
  }

  /** Days of the range this was tracked, when it's fewer than the whole range. */
  trackedDays(row: UsageRow): number | null {
    const s = this.summary();
    if (!s || !row.firstSeen || row.firstSeen <= s.start) return null;
    return daysBetween(row.firstSeen, s.end);
  }

  perPerson(row: UsageRow): string {
    return row.people ? (row.times / row.people).toFixed(1) : '0';
  }

  finishRate(row: UsageRow): number | null {
    return row.times ? Math.round((row.finished / row.times) * 100) : null;
  }

  /** Bar widths as a share of the largest in the group (or of the parent, for details). */
  width(n: number, max: number): number {
    return max ? (n / max) * 100 : 0;
  }

  maxOf(rows: UsageRow[]): number {
    return Math.max(0, ...rows.map((r) => r.people));
  }

  /** On the Guests or Signed in view, the bar shows only that side. */
  barGuests(row: UsageRow): number {
    return this.who() === 'signed-in' ? 0 : this.who() === 'guests' ? row.people : Math.min(row.guests, row.people);
  }

  barUsers(row: UsageRow): number {
    return this.who() === 'guests' ? 0 : this.who() === 'signed-in' ? row.people : row.people - this.barGuests(row);
  }

  private draw(data: UsageSeries | null, el: HTMLCanvasElement | undefined): void {
    this.chart?.destroy();
    this.chart = undefined;
    if (!data || !el) return;
    const text = token('text-subtle');
    const grid = tokenAlpha('border', 0.5);
    const weekly = data.buckets.some((b) => b.start !== b.end);
    this.chart = new Chart(el, {
      type: 'line',
      data: {
        labels: data.buckets.map((b) => shortDate(b.end)),
        datasets: data.lines.map((l) => {
          const color = token(SERIES_TOKENS[this.picked().indexOf(l.key)] ?? 'text');
          return { label: l.label, data: l.data, borderColor: color, backgroundColor: color, borderWidth: 2.5, tension: 0.3, pointRadius: weekly ? 3 : 0, pointHoverRadius: 6 };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: text, font: { size: 14 }, usePointStyle: true, boxHeight: 8 } },
          tooltip: {
            backgroundColor: token('surface-solid'),
            titleColor: token('text'),
            bodyColor: token('text'),
            borderColor: token('border'),
            borderWidth: 1,
            titleFont: { size: 15, weight: 'bold' },
            bodyFont: { size: 15 },
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            itemSort: (a, b) => ((b.raw as number | null) ?? -1) - ((a.raw as number | null) ?? -1),
            callbacks: {
              title: (items) => {
                const b = data.buckets[items[0].dataIndex];
                return b.start === b.end ? shortDate(b.end) : `${shortDate(b.start)} – ${shortDate(b.end)}`;
              },
              label: (c) => ` ${c.dataset.label}: ${c.raw == null ? 'not tracked yet' : `${c.raw} ${c.raw === 1 ? 'person' : 'people'}`}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text, font: { size: 13 }, maxTicksLimit: 8 } },
          y: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, font: { size: 13 }, precision: 0 }, title: { display: true, text: 'People', color: text } },
        },
      },
    });
  }
}
