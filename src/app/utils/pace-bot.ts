/**
 * Client-side pace bot for practice races. It types at a target WPM with
 * human-like variance: each second runs at (1 ± d) of the base speed, with d
 * up to MAX_VARIANCE, drawn in balanced pairs so the average is exactly the
 * target. The first second is slower, like a person finding the keys.
 * Practice only: bot races never touch the server.
 */
const MAX_VARIANCE = 0.2;
const WARMUP_FACTOR = 0.6;
const CHARS_PER_WORD = 5;

/** mulberry32 seeded from a string (same algorithm as the server's). */
const seededRandom = (seed: string): (() => number) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Per-second speed factors for a run: warm-up, then balanced ±d pairs. */
const speedFactors = (seconds: number, seed: string): number[] => {
  const random = seededRandom(seed);
  const factors = [WARMUP_FACTOR, 2 - WARMUP_FACTOR];
  while (factors.length < seconds) {
    const d = random() * MAX_VARIANCE;
    const first = random() < 0.5 ? 1 + d : 1 - d;
    factors.push(first, 2 - first);
  }
  return factors;
};

/**
 * Characters the bot has typed after `elapsedMs`.
 * @param maxSeconds  longest run to plan for (the test's time limit)
 */
export const botCharsAt = (elapsedMs: number, wpm: number, seed: string, maxSeconds: number): number => {
  const cps = (wpm * CHARS_PER_WORD) / 60;
  const factors = speedFactors(Math.ceil(maxSeconds) + 2, seed);
  const seconds = Math.max(0, elapsedMs) / 1000;
  const whole = Math.floor(seconds);
  let chars = 0;
  for (let i = 0; i < whole && i < factors.length; i++) chars += cps * factors[i];
  chars += cps * (factors[whole] ?? 1) * (seconds - whole);
  return Math.floor(chars);
};
