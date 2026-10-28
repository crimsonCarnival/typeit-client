import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { UserApiService } from './user-api.service';
import { PlayerSettings } from '../models/models';
import { ls } from '../utils/storage';

export const DEFAULT_SETTINGS: PlayerSettings = {
  theme: 'crimson',
  typingFont: 'default',
  fontSize: 'm',
  liveStats: 'all',
  soundPack: 'typewriter',
  keyboardLayout: 'qwerty',
  caretStyle: 'line',
  difficulty: 'normal',
  stopOnError: 'off',
  spaceSkips: false,
  soundMuted: false,
};

/** localStorage keys; some predate this service and are shared with GameService. */
const STORAGE_KEYS: Record<keyof PlayerSettings, string> = {
  theme: 'theme',
  typingFont: 'typingFont',
  fontSize: 'fontSize',
  liveStats: 'liveStats',
  soundPack: 'soundPack',
  keyboardLayout: 'keyboardLayout',
  caretStyle: 'caretStyle',
  difficulty: 'difficulty',
  stopOnError: 'stopOnError',
  spaceSkips: 'spaceSkips',
  soundMuted: 'soundMuted',
};

const readLocal = (): PlayerSettings => {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
    const raw = ls.get(storageKey);
    if (raw === null) continue;
    out[key] = typeof DEFAULT_SETTINGS[key as keyof PlayerSettings] === 'boolean' ? raw === 'true' : raw;
  }
  return out as unknown as PlayerSettings;
};

const SAVE_DEBOUNCE_MS = 600;

/**
 * Player preferences. Read from localStorage at start (so the page renders
 * with them before sign-in resolves), replaced by the account's copy once
 * signed in, and saved to both on change.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(UserApiService);

  private readonly state = signal<PlayerSettings>(readLocal());
  readonly settings = this.state.asReadonly();

  /** Bumped when the account's settings replace the local ones (game rules, caret and mute follow). */
  readonly synced = signal(0);

  private pending: Partial<PlayerSettings> = {};
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.applyToDocument(this.state());

    // Signing in brings the account's settings.
    effect(() => {
      const remote = this.auth.user()?.settings;
      if (!remote || !Object.keys(remote).length) return;
      untracked(() => {
        const next = { ...this.state(), ...remote } as PlayerSettings;
        this.writeLocal(next);
        this.state.set(next);
        this.applyToDocument(next);
        this.synced.update((n) => n + 1);
      });
    });
  }

  /** Changes settings locally and, when signed in, on the account. */
  update(patch: Partial<PlayerSettings>): void {
    const next = { ...this.state(), ...patch };
    this.writeLocal(patch);
    this.state.set(next);
    this.applyToDocument(next);
    if (!this.auth.isAuthenticated()) return;
    this.pending = { ...this.pending, ...patch };
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const body = this.pending;
      this.pending = {};
      void this.api.updateSettings(body);
    }, SAVE_DEBOUNCE_MS);
  }

  private writeLocal(patch: Partial<PlayerSettings>): void {
    for (const [key, value] of Object.entries(patch)) {
      const storageKey = STORAGE_KEYS[key as keyof PlayerSettings];
      if (storageKey) ls.set(storageKey, String(value));
    }
  }

  private applyToDocument(s: PlayerSettings): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset['theme'] = s.theme;
    root.dataset['typingFont'] = s.typingFont;
    root.dataset['fontSize'] = s.fontSize;
  }
}
