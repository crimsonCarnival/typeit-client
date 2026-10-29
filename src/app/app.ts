import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { RaceService } from './services/race.service';
import { GameService } from './services/game.service';
import { SettingsService } from './services/settings.service';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { NotificationBellComponent } from './components/notification-bell/notification-bell.component';
import { MenuHostComponent } from './components/menu/menu-host.component';
import { ChangelogModalComponent } from './components/changelog-modal/changelog-modal.component';
import { ChangelogService } from './services/changelog.service';
import { ThemePickerComponent } from './components/theme-picker/theme-picker.component';
import { themeById } from './utils/themes';
import { TooltipService } from './components/tooltip/tooltip.service';
import { NotificationService } from './services/notification.service';
import { NotificationIconComponent } from './components/notification-icon/notification-icon.component';
import { AppNotification } from './models/models';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserMenuComponent, AuthModalComponent, NotificationBellComponent, MenuHostComponent, ChangelogModalComponent, ThemePickerComponent, NotificationIconComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly auth = inject(AuthService);
  // Created here so signed-in players stay connected (online for friends, invites).
  readonly race = inject(RaceService);
  private readonly router = inject(Router);
  readonly notifications = inject(NotificationService);
  readonly changelog = inject(ChangelogService);
  readonly themePickerOpen = signal(false);
  readonly themeName = computed(() => themeById(this.settings.settings().theme).name);
  private readonly game = inject(GameService);

  // Applies saved settings (theme, typing font) from the first render.
  private readonly settings = inject(SettingsService);

  constructor() {
    // Custom hover tooltips for every element with a title.
    inject(TooltipService).start();
    // The footer shows the latest version.
    void this.changelog.load();

    // The account's settings, once signed in, also set the game's rules, caret and sound.
    effect(() => {
      if (this.settings.synced() > 0) untracked(() => this.game.applySyncedSettings());
    });
  }

  /** While a run is in progress the header steps back (design: focus mode). */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /**
   * The header steps back only on the game page, where the run is. The run
   * itself can outlive the page (a live race keeps going), and must not hide
   * the header on every other page.
   */
  readonly focusMode = computed(() => this.game.gameState().isTyping && this.url().split(/[?#]/)[0].startsWith('/play'));

  /** A toast opens what the notification is about. */
  openToast(n: AppNotification): void {
    this.notifications.dismissToast(n.id);
    this.notifications.open(n);
  }

  acceptInvite(): void {
    this.race.acceptInvite();
    void this.router.navigate(['/race']);
  }
}
