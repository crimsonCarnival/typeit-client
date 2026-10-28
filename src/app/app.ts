import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { RaceService } from './services/race.service';
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

  acceptInvite(): void {
    this.race.acceptInvite();
    void this.router.navigate(['/race']);
  }
}
