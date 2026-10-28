export const membershipAge = (createdAt?: string): string => {
  if (!createdAt) return '';
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return '';

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > 0) return `${years}y ${months}m`;
  if (months > 0) return `${months}m`;

  const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
  if (days > 0) return `${days}d`;
  return 'Just joined';
};

export type TimeFormatMode = 'formatted' | 'raw';

export const formatTypingTime = (
  seconds?: number | null,
  mode: TimeFormatMode = 'formatted'
): string => {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) {
    return '0s';
  }

  const rounded = Math.round(seconds);
  if (mode === 'raw') {
    return `${rounded}s`;
  }

  if (rounded === 0) {
    return '0s';
  }

  const YEARS = 31536000;
  const MONTHS = 2592000;
  const DAYS = 86400;
  const HOURS = 3600;
  const MINUTES = 60;

  let rem = rounded;

  const y = Math.floor(rem / YEARS);
  rem %= YEARS;

  const mo = Math.floor(rem / MONTHS);
  rem %= MONTHS;

  const d = Math.floor(rem / DAYS);
  rem %= DAYS;

  const h = Math.floor(rem / HOURS);
  rem %= HOURS;

  const m = Math.floor(rem / MINUTES);
  rem %= MINUTES;

  const s = rem;

  const parts: string[] = [];
  // Compact units ("6m 5s"), as in the redesign and the time-format toggle.
  if (y > 0) parts.push(`${y}y`);
  if (mo > 0) parts.push(`${mo}mo`);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
};

