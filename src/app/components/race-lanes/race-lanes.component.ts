import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface RaceLane {
  id: string;
  label: string;
  initial: string;
  /** 0..1 */
  progress: number;
  /** CSS colour, e.g. 'var(--color-primary)' */
  color: string;
  /** Highlights the player's own lane. */
  me?: boolean;
}

/** Start-to-finish progress lanes, used by bot races and live races. */
@Component({
  selector: 'app-race-lanes',
  imports: [DecimalPipe],
  templateUrl: './race-lanes.component.html',
  styleUrl: './race-lanes.component.css',
})
export class RaceLanesComponent {
  readonly lanes = input.required<RaceLane[]>();

  clamp(p: number): number {
    return Math.min(1, Math.max(0, p));
  }
}
