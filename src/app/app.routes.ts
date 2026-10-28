import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  // Landing page will take '' once it exists; until then send visitors straight to the game.
  { path: '', pathMatch: 'full', redirectTo: 'play' },
  { path: 'play', loadComponent: () => import('./pages/game/game.component').then((m) => m.GameComponent) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent) },
  { path: 'stats', canActivate: [authGuard], loadComponent: () => import('./pages/stats/stats.component').then((m) => m.StatsComponent) },
  { path: 'user/:userId', loadComponent: () => import('./pages/public-profile/public-profile.component').then((m) => m.PublicProfileComponent) },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
