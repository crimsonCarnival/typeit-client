import { Component, computed, inject, input } from '@angular/core';
import { StatsBucket, UserStats } from '../../models/models';
import { TimeDisplayService } from '../../services/time-display.service';

const TIME_BUCKETS = ['30', '60', '90', '120', 'custom'];
const WORD_BUCKETS = ['25', '50', '75', '100', 'custom'];
const MODE_BUCKETS = ['words', 'phrases'];
const MODIFIER_BUCKETS = ['none', 'punctuation', 'numbers', 'both'];

const timeLabel = (key: string) => (key === 'custom' ? 'Custom' : `${key}s`);
const wordsLabel = (key: string) => (key === 'custom' ? 'Custom' : key);
const modeLabel = (key: string) => (key === 'words' ? 'Words' : 'Phrases');
const modifierLabel = (key: string) => {
  switch (key) {
    case 'none': return 'None';
    case 'punctuation': return 'Punctuation';
    case 'numbers': return 'Numbers';
    case 'both': return 'Punct + Numbers';
    default: return key;
  }
};


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



  readonly tables = computed(() => [
    { id: 'time', title: 'By time limit', column: 'Limit', items: this.timeItems() },
    { id: 'words', title: 'By word count', column: 'Words', items: this.wordsItems() },
    { id: 'mode', title: 'By mode', column: 'Mode', items: this.modeItems() },
    { id: 'modifiers', title: 'By modifiers', column: 'Modifiers', items: this.modifierItems() },
  ]);

  isEmpty(data?: StatsBucket): boolean {
    return !data || (data.games || 0) === 0;
  }

  /** Highest value of a column within one table, to highlight the best row. */
  best(items: BucketItem[], field: 'bestWpm' | 'highScore'): number {
    return Math.max(0, ...items.map((i) => i.data?.[field] || 0));
  }

  fmt(seconds?: number): string {
    return this.timeDisplay.format(seconds || 0);
  }



}

