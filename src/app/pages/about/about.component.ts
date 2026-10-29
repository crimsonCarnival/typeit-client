import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart } from 'chart.js/auto';
import { environment } from '../../../environments/environment';
import { token, tokenAlpha } from '../../utils/chart-tokens';

type GlobalStats = {
  players: number;
  started: number;
  completed: number;
  seconds: number;
  distribution: { results: number; bands: { from: number; to: number; players: number }[] };
};

/** Large numbers as "5.27" + "billion". */
const big = (n: number): { value: string; unit: string } => {
  const scales: [number, string][] = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  for (const [size, unit] of scales) if (n >= size) return { value: (n / size).toFixed(2).replace(/\.?0+$/, ''), unit };
  return { value: String(n), unit: '' };
};

/** Seconds as the largest sensible unit: "1446 years", "3 days", "12 hours". */
const span = (seconds: number): { value: string; unit: string } => {
  const units: [number, string][] = [[31_536_000, 'years'], [86_400, 'days'], [3_600, 'hours'], [60, 'minutes']];
  for (const [size, unit] of units) if (seconds >= size) return { value: String(Math.floor(seconds / size)), unit };
  return { value: String(seconds), unit: 'seconds' };
};

const CONTACT_TOPICS = [
  { id: 'Question', icon: '?' },
  { id: 'Feedback', icon: '✎' },
  { id: 'Bug Report', icon: '!' },
  { id: 'Account Help', icon: '@' },
  { id: 'Business Inquiry', icon: '$' },
  { id: 'Other', icon: '…' },
];

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent {
  readonly stats = signal<GlobalStats | null>(null);
  readonly contactOpen = signal(false);
  /** From the server (CONTACT_EMAIL); empty hides the contact options. */
  readonly contactEmail = signal('');
  readonly topics = CONTACT_TOPICS;
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('dist');
  private chart: Chart | undefined;

  readonly started = computed(() => big(this.stats()?.started ?? 0));
  readonly completed = computed(() => big(this.stats()?.completed ?? 0));
  readonly time = computed(() => span(this.stats()?.seconds ?? 0));

  constructor() {
    void fetch(`${environment.apiUrl}/site`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => this.contactEmail.set(body?.data?.contactEmail ?? ''))
      .catch(() => undefined);
    void fetch(`${environment.apiUrl}/stats/global`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body?.data && this.stats.set(body.data))
      .catch(() => undefined);

    effect(() => {
      const bands = this.stats()?.distribution.bands ?? [];
      const el = this.canvas()?.nativeElement;
      this.chart?.destroy();
      if (!el || !bands.length) return;
      this.chart = new Chart(el, {
        type: 'bar',
        data: { labels: bands.map((b) => `${b.from}-${b.to}`), datasets: [{ label: 'Players', data: bands.map((b) => b.players), backgroundColor: token('wpm'), borderRadius: 3 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: tokenAlpha('border', 0.5) }, ticks: { color: token('text-subtle'), maxRotation: 45 } },
            y: { beginAtZero: true, grid: { color: tokenAlpha('border', 0.5) }, ticks: { color: token('text-subtle'), precision: 0 }, title: { display: true, text: 'Players', color: token('text-subtle') } },
          },
        },
      });
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  mailto(topic: string): string {
    return `mailto:${this.contactEmail()}?subject=${encodeURIComponent(`[${topic}]`)}`;
  }
}
