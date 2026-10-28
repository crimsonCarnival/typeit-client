import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent) },
  { path: 'play', loadComponent: () => import('./pages/game/game.component').then((m) => m.GameComponent) },
  { path: 'results', loadComponent: () => import('./pages/results/results.component').then((m) => m.ResultsComponent) },
  { path: 'daily', loadComponent: () => import('./pages/daily/daily.component').then((m) => m.DailyComponent) },
  { path: 'race', loadComponent: () => import('./pages/race-lobby/race-lobby.component').then((m) => m.RaceLobbyComponent) },
  { path: 'learn', loadComponent: () => import('./pages/learn/learn.component').then((m) => m.LearnComponent) },
  { path: 'learn/lists', loadComponent: () => import('./pages/word-lists/word-lists.component').then((m) => m.WordListsComponent) },
  { path: 'error-map', loadComponent: () => import('./pages/error-map/error-map.component').then((m) => m.ErrorMapComponent) },
  { path: 'achievements', loadComponent: () => import('./pages/achievements/achievements.component').then((m) => m.AchievementsComponent) },
  { path: 'ranks', loadComponent: () => import('./pages/rankings/rankings.component').then((m) => m.RankingsComponent) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent) },
  { path: 'stats', canActivate: [authGuard], loadComponent: () => import('./pages/stats/stats.component').then((m) => m.StatsComponent) },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent) },
  { path: 'replay/:resultId', loadComponent: () => import('./pages/replay/replay.component').then((m) => m.ReplayComponent) },
  { path: 'players', loadComponent: () => import('./pages/players/players.component').then((m) => m.PlayersComponent) },
  { path: 'user/:userId', loadComponent: () => import('./pages/public-profile/public-profile.component').then((m) => m.PublicProfileComponent) },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
