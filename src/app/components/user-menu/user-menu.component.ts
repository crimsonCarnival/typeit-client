import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginClick = input<() => void>();
  readonly registerClick = input<() => void>();

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly displayName = computed(() => this.user()?.displayName || this.user()?.username || '');
  readonly initial = computed(() => (this.displayName() ? this.displayName().charAt(0).toUpperCase() : '?'));

  isOpen = false;

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  closeMenu(): void {
    this.isOpen = false;
  }

  goTo(path: string): void {
    this.closeMenu();
    void this.router.navigate([path]);
  }

  logout(): void {
    this.auth.logout();
    this.isOpen = false;
  }
}
