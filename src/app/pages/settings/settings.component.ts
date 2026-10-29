import { Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { SettingsService } from '../../services/settings.service';
import { GameAudioService } from '../../services/game/game-audio.service';
import { TimezoneService } from '../../services/timezone.service';
import { PlayerSettings } from '../../models/models';

type Option<K extends keyof PlayerSettings> = { value: PlayerSettings[K]; label: string; hint?: string };

/**
 * Display and typing preferences. Saved on this device and, when signed in,
 * on the account so they follow the player.
 */
@Component({
  selector: 'app-settings',
  imports: [NgTemplateOutlet],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly audio = inject(GameAudioService);
  readonly tz = inject(TimezoneService);
  readonly settingsService = inject(SettingsService);
  readonly settings = this.settingsService.settings;

  readonly themes: Option<'theme'>[] = [
    { value: 'crimson', label: 'Crimson' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'forest', label: 'Forest' },
    { value: 'light', label: 'Light' },
  ];
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

  /** '' follows the browser; anything else is an IANA zone the player picked. */
  async onZone(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    const res = await this.tz.setZone(value || null);
    this.tzError.set(res.success ? '' : res.error ?? 'Could not save your time zone');
  }

  previewSound(): void {
    this.audio.play('key', false, this.settings().soundPack);
  }
}
