import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

const detectZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * The time zone dates are shown in: the one the player picked in Settings, or
 * else whatever the browser reports. Display only; the server keeps its own
 * clock (daily challenges roll over at UTC midnight for everyone).
 */
@Injectable({ providedIn: 'root' })
export class TimezoneService {
  private readonly auth = inject(AuthService);

  readonly detected = detectZone();
  readonly isManual = computed(() => !!this.auth.user()?.timezoneManual && !!this.auth.user()?.timezone);
  readonly zone = computed(() => (this.isManual() ? this.auth.user()!.timezone! : this.detected));

  /** Every IANA zone the browser knows, for the Settings picker. */
  readonly zones: string[] = (() => {
    try {
      const all = Intl.supportedValuesOf('timeZone');
      return all.includes(this.detected) ? all : [this.detected, ...all];
    } catch {
      return [this.detected];
    }
  })();

  /** Picks a zone, or null to follow the browser again. */
  setZone(zone: string | null): Promise<{ success: boolean; error?: string }> {
    return this.auth.updateProfile({ timezone: zone ?? this.detected, timezoneManual: zone !== null });
  }

  date(value: string | number | Date, options: Intl.DateTimeFormatOptions = {}): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', ...options, timeZone: this.zone() }).format(new Date(value));
  }

  dateTime(value: string | number | Date): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: this.zone() }).format(new Date(value));
  }

  /** Short zone name for the current moment, e.g. "GMT+2". */
  label(at: Date = new Date()): string {
    const part = new Intl.DateTimeFormat(undefined, { timeZone: this.zone(), timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName');
    return part?.value ?? this.zone();
  }
}
