import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { RaceService } from './services/race.service';
import { GameService } from './services/game.service';
import { SettingsService } from './services/settings.service';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserMenuComponent, AuthModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly auth = inject(AuthService);
  // Created here so signed-in players stay connected (online for friends, invites).
  readonly race = inject(RaceService);
  private readonly router = inject(Router);
  private readonly game = inject(GameService);

  // Applies saved settings (theme, typing font) from the first render.
  private readonly settings = inject(SettingsService);

  constructor() {
    // The account's settings, once signed in, also set the game's rules, caret and sound.
    effect(() => {
      if (this.settings.synced() > 0) untracked(() => this.game.applySyncedSettings());
    });
  }

  /** While a run is in progress the header steps back (design: focus mode). */
  readonly focusMode = computed(() => this.game.gameState().isTyping);

  acceptInvite(): void {
    this.race.acceptInvite();
    void this.router.navigate(['/race']);
  }
}
