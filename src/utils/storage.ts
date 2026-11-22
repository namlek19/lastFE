import {
  DetailedMasteryState,
  ExamHistoryItem,
  QuestionProgress,
  StudyTier,
  SubjectId,
  ThreeStateMastery,
  UserProgressStore,
} from '../types/quiz';

const STORAGE_KEY = 'fpt_exam_prep_v1';
const THEME_STORAGE_KEY = 'fpt_exam_theme_v1';

export type ThemeMode = 'light' | 'dark';

export function loadTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage quota errors gracefully
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

export function createDefaultStore(): UserProgressStore {
  return {
    version: 1,
    questions: {},
    examHistory: [],
    lastSubject: 'vnr202',
    lastMode: 'chapter',
    lastTier: 'hardcore',
    subjectMigratedVnr: true,
    tierMigratedHardcore: true,
  };
}

export function normalizeTier(raw: unknown): StudyTier {
  return raw === 'lazymax' || raw === 'lazy' ? raw : 'hardcore';
}

export function normalizeSubject(raw: unknown): SubjectId {
  if (
    raw === 'mln131' ||
    raw === 'vnr202' ||
    raw === 'mln122' ||
    raw === 'wdu202c' ||
    raw === 'wdu203c'
  ) {
    return raw;
  }
  return 'vnr202';
}

export function loadStore(): UserProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as Partial<UserProgressStore>;
    if (!parsed || parsed.version !== 1 || typeof parsed.questions !== 'object') {
      return createDefaultStore();
    }
    const migratedVnr = parsed.subjectMigratedVnr === true;
    const lastSubject: SubjectId = !migratedVnr
      ? 'vnr202'
      : normalizeSubject(parsed.lastSubject);
    const migratedHardcore = parsed.tierMigratedHardcore === true;
    const lastTier: StudyTier = !migratedHardcore ? 'hardcore' : normalizeTier(parsed.lastTier);

    return {
      version: 1,
      questions: parsed.questions ?? {},
      examHistory: Array.isArray(parsed.examHistory) ? parsed.examHistory : [],
      lastSubject,
      lastMode:
        parsed.lastMode === 'rolling' ||
        parsed.lastMode === 'flashcard' ||
        parsed.lastMode === 'exam'
          ? parsed.lastMode
          : 'chapter',
      lastTier,
      subjectMigratedVnr: true,
      tierMigratedHardcore: true,
    };
  } catch {
    return createDefaultStore();
  }
}

export function saveStore(store: UserProgressStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function getQuestionProgress(
  store: UserProgressStore,
  questionId: string
): QuestionProgress {
  return (
    store.questions[questionId] ?? {
      streak: 0,
      flagged: false,
      correctCount: 0,
      attemptCount: 0,
      studied: false,
    }
  );
}

export function getMasteryState(progress?: QuestionProgress): ThreeStateMastery {
  if (progress?.flagged) return 'hesitant';
  if ((progress?.streak ?? 0) >= 2) return 'mastered';
  return 'unlearned';
}

export function getDetailedMasteryState(progress?: QuestionProgress): DetailedMasteryState {
  if (!progress) return 'unlearned';
  if (progress.flagged) return 'hesitant';
  if (progress.streak >= 2) return 'mastered';
  if (progress.streak === 1) return 'pass1';
  if (progress.studied) return 'studied';
  return 'unlearned';
}

export function isMastered(progress?: QuestionProgress): boolean {
  return Boolean(progress && !progress.flagged && progress.streak >= 2);
}

export function isStudied(progress?: QuestionProgress): boolean {
  return Boolean(progress && (progress.studied || progress.streak > 0));
}

function buildNextQuestionAttempt(
  prev: QuestionProgress,
  isCorrect: boolean,
  flaggedOverride?: boolean
): QuestionProgress {
  const flagged = flaggedOverride !== undefined ? flaggedOverride : prev.flagged;

  let streak = 0;
  if (isCorrect && !flagged) {
    streak = (prev.streak || 0) + 1;
  }

  return {
    streak,
    flagged,
    lastResult: isCorrect ? 'correct' : 'wrong',
    correctCount: prev.correctCount + (isCorrect ? 1 : 0),
    attemptCount: prev.attemptCount + 1,
    studied: isCorrect ? Boolean(prev.studied) : false,
  };
}

export function recordQuestionAttempt(
  store: UserProgressStore,
  questionId: string,
  isCorrect: boolean,
  flaggedOverride?: boolean
): UserProgressStore {
  const prev = getQuestionProgress(store, questionId);
  const next = buildNextQuestionAttempt(prev, isCorrect, flaggedOverride);

  return {
    ...store,
    questions: {
      ...store.questions,
      [questionId]: next,
    },
  };
}

export function recordQuestionAttemptsBatch(
  store: UserProgressStore,
  attempts: readonly { questionId: string; isCorrect: boolean; flaggedOverride?: boolean }[]
): UserProgressStore {
  if (attempts.length === 0) return store;
  const nextQuestions = { ...store.questions };
  for (let i = 0; i < attempts.length; i++) {
    const { questionId, isCorrect, flaggedOverride } = attempts[i];
    const prev =
      nextQuestions[questionId] ?? {
        streak: 0,
        flagged: false,
        correctCount: 0,
        attemptCount: 0,
        studied: false,
      };
    nextQuestions[questionId] = buildNextQuestionAttempt(prev, isCorrect, flaggedOverride);
  }
  return {
    ...store,
    questions: nextQuestions,
  };
}

export function markQuestionStudied(
  store: UserProgressStore,
  questionId: string
): UserProgressStore {
  const existing = store.questions[questionId];
  if (existing?.studied) {
    return store;
  }
  const prev = getQuestionProgress(store, questionId);
  const next: QuestionProgress = {
    ...prev,
    studied: true,
  };

  return {
    ...store,
    questions: {
      ...store.questions,
      [questionId]: next,
    },
  };
}

export function toggleQuestionMastered(
  store: UserProgressStore,
  questionId: string
): UserProgressStore {
  const prev = getQuestionProgress(store, questionId);
  const currentlyMastered = isMastered(prev);

  const next: QuestionProgress = currentlyMastered
    ? {
        ...prev,
        streak: 0,
        flagged: false,
        studied: true,
      }
    : {
        ...prev,
        streak: Math.max(prev.streak, 2),
        flagged: false,
        lastResult: 'correct',
        studied: true,
      };

  return {
    ...store,
    questions: {
      ...store.questions,
      [questionId]: next,
    },
  };
}

export function toggleQuestionFlag(
  store: UserProgressStore,
  questionId: string
): UserProgressStore {
  const prev = getQuestionProgress(store, questionId);
  const nextFlagged = !prev.flagged;
  const next: QuestionProgress = {
    ...prev,
    flagged: nextFlagged,
    streak: nextFlagged ? 0 : prev.streak,
  };

  return {
    ...store,
    questions: {
      ...store.questions,
      [questionId]: next,
    },
  };
}

export function markQuestionsFlagged(
  store: UserProgressStore,
  questionIds: string[]
): UserProgressStore {
  if (questionIds.length === 0) return store;
  const nextQuestions = { ...store.questions };
  for (const qId of questionIds) {
    const prev = getQuestionProgress(store, qId);
    nextQuestions[qId] = {
      ...prev,
      flagged: true,
      streak: 0,
    };
  }
  return {
    ...store,
    questions: nextQuestions,
  };
}

export function addExamHistory(
  store: UserProgressStore,
  result: ExamHistoryItem
): UserProgressStore {
  return {
    ...store,
    examHistory: [result, ...store.examHistory].slice(0, 30),
  };
}

export function resetProgress(
  store: UserProgressStore,
  questionIds?: string[]
): UserProgressStore {
  if (!questionIds) {
    return createDefaultStore();
  }
  const nextQuestions = { ...store.questions };
  for (const id of questionIds) {
    delete nextQuestions[id];
  }
  return {
    ...store,
    questions: nextQuestions,
  };
}
