import { Component, computed, input, output } from '@angular/core';

type Cell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4; label: string } | null;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Tests per day, as a year-wide grid (one column per week, Monday first).
 * Days are UTC days, the same the server counts in. Darker means more tests,
 * relative to the player's busiest day in view.
 */
@Component({
  selector: 'app-activity-heatmap',
  templateUrl: './activity-heatmap.component.html',
  styleUrl: './activity-heatmap.component.css',
})
export class ActivityHeatmapComponent {
  /** Days with at least one test. */
  readonly days = input.required<{ date: string; count: number }[]>();
  /** ISO start (inclusive) and end (exclusive) of the span shown. */
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly total = input(0);
  /** Selected calendar year, or null for the last twelve months. */
  readonly year = input<number | null>(null);
  readonly years = input<number[]>([]);
  readonly yearChange = output<number | null>();

  readonly weekdays = WEEKDAYS;

  private readonly byDate = computed(() => new Map(this.days().map((d) => [d.date, d.count])));
  private readonly busiest = computed(() => Math.max(1, ...this.days().map((d) => d.count)));

  /** Cells in column order (week after week, Monday to Sunday); null pads the first and last week. */
  readonly cells = computed<Cell[]>(() => {
    const start = Date.parse(this.from());
    const end = Date.parse(this.to());
    const cells: Cell[] = [];
    // The first column starts on a Monday.
    const lead = (new Date(start).getUTCDay() + 6) % 7;
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let t = start; t < end; t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const count = this.byDate().get(date) ?? 0;
      const level = count === 0 ? 0 : (Math.min(4, Math.ceil((count / this.busiest()) * 4)) as 1 | 2 | 3 | 4);
      cells.push({ date, count, level, label: `${count} ${count === 1 ? 'test' : 'tests'} on ${date}` });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  });

  readonly weeks = computed(() => this.cells().length / 7);

  /** Month names above the first week each month starts in. */
  readonly monthLabels = computed(() => {
    const labels: { column: number; name: string }[] = [];
    const cells = this.cells();
    let last = -1;
    for (let week = 0; week < this.weeks(); week++) {
      const first = cells.slice(week * 7, week * 7 + 7).find((c) => c);
      if (!first) continue;
      const month = new Date(`${first.date}T00:00:00Z`).getUTCMonth();
      if (month !== last) {
        labels.push({ column: week + 1, name: MONTHS[month] });
        last = month;
      }
    }
    return labels;
  });

  onYear(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.yearChange.emit(value ? Number(value) : null);
  }
}
