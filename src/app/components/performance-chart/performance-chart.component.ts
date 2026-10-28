import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { PerformancePoint } from '../../models/models';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

// Ensure the chart uses the application's global font
Chart.defaults.font.family = "'Hapna Demibold', sans-serif";

/** Reads a design token from styles.css so chart colours stay in one place. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();

/** A token colour (hex) at the given opacity, for canvas gradients. */
const tokenAlpha = (name: string, a: number): string => {
  const hex = token(name).replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * Named dataset indices. Update this object whenever datasets are added,
 * removed, or reordered — all tooltip callbacks reference these constants.
 */
const DS = {
  WPM:            0,
  PB:             1,
  ROLLING_AVG:    2,
  RAW_WPM:        3,
  CONSISTENCY:    4,
  ACCURACY:       5,
  CUMULATIVE_AFK: 6,
  MISTAKES:       7,
  BACKSPACES:     8,
  AFK_PERIODS:    9,
} as const;

@Component({
  selector: 'app-performance-chart',
  templateUrl: './performance-chart.component.html',
  styleUrl: './performance-chart.component.css',
})
export class PerformanceChartComponent implements AfterViewInit, OnDestroy {
  readonly performance = input<PerformancePoint[]>([]);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | undefined;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  /**
   * Counts cumulative AFK events up to each data point (O(n) single pass).
   * Note: afkIndex is an ordinal counter (1st, 2nd… event), not a duration.
   * This map stores the total number of AFK events seen so far.
   */
  private buildCumulativeAFKMap(data: PerformancePoint[]): Map<number, number> {
    const cumulativeAfkMap = new Map<number, number>();
    let runningTotal = 0;

    for (const point of data) {
      const afkPeriods = point.afkPeriods || [];
      runningTotal += afkPeriods.length; // count events, not afkIndex ordinals
      cumulativeAfkMap.set(point.timestamp, runningTotal);
    }

    return cumulativeAfkMap;
  }

  private renderChart(): void {
    const data = this.performance();
    const canvasEl = this.canvas()?.nativeElement;
    if (!canvasEl || data.length === 0) return;

    const labels = data.map((p) => p.timestamp);

    // --- Boolean marker arrays ---
    const errorAt = new Array<boolean>(data.length).fill(false);
    const backspaceAt = new Array<boolean>(data.length).fill(false);
    for (let i = 0; i < data.length; i++) {
      if (i > 0 && data[i].mistakes > data[i - 1].mistakes) {
        errorAt[i] = true;
      }
      if (data[i].backspaces > 0) {
        backspaceAt[i] = true;
      }
    }

    // --- Derived datasets ---

    // Step-function PB: rises as the running max grows each second.
    const pbData = data.map((p) => p.highestWpm);

    // 3-point rolling average for noise reduction.
    const rollingAvg = data.map((_, i) => {
      const window = data.slice(Math.max(0, i - 2), i + 1);
      return Math.round(window.reduce((sum, p) => sum + p.wpm, 0) / window.length);
    });

    // Errors per interval.
    const errorsPerSecond = data.map((p, i) => {
      const prev = i > 0 ? data[i - 1].mistakes : 0;
      return p.mistakes - prev;
    });

    // Backspaces per interval.
    const backspacesPerSecond = data.map((p, i) => {
      const prev = i > 0 ? data[i - 1].backspaces : 0;
      return (p.backspaces ?? 0) - prev;
    });

    // Cumulative AFK event count map (O(n) pass).
    const cumulativeAfkMap = this.buildCumulativeAFKMap(data);

    // Map of timestamp -> AFK event ordinal for point rendering.
    const afkMap = new Map<number, number>();
    data.forEach((entry) => {
      (entry.afkPeriods || []).forEach((afk) => afkMap.set(afk.timestamp, afk.afkIndex));
    });

    // AFK Periods point data — null on non-AFK seconds (Chart.js skips null).
    const afkData = data.map((p) => (afkMap.has(p.timestamp) ? afkMap.get(p.timestamp)! : null));

    const totalMistakes = data[data.length - 1].mistakes || 0;
    const maxErrorsPerSecond = Math.max(...errorsPerSecond, 1);

    const config: any = {
      type: 'line',
      data: {
        labels,
        datasets: [
          // DS.WPM = 0
          {
            label: 'WPM',
            data: data.map((p) => p.wpm),
            borderColor: token('wpm'),
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
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
            label: 'Personal Best (PB)',
            data: pbData,
            borderColor: token('pb'),
            borderDash: [10, 5],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            yAxisID: 'y',
          },
          // DS.ROLLING_AVG = 2
          {
            label: 'Avg WPM (3s)',
            data: rollingAvg,
            borderColor: tokenAlpha('wpm', 0.55),
            borderDash: [4, 4],
            borderWidth: 1.5,
            tension: 0.4,
            pointRadius: 0,
            fill: false,
            yAxisID: 'y',
          },
          // DS.RAW_WPM = 3
          {
            label: 'Raw WPM',
            data: data.map((p) => p.rawWpm),
            borderColor: token('raw'),
            borderWidth: 1,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y',
          },
          // DS.CONSISTENCY = 4
          {
            label: 'Consistency',
            data: data.map((p) => p.consistency),
            borderColor: token('consistency'),
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y',
          },
          // DS.ACCURACY = 5
          {
            label: 'Accuracy',
            data: data.map((p) => p.accuracy),
            borderColor: token('accuracy'),
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y',
          },
          // DS.CUMULATIVE_AFK = 6
          {
            label: 'AFK Event Count',
            data: labels.map((ts) => cumulativeAfkMap.get(Number(ts)) || 0),
            borderColor: token('afk'),
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            yAxisID: 'errors',
            backgroundColor: (context: any) => {
              const { ctx, chartArea } = context.chart;
              if (!chartArea) return tokenAlpha('afk', 0.2);
              const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, tokenAlpha('afk', 0.05));
              gradient.addColorStop(1, tokenAlpha('afk', 0.25));
              return gradient;
            },
          },
          // DS.MISTAKES = 7
          {
            label: 'Errors',
            data: errorsPerSecond,
            borderColor: token('accent'),
            showLine: false,
            yAxisID: 'errors',
            tension: 0.4,
            pointRadius: (context: any) => (errorAt[context.dataIndex] ? 4 : 0),
            pointStyle: 'crossRot',
            pointBackgroundColor: token('accent'),
            pointBorderWidth: 2,
          },
          // DS.BACKSPACES = 8
          {
            label: 'Backspaces',
            data: backspacesPerSecond,
            showLine: false,
            yAxisID: 'errors',
            tension: 0.4,
            pointRadius: (context: any) => (backspaceAt[context.dataIndex] ? 5 : 0),
            pointStyle: 'triangle',
            pointRotation: 180,
            pointBackgroundColor: token('text-subtle'),
            pointBorderColor: token('text-faint'),
            pointBorderWidth: 2,
          },
          // DS.AFK_PERIODS = 9
          {
            label: 'AFK Periods',
            data: afkData,
            showLine: false,
            yAxisID: 'errors',
            pointRadius: 7,
            pointStyle: 'triangle',
            pointBackgroundColor: token('afk'),
            pointBorderColor: token('afk'),
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', axis: 'xy', intersect: false },
        scales: {
          x: {
            ticks: { color: token('text-faint'), font: { size: 12 } },
            grid: { color: token('border'), borderColor: token('border') },
            title: { display: true, text: 'Time (s)', color: token('text-faint'), font: { size: 12 } },
          },
          y: {
            ticks: { color: token('text-faint'), font: { size: 12 } },
            grid: { color: token('border'), borderColor: token('border') },
            title: { display: true, text: 'WPM & Accuracy', color: token('text-faint'), font: { size: 12 } },
          },
          errors: {
            position: 'right',
            min: 0,
            max: Math.max(totalMistakes, maxErrorsPerSecond, 1) + 2,
            ticks: { stepSize: 1, color: token('text-faint'), font: { size: 12 } },
            grid: { display: false },
            title: { display: true, text: 'Errors', color: token('text-faint'), font: { size: 12 } },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: token('text-muted'),
              font: { size: 12 },
              padding: 18,
              boxWidth: 24,
              boxHeight: 10,
              generateLabels: (chart: any) => {
                const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                return labels.map((label: any) => {
                  if (label.text === 'Errors' || label.text === 'Backspaces' || label.text === 'AFK Periods') {
                    label.usePointStyle = true;
                    // Rotate the backspaces triangle downwards to match the chart.
                    if (label.text === 'Backspaces') {
                      label.rotation = 180;
                    }
                  }
                  return label;
                });
              },
            },
          },
          tooltip: {
            usePointStyle: true,
            boxWidth: 7,
            boxHeight: 7,
            boxPadding: 4,
            callbacks: {
              title: (items: any[]) => `Time: ${items[0]?.label}s`,
              filter: (item: any) => {
                if (item.datasetIndex === DS.BACKSPACES) {
                  return backspaceAt[item.dataIndex];
                }
                if (item.datasetIndex === DS.AFK_PERIODS) {
                  return afkMap.has(Number(labels[item.dataIndex]));
                }
                return true;
              },
              label: (context: any) => {
                const point = data[context.dataIndex];
                switch (context.datasetIndex) {
                  case DS.WPM:            return `WPM: ${point.wpm}`;
                  case DS.PB:             return `Session Best: ${point.highestWpm} WPM`;
                  case DS.ROLLING_AVG:    return `3s Avg WPM: ${rollingAvg[context.dataIndex]}`;
                  case DS.RAW_WPM:        return `Raw WPM: ${point.rawWpm || 0}`;
                  case DS.CONSISTENCY:    return `Consistency: ${point.consistency}%`;
                  case DS.ACCURACY:       return `Accuracy: ${point.accuracy}%`;
                  case DS.CUMULATIVE_AFK: {
                    const count = cumulativeAfkMap.get(point.timestamp) || 0;
                    return `AFK Events so far: ${count}`;
                  }
                  case DS.MISTAKES:       return `Errors: ${errorsPerSecond[context.dataIndex]}`;
                  case DS.BACKSPACES:     return `Backspaces: ${backspacesPerSecond[context.dataIndex]}`;
                  case DS.AFK_PERIODS: {
                    if (!point.afkPeriods || point.afkPeriods.length === 0) return 'AFK Event';
                    const afkPeriod = point.afkPeriods[0];
                    return `AFK Event #${afkPeriod.afkIndex} at ${afkPeriod.timestamp}s`;
                  }
                  default: return '';
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