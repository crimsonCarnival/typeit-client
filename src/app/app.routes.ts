import { Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { authGuard } from './core/auth.guard';

const raceMatcher: UrlMatcher = (segments: UrlSegment[]) =>
  segments[0]?.path === 'race' && segments.length <= 2
    ? { consumed: segments, ...(segments[1] && { posParams: { code: segments[1] } }) }
    : null;

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent) },
  { path: 'play', loadComponent: () => import('./pages/game/game.component').then((m) => m.GameComponent) },
  { path: 'results', loadComponent: () => import('./pages/results/results.component').then((m) => m.ResultsComponent) },
  { path: 'daily', loadComponent: () => import('./pages/daily/daily.component').then((m) => m.DailyComponent) },
  // /race and /race/:code share one component instance, so opening a room
  // (which moves the URL to its link) doesn't rebuild the lobby.
  { matcher: raceMatcher, loadComponent: () => import('./pages/race-lobby/race-lobby.component').then((m) => m.RaceLobbyComponent) },
  { path: 'learn', loadComponent: () => import('./pages/learn/learn.component').then((m) => m.LearnComponent) },
  { path: 'learn/lists', loadComponent: () => import('./pages/word-lists/word-lists.component').then((m) => m.WordListsComponent) },
  { path: 'error-map', loadComponent: () => import('./pages/error-map/error-map.component').then((m) => m.ErrorMapComponent) },
  { path: 'achievements', loadComponent: () => import('./pages/achievements/achievements.component').then((m) => m.AchievementsComponent) },
  { path: 'ranks', loadComponent: () => import('./pages/rankings/rankings.component').then((m) => m.RankingsComponent) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent) },
  { path: 'stats', canActivate: [authGuard], loadComponent: () => import('./pages/stats/stats.component').then((m) => m.StatsComponent) },
  { path: 'user/:userId', loadComponent: () => import('./pages/public-profile/public-profile.component').then((m) => m.PublicProfileComponent) },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
