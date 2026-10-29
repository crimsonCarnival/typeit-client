import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** Where Google sends the browser back to: finishes the sign-in or link, then moves on. */
@Component({
  selector: 'app-auth-google',
  imports: [RouterLink],
  template: `
    <div class="wrap">
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
        <a routerLink="/">Back to TypeIt</a>
      } @else {
        <p role="status">Signing you in&#8230;</p>
      }
    </div>
  `,
  styles: `
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 80px 16px;
      color: var(--color-text-muted);
    }

    .error {
      max-width: 520px;
      text-align: center;
      color: var(--color-error);
    }

    a {
      color: var(--color-accent);
    }
  `,
})
export class AuthGoogleComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal('');

  constructor() {
    const fragment = window.location.hash;
    // Take the token out of the address bar and history straight away.
    history.replaceState(null, '', window.location.pathname);
    void this.auth.finishGoogle(fragment).then((out) => {
      if (out.error) this.error.set(out.error);
      else void this.router.navigateByUrl(out.linked ? '/account?tab=authentication' : out.next, { replaceUrl: true });
    });
  }
}
