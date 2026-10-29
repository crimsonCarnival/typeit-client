import { GameMode, ResultRow } from '../models/models';

/** What the stats dashboard can narrow results by. 'all' means no narrowing on that. */
export type StatsFilters = {
  range: 'all' | 'day' | 'week' | 'month' | '3months';
  mode: 'all' | GameMode;
  time: 'all' | number;
  words: 'all' | number;
  mods: 'all' | ResultRow['mods'];
  lang: 'all' | string;
  verified: 'all' | 'yes' | 'no';
  /** Normal tests, or practice runs, or daily challenge runs. */
  kind: 'all' | 'tests' | 'practice' | 'daily';
};

export const NO_FILTERS: StatsFilters = { range: 'all', mode: 'all', time: 'all', words: 'all', mods: 'all', lang: 'all', verified: 'all', kind: 'all' };

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_MS: Record<Exclude<StatsFilters['range'], 'all'>, number> = { day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS, '3months': 90 * DAY_MS };

export const filterRows = (rows: ResultRow[], f: StatsFilters, now = Date.now()): ResultRow[] =>
  rows.filter((r) => {
    if (f.range !== 'all' && r.t < now - RANGE_MS[f.range]) return false;
    if (f.mode !== 'all' && r.mode !== f.mode) return false;
    if (f.time !== 'all' && r.timeMax !== f.time) return false;
    if (f.words !== 'all' && r.words !== f.words) return false;
    if (f.mods !== 'all' && r.mods !== f.mods) return false;
    if (f.lang !== 'all' && (r.lang ?? 'none') !== f.lang) return false;
    if (f.verified === 'yes' && !r.verified) return false;
    if (f.verified === 'no' && r.verified) return false;
    if (f.kind === 'tests' && (r.practice || r.daily)) return false;
    if (f.kind === 'practice' && !r.practice) return false;
    if (f.kind === 'daily' && !r.daily) return false;
    return true;
  });

/** Mean of the last `window` values at each point (fewer at the start). */
export const movingAverage = (values: number[], window: number): number[] => {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(sum / Math.min(i + 1, window));
  }
  return out;
};

/**
 * How much faster (or slower) a player gets for every hour spent typing: the
 * slope of a straight line through speed against total time typed so far.
 * Null when there is not enough to draw a line (fewer than two results, or no
 * time between them).
 */
export const speedChangePerHour = (rows: ResultRow[]): number | null => {
  if (rows.length < 2) return null;
  const xs: number[] = [];
  let hours = 0;
  for (const r of rows) {
    hours += r.secs / 3600;
    xs.push(hours);
  }
  const n = rows.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = rows.reduce((a, r) => a + r.wpm, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xs[i] - meanX) * (rows[i].wpm - meanY);
    variance += (xs[i] - meanX) ** 2;
  }
  return variance > 1e-12 ? covariance / variance : null;
};

/** Tests per speed band (0-9, 10-19, ...), from 0 up to the band holding the fastest result. */
export const histogram = (rows: ResultRow[], size = 10): { label: string; count: number }[] => {
  if (!rows.length) return [];
  const top = Math.floor(Math.max(...rows.map((r) => r.wpm)) / size);
  const bands = Array.from({ length: top + 1 }, (_, i) => ({ label: `${i * size}-${i * size + size - 1}`, count: 0 }));
  for (const r of rows) bands[Math.floor(r.wpm / size)].count++;
  return bands;
};

export type DayStats = {
  date: string;
  /** Seconds spent typing. */
  secs: number;
  tests: number;
  highestWpm: number;
  avgWpm: number;
  avgAcc: number;
  avgCons: number;
};

const mean = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** One entry per UTC day with results, oldest first. */
export const dailySeries = (rows: ResultRow[]): DayStats[] => {
  const days = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const date = new Date(r.t).toISOString().slice(0, 10);
    days.set(date, [...(days.get(date) ?? []), r]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, list]) => ({
      date,
      secs: list.reduce((n, r) => n + r.secs, 0),
      tests: list.length,
      highestWpm: Math.max(...list.map((r) => r.wpm)),
      avgWpm: mean(list.map((r) => r.wpm)),
      avgAcc: mean(list.map((r) => r.acc)),
      avgCons: mean(list.map((r) => r.cons)),
    }));
};

export type StatsSummary = {
  tests: number;
  secs: number;
  words: number;
  highest: { wpm: number; raw: number; acc: number; cons: number };
  average: { wpm: number; raw: number; acc: number; cons: number };
  /** Averages over the latest `last` tests. */
  recent: { wpm: number; raw: number; acc: number; cons: number };
};

const aggregate = (rows: ResultRow[]) => ({
  wpm: mean(rows.map((r) => r.wpm)),
  raw: mean(rows.map((r) => r.raw)),
  acc: mean(rows.map((r) => r.acc)),
  cons: mean(rows.map((r) => r.cons)),
});

export const RECENT_TESTS = 10;

/** Highest and average speed, raw speed, accuracy and consistency, over all results and the latest ten. */
export const summarize = (rows: ResultRow[], last = RECENT_TESTS): StatsSummary => ({
  tests: rows.length,
  secs: rows.reduce((n, r) => n + r.secs, 0),
  words: Math.floor(rows.reduce((n, r) => n + r.correct, 0) / 5),
  highest: {
    wpm: Math.max(0, ...rows.map((r) => r.wpm)),
    raw: Math.max(0, ...rows.map((r) => r.raw)),
    acc: Math.max(0, ...rows.map((r) => r.acc)),
    cons: Math.max(0, ...rows.map((r) => r.cons)),
  },
  average: aggregate(rows),
  recent: aggregate(rows.slice(-last)),
});

/** What makes two results comparable for a personal best: every setting that changes difficulty. */
export const configKey = (r: ResultRow): string => [r.mode, r.mode === 'words' ? r.words : '', r.timeMax, r.mods, r.lang ?? ''].join('|');

/**
 * Ids of the results that set a personal best in their configuration: the
 * first result there, and every later one that was strictly faster. Practice,
 * daily and flagged results never count. Expects oldest first.
 */
export const personalBestIds = (rows: ResultRow[]): Set<string> => {
  const best = new Map<string, number>();
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.practice || r.daily || r.flagged) continue;
    const key = configKey(r);
    if (!best.has(key) || r.wpm > best.get(key)!) {
      best.set(key, r.wpm);
      ids.add(r.id);
    }
  }
  return ids;
};

const CSV_COLUMNS: [string, (r: ResultRow) => string | number][] = [
  ['date', (r) => new Date(r.t).toISOString()],
  ['wpm', (r) => r.wpm],
  ['raw', (r) => r.raw],
  ['accuracy', (r) => r.acc],
  ['consistency', (r) => r.cons],
  ['seconds', (r) => r.secs],
  ['correct', (r) => r.correct],
  ['incorrect', (r) => r.incorrect],
  ['backspaces', (r) => r.backspaces],
  ['mode', (r) => r.mode],
  ['time_limit', (r) => r.timeMax],
  ['words', (r) => r.words],
  ['modifiers', (r) => r.mods],
  ['language', (r) => r.lang ?? ''],
  ['verified', (r) => (r.verified ? 'yes' : 'no')],
  ['flagged', (r) => (r.flagged ? 'yes' : 'no')],
  ['practice', (r) => r.practice ?? ''],
  ['daily', (r) => (r.daily ? 'yes' : 'no')],
];

/** The results as CSV text. Values that could be read as a spreadsheet formula are neutralised. */
export const toCsv = (rows: ResultRow[]): string => {
  const cell = (value: string | number): string => {
    let text = String(value);
    // A value starting with = + - or @ would run as a formula when opened in a spreadsheet.
    if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [CSV_COLUMNS.map(([name]) => name).join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map(([, get]) => cell(get(r))).join(','));
  return `${lines.join('\n')}\n`;
};
