import { Component, computed, inject, input, signal, WritableSignal } from '@angular/core';
import { StatsBucket, UserStats } from '../../models/models';
import { TimeDisplayService } from '../../services/time-display.service';

const TIME_BUCKETS = ['30', '60', '90', '120', 'custom'];
const WORD_BUCKETS = ['25', '50', '75', '100', 'custom'];
const MODE_BUCKETS = ['words', 'phrases'];
const MODIFIER_BUCKETS = ['none', 'punctuation', 'numbers', 'both'];

const timeLabel = (key: string) => (key === 'custom' ? 'Custom time' : `${key}s`);
const wordsLabel = (key: string) => (key === 'custom' ? 'Custom words' : `${key} words`);
const modeLabel = (key: string) => (key === 'words' ? 'Words' : 'Phrases');
const modifierLabel = (key: string) => {
  switch (key) {
    case 'none': return 'No modifiers';
    case 'punctuation': return 'Punctuation';
    case 'numbers': return 'Numbers';
    case 'both': return 'Punct. & Numbers';
    default: return key;
  }
};

const PAGE_SIZE = 5;

interface BucketItem {
  key: string;
  label: string;
  data?: StatsBucket;
}

@Component({
  selector: 'app-stats-sections',
  templateUrl: './stats-sections.component.html',
  styleUrl: './stats-sections.component.css',
})
export class StatsSectionsComponent {
  private readonly timeDisplay = inject(TimeDisplayService);

  readonly stats = input<UserStats | null>(null);
  readonly overall = input<{ label: string; value: string | number }[]>([]);
  readonly averages = input<{ label: string; value: string | number }[]>([]);

  readonly formatMode = this.timeDisplay.formatMode;

  toggleTimeFormat(): void {
    this.timeDisplay.toggleFormat();
  }

  readonly timePage = signal(0);
  readonly wordsPage = signal(0);
  readonly modePage = signal(0);
  readonly modifierPage = signal(0);

  readonly byTime = computed(() => this.stats()?.byTime || {});
  readonly byWords = computed(() => this.stats()?.byWords || {});
  readonly byMode = computed(() => this.stats()?.byMode || {});
  readonly byModifier = computed(() => this.stats()?.byModifier || {});

  readonly timeItems = computed<BucketItem[]>(() =>
    TIME_BUCKETS.map((key) => ({ key, label: timeLabel(key), data: this.byTime()[key] }))
  );
  readonly wordsItems = computed<BucketItem[]>(() =>
    WORD_BUCKETS.map((key) => ({ key, label: wordsLabel(key), data: this.byWords()[key] }))
  );
  readonly modeItems = computed<BucketItem[]>(() =>
    MODE_BUCKETS.map((key) => ({ key, label: modeLabel(key), data: this.byMode()[key] }))
  );
  readonly modifierItems = computed<BucketItem[]>(() =>
    MODIFIER_BUCKETS.map((key) => ({ key, label: modifierLabel(key), data: this.byModifier()[key] }))
  );

  readonly visibleTime = computed(() => this.paginate(this.timeItems(), this.timePage()));
  readonly visibleWords = computed(() => this.paginate(this.wordsItems(), this.wordsPage()));
  readonly visibleMode = computed(() => this.paginate(this.modeItems(), this.modePage()));
  readonly visibleModifier = computed(() => this.paginate(this.modifierItems(), this.modifierPage()));

  readonly timePages = computed(() => Math.max(1, Math.ceil(this.timeItems().length / PAGE_SIZE)));
  readonly wordsPages = computed(() => Math.max(1, Math.ceil(this.wordsItems().length / PAGE_SIZE)));
  readonly modePages = computed(() => Math.max(1, Math.ceil(this.modeItems().length / PAGE_SIZE)));
  readonly modifierPages = computed(() => Math.max(1, Math.ceil(this.modifierItems().length / PAGE_SIZE)));

  private paginate(items: BucketItem[], page: number): BucketItem[] {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const current = Math.min(page, totalPages - 1);
    return items.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  }

  isEmpty(data?: StatsBucket): boolean {
    return !data || (data.games || 0) === 0;
  }

  bucketRows(data?: StatsBucket): { label: string; value: string }[] {
    if (!data) return [];
    return [
      { label: 'Games', value: String(data.games || 0) },
      { label: 'Best WPM', value: String(data.bestWpm || 0) },
      { label: 'High Score', value: String(data.highScore || 0) },
      { label: 'Best Accuracy', value: `${data.bestAccuracy || 0}%` },
      { label: 'Total Time', value: this.timeDisplay.format(data.totalTimeTyping || 0) },
      { label: 'AFK Time', value: this.timeDisplay.format(data.afkTime || 0) },
    ];
  }

  prevPage(page: WritableSignal<number>): void {
    page.set(Math.max(0, page() - 1));
  }

  nextPage(page: WritableSignal<number>, totalPages: number): void {
    page.set(Math.min(totalPages - 1, page() + 1));
  }
}

