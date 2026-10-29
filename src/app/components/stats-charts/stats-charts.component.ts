import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ResultRow } from '../../models/models';
import { token, tokenAlpha } from '../../utils/chart-tokens';
import { dailySeries, histogram, movingAverage, speedChangePerHour } from '../../utils/stats-math';
import { clock } from '../profile-overview/profile-overview.component';

type Series = 'speed' | 'accuracy' | 'avg10' | 'avg100';

/** Chart.js options shared by the three charts: quiet grid, theme-coloured text. */
const baseScale = () => ({
  grid: { color: tokenAlpha('border', 0.6) },
  ticks: { color: token('text-subtle'), font: { size: 12 } },
});

/**
 * The stats dashboard's three charts: speed and accuracy over time (with
 * moving averages), tests per speed band, and time typing per day.
 */
@Component({
  selector: 'app-stats-charts',
  templateUrl: './stats-charts.component.html',
  styleUrl: './stats-charts.component.css',
})
export class StatsChartsComponent {
  /** The results to chart, oldest first (already filtered). */
  readonly rows = input.required<ResultRow[]>();

  readonly shown = signal<Record<Series, boolean>>({ speed: true, accuracy: true, avg10: true, avg100: true });
  readonly series: { id: Series; label: string }[] = [
    { id: 'speed', label: 'Speed' },
    { id: 'accuracy', label: 'Accuracy' },
    { id: 'avg10', label: 'Avg of 10' },
    { id: 'avg100', label: 'Avg of 100' },
  ];

  readonly slope = computed(() => speedChangePerHour(this.rows()));

  private readonly perfCanvas = viewChild<ElementRef<HTMLCanvasElement>>('perf');
  private readonly histCanvas = viewChild<ElementRef<HTMLCanvasElement>>('hist');
  private readonly dailyCanvas = viewChild<ElementRef<HTMLCanvasElement>>('daily');
  private charts: Partial<Record<'perf' | 'hist' | 'daily', Chart>> = {};

  constructor() {
    effect(() => {
      const rows = this.rows();
      const shown = this.shown();
      this.draw('perf', this.perfCanvas(), () => this.performance(rows, shown));
      this.draw('hist', this.histCanvas(), () => this.bands(rows));
      this.draw('daily', this.dailyCanvas(), () => this.perDay(rows));
    });
    inject(DestroyRef).onDestroy(() => Object.values(this.charts).forEach((c) => c?.destroy()));
  }

  toggle(id: Series): void {
    this.shown.update((s) => ({ ...s, [id]: !s[id] }));
  }

  private draw(key: 'perf' | 'hist' | 'daily', canvas: ElementRef<HTMLCanvasElement> | undefined, config: () => any): void {
    this.charts[key]?.destroy();
    this.charts[key] = undefined;
    if (!canvas || !this.rows().length) return;
    this.charts[key] = new Chart(canvas.nativeElement, config());
  }

  private performance(rows: ResultRow[], shown: Record<Series, boolean>) {
    const wpm = rows.map((r) => r.wpm);
    const dates = rows.map((r) => new Date(r.t).toISOString().slice(0, 10));
    const datasets: any[] = [];
    if (shown.speed) {
      datasets.push({ label: 'Speed', data: wpm, showLine: false, borderColor: tokenAlpha('wpm', 0.5), backgroundColor: tokenAlpha('wpm', 0.5), pointRadius: 3, yAxisID: 'y' });
    }
    if (shown.accuracy) {
      datasets.push({ label: 'Accuracy', data: rows.map((r) => r.acc), showLine: false, borderColor: tokenAlpha('accuracy', 0.45), backgroundColor: tokenAlpha('accuracy', 0.45), pointStyle: 'triangle', pointRadius: 3, yAxisID: 'y1' });
    }
    if (shown.avg10) {
      datasets.push({ label: 'Avg of 10', data: movingAverage(wpm, 10), borderColor: token('wpm'), borderWidth: 3, pointRadius: 0, tension: 0.35, yAxisID: 'y' });
    }
    if (shown.avg100) {
      datasets.push({ label: 'Avg of 100', data: movingAverage(wpm, 100), borderColor: token('text-muted'), borderWidth: 3, pointRadius: 0, tension: 0.35, yAxisID: 'y' });
    }
    return {
      type: 'line',
      data: { labels: rows.map((_, i) => i + 1), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (items: any[]) => `Test ${items[0].label} · ${dates[items[0].dataIndex]}` } },
        },
        scales: {
          x: { ...baseScale(), title: { display: true, text: 'Test', color: token('text-subtle') } },
          y: { ...baseScale(), beginAtZero: true, title: { display: true, text: 'Words per minute', color: token('text-subtle') } },
          y1: { ...baseScale(), position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: 'Accuracy %', color: token('text-subtle') } },
        },
      },
    };
  }

  private bands(rows: ResultRow[]) {
    const bands = histogram(rows);
    return {
      type: 'bar',
      data: { labels: bands.map((b) => b.label), datasets: [{ label: 'Tests', data: bands.map((b) => b.count), backgroundColor: token('wpm'), borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ...baseScale(), title: { display: true, text: 'Words per minute', color: token('text-subtle') } },
          y: { ...baseScale(), beginAtZero: true, ticks: { ...baseScale().ticks, precision: 0 }, title: { display: true, text: 'Tests', color: token('text-subtle') } },
        },
      },
    };
  }

  private perDay(rows: ResultRow[]) {
    const days = dailySeries(rows);
    return {
      type: 'bar',
      data: {
        labels: days.map((d) => d.date),
        datasets: [
          { type: 'bar', label: 'Time typing', data: days.map((d) => d.secs / 60), backgroundColor: token('wpm'), borderRadius: 4, yAxisID: 'y' },
          { type: 'line', label: 'Average WPM', data: days.map((d) => d.avgWpm), borderColor: token('text-muted'), backgroundColor: token('text-muted'), borderWidth: 2, pointRadius: 3, tension: 0.2, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items: any[]) => days[items[0].dataIndex].date,
              label: () => '',
              afterBody: (items: any[]) => {
                const d = days[items[0].dataIndex];
                return [
                  `Time typing: ${clock(d.secs)}`,
                  `Tests completed: ${d.tests}`,
                  `Highest WPM: ${d.highestWpm.toFixed(2)}`,
                  `Average WPM: ${d.avgWpm.toFixed(2)}`,
                  `Average accuracy: ${d.avgAcc.toFixed(2)}%`,
                  `Average consistency: ${d.avgCons.toFixed(2)}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: { ...baseScale(), ticks: { ...baseScale().ticks, maxRotation: 50, autoSkip: true } },
          y: { ...baseScale(), beginAtZero: true, title: { display: true, text: 'Time typing (minutes)', color: token('text-subtle') } },
          y1: { ...baseScale(), position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Average WPM', color: token('text-subtle') } },
        },
      },
    };
  }
}
