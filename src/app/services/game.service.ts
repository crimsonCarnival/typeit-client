import { Injectable, inject, signal } from '@angular/core';
import { GameApiService } from './game-api.service';
import { TextGeneratorService } from './text-generator.service';
import { AfkEvent, Character, GameState, PerformancePoint, Results } from '../models/models';
import { ls } from '../utils/storage';

const AFK_THRESHOLD_MS = 1600;
const HEARTBEAT_INTERVAL_S = 5;
const BACKSPACE_THRESHOLD = 3;

const KEY_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-single-key_wbesmp.mp3';
const TIME_UP_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-bell_xrpggk.mp3';
const ERROR_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240116/error-sound_kpstvo.mp3';

/**
 * Creates the character array from a text string. Characters before
 * `typedPrefix` (e.g. a resumed session) are marked as already typed.
 */
const textToCharacters = (text: string, typedPrefix = ''): Character[] => {
  if (!text) return [];
  const prefixLength = typedPrefix ? typedPrefix.length : 0;
  return text.split('').map((char, index) => ({
    char,
    status: index < prefixLength ? 'correct' : '',
  }));
};

const loadAudioBuffer = async (audioContext: AudioContext, url: string): Promise<AudioBuffer | null> => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
};

const defaultState = (isAuthenticated: boolean): GameState => {
  const initialGameMode: GameState['gameMode'] = isAuthenticated
    ? (ls.get('gameMode') as GameState['gameMode']) || 'phrases'
    : 'words';
  const initialTimeMax = ls.int('timeMax', 120);
  return {
    currentText: '',
    text: '',
    currentIndex: 0,
    mistakes: 0,
    successes: 0,
    accuracy: 0,
    score: 0,
    completionPercentage: 0,
    isTyping: false,
    isFinished: false,
    timeMax: initialTimeMax,
    timeLeft: initialTimeMax,
    gameMode: initialGameMode,
    wordCount: ls.int('wordCount', 50),
    isMuted: ls.bool('soundMuted'),
    punctuationEnabled: isAuthenticated ? ls.bool('punctuationEnabled') : false,
    numbersEnabled: isAuthenticated ? ls.bool('numbersEnabled') : false,
    lastWpm: 0,
    lastCpm: 0,
    totalWords: 0,
    textSource: isAuthenticated
      ? (ls.get('textSource') as GameState['textSource']) || 'default'
      : 'default',
    generatorUnit: (ls.get('generatorUnit') as GameState['generatorUnit']) || 'sentence',
    generatorCount: ls.int('generatorCount', 3),
    loremMin: ls.int('loremMin', 20),
    loremMax: ls.int('loremMax', 60),
    caretStyle: (ls.get('caretStyle') as GameState['caretStyle']) || 'line',
  };
};

/**
 * Typing game state service. Port of the React useTypingGame hook: server
 * logic (session, scoring) lives on the server, while audio and live UI
 * state stay client-side for responsiveness.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly gameApi = inject(GameApiService);
  private readonly textGenerator = inject(TextGeneratorService);

  private readonly gameStateSignal = signal<GameState>(defaultState(false));
  readonly gameState = this.gameStateSignal.asReadonly();
  readonly characters = signal<Character[]>([]);
  readonly results = signal<Results | null>(null);
  readonly performance = signal<PerformancePoint[]>([]);

  /** True while a guest-finished game is being migrated to the authenticated account. */
  private readonly migrationPending = signal(false);
  readonly isMigrating = this.migrationPending.asReadonly();

  // Mutable accumulators (the "refs" in the React hook).
  private sessionId: string | null = null;
  private isAuthenticated = false;
  private initialAuth: boolean | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number | null = null;
  private audioContext: AudioContext | null = null;
  private keySoundBuffer: AudioBuffer | null = null;
  private timeUpSoundBuffer: AudioBuffer | null = null;
  private errorSoundBuffer: AudioBuffer | null = null;
  private starting = false;
  private ending = false;
  private lastKeystrokeTime: number | null = null;
  private afkTime = 0;
  private afkCount = 0;
  private afkEvents: AfkEvent[] = [];
  private currentText = '';
  private lastSnapshotTime = 0;
  private successes = 0;
  private mistakes = 0;
  private currentIndex = 0;
  private rawKeystrokes = 0;
  private backspaceCount = 0;
  private lastSnapshotBackspaces = 0;
  private lastTypedChar: string | null = null;
  private consecutiveKeyCount = 0;
  private penaltyTime = 0;
  private penaltyPoints = 0;
  private pendingGuestFinish: Record<string, any> | null = null;
  /** Per-key mismatch tally — sent with endGame payload for the heatmap. */
  private keyErrors: Record<string, number> = {};

  constructor() {
    this.initAudio();
  }

  private initAudio(): void {
    this.audioContext = new AudioContext();
    void Promise.all([
      loadAudioBuffer(this.audioContext, KEY_SOUND_URL),
      loadAudioBuffer(this.audioContext, TIME_UP_SOUND_URL),
      loadAudioBuffer(this.audioContext, ERROR_SOUND_URL),
    ]).then(([key, timeUp, error]) => {
      this.keySoundBuffer = key;
      this.timeUpSoundBuffer = timeUp;
      this.errorSoundBuffer = error;
    });
  }

  private playSound(buffer: AudioBuffer | null): void {
    const gs = this.gameState();
    if (!gs.isMuted && buffer && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    }
  }

  /**
   * Applies server-provided fresh text (no resume).
   */
  private applyNewText(data: any): void {
    this.characters.set(textToCharacters(data.text));
    this.currentText = '';
    this.gameStateSignal.update(prev => ({
      ...prev,
      text: data.text,
      totalWords: data.totalWords,
      currentText: '',
      currentIndex: 0,
      mistakes: 0,
      successes: 0,
      accuracy: 0,
      score: 0,
      completionPercentage: 0,
      lastWpm: 0,
      lastCpm: 0,
      isTyping: false,
      isFinished: false,
    }));
  }

  /**
   * Applies server session state, resuming typed progress when the server has it.
   */
  private applyServerText(data: any): void {
    const text: string = data.text || '';
    const resumeText: string = data.incomplete && typeof data.typedText === 'string'
      ? data.typedText
      : '';
    const idx = resumeText.length;

    let s = 0;
    let m = 0;
    for (let i = 0; i < idx; i++) {
      if (text[i] !== undefined && text[i] === resumeText[i]) s++;
      else m++;
    }

    this.currentText = resumeText;
    this.currentIndex = idx;
    this.successes = s;
    this.mistakes = m;
    this.rawKeystrokes = idx;

    this.characters.set(textToCharacters(text, resumeText));
    this.gameStateSignal.update(prev => ({
      ...prev,
      text,
      totalWords: data.totalWords ?? prev.totalWords,
      currentText: resumeText,
      currentIndex: idx,
      mistakes: m,
      successes: s,
      accuracy: s + m > 0 ? (s / (s + m)) * 100 : 0,
      completionPercentage: text.length ? (idx / text.length) * 100 : 0,
      gameMode: data.gameMode ?? prev.gameMode,
      wordCount: data.wordCount ?? prev.wordCount,
      timeMax: data.timeMax ?? prev.timeMax,
      timeLeft: data.timeMax ?? prev.timeMax,
      punctuationEnabled: data.punctuationEnabled ?? prev.punctuationEnabled,
      numbersEnabled: data.numbersEnabled ?? prev.numbersEnabled,
      isTyping: false,
      isFinished: false,
    }));
  }

  /**
   * Returns locally-generated text using txtgen (phrases mode, non-default source).
   */
  private generateLocalText(): { text: string; totalWords: number } {
    const gs = this.gameState();
    if (gs.textSource === 'lorem') {
      return this.textGenerator.generateLorem(gs.loremMin, gs.loremMax);
    }
    return this.textGenerator.generate({
      unit: gs.generatorUnit,
      count: gs.generatorCount,
    });
  }

  /**
   * Guest init: fetch fresh text without creating a server session.
   * In phrases mode with a non-default source, generate locally instead.
   */
  private async initGame(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try {
      const gs = this.gameState();
      if (gs.gameMode === 'phrases' && gs.textSource !== 'default') {
        this.applyNewText(this.generateLocalText());
        return;
      }
      const response = await this.gameApi.resetGame({
        gameMode: gs.gameMode,
        wordCount: gs.wordCount,
        timeMax: gs.timeMax,
        punctuationEnabled: gs.punctuationEnabled,
        numbersEnabled: gs.numbersEnabled,
        noSession: true,
      });
      if (response.success) this.applyNewText(response.data);
    } catch {
      // Server unreachable; keep whatever text is already rendered.
    } finally {
      this.starting = false;
    }
  }

  /**
   * Authenticated init: get-or-create the server session (resumes in-progress games).
   * When textSource !== 'default' in phrases mode, the client generates the text
   * and passes it to the server so it creates the session with that content.
   */
  private async initSession(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try {
      const gs = this.gameState();
      const clientText =
        gs.gameMode === 'phrases' && gs.textSource !== 'default'
          ? this.generateLocalText()
          : null;

      const response = await this.gameApi.startGame({
        gameMode: gs.gameMode,
        wordCount: gs.wordCount,
        timeMax: gs.timeMax,
        punctuationEnabled: gs.punctuationEnabled,
        numbersEnabled: gs.numbersEnabled,
        persist: true,
        ...(clientText ? { clientText: clientText.text, clientTotalWords: clientText.totalWords } : {}),
      });
      if (response.success) {
        const data = response.data;
        this.sessionId = data.sessionId;
        this.applyServerText(data);
      }
    } catch {
      // Fall back to guest text so the UI still works.
      this.starting = false;
      await this.initGame();
    } finally {
      this.starting = false;
    }
  }

  /**
   * Drives (re)initialization whenever the auth state changes. The first call
   * applies the auth-dependent defaults; later transitions keep the current
   * settings and only reset transient progress (mirrors the React hook).
   */
  setAuthenticated(isAuth: boolean): void {
    if (this.initialAuth === null) {
      this.initialAuth = isAuth;
      this.isAuthenticated = isAuth;
      this.gameStateSignal.set(defaultState(isAuth));
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
   * Carries a guest's work into the account on sign-up/sign-in. Two cases:
   * - a finished guest game is re-persisted server-side as a result;
   * - an in-progress guest game is adopted as the user's session so the
   *   countdown and typed progress keep running uninterrupted.
   */
  private async adoptGuestGame(): Promise<void> {
    const gs = this.gameState();

    if (this.pendingGuestFinish) {
      const pending = this.pendingGuestFinish;
      this.pendingGuestFinish = null;
      this.migrationPending.set(true);
      try {
        const response = await this.gameApi.migrateGame(pending);
        if (response.success && response.data?.results) {
          const data = response.data.results;
          this.results.set({
            ...data,
            afkTime: (((pending['endData']?.afkTime ?? 0) as number) / 1000).toFixed(2),
            afkCount: pending['endData']?.afkPeriods ?? 0,
          });
          this.gameStateSignal.update(prev => ({
            ...prev,
            isTyping: false,
            isFinished: true,
            score: data.score,
            lastWpm: data.wpm,
            lastCpm: data.cpm,
            accuracy: data.accuracy,
            completionPercentage: data.completionPercentage,
          }));
        }
      } catch {
        // Keep the guest-computed results already on screen.
      } finally {
        this.migrationPending.set(false);
      }
      return;
    }

    if (!gs.text) {
      this.sessionId = null;
      this.init();
      return;
    }

    if (gs.isTyping) {
      try {
        const response = await this.gameApi.migrateGame({
          text: gs.text,
          typedText: this.currentText,
          totalWords: gs.totalWords,
          gameMode: gs.gameMode,
          wordCount: gs.wordCount,
          timeMax: gs.timeMax,
          timeLeft: gs.timeLeft,
          punctuationEnabled: gs.punctuationEnabled,
          numbersEnabled: gs.numbersEnabled,
          incomplete: true,
        });
        if (response.success && response.data?.sessionId) {
          this.sessionId = response.data.sessionId;
          return;
        }
      } catch {
        // Fall through to a fresh session.
      }
      this.sessionId = null;
      this.init();
      return;
    }

    // Text loaded but nothing typed yet: start a fresh authenticated session.
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

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  /**
   * Persists current progress to the server (authenticated only) so the
   * session can be resumed after a reload or logout.
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isAuthenticated || !this.sessionId) return;
    try {
      const gs = this.gameState();
      await this.gameApi.saveSessionState({
        currentIndex: this.currentIndex,
        typedText: this.currentText,
        timeLeft: gs.timeLeft,
        isTyping: gs.isTyping,
        currentText: this.currentText,
      });
    } catch {
      // Heartbeat failures are non-fatal.
    }
  }

  private async handleEnd(): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    this.stopTimer();
    if (this.timeUpSoundBuffer) {
      this.playSound(this.timeUpSoundBuffer);
    }

    const gs = this.gameState();
    const gameData = {
      typedText: this.currentText,
      startTime: this.startTime,
      endTime: Date.now(),
      afkTime: this.afkTime,
      afkPeriods: this.afkCount,
      performance: this.performance(),
      penalty: this.penaltyPoints,
      rawKeystrokes: this.rawKeystrokes,
      gameMode: gs.gameMode,
      wordCount: gs.wordCount,
      timeMax: gs.timeMax,
      text: gs.text,
      totalWords: gs.totalWords,
      keyErrors: this.keyErrors,
    };

    const markFinished = () => {
      this.gameStateSignal.update(prev => ({ ...prev, isTyping: false, isFinished: true }));
    };

    try {
      const response = await this.gameApi.endGame(gameData);
      if (response.success) {
        const data = response.data;
        this.results.set({
          ...data,
          afkTime: (this.afkTime / 1000).toFixed(2),
          afkCount: this.afkCount,
        });
        this.gameStateSignal.update(prev => ({
          ...prev,
          isTyping: false,
          isFinished: true,
          score: data.score,
          lastWpm: data.wpm,
          lastCpm: data.cpm,
          accuracy: data.accuracy,
          completionPercentage: data.completionPercentage,
        }));

        // Keep the raw snapshot of a finished guest game so it can be migrated
        // into an account when the player signs up / signs in.
        if (!this.isAuthenticated) {
          this.pendingGuestFinish = {
            text: gs.text,
            totalWords: gs.totalWords,
            typedText: this.currentText,
            gameMode: gs.gameMode,
            wordCount: gs.wordCount,
            timeMax: gs.timeMax,
            punctuationEnabled: gs.punctuationEnabled,
            numbersEnabled: gs.numbersEnabled,
            endData: {
              startTime: this.startTime ?? Date.now(),
              endTime: Date.now(),
              afkTime: this.afkTime,
              afkPeriods: this.afkCount,
              performance: this.performance(),
              penalty: this.penaltyPoints,
              rawKeystrokes: this.rawKeystrokes,
            },
          };
        }
      } else {
        // E.g. no active session: fall back to client-computed stats.
        markFinished();
      }
    } catch {
      markFinished();
    } finally {
      this.ending = false;
    }
  }

  private startTimer(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      if (!this.startTime) return;

      const gs = this.gameState();
      const elapsed = (Date.now() - this.startTime) / 1000;
      const newTimeLeft = Math.max(0, Math.ceil(gs.timeMax - elapsed) - this.penaltyTime);

      if (newTimeLeft <= 0) {
        this.stopTimer();
        void this.handleEnd();
        this.gameStateSignal.update(prev => ({ ...prev, timeLeft: 0, isFinished: true, isTyping: false }));
        return;
      }

      this.gameStateSignal.update(prev => ({ ...prev, timeLeft: newTimeLeft }));
    }, 1000);

    this.snapshotInterval = setInterval(() => {
      if (!this.startTime) return;

      // Float elapsed for accurate WPM math (avoids division by zero in first second).
      const elapsed = Math.max((Date.now() - this.startTime) / 1000, 1);
      // Integer elapsed for timestamps (x-axis labels) and AFK event filtering.
      const elapsedSec = Math.round(elapsed);
      const totalChars = this.successes + this.mistakes;

      const correctChars = this.successes;
      const rawChars = this.currentText.length;
      
      const accuracy = totalChars > 0 ? (this.successes / totalChars) * 100 : 100;
      const cpm = elapsed > 0 ? Math.floor(correctChars * (60 / elapsed)) : 0;
      const wpm = Math.floor(cpm / 5) || 0;
      const rawWpm = elapsed > 0 ? Math.floor((rawChars / 5) * (60 / elapsed)) : 0;

      // Collect all AFK events since the last snapshot.
      const afkEventsForSnapshot = this.afkEvents.filter(
        (e) => e.timestamp > this.lastSnapshotTime && e.timestamp <= elapsedSec
      );
      this.lastSnapshotTime = elapsedSec;

      this.performance.update(prev => {
        let highestWpm = wpm;
        let consistency = 100;

        if (prev.length > 0) {
          highestWpm = Math.max(prev[prev.length - 1].highestWpm, wpm);

          const rawWpms = [...prev.map(p => p.rawWpm), rawWpm];
          const avgRawWpm = rawWpms.reduce((a, b) => a + b, 0) / rawWpms.length;

          if (avgRawWpm > 0) {
            const variance = rawWpms.reduce((a, b) => a + Math.pow(b - avgRawWpm, 2), 0) / rawWpms.length;
            const stdDev = Math.sqrt(variance);
            const cov = stdDev / avgRawWpm;
            consistency = Math.max(0, Math.round((1 - cov) * 10000) / 100);
          }
        }

        const backspacesDelta = this.backspaceCount - this.lastSnapshotBackspaces;
        this.lastSnapshotBackspaces = this.backspaceCount;

        return [...prev, {
          timestamp: elapsedSec,
          wpm,
          rawWpm,
          accuracy: parseFloat(accuracy.toFixed(2)),
          currentIndex: this.currentIndex,
          mistakes: this.mistakes,
          highestWpm,
          consistency,
          backspaces: backspacesDelta,
          afkPeriods: afkEventsForSnapshot,
        }];
      });
      this.afkEvents = this.afkEvents.filter((e) => e.timestamp > elapsedSec);

      if (elapsedSec > 0 && elapsedSec % HEARTBEAT_INTERVAL_S === 0) {
        void this.sendHeartbeat();
      }
    }, 1000);
  }

  /**
   * Handles a keystroke/value change from the typing input.
   */
  handleTyping(value: string): void {
    try {
      const gs = this.gameState();
      if (gs.timeMax <= 0 || gs.isFinished) return;

      const newCurrentText = value;
      const newIndex = newCurrentText.length;
      const prevIndex = this.currentIndex;

      const targetText = gs.text || '';

      // Start tracking on first keystroke.
      if (!gs.isTyping && newIndex > 0) {
        this.startTime = Date.now();
        this.gameStateSignal.update(prev => ({ ...prev, isTyping: true }));
        this.startTimer();
        this.lastKeystrokeTime = Date.now();
      }

      // AFK detection.
      if (this.lastKeystrokeTime && newIndex > prevIndex) {
        const now = Date.now();
        const gap = now - this.lastKeystrokeTime;
        if (gap > AFK_THRESHOLD_MS) {
          this.afkTime += gap;
          this.afkCount++;
          this.afkEvents.push({
            timestamp: Math.floor((now - this.startTime!) / 1000),
            afkIndex: this.afkCount,
          });
        }
        this.lastKeystrokeTime = now;
      }

      const currentChar = targetText[newIndex - 1];
      const typedChar = newCurrentText[newIndex - 1];

      const newCharacters = this.characters().map(c => ({ ...c }));
      let newMistakes = this.mistakes;
      let totalSuccesses = this.successes;

      if (newIndex < prevIndex) {
        // Backspace: track count for punishment but do NOT count as a typed mistake.
        this.backspaceCount++;
        if (newCharacters[newIndex]) {
          newCharacters[newIndex] = { ...newCharacters[newIndex], status: '' };
        }
        if (this.backspaceCount >= BACKSPACE_THRESHOLD) {
          this.applyPunishment();
        }
      } else if (newIndex > prevIndex) {
        if (typedChar === this.lastTypedChar) {
          this.consecutiveKeyCount++;
        } else {
          this.consecutiveKeyCount = 1;
          this.lastTypedChar = typedChar;
        }

        // Spam prevention: block input and punish if the same key is pressed repeatedly
        if (this.consecutiveKeyCount >= 5) {
          this.applyPunishment();
          if (this.errorSoundBuffer) {
            this.playSound(this.errorSoundBuffer);
          }
          // Force input field to revert to prevent advancing
          this.gameStateSignal.update(prev => ({ ...prev, currentText: this.currentText }));
          return;
        }

        this.rawKeystrokes++;

        if (currentChar === typedChar) {
          if (newCharacters[newIndex - 1]) {
            newCharacters[newIndex - 1] = { ...newCharacters[newIndex - 1], status: 'correct' };
          }
          totalSuccesses++;
          if (this.keySoundBuffer) {
            this.playSound(this.keySoundBuffer);
          }
        } else {
          if (newCharacters[newIndex - 1]) {
            newCharacters[newIndex - 1] = { ...newCharacters[newIndex - 1], status: 'incorrect' };
          }
          newMistakes++;
          // Track which character was expected — used by the keyboard heatmap.
          if (currentChar) {
            this.keyErrors[currentChar] = (this.keyErrors[currentChar] ?? 0) + 1;
          }
          if (this.errorSoundBuffer) {
            this.playSound(this.errorSoundBuffer);
          }
        }
      }

      // Calculate stats locally for the live display.
      // Accuracy: only correct vs. incorrect typed characters — backspaces excluded.
      const totalTyped = totalSuccesses + newMistakes;
      const accuracy = totalTyped > 0 ? (totalSuccesses / totalTyped) * 100 : 0;
      const elapsedSeconds = this.startTime
        ? Math.max((Date.now() - this.startTime) / 1000, 1)
        : 1;

      const correctChars = totalSuccesses;

      const cpm = Math.floor(correctChars * (60 / elapsedSeconds)) || 0;
      const wpm = Math.floor(cpm / 5) || 0;
      const completionPercentage = targetText.length > 0
        ? (newIndex / targetText.length) * 100
        : 0;

      this.characters.set(newCharacters);
      this.currentText = newCurrentText;
      this.successes = totalSuccesses;
      this.mistakes = newMistakes;
      this.currentIndex = newIndex;

      this.gameStateSignal.update(prev => ({
        ...prev,
        currentText: newCurrentText,
        currentIndex: newIndex,
        mistakes: newMistakes,
        successes: totalSuccesses,
        accuracy,
        lastWpm: wpm,
        lastCpm: cpm,
        completionPercentage,
      }));

      if (completionPercentage >= 100) {
        void this.handleEnd();
      }
    } catch {
      // Input handling must never throw in a controlled input.
    }
  }

  /**
   * Applies the backspace punishment immediately (no confirmation modal): dock
   * 1 second of countdown and 1 score point.
   */
  private applyPunishment(): void {
    this.penaltyTime++;
    this.penaltyPoints++;
    this.backspaceCount = 0;
    this.lastKeystrokeTime = Date.now();
    this.gameStateSignal.update(prev => ({
      ...prev,
      score: Math.max(0, prev.score - 1),
      timeLeft: Math.max(0, prev.timeLeft - 1),
    }));
  }

  /**
   * Common reset of transient game state (progress, accumulators, results).
   * The text itself is repopulated by the caller.
   */
  private resetInternalState(): void {
    this.stopTimer();

    this.startTime = null;
    this.lastKeystrokeTime = null;
    this.currentText = '';
    this.afkTime = 0;
    this.afkCount = 0;
    this.afkEvents = [];
    this.lastSnapshotTime = 0;
    this.successes = 0;
    this.mistakes = 0;
    this.currentIndex = 0;
    this.rawKeystrokes = 0;
    this.ending = false;

    this.lastTypedChar = null;
    this.consecutiveKeyCount = 0;
    this.backspaceCount = 0;
    this.penaltyTime = 0;
    this.penaltyPoints = 0;
    this.keyErrors = {};

    this.results.set(null);
    this.performance.set([]);
    this.characters.set([]);
  }

  /**
   * Applies a settings change that regenerates the text: authenticated users
   * PATCH the session, guests fetch a fresh noSession text.
   */
  private async updateSettingsAndRefresh(payload: Record<string, unknown>): Promise<void> {
    this.resetInternalState();
    try {
      if (this.sessionId) {
        const response = await this.gameApi.updateSettings(payload);
        if (response.success) this.applyNewText(response.data);
      } else if (this.isAuthenticated) {
        await this.initSession();
      } else {
        const response = await this.gameApi.resetGame({ ...payload, noSession: true });
        if (response.success) this.applyNewText(response.data);
      }
    } catch {
      // Server unreachable; keep current text.
    }
  }

  async resetGame(overrideWordCount: number | null = null): Promise<void> {
    this.resetInternalState();
    const gs = this.gameState();
    try {
      if (this.sessionId) {
        const clientText =
          gs.gameMode === 'phrases' && gs.textSource !== 'default'
            ? this.generateLocalText()
            : null;

        const response = await this.gameApi.resetGame({
          gameMode: gs.gameMode,
          wordCount: overrideWordCount || gs.wordCount,
          timeMax: gs.timeMax,
          punctuationEnabled: gs.punctuationEnabled,
          numbersEnabled: gs.numbersEnabled,
          ...(clientText ? { clientText: clientText.text, clientTotalWords: clientText.totalWords } : {}),
        });
        if (response.success) this.applyNewText(response.data);
      } else if (this.isAuthenticated) {
        await this.initSession();
      } else {
        await this.initGame();
      }
    } catch {
      // Server unreachable; restore the previous text so the display isn't blank.
      this.characters.set(textToCharacters(this.gameState().text, this.currentText));
    }
  }

  async generateNewParagraph(): Promise<void> {
    this.resetInternalState();
    const gs = this.gameState();
    try {
      // Local-generation intercept for phrases mode with non-default source
      if (gs.gameMode === 'phrases' && gs.textSource !== 'default') {
        this.applyNewText(this.generateLocalText());
        return;
      }
      if (this.sessionId) {
        const response = await this.gameApi.refreshText({
          gameMode: gs.gameMode,
          wordCount: gs.wordCount,
          timeMax: gs.timeMax,
          punctuationEnabled: gs.punctuationEnabled,
          numbersEnabled: gs.numbersEnabled,
        });
        if (response.success) this.applyNewText(response.data);
      } else if (this.isAuthenticated) {
        await this.initSession();
      } else {
        await this.initGame();
      }
    } catch {
      // Server unreachable; restore the previous text so the display isn't blank.
      this.characters.set(textToCharacters(this.gameState().text, this.currentText));
    }
  }

  setTimeMax(time: number): void {
    ls.set('timeMax', String(time));
    this.gameStateSignal.update(prev => ({ ...prev, timeMax: time, timeLeft: time }));
    if (this.sessionId) {
      void this.gameApi.updateSettings({ timeMax: time });
    }
  }

  setGameMode(mode: GameState['gameMode']): void {
    ls.set('gameMode', mode);
    this.gameStateSignal.update(prev => ({ ...prev, gameMode: mode }));
    const gs = this.gameState();
    void this.updateSettingsAndRefresh({
      gameMode: mode,
      wordCount: gs.wordCount,
      timeMax: gs.timeMax,
      punctuationEnabled: gs.punctuationEnabled,
      numbersEnabled: gs.numbersEnabled,
    });
  }

  setWordCount(count: number): void {
    ls.set('wordCount', String(count));
    this.gameStateSignal.update(prev => ({ ...prev, wordCount: count }));
    const gs = this.gameState();
    void this.updateSettingsAndRefresh({
      gameMode: gs.gameMode,
      wordCount: count,
      timeMax: gs.timeMax,
      punctuationEnabled: gs.punctuationEnabled,
      numbersEnabled: gs.numbersEnabled,
    });
  }

  togglePunctuation(): void {
    const newEnabled = !this.gameState().punctuationEnabled;
    ls.set('punctuationEnabled', String(newEnabled));
    this.gameStateSignal.update(prev => ({ ...prev, punctuationEnabled: newEnabled }));
    const gs = this.gameState();
    void this.updateSettingsAndRefresh({
      gameMode: gs.gameMode,
      wordCount: gs.wordCount,
      timeMax: gs.timeMax,
      punctuationEnabled: newEnabled,
      numbersEnabled: gs.numbersEnabled,
    });
  }

  toggleNumbers(): void {
    const newEnabled = !this.gameState().numbersEnabled;
    ls.set('numbersEnabled', String(newEnabled));
    this.gameStateSignal.update(prev => ({ ...prev, numbersEnabled: newEnabled }));
    const gs = this.gameState();
    void this.updateSettingsAndRefresh({
      gameMode: gs.gameMode,
      wordCount: gs.wordCount,
      timeMax: gs.timeMax,
      punctuationEnabled: gs.punctuationEnabled,
      numbersEnabled: newEnabled,
    });
  }

  setCaretStyle(style: GameState['caretStyle']): void {
    ls.set('caretStyle', style);
    this.gameStateSignal.update(s => ({ ...s, caretStyle: style }));
  }

  toggleMute(): void {
    const newMuted = !this.gameState().isMuted;
    ls.set('soundMuted', String(newMuted));
    this.gameStateSignal.update(prev => ({ ...prev, isMuted: newMuted }));
  }

  /**
   * Updates the text generator config, persists to localStorage, and regenerates
   * text immediately. Used by the text source dropdown component.
   */
  setGeneratorConfig(patch: Partial<{
    textSource: GameState['textSource'];
    generatorUnit: GameState['generatorUnit'];
    generatorCount: number;
    loremMin: number;
    loremMax: number;
  }>): void {
    if (patch.textSource !== undefined)     ls.set('textSource', patch.textSource);
    if (patch.generatorUnit !== undefined)  ls.set('generatorUnit', patch.generatorUnit);
    if (patch.generatorCount !== undefined) ls.set('generatorCount', String(patch.generatorCount));
    if (patch.loremMin !== undefined)       ls.set('loremMin', String(patch.loremMin));
    if (patch.loremMax !== undefined)       ls.set('loremMax', String(patch.loremMax));

    this.gameStateSignal.update(prev => ({ ...prev, ...patch }));
    this.resetInternalState();
    void this.resetGame();
  }

  /**
   * Restarts the current text from the beginning without fetching new text.
   * Bound to the Tab key shortcut.
   */
  restartSameText(): void {
    if (this.gameState().isTyping || this.gameState().isFinished) return;
    const text = this.gameState().text;
    if (!text) return;
    this.resetInternalState();
    this.keyErrors = {};
    this.characters.set(textToCharacters(text));
    this.gameStateSignal.update(prev => ({
      ...prev,
      currentText: '',
      currentIndex: 0,
      mistakes: 0,
      successes: 0,
      accuracy: 0,
      score: 0,
      completionPercentage: 0,
      isTyping: false,
      isFinished: false,
      lastWpm: 0,
      lastCpm: 0,
      timeLeft: prev.timeMax,
    }));
  }

  /** Exposes the text generator service so toolbar components can extend vocabulary. */
  get generator(): TextGeneratorService {
    return this.textGenerator;
  }
}
