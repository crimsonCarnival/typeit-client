export interface StatsBucket {
  games?: number;
  highScore?: number;
  bestWpm?: number;
  bestAccuracy?: number;
  totalTimeTyping?: number;
  afkTime?: number;
  afkPeriods?: number;
}

export interface UserStats {
  gamesPlayed?: number;
  highScore?: number;
  bestWpm?: number;
  bestAccuracy?: number;
  totalTimeTyping?: number;
  incompleteSessions?: number;
  afkTime?: number;
  afkPeriods?: number;
  byTime?: Record<string, StatsBucket | undefined>;
  byWords?: Record<string, StatsBucket | undefined>;
  byMode?: Record<string, StatsBucket | undefined>;
  byModifier?: Record<string, StatsBucket | undefined>;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  bio?: string;
  role?: string;
  timezone?: string;
  stats?: UserStats;
  followersCount: number;
  followingCount: number;
  createdAt?: string;
}

export interface Character {
  char: string;
  status: string;
}

export type GameMode = 'phrases' | 'words';
export type CaretStyle = 'line' | 'block' | 'underline' | 'off';

export interface GameState {
  currentText: string;
  text: string;
  currentIndex: number;
  mistakes: number;
  successes: number;
  accuracy: number;
  score: number;
  completionPercentage: number;
  isTyping: boolean;
  isFinished: boolean;
  timeMax: number;
  timeLeft: number;
  gameMode: GameMode;
  wordCount: number;
  isMuted: boolean;
  punctuationEnabled: boolean;
  numbersEnabled: boolean;
  lastWpm: number;
  lastCpm: number;
  totalWords: number;
  // Text source (phrases mode only)
  textSource: 'default' | 'generated' | 'lorem';
  generatorUnit: 'sentence' | 'paragraph' | 'article';
  generatorCount: number;
  loremMin: number;
  loremMax: number;
  caretStyle: CaretStyle;
  /** 'YYYY-MM-DD' while playing that day's daily challenge, else null. */
  dailyDate: string | null;
  /** Key or digraph being drilled (practice text, never ranked), else null. */
  drillTarget: string | null;
}

export interface AfkEvent {
  timestamp: number;
  afkIndex: number;
}

export interface PerformancePoint {
  timestamp: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  currentIndex: number;
  mistakes: number;
  highestWpm: number;
  consistency: number;
  backspaces: number;
  afkPeriods?: AfkEvent[];
}

export interface Results {
  score: number;
  wpm: number;
  rawWpm: number;
  highestWpm: number;
  cpm: number;
  accuracy: number;
  successes: number;
  mistakes: number;
  missed: number;
  totalWords: number;
  elapsedTime: number;
  consistency: number;
  afkTime?: string;
  afkCount?: number;
}

export interface Punishment {
  count: number;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  username: string;
  avatar?: string;
  bio?: string;
  stats?: UserStats;
  createdAt?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwner: boolean;
}

export interface FollowListUser {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionSummary {
  sessionId: string;
  endTime: number;              // Unix ms
  wpm: number;
  cpm: number;
  rawWpm?: number;
  accuracy: number;
  score: number;
  consistency?: number;
  gameMode: string;
  wordCount: number;
  timeMax: number;
  completionPercentage: number;
  migrated: boolean;
}

export interface SessionHistoryResponse {
  sessions: SessionSummary[];
}

export type RankingPeriod = 'all' | 'month';
export type RankingModifiers = 'none' | 'punctuation' | 'numbers' | 'both';
export type RankingRegion = 'all' | 'africa' | 'americas' | 'asia' | 'europe' | 'oceania';

export interface RankingQuery {
  period: RankingPeriod;
  mode: GameMode;
  time: number;
  modifiers: RankingModifiers;
  region: RankingRegion;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  wpm: number;
  accuracy: number;
  raceWins: number;
}

export interface RankingsResponse {
  entries: RankingEntry[];
  me: RankingEntry | null;
  totalPlayers: number;
  updatedAt: string;
}

export interface DailySettings {
  gameMode: GameMode;
  wordCount: number;
  timeMax: number;
  punctuationEnabled: boolean;
  numbersEnabled: boolean;
}

export interface DailyLeader {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  wpm: number;
  accuracy: number;
}

export interface DailyOverview {
  date: string;
  resetsAt: string;
  settings: DailySettings;
  playersToday: number;
  leaders: DailyLeader[];
  me: {
    status: 'not-played' | 'in-progress' | 'finished';
    wpm: number | null;
    accuracy: number | null;
    ranked: boolean;
    rank: number | null;
  } | null;
  pastDays: {
    date: string;
    winner: { userId: string; username: string; displayName: string; avatar: string; wpm: number } | null;
    myWpm: number | null;
  }[];
}

export type AchievementCategory = 'speed' | 'accuracy' | 'habits' | 'racing';
export type AchievementRarity = 'common' | 'rare' | 'epic';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  target: number;
  unit: string;
  value: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface ErrorMapKey {
  key: string;
  presses: number;
  errors: number;
  errorRate: number;
  typedInstead: { typed: string; count: number }[];
}

export interface ErrorMap {
  runs: number;
  totalPresses: number;
  keys: ErrorMapKey[];
  digraphs: { pair: string; errors: number }[];
}
