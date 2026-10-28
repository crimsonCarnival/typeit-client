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
export type TextCategory = 'classics' | 'quotes' | 'speeches' | 'gta';

export interface Passage {
  category: TextCategory;
  title: string | null;
  author: string;
}
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
  /** Server passage pool used when textSource is 'default'. */
  textCategory: TextCategory;
  /** Where the current phrases text came from (attribution), or null. */
  passage: Passage | null;
  generatorUnit: 'sentence' | 'paragraph' | 'article';
  generatorCount: number;
  loremMin: number;
  loremMax: number;
  caretStyle: CaretStyle;
  /** 'YYYY-MM-DD' while playing that day's daily challenge, else null. */
  dailyDate: string | null;
  /** Practice run in progress (drill, lesson, common words, list); never ranked. */
  practice: PracticeState | null;
  /** Target speed of the client-side pace bot, or null when not racing one. */
  botWpm: number | null;
  /** Live race in progress: its code and the start time on the local clock. */
  race: { code: string; startAt: number } | null;
}

export type PracticeKind = 'drill' | 'lesson' | 'common-words' | 'list';

export interface PracticeState {
  kind: PracticeKind;
  id: string | null;
  /** Shown in the game's practice banner. */
  label: string;
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
  /** Server integrity verdict (signed-in runs only). */
  ranked?: boolean;
  integrityFlags?: string[];
  newAchievements?: string[];
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

export interface Lesson {
  id: string;
  number: number;
  title: string;
  focus: string;
  hint: string;
  completed: boolean;
  bestWpm: number;
  bestAccuracy: number;
}

export interface WordList {
  id: string;
  name: string;
  words: string[];
  updatedAt?: string;
}

export interface LearnOverview {
  lessons: Lesson[];
  nextLessonId: string | null;
  passAccuracy: number;
  commonWords: { runs: number; bestWpm: number };
  lists: WordList[];
  maxLists: number;
}

export type RaceState = 'lobby' | 'countdown' | 'racing' | 'finished';

export interface RacePlayer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
  index: number;
  wpm: number;
  accuracy: number;
  finishedAt: number | null;
  place: number | null;
  /** Whether the finished run passed verification (null until finished). */
  ranked: boolean | null;
}

export interface RaceRoom {
  code: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  wordCount: number;
  state: RaceState;
  startAt: number | null;
  serverNow: number;
  text: string | null;
  winnerId: string | null;
  players: RacePlayer[];
}

export interface RaceFriend {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  online: boolean;
}

export interface RaceInvite {
  code: string;
  name: string;
  from: { userId: string; displayName: string; username: string };
}

export interface OpenRace {
  code: string;
  name: string;
  wordCount: number;
  players: number;
}
