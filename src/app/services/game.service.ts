import { Injectable, inject, signal } from '@angular/core';
import { GameApiService } from './game-api.service';
import { TextGeneratorService } from './text-generator.service';
import { ApiResponse, Character, GameState, PerformancePoint, PracticeKind, Results, RunGhost, TypingRules } from '../models/models';
import { ls } from '../utils/storage';
import { GameAudioService, GameSound } from './game/game-audio.service';
import { SettingsService } from './settings.service';
import { KeystrokeLog, inputKeys } from './game/keystroke-log';
import { defaultState, practiceLabel } from './game/game-state';
import { DEFAULT_RULES, KeyOutcome, TypingEngine } from './game/typing-engine';
import { PROGRESS_INTERVAL_MS, RACE_PROGRESS_INTERVAL_MS, RunSyncService } from './game/run-sync.service';

const CLOCK_TICK_MS = 250;
// Zen and phrases runs: the longest limit the server allows; no timer shown.
// (Zen also takes the longest text.)
const ZEN_WORDS = 500;
const ZEN_SECONDS = 600;

const SOUND_FOR: Partial<Record<KeyOutcome, GameSound>> = {
  correct: 'key',
  skip: 'key',
  wrong: 'error',
  rejected: 'error',
  blocked: 'error',
};

/**
 * Typing game state. The server is the source of truth for every number:
 * this service applies the run's input rules for instant feedback
 * (TypingEngine), streams the keys (RunSyncService) and shows what the
 * server computes, live and at the end.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly gameApi = inject(GameApiService);
  private readonly textGenerator = inject(TextGeneratorService);
  private readonly audio = inject(GameAudioService);
  private readonly sync = inject(RunSyncService);
  private readonly settings = inject(SettingsService);

  private readonly gameStateSignal = signal<GameState>(defaultState(false));
  readonly gameState = this.gameStateSignal.asReadonly();
  readonly characters = signal<Character[]>([]);
  readonly results = signal<Results | null>(null);
  readonly performance = signal<PerformancePoint[]>([]);
  /** A recorded run raced as a ghost cursor (your PB or a daily winner), or null. */
  readonly ghost = signal<RunGhost | null>(null);

  /** Why the last run has no results (e.g. the server couldn't be reached). */
  readonly scoreError = signal<string | null>(null);
  /** Why the last run was failed by the player's own rules (expert, master, minimums), or null. */
  readonly failReason = signal<string | null>(null);

  /** True while a guest-finished game is being migrated to the authenticated account. */
  private readonly migrationPending = signal(false);
  readonly isMigrating = this.migrationPending.asReadonly();

  /** Server session id (guest runs need it on every request). */
  private sessionId: string | null = null;
  private isAuthenticated = false;
  private initialAuth: boolean | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private startTime: number | null = null;
  private starting = false;
  private ending = false;
  private engine = new TypingEngine('');
  private readonly log = new KeystrokeLog();
  /** Time limit of the run on screen (the server's; zen runs differ from the setting). */
  private runLimitSec: number | null = null;
  /** Guest run finished before signing in: saved to the account on sign-in. */
  private guestFinishedId: string | null = null;

  /** Current test settings in the shape the game endpoints take. */
  private settingsPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const gs = this.gameState();
    return {
      gameMode: gs.gameMode,
      wordCount: gs.zen && gs.gameMode === 'words' ? ZEN_WORDS : gs.wordCount,
      timeMax: gs.zen || gs.gameMode === 'phrases' ? ZEN_SECONDS : gs.timeMax,
      punctuationEnabled: gs.punctuationEnabled,
      numbersEnabled: gs.numbersEnabled,
      textCategory: gs.textCategory,
      language: gs.language,
      codeLanguage: gs.codeLanguage,
      rules: { difficulty: gs.rules.difficulty, stopOnError: gs.rules.stopOnError, spaceSkips: gs.rules.spaceSkips },
      ...overrides,
    };
  }

  private playSound(sound: GameSound): void {
    const s = this.settings.settings();
    if (sound === 'error' && !s.errorSound) return;
    this.audio.play(sound, this.gameState().isMuted, s.soundPack, s.soundVolume);
  }

  private rulesFrom(data: any): TypingRules {
    return data?.rules ? { ...DEFAULT_RULES, ...data.rules } : this.gameState().rules;
  }

  /** Applies server-provided fresh text (no resume). */
  private applyNewText(data: any): void {
    this.resetInternalState();
    // A daily ghost belongs to that day's text only.
    if (this.ghost()?.kind === 'daily') this.ghost.set(null);
    if (data.sessionId) this.sessionId = data.sessionId;
    this.runLimitSec = data.timeMax ?? null;
    const rules = this.rulesFrom(data);
    this.engine = new TypingEngine(data.text || '', rules);
    this.characters.set(this.engine.characters());
    this.gameStateSignal.update(prev => ({
      ...prev,
      text: data.text,
      totalWords: data.totalWords,
      passage: data.passage ?? null,
      rules,
      currentText: '',
      currentIndex: 0,
      mistakes: 0,
      successes: 0,
      accuracy: 0,
      score: 0,
      completionPercentage: 0,
      lastWpm: 0,
      lastCpm: 0,
      timeLeft: this.runLimitSec ?? prev.timeMax,
      isTyping: false,
      isFinished: false,
      dailyDate: null,
      practice: null,
      race: null,
    }));
  }

  /**
   * Applies server session state. A run the server already holds keys for
   * continues on the server's clock (its deadline may already have passed).
   */
  private applyServerText(data: any): void {
    this.resetInternalState();
    if (data.sessionId) this.sessionId = data.sessionId;
    this.runLimitSec = data.timeMax ?? null;
    // A zen or phrases run's long limit is not the player's time setting.
    const untimedRun = (this.gameState().zen || (data.gameMode ?? this.gameState().gameMode) === 'phrases') && !data.dailyDate && !data.practice && !data.raceCode;
    const text: string = data.text || '';
    const rules = this.rulesFrom(data);
    const resumeText: string = data.incomplete && typeof data.typedText === 'string' ? data.typedText : '';
    const keyCount: number = data.incomplete ? data.keyCount ?? 0 : 0;

    this.engine = new TypingEngine(text, rules, resumeText);
    this.log.reset(keyCount);
    this.characters.set(this.engine.characters());
    this.gameStateSignal.update(prev => ({
      ...prev,
      text,
      totalWords: data.totalWords ?? prev.totalWords,
      passage: data.passage ?? null,
      textCategory: data.textCategory ?? prev.textCategory,
      rules,
      currentText: this.engine.value,
      currentIndex: this.engine.position,
      mistakes: 0,
      successes: 0,
      accuracy: 0,
      lastWpm: 0,
      lastCpm: 0,
      completionPercentage: text.length ? (this.engine.position / text.length) * 100 : 0,
      gameMode: data.gameMode ?? prev.gameMode,
      wordCount: this.gameState().zen && untimedRun ? prev.wordCount : data.wordCount ?? prev.wordCount,
      timeMax: untimedRun ? prev.timeMax : data.timeMax ?? prev.timeMax,
      timeLeft: data.timeMax ?? prev.timeMax,
      language: data.language ?? prev.language,
      codeLanguage: data.codeLanguage ?? prev.codeLanguage,
      punctuationEnabled: data.punctuationEnabled ?? prev.punctuationEnabled,
      numbersEnabled: data.numbersEnabled ?? prev.numbersEnabled,
      dailyDate: data.dailyDate ?? null,
      practice: data.practice ? { ...data.practice, label: practiceLabel(data.practice) } : null,
      // The start time only comes from the race socket; keep it while the
      // server session is still the race's.
      race: data.raceCode && prev.race?.code === data.raceCode ? prev.race : null,
      isTyping: false,
      isFinished: false,
    }));

    if (keyCount > 0 && data.startedAt && data.serverNow && !data.raceCode) {
      this.startRun(Date.now() - (data.serverNow - data.startedAt));
      void this.sync.flush().then(() => this.applyLive());
    }
  }

  /** Locally generated text (phrases mode, generated or lorem source). */
  private generateLocalText(): { text: string; totalWords: number } {
    const gs = this.gameState();
    if (gs.textSource === 'custom') {
      const text = (ls.get('customText') ?? '').replace(/\s+/g, ' ').trim() || 'Paste your own text in the text source menu.';
      return { text, totalWords: text.split(' ').length };
    }
    if (gs.textSource === 'lorem') {
      return this.textGenerator.generateLorem(gs.loremMin, gs.loremMax);
    }
    return this.textGenerator.generate({
      unit: gs.generatorUnit,
      count: gs.generatorCount,
    });
  }

  /** Text the client brings itself (generated/lorem phrases), or null for server text. */
  private clientTextPayload(): Record<string, unknown> {
    const gs = this.gameState();
    if (gs.gameMode !== 'phrases' || gs.textSource === 'default') return {};
    const local = this.generateLocalText();
    return { clientText: local.text, clientTotalWords: local.totalWords };
  }

  /** Guest init: a fresh guest run (held by the server in memory, scored there). */
  private async initGame(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try {
      const response = await this.gameApi.resetGame({ ...this.settingsPayload(), ...this.clientTextPayload() });
      if (response.success) this.applyNewText(response.data);
    } finally {
      this.starting = false;
    }
  }

  /** Authenticated init: get-or-create the server session (resumes in-progress games). */
  private async initSession(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try {
      const response = await this.gameApi.startGame({ ...this.settingsPayload(), persist: true, ...this.clientTextPayload() });
      if (response.success) this.applyServerText(response.data);
    } finally {
      this.starting = false;
    }
  }

  /**
   * Drives (re)initialization whenever the auth state changes. The first call
   * applies the auth-dependent defaults; later transitions keep the current
   * settings and only reset transient progress.
   */
  setAuthenticated(isAuth: boolean): void {
    if (this.initialAuth === null) {
      this.initialAuth = isAuth;
      this.isAuthenticated = isAuth;
      // Keep a bot or race chosen on another page before the game first initialised.
      const { botWpm, race } = this.gameState();
      this.gameStateSignal.set({ ...defaultState(isAuth), botWpm, race });
      this.init();
      return;
    }
    if (isAuth === this.initialAuth) return;
    this.initialAuth = isAuth;

    if (isAuth) {
      this.isAuthenticated = true;
      void this.adoptGuestGame();
      return;
    }

    this.isAuthenticated = false;
    this.resetInternalState();
    this.sessionId = null;
    this.init();
  }

  /**
   * Carries a guest's work into the account on sign-up/sign-in: a finished
   * guest run is saved as a result (the server re-scores it from its log);
   * a run in progress becomes the player's session, keys and clock included.
   */
  private async adoptGuestGame(): Promise<void> {
    const gs = this.gameState();

    if (this.guestFinishedId) {
      const guestSessionId = this.guestFinishedId;
      this.guestFinishedId = null;
      this.migrationPending.set(true);
      try {
        const response = await this.gameApi.migrateGame({ guestSessionId });
        if (response.success && response.data?.results) this.showResults(response.data.results);
      } finally {
        this.migrationPending.set(false);
      }
      return;
    }

    if (gs.isTyping && this.sessionId) {
      const guestSessionId = this.sessionId;
      await this.sync.flush();
      const response = await this.gameApi.migrateGame({ guestSessionId });
      if (response.success && response.data?.sessionId) {
        this.sessionId = response.data.sessionId;
        // Signed in now: the token identifies the run.
        this.sync.begin(this.log, {
          sessionId: null,
          serverKeys: response.data.keyCount ?? 0,
          elapsed: () => this.getElapsedMs(),
        });
        return;
      }
    }

    this.resetInternalState();
    this.sessionId = null;
    this.init();
  }

  private init(): void {
    if (this.isAuthenticated) {
      void this.initSession();
    } else {
      void this.initGame();
    }
  }

  private stopTimers(): void {
    if (this.clock) clearInterval(this.clock);
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.clock = null;
    this.progressTimer = null;
  }

  /** Starts the run clock and key streaming. `startTime` is on the local clock. */
  private startRun(startTime: number): void {
    const race = this.gameState().race;
    this.startTime = startTime;
    this.gameStateSignal.update(prev => ({ ...prev, isTyping: true }));
    this.sync.begin(this.log, {
      sessionId: this.isAuthenticated ? null : this.sessionId,
      serverKeys: this.log.total,
      elapsed: () => this.getElapsedMs(),
      leadMs: race ? () => Math.max(0, Date.now() - race.startAt) : undefined,
      botWpm: this.gameState().botWpm,
    });

    this.stopTimers();
    this.clock = setInterval(() => this.tickClock(), CLOCK_TICK_MS);
    this.progressTimer = setInterval(() => {
      void this.sync.flush().then(() => this.applyLive());
    }, race ? RACE_PROGRESS_INTERVAL_MS : PROGRESS_INTERVAL_MS);
  }

  /** Counts down to the server's deadline (time penalties move it earlier). */
  private tickClock(): void {
    if (!this.startTime) return;
    const gs = this.gameState();
    const deadline = this.sync.live()?.deadlineMs ?? (this.runLimitSec ?? gs.timeMax) * 1000;
    const remaining = deadline - this.getElapsedMs();
    const timeLeft = Math.max(0, Math.ceil(remaining / 1000));
    if (timeLeft !== gs.timeLeft) {
      // The time warning sounds once, as the clock reaches the chosen second (not in zen runs).
      const warn = this.settings.settings().timeWarning;
      if (warn && timeLeft === warn && gs.timeLeft > warn && !gs.zen) this.audio.playWarning(gs.isMuted, this.settings.settings().soundVolume);
      this.gameStateSignal.update(prev => ({ ...prev, timeLeft }));
    }
    if (remaining <= 0) void this.handleEnd();
  }

  /** Copies the server's live numbers into the display state. */
  private applyLive(): void {
    const live = this.sync.live();
    if (!live || this.gameState().isFinished) return;
    this.gameStateSignal.update(prev => ({
      ...prev,
      lastWpm: live.wpm,
      accuracy: live.accuracy,
      mistakes: live.mistakes,
    }));
    this.checkMinimums(live.wpm, live.accuracy);
  }

  /** Seconds before the minimum speed and accuracy apply: the first words are always slow. */
  private static readonly MINIMUMS_AFTER_MS = 5000;

  private checkMinimums(wpm: number, accuracy: number): void {
    const s = this.settings.settings();
    const gs = this.gameState();
    if (!gs.isTyping || gs.race || gs.dailyDate || this.getElapsedMs() < GameService.MINIMUMS_AFTER_MS) return;
    if (s.minWpm && wpm < s.minWpm) this.failRun(`Your speed fell below ${s.minWpm} WPM.`);
    else if (s.minAccuracy && accuracy < s.minAccuracy) this.failRun(`Your accuracy fell below ${s.minAccuracy}%.`);
  }

  /** Whether the word just finished by a space (in the typed text before it) had a mistake. */
  private wordHadMistake(typedBefore: string): boolean {
    const text = this.gameState().text;
    const end = typedBefore.length;
    let start = typedBefore.lastIndexOf(' ', end - 1) + 1;
    if (start < 0) start = 0;
    for (let i = start; i < end; i++) if (typedBefore[i] !== text[i]) return true;
    return false;
  }

  /**
   * Ends the run as failed by the player's own rules: nothing is scored or
   * saved (it stays a started, unfinished test) and fresh text is loaded.
   * Daily challenges and races are never failed this way.
   */
  failRun(reason: string): void {
    const gs = this.gameState();
    if (!gs.isTyping || gs.race || gs.dailyDate || this.ending) return;
    this.failReason.set(reason);
    this.playSound('error');
    void this.resetGame();
  }

  private showResults(data: Results): void {
    this.results.set(data);
    this.performance.set(data.performance ?? []);
    this.scoreError.set(null);
    this.gameStateSignal.update(prev => ({
      ...prev,
      isTyping: false,
      isFinished: true,
      score: data.score,
      lastWpm: data.wpm,
      lastCpm: data.cpm,
      accuracy: data.accuracy,
      mistakes: data.mistakes,
      completionPercentage: data.completionPercentage ?? prev.completionPercentage,
    }));
  }

  private async handleEnd(): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    this.stopTimers();
    this.playSound('timeUp');

    try {
      const { results, error } = await this.sync.finish(this.engine.value, !this.settings.settings().saveResults);
      if (results) {
        this.showResults(results);
        if (!this.isAuthenticated) this.guestFinishedId = this.sessionId;
      } else {
        this.scoreError.set(error || 'This run could not be scored.');
        this.gameStateSignal.update(prev => ({ ...prev, isTyping: false, isFinished: true }));
      }
    } finally {
      this.ending = false;
    }
  }

  /** Handles a value change from the typing input. */
  handleTyping(value: string): void {
    try {
      const gs = this.gameState();
      if (gs.timeMax <= 0 || gs.isFinished || !gs.text || this.ending) return;

      // Live race: nobody types before the shared start.
      if (gs.race && Date.now() < gs.race.startAt) {
        this.gameStateSignal.update(prev => ({ ...prev, currentText: this.engine.value }));
        return;
      }

      const keys = inputKeys(this.engine.value, value);
      if (!keys.length) return;

      const first = !gs.isTyping;
      // In a race the clock runs from the shared start for everyone.
      if (first) {
        this.failReason.set(null);
        this.startRun(gs.race ? gs.race.startAt : Date.now());
      }

      this.log.push(keys);
      let sound: GameSound | undefined;
      const failMode = this.settings.settings().failMode;
      for (const key of keys) {
        const before = this.engine.value;
        const outcome = this.engine.apply(key);
        if (failMode === 'master' && (outcome === 'wrong' || outcome === 'rejected' || outcome === 'blocked')) {
          this.failRun('Master: a wrong key ends the test.');
          return;
        }
        if (failMode === 'expert' && key === ' ' && this.wordHadMistake(before)) {
          this.failRun('Expert: a word was finished with a mistake.');
          return;
        }
        sound = SOUND_FOR[outcome] === 'error' ? 'error' : sound ?? SOUND_FOR[outcome];
      }
      if (sound) this.playSound(sound);

      const position = this.engine.position;
      this.characters.set(this.engine.characters());
      this.gameStateSignal.update(prev => ({
        ...prev,
        currentText: this.engine.value,
        currentIndex: position,
        completionPercentage: prev.text.length ? (position / prev.text.length) * 100 : 0,
      }));

      // The first batch starts the run on the server clock.
      if (first) void this.sync.flush().then(() => this.applyLive());
      if (this.engine.done) void this.handleEnd();
    } catch {
      // Input handling must never throw in a controlled input.
    }
  }

  /** Common reset of transient run state. The text is repopulated by the caller. */
  private resetInternalState(): void {
    this.stopTimers();
    this.sync.stop();
    this.startTime = null;
    this.ending = false;
    this.log.reset();
    this.engine = new TypingEngine(this.gameState().text || '', this.gameState().rules);
    this.results.set(null);
    this.performance.set([]);
    this.scoreError.set(null);
  }

  /**
   * Applies a settings change that regenerates the text: signed-in players
   * PATCH their session, guests get a fresh guest run.
   */
  private async updateSettingsAndRefresh(payload: Record<string, unknown>): Promise<void> {
    this.resetInternalState();
    if (this.isAuthenticated && this.sessionId) {
      const response = await this.gameApi.updateSettings(payload);
      if (response.success) this.applyNewText(response.data);
    } else if (this.isAuthenticated) {
      await this.initSession();
    } else {
      const response = await this.gameApi.resetGame({ ...payload, ...this.clientTextPayload() });
      if (response.success) this.applyNewText(response.data);
    }
  }

  async resetGame(overrideWordCount: number | null = null): Promise<void> {
    this.resetInternalState();
    const gs = this.gameState();
    if (this.isAuthenticated && !this.sessionId) {
      await this.initSession();
      return;
    }
    const response = await this.gameApi.resetGame({
      ...this.settingsPayload({ wordCount: overrideWordCount || gs.wordCount }),
      ...this.clientTextPayload(),
    });
    if (response.success) this.applyNewText(response.data);
    else this.characters.set(this.engine.characters());
  }

  async generateNewParagraph(): Promise<void> {
    await this.resetGame();
  }

  setTimeMax(time: number): void {
    ls.set('timeMax', String(time));
    this.gameStateSignal.update(prev => ({ ...prev, timeMax: time, timeLeft: time }));
    if (this.isAuthenticated && this.sessionId) {
      void this.gameApi.updateSettings({ timeMax: time });
    } else {
      // Guest runs carry their limit: start a run with the new one.
      void this.resetGame();
    }
  }

  setGameMode(mode: GameState['gameMode']): void {
    ls.set('gameMode', mode);
    this.gameStateSignal.update(prev => ({ ...prev, gameMode: mode }));
    void this.updateSettingsAndRefresh(this.settingsPayload());
  }

  setWordCount(count: number): void {
    ls.set('wordCount', String(count));
    this.gameStateSignal.update(prev => ({ ...prev, wordCount: count }));
    void this.updateSettingsAndRefresh(this.settingsPayload({ wordCount: count }));
  }

  togglePunctuation(): void {
    const newEnabled = !this.gameState().punctuationEnabled;
    ls.set('punctuationEnabled', String(newEnabled));
    this.gameStateSignal.update(prev => ({ ...prev, punctuationEnabled: newEnabled }));
    void this.updateSettingsAndRefresh(this.settingsPayload({ punctuationEnabled: newEnabled }));
  }

  toggleNumbers(): void {
    const newEnabled = !this.gameState().numbersEnabled;
    ls.set('numbersEnabled', String(newEnabled));
    this.gameStateSignal.update(prev => ({ ...prev, numbersEnabled: newEnabled }));
    void this.updateSettingsAndRefresh(this.settingsPayload({ numbersEnabled: newEnabled }));
  }

  /**
   * Applies settings that arrived from the account (on sign-in): caret and
   * sound at once; changed typing rules start a new run under them.
   */
  applySyncedSettings(): void {
    const s = this.settings.settings();
    const gs = this.gameState();
    const rulesChanged = gs.rules.difficulty !== s.difficulty || gs.rules.stopOnError !== s.stopOnError || gs.rules.spaceSkips !== s.spaceSkips;
    this.gameStateSignal.update(prev => ({
      ...prev,
      caretStyle: s.caretStyle,
      isMuted: s.soundMuted,
      rules: { ...prev.rules, difficulty: s.difficulty, stopOnError: s.stopOnError, spaceSkips: s.spaceSkips },
    }));
    if (rulesChanged && !gs.isTyping && !gs.isFinished && !gs.dailyDate && !gs.race && !gs.practice) {
      void this.updateSettingsAndRefresh(this.settingsPayload());
    }
  }

  /** Words mode language or code mode snippet language; starts a new run. */
  setLanguage(patch: Partial<Pick<GameState, 'language' | 'codeLanguage'>>): void {
    if (patch.language) ls.set('language', patch.language);
    if (patch.codeLanguage) ls.set('codeLanguage', patch.codeLanguage);
    this.gameStateSignal.update(prev => ({ ...prev, ...patch }));
    void this.updateSettingsAndRefresh(this.settingsPayload());
  }

  /** Zen: a long untimed-feeling run you end yourself. */
  setZen(zen: boolean): void {
    ls.set('zen', String(zen));
    this.gameStateSignal.update(prev => ({ ...prev, zen }));
    void this.updateSettingsAndRefresh(this.settingsPayload());
  }

  /** Ends the run now (zen's Finish button); the server scores what was typed. */
  finishRun(): void {
    if (this.gameState().isTyping) void this.handleEnd();
  }

  /** Saves pasted text for the custom source and starts a run on it. */
  setCustomText(text: string): void {
    ls.set('customText', text);
    this.setGeneratorConfig({ textSource: 'custom' });
  }

  /** Changes the typing rules (difficulty, stop on error, space skips); starts a new run. */
  setRules(patch: Partial<Pick<TypingRules, 'difficulty' | 'stopOnError' | 'spaceSkips'>>): void {
    this.settings.update(patch);
    this.gameStateSignal.update(prev => ({ ...prev, rules: { ...prev.rules, ...patch } }));
    void this.updateSettingsAndRefresh(this.settingsPayload());
  }

  setCaretStyle(style: GameState['caretStyle']): void {
    this.settings.update({ caretStyle: style });
    this.gameStateSignal.update(s => ({ ...s, caretStyle: style }));
  }

  toggleMute(): void {
    const newMuted = !this.gameState().isMuted;
    this.settings.update({ soundMuted: newMuted });
    this.gameStateSignal.update(prev => ({ ...prev, isMuted: newMuted }));
  }

  /**
   * Updates the text generator config, persists to localStorage, and regenerates
   * text immediately. Used by the text source dropdown component.
   */
  setGeneratorConfig(patch: Partial<{
    textSource: GameState['textSource'];
    textCategory: GameState['textCategory'];
    generatorUnit: GameState['generatorUnit'];
    generatorCount: number;
    loremMin: number;
    loremMax: number;
  }>): void {
    if (patch.textSource !== undefined)     ls.set('textSource', patch.textSource);
    if (patch.textCategory !== undefined)   ls.set('textCategory', patch.textCategory);
    if (patch.generatorUnit !== undefined)  ls.set('generatorUnit', patch.generatorUnit);
    if (patch.generatorCount !== undefined) ls.set('generatorCount', String(patch.generatorCount));
    if (patch.loremMin !== undefined)       ls.set('loremMin', String(patch.loremMin));
    if (patch.loremMax !== undefined)       ls.set('loremMax', String(patch.loremMax));

    this.gameStateSignal.update(prev => ({ ...prev, ...patch }));
    void this.resetGame();
  }

  /**
   * Restarts the current text from the beginning (nothing typed yet, so the
   * server run has no keys). Bound to the Tab key shortcut.
   */
  restartSameText(): void {
    const gs = this.gameState();
    if (gs.isTyping || gs.isFinished || !gs.text) return;
    this.resetInternalState();
    this.characters.set(this.engine.characters());
    this.gameStateSignal.update(prev => ({
      ...prev,
      currentText: '',
      currentIndex: 0,
      completionPercentage: 0,
      timeLeft: prev.timeMax,
    }));
  }

  /**
   * Starts today's daily challenge: the server uses up the player's attempt
   * and switches their session to the daily text, which is applied here.
   */
  async startDaily(): Promise<ApiResponse<unknown>> {
    const response = await this.gameApi.startDaily();
    if (response.success && response.data) this.applyServerText(response.data);
    return response;
  }

  /**
   * Loads a practice text focused on one key or digraph (from the error map).
   * Drill runs are saved but never ranked.
   */
  startDrill(target: string): Promise<ApiResponse<unknown>> {
    return this.applyPractice(this.gameApi.startDrill(target));
  }

  /** Practice weighted toward your weakest keys and digraphs. Never ranked. */
  startWeakKeys(): Promise<ApiResponse<unknown>> {
    return this.applyPractice(this.gameApi.startWeakKeys());
  }

  /** Loads a lesson, the common-words drill, a custom list or a digraph review. Never ranked. */
  startPractice(kind: Exclude<PracticeKind, 'drill'>, id?: string, label?: string): Promise<ApiResponse<unknown>> {
    return this.applyPractice(this.gameApi.startPractice(kind, id), label);
  }

  private async applyPractice(request: Promise<ApiResponse<any>>, label?: string): Promise<ApiResponse<unknown>> {
    const response = await request;
    if (response.success && response.data) {
      this.applyServerText(response.data);
      if (label) {
        this.gameStateSignal.update(prev => (prev.practice ? { ...prev, practice: { ...prev.practice, label } } : prev));
      }
    }
    return response;
  }

  /**
   * Loads the race the server just started: its session already holds the
   * race text and start time. `startAt` is on the local clock.
   */
  async startRace(code: string, startAt: number): Promise<void> {
    this.resetInternalState();
    this.gameStateSignal.update(prev => ({ ...prev, race: { code, startAt }, botWpm: null }));
    const response = await this.gameApi.getGameState();
    if (response.success && response.data) this.applyServerText(response.data);
  }

  /** Leaves race mode locally (the race socket handles the server side). */
  clearRace(): void {
    this.gameStateSignal.update(prev => ({ ...prev, race: null }));
  }

  /**
   * Drops what a bot race, ghost, daily, practice or finished race left on
   * this singleton, so the next plain run starts clean. A race still live
   * stays: the server is waiting on it.
   */
  abandonSession(raceIsLive: boolean): void {
    const gs = this.gameState();
    const staleRace = !!gs.race && !raceIsLive;
    // A test left half-typed is abandoned too (a live race is not: it runs on without us).
    const abandonedRun = gs.isTyping && !(gs.race && raceIsLive);
    if (!gs.botWpm && !this.ghost() && !gs.dailyDate && !gs.practice && !staleRace && !abandonedRun) return;
    this.setBot(null);
    this.ghost.set(null);
    this.lastBotOutcome.set(null);
    if (staleRace) this.clearRace();
    void this.resetGame();
  }

  /** Bot race outcome of the run that just finished, shown on the results page. */
  readonly lastBotOutcome = signal<string | null>(null);

  /**
   * "Retry same" from the results page: the same text again, as client
   * text, so the retry is saved but never ranked (the text is already known).
   */
  async retrySame(): Promise<void> {
    const gs = this.gameState();
    if (!gs.text) return;
    this.resetInternalState();
    const response = await this.gameApi.resetGame({
      ...this.settingsPayload(),
      clientText: gs.text,
      clientTotalWords: gs.totalWords,
    });
    if (response.success) this.applyNewText(response.data);
  }

  /** Milliseconds since the run started (0 before it). */
  getElapsedMs(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  /**
   * Races your best ranked run for the current mode and time limit. Resolves
   * to an error message when there is no such run yet.
   */
  async racePb(): Promise<string | null> {
    const gs = this.gameState();
    const res = await this.gameApi.getPbGhost(gs.gameMode, gs.timeMax);
    if (!res.success) return res.error || 'Could not load your best run';
    if (!res.data) return `No verified ${gs.gameMode} run at ${gs.timeMax}s yet`;
    this.ghost.set({ kind: 'pb', label: `PB · ${res.data.wpm} WPM`, wpm: res.data.wpm, timeline: res.data.timeline });
    return null;
  }

  /** Practice run on a day's text against its winner's ghost. */
  async raceDailyGhost(date?: string): Promise<ApiResponse<unknown>> {
    const res = await this.gameApi.startDailyGhost(date);
    if (res.success && res.data) {
      this.applyServerText(res.data.state);
      this.ghost.set({ kind: 'daily', ...res.data.ghost });
    }
    return res;
  }

  stopGhost(): void {
    this.ghost.set(null);
  }

  /** Races a client-side pace bot on the next runs (null stops). Purely visual. */
  setBot(wpm: number | null): void {
    this.gameStateSignal.update(prev => ({ ...prev, botWpm: wpm }));
  }

  /** Exposes the text generator service so toolbar components can extend vocabulary. */
  get generator(): TextGeneratorService {
    return this.textGenerator;
  }
}
