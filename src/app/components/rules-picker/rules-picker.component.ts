import { Component, computed, input, output } from '@angular/core';
import { StopOnError, TypingRules } from '../../models/models';

export type RulesPatch = Partial<Pick<TypingRules, 'difficulty' | 'stopOnError' | 'spaceSkips'>>;

/**
 * Typing rules for the next runs: difficulty (hardcore keeps the strict
 * penalties), stop on error and space skips word. The server applies and
 * scores them; this only picks them.
 */
@Component({
  selector: 'app-rules-picker',
  templateUrl: './rules-picker.component.html',
})
export class RulesPickerComponent {
  readonly rules = input.required<TypingRules>();
  readonly disabled = input(false);
  readonly rulesChange = output<RulesPatch>();

  private readonly stops: { id: StopOnError; label: string; title: string }[] = [
    { id: 'off', label: 'off', title: 'Stop on error: off. Mistakes stay in the text. Click to change.' },
    { id: 'letter', label: 'letter', title: 'Stop on error: letter. A wrong key is not accepted. Click to change.' },
    { id: 'word', label: 'word', title: "Stop on error: word. Can't leave a word until it is correct. Click to change." },
  ];

  private readonly stop = computed(() => this.stops.find((s) => s.id === this.rules().stopOnError) ?? this.stops[0]);
  readonly stopLabel = computed(() => this.stop().label);
  readonly stopTitle = computed(() => this.stop().title);

  /** Off -> letter -> word -> off. */
  cycleStop(): void {
    const i = this.stops.indexOf(this.stop());
    this.set({ stopOnError: this.stops[(i + 1) % this.stops.length].id });
  }

  set(patch: RulesPatch): void {
    if (!this.disabled()) this.rulesChange.emit(patch);
  }
}
