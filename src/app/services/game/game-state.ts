import { Character, GameState, PracticeKind } from '../../models/models';
import { ls } from '../../utils/storage';
import { DEFAULT_RULES } from './typing-engine';

/**
 * Creates the character array from a text string. Characters before
 * `typedPrefix` (e.g. a resumed session) are marked as already typed.
 */
export const textToCharacters = (text: string, typedPrefix = ''): Character[] => {
  if (!text) return [];
  const prefixLength = typedPrefix ? typedPrefix.length : 0;
  return text.split('').map((char, index) => ({
    char,
    status: index < prefixLength ? 'correct' : '',
  }));
};

/** Fallback banner label when practice state comes from the server (e.g. after a reload). */
export const practiceLabel = (p: { kind: PracticeKind; id: string | null }): string => {
  switch (p.kind) {
    case 'drill': return `Drill · ${p.id === ' ' ? 'Space' : (p.id ?? '').toUpperCase()}`;
    case 'lesson': return 'Lesson';
    case 'common-words': return 'Common words';
    case 'list': return 'Custom list';
  }
};

/** Rules the player picked last (sent with settings; the server confirms them). */
export const savedRules = (): Partial<GameState['rules']> => {
  const difficulty = ls.get('difficulty');
  const stopOnError = ls.get('stopOnError');
  return {
    ...(difficulty === 'normal' || difficulty === 'hardcore' ? { difficulty } : {}),
    ...(stopOnError === 'off' || stopOnError === 'letter' || stopOnError === 'word' ? { stopOnError } : {}),
    spaceSkips: ls.bool('spaceSkips'),
  };
};

export const defaultState = (isAuthenticated: boolean): GameState => {
  const initialGameMode: GameState['gameMode'] = isAuthenticated
    ? (ls.get('gameMode') as GameState['gameMode']) || 'phrases'
    : 'words';
  const initialTimeMax = ls.int('timeMax', 120);
  return {
    currentText: '',
    text: '',
    currentIndex: 0,
    mistakes: 0,
    successes: 0,
    accuracy: 0,
    score: 0,
    completionPercentage: 0,
    isTyping: false,
    isFinished: false,
    timeMax: initialTimeMax,
    timeLeft: initialTimeMax,
    gameMode: initialGameMode,
    wordCount: ls.int('wordCount', 50),
    isMuted: ls.bool('soundMuted'),
    punctuationEnabled: isAuthenticated ? ls.bool('punctuationEnabled') : false,
    numbersEnabled: isAuthenticated ? ls.bool('numbersEnabled') : false,
    lastWpm: 0,
    lastCpm: 0,
    totalWords: 0,
    textSource: isAuthenticated
      ? (ls.get('textSource') as GameState['textSource']) || 'default'
      : 'default',
    textCategory: (ls.get('textCategory') as GameState['textCategory']) || 'classics',
    passage: null,
    generatorUnit: (ls.get('generatorUnit') as GameState['generatorUnit']) || 'sentence',
    generatorCount: ls.int('generatorCount', 3),
    loremMin: ls.int('loremMin', 20),
    loremMax: ls.int('loremMax', 60),
    caretStyle: (ls.get('caretStyle') as GameState['caretStyle']) || 'line',
    dailyDate: null,
    practice: null,
    botWpm: null,
    race: null,
    rules: { ...DEFAULT_RULES, ...savedRules() },
  };
};
