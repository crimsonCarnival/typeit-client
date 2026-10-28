import { Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { EMOTES, RaceService } from '../../services/race.service';
import { RaceEmote } from '../../models/models';

/** Room chat and emotes, for racers and spectators. */
@Component({
  selector: 'app-race-chat',
  templateUrl: './race-chat.component.html',
  styleUrl: './race-chat.component.css',
})
export class RaceChatComponent {
  readonly race = inject(RaceService);
  /** Compact: emotes and the last few lines only (during a race). */
  readonly compact = input(false);

  readonly emotes = Object.entries(EMOTES) as [RaceEmote, string][];
  readonly emoteLabel = EMOTES;
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    // Keep the newest line in view.
    effect(() => {
      this.race.chat();
      const el = this.log()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  send(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    this.race.say(input.value);
    input.value = '';
  }

  lines() {
    const all = this.race.chat();
    return this.compact() ? all.slice(-3) : all;
  }
}
