import { AfterViewInit, Component, DestroyRef, computed, effect, inject, signal, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { MDCTooltip } from '@material/tooltip';
import { createTooltip, destroyTooltip } from '../../utils/tooltip.utils';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { SoundToggleComponent } from '../../components/sound-toggle/sound-toggle.component';
import { RefreshButtonComponent } from '../../components/refresh-button/refresh-button.component';
import { ModeDropdownComponent } from '../../components/mode-dropdown/mode-dropdown.component';
import { WordCountDropdownComponent } from '../../components/word-count-dropdown/word-count-dropdown.component';
import { WordModeSettingsComponent } from '../../components/word-mode-settings/word-mode-settings.component';
import { CustomTimeDropdownComponent } from '../../components/custom-time-dropdown/custom-time-dropdown.component';
import { ShortcutsFooterComponent } from '../../components/shortcuts-footer/shortcuts-footer.component';
import { TypingAreaComponent } from '../../components/typing-area/typing-area.component';
import { ResultsModalComponent } from '../../components/results-modal/results-modal.component';
import { TextSourceDropdownComponent } from '../../components/text-source-dropdown/text-source-dropdown.component';
import { GameMode } from '../../models/models';
import { CaretPickerComponent } from '../../components/caret-picker/caret-picker.component';
import { RaceLane, RaceLanesComponent } from '../../components/race-lanes/race-lanes.component';
import { botCharsAt } from '../../utils/pace-bot';

const BOT_TICK_MS = 100;

@Component({
  selector: 'app-game',
  imports: [
    FormsModule,
    SoundToggleComponent,
    RefreshButtonComponent,
    ModeDropdownComponent,
    WordCountDropdownComponent,
    WordModeSettingsComponent,
    CustomTimeDropdownComponent,
    ShortcutsFooterComponent,
    TypingAreaComponent,
    ResultsModalComponent,
    TextSourceDropdownComponent,
    CaretPickerComponent,
    RaceLanesComponent,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css',
})
export class GameComponent implements AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly game = inject(GameService);

  readonly gameState = this.game.gameState;
  readonly characters = this.game.characters;
  readonly results = this.game.results;
  readonly performance = this.game.performance;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly typingArea = viewChild(TypingAreaComponent);

  inputReady = false;
  isFocused = false;

  /** Run time the bot has raced so far; frozen when the run finishes. */
  private readonly botElapsedMs = signal(0);

  private readonly botProgress = computed(() => {
    const gs = this.gameState();
    if (!gs.botWpm || !gs.text) return 0;
    // Same text and speed always replay the same bot run.
    const chars = botCharsAt(this.botElapsedMs(), gs.botWpm, `${gs.botWpm}:${gs.text}`, gs.timeMax);
    return Math.min(1, chars / gs.text.length);
  });

  readonly botLanes = computed<RaceLane[] | null>(() => {
    const gs = this.gameState();
    if (!gs.botWpm) return null;
    return [
      { id: 'you', label: 'You', initial: 'Y', progress: gs.completionPercentage / 100, color: 'var(--color-primary)', me: true },
      { id: 'bot', label: `Bot at ${gs.botWpm} WPM`, initial: 'B', progress: this.botProgress(), color: 'var(--color-avatar-2)' },
    ];
  });

  /** Outcome once the run is over, or null while racing. */
  readonly botOutcome = computed(() => {
    const gs = this.gameState();
    if (!gs.botWpm || !gs.isFinished) return null;
    const you = gs.completionPercentage / 100;
    const bot = this.botProgress();
    if (you >= 1 && bot < 1) return 'You beat the bot.';
    if (bot >= 1 && you < 1) return 'The bot won this one.';
    return you >= bot ? 'You beat the bot.' : 'The bot won this one.';
  });

  readonly richTooltipEl = viewChild<ElementRef<HTMLElement>>('richTooltipEl');
  private richTooltip?: MDCTooltip;

  constructor() {
    // Keep the game service in sync with auth transitions (mount + login/logout).
    effect(() => {
      this.game.setAuthenticated(this.auth.isAuthenticated());
    });

    // Advance the bot while a run is in progress; reset it between runs.
    const tick = setInterval(() => {
      const gs = this.gameState();
      if (!gs.botWpm || gs.isFinished) return;
      this.botElapsedMs.set(gs.isTyping ? this.game.getElapsedMs() : 0);
    }, BOT_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  ngAfterViewInit(): void {
    // Clean up ?sessionId= from legacy session-sharing links.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('sessionId')) {
        url.searchParams.delete('sessionId');
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    } catch {
      // ignore in non-browser environments
    }

    this.richTooltip = createTooltip(this.richTooltipEl()?.nativeElement);
  }

  ngOnDestroy() {
    destroyTooltip(this.richTooltip, this.richTooltipEl()?.nativeElement);
  }

  focusInput(): void {
    this.typingArea()?.focus();
  }

  async handleCloseResults(): Promise<void> {
    await this.game.resetGame();
    this.inputReady = false;
    this.isFocused = false;
    this.focusInput();
    void this.auth.refreshProfile();
  }

  handleTimeSelect(time: number): void {
    this.game.setTimeMax(time);
    this.inputReady = true;
  }

  // Refresh button and Esc reset do the same thing: a new paragraph plus a
  // blurred input, so the "Click here to start" overlay is shown either way.
  handleReset(): void {
    this.game.generateNewParagraph();
    this.typingArea()?.blur();
  }

  handleModeChange(mode: GameMode): void {
    this.game.setGameMode(mode);
  }

  handleWordCountChange(count: number): void {
    this.game.setWordCount(count);
  }

  handleSourceChange(patch: Parameters<GameService['setGeneratorConfig']>[0]): void {
    this.game.setGeneratorConfig(patch);
  }

  handleCaretChange(style: import('../../models/models').CaretStyle): void {
    this.game.setCaretStyle(style);
  }

  handleWrapperClick(event: Event): void {
    const target = event.target as HTMLElement;
    const isInteractive =
      target.closest('button') ||
      target.closest('.toggle-icon') ||
      target.closest('.horizontal-time-dropdown') ||
      target.closest('.horizontal-mode-dropdown') ||
      target.closest('.horizontal-wordcount-dropdown') ||
      target.closest('.horizontal-textsource-dropdown') ||
      target.closest('.toggle-hints-btn') ||
      target.closest('.alert-card');
    if (!isInteractive) {
      this.focusInput();
    }
  }
}
