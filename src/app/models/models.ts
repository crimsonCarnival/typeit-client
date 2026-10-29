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
  /** Tests whose first key was typed; gamesPlayed counts the finished ones. */
  testsStarted?: number;
  afkTime?: number;
  afkPeriods?: number;
  byTime?: Record<string, StatsBucket | undefined>;
  byWords?: Record<string, StatsBucket | undefined>;
  byMode?: Record<string, StatsBucket | undefined>;
  byModifier?: Record<string, StatsBucket | undefined>;
}

/** Display and typing preferences, kept on the account (server config/settings.js). */
export interface PlayerSettings {
  /** A theme id from utils/themes.ts. */
  theme: string;
  typingFont: 'default' | 'mono' | 'serif';
  fontSize: 's' | 'm' | 'l' | 'xl';
  /** What the in-run head shows: everything, speed and timer, or the timer only. */
  liveStats: 'all' | 'speed' | 'timer';
  soundPack: 'typewriter' | 'click' | 'soft' | 'beep' | 'pop' | 'sine' | 'square' | 'triangle' | 'sawtooth';
  keyboardLayout: 'qwerty' | 'dvorak' | 'colemak';
  caretStyle: CaretStyle;
  difficulty: Difficulty;
  stopOnError: StopOnError;
  spaceSkips: boolean;
  soundMuted: boolean;
  soundVolume: 0.1 | 0.25 | 0.5 | 0.75 | 1;
  errorSound: boolean;
  /** Seconds left when a warning sounds in a timed test (0 = off). */
  timeWarning: 0 | 1 | 3 | 5 | 10;
  blindMode: boolean;
  typedEffect: 'keep' | 'fade' | 'hide';
  timerColor: 'main' | 'text' | 'sub';
  timerOpacity: 0.25 | 0.5 | 0.75 | 1;
  /** Which restart shortcuts work: Esc (new text), Tab (same text), both or neither. */
  quickRestart: 'both' | 'esc' | 'tab' | 'off';
  smoothCaret: 'off' | 'slow' | 'medium' | 'fast';
  highlightMode: 'letter' | 'word';
  tapeMode: boolean;
  paceCaret: 'off' | 'pb' | 'average' | 'last' | 'custom';
  paceCaretWpm: number;
  /** Expert fails a test on a word finished with a mistake; master on any wrong key. */
  failMode: 'normal' | 'expert' | 'master';
  /** 0 = off. */
  minWpm: number;
  minAccuracy: number;
  saveResults: boolean;
}

export interface User {
  id: string;
  settings?: Partial<PlayerSettings>;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  bio?: string;
  role?: string;
  /** What this player may do in the admin area (role plus per-user overrides). */
  permissions?: string[];
  level?: LevelInfo;
  timezone?: string;
  /** True when the player chose their zone instead of following the browser. */
  timezoneManual?: boolean;
  /** Sign-in methods: a password, and the Google account linked (if any). */
  hasPassword?: boolean;
  googleEmail?: string | null;
  leaderboardOptOut?: boolean;
  streakHourOffset?: number;
  streakOffsetSet?: boolean;
  usernameChangedAt?: string | null;
  stats?: UserStats;
  followersCount: number;
  followingCount: number;
  createdAt?: string;
}

export interface Character {
  char: string;
  status: string;
}

export type GameMode = 'phrases' | 'words' | 'code';
export type WordLanguage = 'english' | 'spanish' | 'french' | 'german' | 'portuguese' | 'italian';
export type CodeLanguage = 'javascript' | 'python' | 'go' | 'rust' | 'sql' | 'bash';
export type Difficulty = 'normal' | 'hardcore';
export type StopOnError = 'off' | 'letter' | 'word';

/** Typing rules of a run, as the server reports them (with the numbers the input rules need). */
export interface TypingRules {
  difficulty: Difficulty;
  stopOnError: StopOnError;
  spaceSkips: boolean;
  spamRun: number;
  backspaceEvery: number;
  backspaceSeconds: number;
  backspacePoints: number;
}

/** Server-computed numbers for the run in progress (POST /game/progress). */
export interface LiveStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  mistakes: number;
  position: number;
  completionPercentage: number;
  penalty: { points: number; seconds: number };
  /** When time runs out, in ms from the run's start (penalties included). */
  deadlineMs: number;
  timeLeft: number;
}

export interface WordStat {
  word: string;
  errors: number;
  skipped: boolean;
  ms: number;
  wpm: number | null;
}
export type TextCategory = 'classics' | 'quotes' | 'speeches' | 'gta';

export interface Passage {
  category: TextCategory | 'code' | 'language';
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
  textSource: 'default' | 'generated' | 'lorem' | 'custom';
  /** Words mode language. */
  language: WordLanguage;
  /** Code mode snippet language. */
  codeLanguage: CodeLanguage;
  /** Zen: no time pressure; the run ends when you press Finish. */
  zen: boolean;
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
  /** Typing rules of the current run. */
  rules: TypingRules;
}

export type PracticeKind = 'drill' | 'lesson' | 'common-words' | 'list' | 'ghost' | 'weak-keys' | 'review';

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
  /** That second's raw speed (what consistency is computed from). */
  burst?: number;
  /** Backspaces pressed during that second. */
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
  completionPercentage?: number;
  /** Wrong keys per minute. */
  errorRate?: number;
  /** Seconds away from the keyboard. */
  afkTime?: number;
  afkPeriods?: number;
  backspaces?: number;
  penalty?: { points: number; seconds: number };
  performance?: PerformancePoint[];
  wordStats?: WordStat[];
  /** Server integrity verdict (signed-in runs only). */
  ranked?: boolean;
  integrityFlags?: string[];
  newAchievements?: string[];
  /** Saved result id (signed-in runs), for the replay. */
  resultId?: string;
}

export interface Punishment {
  count: number;
}

/** Where a player stands: their level, how far into it, and what the next needs. */
export interface LevelInfo {
  level: number;
  xp: number;
  into: number;
  needed: number;
  progress: number;
}

/** One saved result, in the short form the stats dashboard works with. */
export interface ResultRow {
  id: string;
  /** When it was saved (ms). */
  t: number;
  wpm: number;
  raw: number;
  acc: number;
  cons: number;
  /** Seconds spent typing. */
  secs: number;
  mode: GameMode;
  timeMax: number;
  words: number;
  mods: 'none' | 'punctuation' | 'numbers' | 'both';
  lang: string | null;
  /** Passed the integrity checks and is eligible for rankings. */
  verified: boolean;
  /** The integrity checks flagged it. */
  flagged: boolean;
  practice: string | null;
  daily: boolean;
  correct: number;
  incorrect: number;
  backspaces: number;
  replay: boolean;
}

export interface PersonalBest {
  /** The time limit (s) or word count the best belongs to. */
  limit: number;
  wpm: number;
  accuracy: number;
}

/** What a profile shows beside the player's name: totals, personal bests and activity. */
export interface ProfileOverview {
  totals: {
    started: number;
    completed: number;
    completionRate: number | null;
    restartsPerTest: number | null;
    timeTyping: number;
    estimatedWords: number;
  };
  personalBests: {
    time: (PersonalBest | null)[];
    words: (PersonalBest | null)[];
  };
  activity: {
    from: string;
    to: string;
    year: number | null;
    years: number[];
    total: number;
    days: { date: string; count: number }[];
  };
}

/** One release of the in-app changelog. */
export interface ChangelogEntry {
  scope: string | null;
  text: string;
  breaking: boolean;
  pr: number | null;
  hash: string;
  repo: string | null;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  /** Section id (features, fixes, security, ...) to its entries; empty sections may be missing. */
  sections: Record<string, ChangelogEntry[]>;
}

/** Tests a player started, and what became of them. */
export interface TestOutcomes {
  started: number;
  /** Started but never finished. */
  abandoned: number;
  finished: number;
  /** Finished and passed the integrity checks. */
  approved: number;
  /** Finished but flagged by the integrity checks. */
  failed: number;
}

export interface BlockedUser {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  blockedAt: string;
}

export interface PublicProfile {
  id: string;
  outcomes?: TestOutcomes;
  /** Only set for staff. */
  role?: string;
  level?: number;
  displayName: string;
  username: string;
  avatar?: string;
  bio?: string;
  stats?: UserStats;
  createdAt?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  /** The viewer has blocked this player. */
  isBlocked?: boolean;
  isOwner: boolean;
}

/** A player found by GET /users/search. */
export interface PlayerSearchResult {
  id: string;
  role?: string;
  level?: number;
  username: string;
  displayName: string;
  avatar: string;
  bestWpm: number;
  gamesPlayed: number;
  followersCount: number;
}

export interface FollowListUser {
  _id: string;
  role?: string;
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
  /** null for phrases, which have no time limit. */
  time: number | null;
  modifiers: RankingModifiers;
  region: RankingRegion;
}

export interface RankingEntry {
  rank: number;
  role?: string;
  /** The run behind the entry (for its replay). */
  resultId?: string | null;
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
  resultId?: string | null;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  wpm: number;
  accuracy: number;
}

export interface DailyDay {
  date: string;
  settings: DailySettings;
  started: number;
  finished: number;
  rankedCount: number;
  averageWpm: number | null;
  winner: DailyLeader | null;
  entries: DailyLeader[];
  me: {
    status: 'not-played' | 'in-progress' | 'finished';
    wpm: number | null;
    accuracy: number | null;
    ranked: boolean;
    rank: number | null;
  } | null;
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

export type AchievementCategory = 'speed' | 'accuracy' | 'habits' | 'racing' | 'learning';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  /** Tiered badges share a family; tiers count from 1. */
  family?: string;
  tier?: number;
  /** Secret until earned: the server sends a placeholder name and hint meanwhile. */
  hidden?: boolean;
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

/** Spaced-repetition queue of missed digraphs. */
export interface ReviewQueue {
  total: number;
  due: number;
  duePairs: string[];
  nextDueAt: string | null;
}

export interface ErrorTrendWeek {
  /** Monday of the week (UTC), 'YYYY-MM-DD'. */
  week: string;
  runs: number;
  presses: number;
  errors: number;
  errorRate: number | null;
  wpm: number | null;
  /** Error rate of each tracked key that week (null without presses). */
  keys: Record<string, number | null>;
}

export interface ErrorTrends {
  keys: string[];
  weeks: ErrorTrendWeek[];
}

export interface LearnOverview {
  review?: ReviewQueue;
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
  role?: string;
  /** Quick-match rating when the player joined (null outside rated rooms). */
  rating?: number | null;
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

export type RaceMode = 'words' | 'time' | 'phrases';

/** Host-chosen race rules; the server validates them against fixed lists. */
export interface RaceSettings {
  mode: RaceMode;
  /** Text category for the phrases mode. */
  category: string;
  wordCount: number;
  timeLimit: number;
  maxPlayers: number;
  countdownSec: number;
  punctuation: boolean;
  numbers: boolean;
}

export type Role = 'user' | 'moderator' | 'admin' | 'founder';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  social: boolean;
  achievements: boolean;
  races: boolean;
  daily: boolean;
}

export interface AdminUser {
  _id: string;
  username: string;
  displayName?: string;
  email?: string;
  role: Role;
  status: 'active' | 'deactivated' | 'banned';
  statusReason?: string;
  permissionGrants?: string[];
  permissionRevokes?: string[];
  level?: LevelInfo;
  stats?: UserStats;
  createdAt: string;
}

export interface AdminUsersPage {
  users: AdminUser[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface PermissionCatalog {
  permissions: { id: string; description: string }[];
  roles: Record<Role, string[]>;
}

export interface AdminRoom {
  code: string;
  name: string;
  state: string;
  isPrivate: boolean;
  rated: boolean;
  hostId: string;
  players: { userId: string; displayName: string; muted: boolean }[];
  spectators: number;
}

export interface AdminAudit {
  entries: {
    id: string;
    action: string;
    reason: string;
    details: unknown;
    createdAt: string;
    actor: { userId: string; username: string; role: string } | null;
    target: { userId: string; username: string; role: string } | null;
  }[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface RaceMistakePlayer {
  userId: string;
  displayName: string;
  username: string;
  place: number | null;
  wpm: number | null;
  accuracy: number | null;
  /** False when the run has no keystroke log (DNF, or never saved). */
  hasData: boolean;
  mistakes?: number;
  backspaces?: number;
  blocked?: number;
  worstKeys?: { key: string; count: number }[];
  /** Mistakes made in each word of the shared text. */
  wordErrors?: number[];
}

export interface RaceMistakes {
  raceId: string;
  code: string;
  name: string;
  finishedAt: string;
  players: RaceMistakePlayer[];
  words: string[];
  hardestWords: { word: string; errors: number }[];
}

export interface RaceHistoryEntry {
  raceId: string;
  code: string;
  name: string;
  finishedAt: string;
  mode: RaceMode;
  wordCount: number;
  timeLimit: number | null;
  rated: boolean;
  racers: number;
  place: number | null;
  wpm: number | null;
  accuracy: number | null;
}

export interface RaceRoom extends RaceSettings {
  code: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  /** Quick-match room: the result moves ratings. */
  rated: boolean;
  /** Number of people watching. */
  spectators: number;
  state: RaceState;
  startAt: number | null;
  serverNow: number;
  text: string | null;
  winnerId: string | null;
  players: RacePlayer[];
  /** Rating change per userId once a rated race is over. */
  ratingChanges: Record<string, number> | null;
}

export type RaceEmote = 'wave' | 'fire' | 'laugh' | 'wow' | 'clap' | 'gg';

export interface RaceChatMessage {
  from: { userId: string; displayName: string };
  text?: string;
  emote?: RaceEmote;
  at: number;
}

export interface RaceRatingEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  races: number;
  wins: number;
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
  mode: RaceMode;
  category: string;
  wordCount: number;
  timeLimit: number;
  players: number;
  maxPlayers: number;
  /** Lobbies can be joined; races under way can be watched. */
  state: RaceState;
  rated: boolean;
}

/** Cursor positions over a run: [ms from the run's start, chars typed]. */
export type GhostTimeline = [number, number][];

/** A recorded run raced as a ghost cursor. */
export interface RunGhost {
  kind: 'pb' | 'daily';
  label: string;
  wpm: number;
  timeline: GhostTimeline;
}

export interface Replay {
  resultId: string;
  player: { userId: string; username: string; displayName: string; avatar: string };
  text: string;
  keystrokes: [number, string][];
  rules: Partial<TypingRules>;
  leadMs: number;
  timeMax: number;
  gameMode: GameMode;
  wordCount: number;
  modifiers: string;
  wpm: number;
  rawWpm?: number;
  accuracy: number;
  consistency: number;
  performance: PerformancePoint[];
  ranked: boolean;
  dailyDate: string | null;
  createdAt: string;
}
