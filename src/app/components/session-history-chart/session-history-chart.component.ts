import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { SessionSummary } from '../../models/models';
import { token, tokenAlpha } from '../../utils/chart-tokens';

Chart.defaults.font.family = "'Hapna Demibold', sans-serif";

/**
 * Named dataset indices. Updating the dataset order only requires changing
 * the values here — all callbacks reference these constants, never raw integers.
 */
const DS = {
  WPM:         0,
  PB:          1,
  RAW_WPM:     2,
  ACCURACY:    3,
  CONSISTENCY: 4,
} as const;

@Component({
  selector: 'app-session-history-chart',
  templateUrl: './session-history-chart.component.html',
  styleUrl: './session-history-chart.component.css',
})
export class SessionHistoryChartComponent implements AfterViewInit, OnDestroy {
  readonly sessions = input<SessionSummary[]>([]);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | undefined;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    const sessions = this.sessions();
    const canvasEl = this.canvas()?.nativeElement;
    if (!canvasEl || sessions.length === 0) return;

    // X-axis: session ordinal (1, 2, 3…) — dates surface in the tooltip only.
    const labels = sessions.map((_, i) => i + 1);

    // Step-function PB: only rises when a new WPM high is set.
    const pbData = sessions.map((_, i) =>
      Math.max(...sessions.slice(0, i + 1).map((s) => s.wpm))
    );

    // Conditional datasets: omit if the field is absent across all sessions.
    const hasRawWpm     = sessions.some((s) => s.rawWpm != null);
    const hasConsistency = sessions.some((s) => s.consistency != null);

    const datasets: any[] = [
      // DS.WPM = 0
      {
        label: 'WPM',
        data: sessions.map((s) => s.wpm),
        borderColor: token('wpm'),
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y',
        backgroundColor: (context: any) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return tokenAlpha('wpm', 0.3);
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, tokenAlpha('wpm', 0));
          gradient.addColorStop(1, tokenAlpha('wpm', 0.3));
          return gradient;
        },
      },
      // DS.PB = 1
      {
        label: 'Personal Best',
        data: pbData,
        borderColor: token('pb'),
        borderDash: [8, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0,        // stepped — no smoothing
        yAxisID: 'y',
      },
      // DS.RAW_WPM = 2 (omitted when absent)
      ...(hasRawWpm ? [{
        label: 'Raw WPM',
        data: sessions.map((s) => s.rawWpm ?? null),
        borderColor: token('raw'),
        borderWidth: 1.5,
        tension: 0.4,
        pointRadius: 3,
        fill: false,
        yAxisID: 'y',
      }] : []),
      // DS.ACCURACY = 3 (or 2 when rawWpm absent)
      {
        label: 'Accuracy',
        data: sessions.map((s) => s.accuracy),
        borderColor: token('accuracy'),
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        fill: false,
        yAxisID: 'y2',
      },
      // DS.CONSISTENCY = 4 (or 3) — omitted when absent
      ...(hasConsistency ? [{
        label: 'Consistency',
        data: sessions.map((s) => s.consistency ?? null),
        borderColor: token('consistency'),
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        fill: false,
        yAxisID: 'y2',
      }] : []),
    ];

    // Recalculate DS indices based on which optional datasets are present,
    // so tooltip callbacks are always accurate.
    const resolvedDS = {
      WPM:         0,
      PB:          1,
      RAW_WPM:     hasRawWpm ? 2 : -1,
      ACCURACY:    hasRawWpm ? 3 : 2,
      CONSISTENCY: hasRawWpm && hasConsistency ? 4 : !hasRawWpm && hasConsistency ? 3 : -1,
    };

    const config: any = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', axis: 'x', intersect: false },
        scales: {
          x: {
            ticks: { color: token('text-faint'), font: { size: 12 } },
            grid: { color: token('border') },
            title: { display: true, text: 'Session #', color: token('text-faint'), font: { size: 12 } },
          },
          y: {
            ticks: { color: token('text-faint'), font: { size: 12 } },
            grid: { color: token('border') },
            title: { display: true, text: 'WPM', color: token('text-faint'), font: { size: 12 } },
          },
          y2: {
            position: 'right',
            min: 0,
            max: 100,
            ticks: { color: token('text-faint'), font: { size: 12 } },
            grid: { display: false },
            title: { display: true, text: 'Accuracy / Consistency %', color: token('text-faint'), font: { size: 12 } },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: token('text-muted'), font: { size: 12 }, padding: 18, boxWidth: 24, boxHeight: 10 },
          },
          tooltip: {
            usePointStyle: true,
            boxWidth: 7,
            boxHeight: 7,
            boxPadding: 4,
            callbacks: {
              title: (items: any[]) => {
                const s = sessions[items[0].dataIndex];
                if (!s) return '';
                const date = new Date(s.endTime).toLocaleDateString();
                const tag  = s.migrated ? ' (migrated)' : '';
                return `Session ${items[0].label} — ${date}${tag}`;
              },
              label: (context: any) => {
                const s = sessions[context.dataIndex];
                if (!s) return '';
                switch (context.datasetIndex) {
                  case resolvedDS.WPM:         return `WPM: ${s.wpm}`;
                  case resolvedDS.PB:          return `Personal Best: ${pbData[context.dataIndex]} WPM`;
                  case resolvedDS.RAW_WPM:     return `Raw WPM: ${s.rawWpm ?? 0}`;
                  case resolvedDS.ACCURACY:    return `Accuracy: ${s.accuracy.toFixed(1)}%`;
                  case resolvedDS.CONSISTENCY: return `Consistency: ${s.consistency ?? 0}%`;
                  default:                     return '';
                }
              },
            },
          },
        },
      },
    };

    this.chart = new Chart(canvasEl, config);
  }
}
