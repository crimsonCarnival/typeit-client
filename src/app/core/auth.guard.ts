import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';

/**
 * Route guard for authenticated pages. Waits for the bootstrap `loading`
 * flag to settle (so a valid stored token is verified before deciding),
 * then allows access or redirects to the game.
 */
export const authGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    map(() => (auth.isAuthenticated() ? true : router.createUrlTree(['/'])))
  );
};
