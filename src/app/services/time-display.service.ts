import { Injectable, signal } from '@angular/core';
import { formatTypingTime, TimeFormatMode } from '../utils/time';
import { ls } from '../utils/storage';

@Injectable({
  providedIn: 'root',
})
export class TimeDisplayService {
  readonly formatMode = signal<TimeFormatMode>(this.loadInitialMode());

  private loadInitialMode(): TimeFormatMode {
    const saved = ls.get('timeFormat');
    return saved === 'raw' ? 'raw' : 'formatted';
  }

  toggleFormat(): void {
    const next: TimeFormatMode = this.formatMode() === 'formatted' ? 'raw' : 'formatted';
    this.formatMode.set(next);
    ls.set('timeFormat', next);
  }

  format(seconds?: number | null): string {
    return formatTypingTime(seconds, this.formatMode());
  }
}
