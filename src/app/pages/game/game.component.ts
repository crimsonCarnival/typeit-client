import { AfterViewInit, Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
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
import { TextSourceDropdownComponent } from '../../components/text-source-dropdown/text-source-dropdown.component';
import { GameMode } from '../../models/models';
import { CaretPickerComponent } from '../../components/caret-picker/caret-picker.component';
import { RulesPatch, RulesPickerComponent } from '../../components/rules-picker/rules-picker.component';
import { Ghost } from '../../components/typing-area/typing-area.component';
import { botCharsAt } from '../../utils/pace-bot';
import { ghostCharsAt } from '../../utils/ghost';
import { RaceService } from '../../services/race.service';
import { RacePlayer } from '../../models/models';
import { Router } from '@angular/router';

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
    TextSourceDropdownComponent,
    CaretPickerComponent,
    RulesPickerComponent,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css',
})
export class GameComponent implements AfterViewInit {
  readonly auth = inject(AuthService);
  readonly game = inject(GameService);

  readonly gameState = this.game.gameState;
  readonly characters = this.game.characters;
  readonly results = this.game.results;
  readonly performance = this.game.performance;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly typingArea = viewChild(TypingAreaComponent);

  isFocused = false;

  readonly race = inject(RaceService);
  private readonly router = inject(Router);
  private readonly now = signal(Date.now());

  /** Seconds until a live race starts, or 0 once it has. */
  readonly raceStartsIn = computed(() => {
    const race = this.gameState().race;
    return race ? Math.max(0, Math.ceil((race.startAt - this.now()) / 1000)) : 0;
  });

  /** Racers by current position (finish order first, then progress). */
  readonly raceStandings = computed<RacePlayer[]>(() => {
    const players = [...(this.race.room()?.players ?? [])];
    return players.sort((a, b) =>
      (a.place ?? 99) - (b.place ?? 99) || b.index - a.index
    );
  });

  readonly raceFinished = computed(() => this.race.room()?.state === 'finished');

  readonly raceWinnerLabel = computed(() => {
    const room = this.race.room();
    if (!room?.winnerId) return 'No verified winner';
    if (room.winnerId === this.race.myId()) return 'You won!';
    const winner = room.players.find((p) => p.userId === room.winnerId);
    return `${winner?.displayName ?? 'Someone'} won`;
  });

  /** Run time the bot or ghost has raced so far; frozen when the run finishes. */
  private readonly botElapsedMs = signal(0);

  readonly ghost = this.game.ghost;
  readonly ghostError = signal('');

  /** Characters the recorded-run ghost has typed so far, on this text. */
  private readonly ghostChars = computed(() => {
    const g = this.ghost();
    const length = this.gameState().text.length;
    return g ? Math.min(length, ghostCharsAt(g.timeline, this.botElapsedMs())) : 0;
  });

  /** Characters the pace bot has typed so far (0 when no bot is racing). */
  private readonly botChars = computed(() => {
    const gs = this.gameState();
    if (!gs.botWpm || !gs.text) return 0;
    // Same text and speed always replay the same bot run.
    return Math.min(gs.text.length, botCharsAt(this.botElapsedMs(), gs.botWpm, `${gs.botWpm}:${gs.text}`, gs.timeMax));
  });

  private readonly botProgress = computed(() => {
    const length = this.gameState().text.length;
    return length ? this.botChars() / length : 0;
  });

  /**
   * Ghost cursors drawn in the text: the pace bot, or every other racer in a
   * live race. The player's own caret is the normal one, so a four-player
   * race shows three ghosts.
   */
  readonly ghosts = computed<Ghost[]>(() => {
    const gs = this.gameState();
    if (gs.race) {
      const room = this.race.room();
      if (!room?.text) return [];
      return room.players
        .filter((p) => p.userId !== this.race.myId())
        .map((p) => ({
          id: p.userId,
          label: p.displayName,
          index: p.index,
          color: `var(--color-avatar-${(room.players.indexOf(p) % 7) + 2})`,
        }));
    }
    const ghosts: Ghost[] = [];
    if (gs.botWpm) {
      ghosts.push({ id: 'bot', label: `Bot · ${gs.botWpm} WPM`, index: this.botChars(), color: 'var(--color-avatar-2)' });
    }
    const g = this.ghost();
    if (g) ghosts.push({ id: 'ghost', label: g.label, index: this.ghostChars(), color: 'var(--color-avatar-4)' });
    return ghosts;
  });

  /** Outcome against the recorded-run ghost once the run is over. */
  readonly ghostOutcome = computed(() => {
    const gs = this.gameState();
    const g = this.ghost();
    if (!g || !gs.isFinished) return null;
    const length = gs.text.length;
    return gs.currentIndex >= Math.min(length, this.ghostChars()) ? `You beat ${g.kind === 'pb' ? 'your PB ghost' : 'the ghost'}.` : `The ghost won this one.`;
  });

  async racePb(): Promise<void> {
    this.ghostError.set('');
    const err = await this.game.racePb();
    if (err) this.ghostError.set(err);
  }

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

  /** Focus-mode timer as M:SS. */
  readonly timeLeftLabel = computed(() => {
    const t = Math.max(0, this.gameState().timeLeft);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  });

  readonly accuracyLabel = computed(() => Math.round(this.gameState().accuracy));

  /** Words completed so far (each typed space finishes a word). */
  readonly wordsDone = computed(() => (this.gameState().currentText.match(/ /g) ?? []).length);

  /** Best WPM shown in the status line for signed-in players. */
  readonly personalBest = computed(() => this.auth.user()?.stats?.bestWpm || null);

  constructor() {
    // Keep the game service in sync with auth transitions (mount + login/logout).
    effect(() => {
      this.game.setAuthenticated(this.auth.isAuthenticated());
    });

    // Advance the bot while a run is in progress; reset it between runs.
    // The same tick drives the race countdown.
    const tick = setInterval(() => {
      this.now.set(Date.now());
      const gs = this.gameState();
      if ((!gs.botWpm && !this.ghost()) || gs.isFinished) return;
      this.botElapsedMs.set(gs.isTyping ? this.game.getElapsedMs() : 0);
    }, BOT_TICK_MS);

    // A finished run opens the results page (races show their own result).
    effect(() => {
      const gs = this.gameState();
      if (!gs.isFinished || gs.race) return;
      untracked(() => {
        this.game.lastBotOutcome.set(this.botOutcome() ?? this.ghostOutcome());
        void this.router.navigate(['/results']);
      });
    });

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

  }

  focusInput(): void {
    this.typingArea()?.focus();
  }


  handleTimeSelect(time: number): void {
    this.game.setTimeMax(time);
  }

  // Refresh button and Esc reset do the same thing: a new paragraph plus a
  // blurred input, so the "Click here to start" overlay is shown either way.
  handleReset(): void {
    // Esc mid-race leaves the race (the run is abandoned).
    if (this.gameState().race) this.leaveRace();
    this.game.generateNewParagraph();
    this.typingArea()?.blur();
  }

  leaveRace(): void {
    this.race.leave();
    this.game.clearRace();
  }

  backToLobby(): void {
    this.leaveRace();
    void this.router.navigate(['/race']);
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

  handleRulesChange(patch: RulesPatch): void {
    this.game.setRules(patch);
  }

  handleCaretChange(style: import('../../models/models').CaretStyle): void {
    this.game.setCaretStyle(style);
  }

  handleWrapperClick(event: Event): void {
    const target = event.target as HTMLElement;
    // Clicks on controls keep their own focus; anywhere else focuses the text.
    const isInteractive =
      target.closest('button, a, input, select, textarea, label') ||
      target.closest('.horizontal-textsource-dropdown');
    if (!isInteractive) {
      this.focusInput();
    }
  }
}
