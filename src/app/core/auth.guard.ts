import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';

/** Admin area: needs the `admin.access` permission, otherwise back to the game. */
export const adminGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    map(() => (auth.can('admin.access') ? true : router.createUrlTree(['/'])))
  );
};

/** Admin usage statistics: needs `usage.view` (and the admin area). */
export const usageGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    map(() => (auth.can('admin.access') && auth.can('usage.view') ? true : router.createUrlTree(['/'])))
  );
};

/**
 * Route guard for authenticated pages. Waits for the bootstrap `loading`
 * flag to settle (so a valid stored token is verified before deciding),
 * then allows access or redirects to the game with the sign-in dialog open.
 */
export const authGuard: CanActivateFn = (_route, state): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    map(() => {
      if (auth.isAuthenticated()) return true;
      // Ask a guest to sign in, then bring them back to the page they wanted.
      auth.openAuthModal('login', state.url);
      return router.createUrlTree(['/']);
    })
  );
};
