import { GhostTimeline } from '../models/models';

/** Characters a ghost has typed `ms` into the run (its last point at or before then). */
export const ghostCharsAt = (timeline: GhostTimeline, ms: number): number => {
  let lo = 0;
  let hi = timeline.length - 1;
  let chars = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid][0] <= ms) {
      chars = timeline[mid][1];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return chars;
};
