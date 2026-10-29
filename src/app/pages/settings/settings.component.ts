import { Component, computed, inject, signal } from '@angular/core';
import { StepperComponent } from '../../components/stepper/stepper.component';
import { ThemePickerComponent } from '../../components/theme-picker/theme-picker.component';
import { themeById } from '../../utils/themes';
import { NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { SettingsService } from '../../services/settings.service';
import { GameAudioService } from '../../services/game/game-audio.service';
import { TimezoneService } from '../../services/timezone.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationPrefs } from '../../models/models';
import { PlayerSettings } from '../../models/models';

type Option<K extends keyof PlayerSettings> = { value: PlayerSettings[K]; label: string; hint?: string };

/**
 * Display and typing preferences. Saved on this device and, when signed in,
 * on the account so they follow the player.
 */
@Component({
  selector: 'app-settings',
  imports: [NgTemplateOutlet, ThemePickerComponent, StepperComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly audio = inject(GameAudioService);
  readonly tz = inject(TimezoneService);
  readonly notifications = inject(NotificationService);

  readonly notificationKinds: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
    { key: 'social', label: 'Followers and invites', hint: 'Someone follows you, or invites you to a race.' },
    { key: 'achievements', label: 'Achievements', hint: 'Badges you unlock.' },
    { key: 'races', label: 'Race results', hint: 'How a race went, and your rating change.' },
    { key: 'daily', label: 'Daily challenge', hint: 'A reminder before it expires, and where you placed.' },
  ];
  readonly settingsService = inject(SettingsService);
  readonly settings = this.settingsService.settings;

  readonly themePickerOpen = signal(false);
  readonly currentTheme = computed(() => themeById(this.settings().theme));

  readonly fonts: Option<'typingFont'>[] = [
    { value: 'default', label: 'Slab' },
    { value: 'mono', label: 'Mono' },
    { value: 'serif', label: 'Serif' },
  ];
  readonly sizes: Option<'fontSize'>[] = [
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
    { value: 'xl', label: 'XL' },
  ];
  readonly liveStats: Option<'liveStats'>[] = [
    { value: 'all', label: 'Everything', hint: 'Timer, WPM, accuracy and words' },
    { value: 'speed', label: 'Speed', hint: 'Timer and WPM' },
    { value: 'timer', label: 'Timer only', hint: 'Just the clock: no numbers to chase' },
  ];
  readonly soundPacks: Option<'soundPack'>[] = [
    { value: 'typewriter', label: 'Typewriter' },
    { value: 'click', label: 'Click' },
    { value: 'soft', label: 'Soft' },
    { value: 'beep', label: 'Beep' },
    { value: 'pop', label: 'Pop' },
    { value: 'sine', label: 'Sine' },
    { value: 'square', label: 'Square' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'sawtooth', label: 'Sawtooth' },
  ];
  readonly layouts: Option<'keyboardLayout'>[] = [
    { value: 'qwerty', label: 'QWERTY' },
    { value: 'dvorak', label: 'Dvorak' },
    { value: 'colemak', label: 'Colemak' },
  ];
  readonly carets: Option<'caretStyle'>[] = [
    { value: 'line', label: 'Line' },
    { value: 'block', label: 'Block' },
    { value: 'underline', label: 'Underline' },
    { value: 'off', label: 'Off' },
  ];
  readonly difficulties: Option<'difficulty'>[] = [
    { value: 'normal', label: 'Normal', hint: 'Fixing mistakes is free; heavy correcting costs a point' },
    { value: 'hardcore', label: 'Hardcore', hint: 'Every 3 backspaces and every mashed key cost a point and a second' },
  ];
  readonly stops: Option<'stopOnError'>[] = [
    { value: 'off', label: 'Off' },
    { value: 'letter', label: 'Letter' },
    { value: 'word', label: 'Word' },
  ];

  readonly volumes: Option<'soundVolume'>[] = [0.1, 0.25, 0.5, 0.75, 1].map((v) => ({ value: v as PlayerSettings['soundVolume'], label: String(v) }));
  readonly onOff: { value: boolean; label: string }[] = [
    { value: false, label: 'Off' },
    { value: true, label: 'On' },
  ];
  readonly warnings: Option<'timeWarning'>[] = [
    { value: 0, label: 'Off' },
    { value: 1, label: '1 second' },
    { value: 3, label: '3 seconds' },
    { value: 5, label: '5 seconds' },
    { value: 10, label: '10 seconds' },
  ];
  readonly typedEffects: Option<'typedEffect'>[] = [
    { value: 'keep', label: 'Keep' },
    { value: 'fade', label: 'Fade' },
    { value: 'hide', label: 'Hide' },
  ];
  readonly timerColors: Option<'timerColor'>[] = [
    { value: 'main', label: 'Main' },
    { value: 'text', label: 'Text' },
    { value: 'sub', label: 'Sub' },
  ];
  readonly timerOpacities: Option<'timerOpacity'>[] = [0.25, 0.5, 0.75, 1].map((v) => ({ value: v as PlayerSettings['timerOpacity'], label: String(v) }));

  readonly failModes: Option<'failMode'>[] = [
    { value: 'normal', label: 'Normal', hint: 'The classic test' },
    { value: 'expert', label: 'Expert', hint: 'Fails if you finish a word with a mistake' },
    { value: 'master', label: 'Master', hint: 'Fails on a single wrong key' },
  ];
  readonly restarts: Option<'quickRestart'>[] = [
    { value: 'both', label: 'Esc and Tab' },
    { value: 'esc', label: 'Esc' },
    { value: 'tab', label: 'Tab' },
    { value: 'off', label: 'Off' },
  ];
  readonly smoothCarets: Option<'smoothCaret'>[] = [
    { value: 'off', label: 'Off' },
    { value: 'slow', label: 'Slow' },
    { value: 'medium', label: 'Medium' },
    { value: 'fast', label: 'Fast' },
  ];
  readonly paceCarets: Option<'paceCaret'>[] = [
    { value: 'off', label: 'Off' },
    { value: 'pb', label: 'PB', hint: 'Your best speed' },
    { value: 'average', label: 'Average', hint: 'The average of your last 10 results' },
    { value: 'last', label: 'Last', hint: 'Your last result' },
    { value: 'custom', label: 'Custom', hint: 'The speed you set' },
  ];
  readonly highlightModes: Option<'highlightMode'>[] = [
    { value: 'letter', label: 'Letter' },
    { value: 'word', label: 'Word' },
  ];

  /** Number settings: whole numbers in range, 0 switches a minimum off; anything else is ignored. */
  setNumber(key: 'paceCaretWpm' | 'minWpm' | 'minAccuracy', event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    const [min, max, offAllowed] = key === 'paceCaretWpm' ? [10, 300, false] : key === 'minWpm' ? [10, 300, true] : [50, 100, true];
    if (!Number.isInteger(n) || ((n < min || n > max) && !(offAllowed && n === 0))) return;
    this.settingsService.update({ [key]: n });
  }

  /** For the shared segmented-control template, whose context isn't typed. */
  isSelected(key: keyof PlayerSettings, value: unknown): boolean {
    return this.settings()[key] === value;
  }

  set<K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]): void {
    // Caret, sound and rules belong to the game too; it saves them through the settings.
    if (key === 'caretStyle') this.game.setCaretStyle(value as PlayerSettings['caretStyle']);
    else if (key === 'difficulty' || key === 'stopOnError' || key === 'spaceSkips') this.game.setRules({ [key]: value });
    else if (key === 'soundMuted') {
      if (this.game.gameState().isMuted !== value) this.game.toggleMute();
    } else this.settingsService.update({ [key]: value } as Partial<PlayerSettings>);
  }

  readonly tzError = signal('');

  constructor() {
    if (this.auth.isAuthenticated()) void this.notifications.loadPrefs();
  }

  /** '' follows the browser; anything else is an IANA zone the player picked. */
  async onZone(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    const res = await this.tz.setZone(value || null);
    this.tzError.set(res.success ? '' : res.error ?? 'Could not save your time zone');
  }

  setNotification(key: keyof NotificationPrefs, on: boolean): void {
    void this.notifications.setPref(key, on);
  }

  previewSound(): void {
    this.audio.play('key', false, this.settings().soundPack);
  }
}
