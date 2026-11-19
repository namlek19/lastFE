import LZString from 'lz-string';
import {
  DetailedMasteryState,
  ExamHistoryItem,
  QuestionProgress,
  StudyMode,
  StudyTier,
  SubjectId,
  ThreeStateMastery,
  UserProgressStore,
} from '../types/quiz';

const STORAGE_KEY = 'fpt_exam_prep_v1';
const THEME_STORAGE_KEY = 'fpt_exam_theme_v1';
const CODE_PREFIX = 'OT1:';

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

function normalizeTier(raw: unknown): StudyTier {
  return raw === 'lazymax' || raw === 'lazy' ? raw : 'hardcore';
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
      : parsed.lastSubject === 'mln131'
        ? 'mln131'
        : 'vnr202';
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

export function recordQuestionAttempt(
  store: UserProgressStore,
  questionId: string,
  isCorrect: boolean,
  flaggedOverride?: boolean
): UserProgressStore {
  const prev = getQuestionProgress(store, questionId);
  const flagged = flaggedOverride !== undefined ? flaggedOverride : prev.flagged;

  let streak = 0;
  if (isCorrect && !flagged) {
    streak = (prev.streak || 0) + 1;
  }

  const next: QuestionProgress = {
    streak,
    flagged,
    lastResult: isCorrect ? 'correct' : 'wrong',
    correctCount: prev.correctCount + (isCorrect ? 1 : 0),
    attemptCount: prev.attemptCount + 1,
    studied: isCorrect ? Boolean(prev.studied) : false,
  };

  return {
    ...store,
    questions: {
      ...store.questions,
      [questionId]: next,
    },
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

type CompactTuple = [string, number, 0 | 1, 0 | 1 | 2, number, number, (0 | 1)?];

interface CompactSyncPayload {
  v: 1;
  s: SubjectId;
  m: StudyMode;
  t?: StudyTier;
  q: CompactTuple[];
  h: ExamHistoryItem[];
}

export function exportProgressCode(store: UserProgressStore): string {
  const tuples: CompactTuple[] = Object.entries(store.questions).map(([id, p]) => [
    id,
    p.streak,
    p.flagged ? 1 : 0,
    p.lastResult === 'correct' ? 1 : p.lastResult === 'wrong' ? 2 : 0,
    p.correctCount,
    p.attemptCount,
    p.studied ? 1 : 0,
  ]);

  const payload: CompactSyncPayload = {
    v: 1,
    s: store.lastSubject,
    m: store.lastMode,
    t: store.lastTier,
    q: tuples,
    h: store.examHistory,
  };

  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  return `${CODE_PREFIX}${compressed}`;
}

export function importProgressCode(code: string): UserProgressStore | null {
  try {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const rawCompressed = trimmed.startsWith(CODE_PREFIX)
      ? trimmed.slice(CODE_PREFIX.length)
      : trimmed;

    const jsonText = LZString.decompressFromEncodedURIComponent(rawCompressed);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText) as Partial<CompactSyncPayload>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.q)) {
      return null;
    }

    const questions: Record<string, QuestionProgress> = {};
    for (const row of parsed.q) {
      if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
      const [id, streak, flaggedNum, lastResNum, correctCount, attemptCount, studiedNum] = row;
      questions[id] = {
        streak: typeof streak === 'number' ? Math.max(0, streak) : 0,
        flagged: flaggedNum === 1,
        ...(lastResNum === 1
          ? { lastResult: 'correct' as const }
          : lastResNum === 2
            ? { lastResult: 'wrong' as const }
            : {}),
        correctCount: typeof correctCount === 'number' ? Math.max(0, correctCount) : 0,
        attemptCount: typeof attemptCount === 'number' ? Math.max(0, attemptCount) : 0,
        studied: studiedNum === 1,
      };
    }

    return {
      version: 1,
      questions,
      examHistory: Array.isArray(parsed.h) ? parsed.h : [],
      lastSubject: parsed.s === 'mln131' ? 'mln131' : 'vnr202',
      lastMode:
        parsed.m === 'rolling' || parsed.m === 'flashcard' || parsed.m === 'exam'
          ? parsed.m
          : 'chapter',
      lastTier: normalizeTier(parsed.t),
      subjectMigratedVnr: true,
      tierMigratedHardcore: true,
    };
  } catch {
    return null;
  }
}

/**
 * Cumulatively merges an imported progress store into the current local store
 * so learning on multiple devices/tiers combines mastered & studied questions
 * and exam history without losing local progress.
 */
export function mergeProgressStores(
  current: UserProgressStore,
  incoming: UserProgressStore
): UserProgressStore {
  const mergedQuestions: Record<string, QuestionProgress> = { ...current.questions };

  for (const [qId, incProg] of Object.entries(incoming.questions)) {
    const curProg = mergedQuestions[qId];
    if (!curProg) {
      mergedQuestions[qId] = incProg;
      continue;
    }

    const curMastered = isMastered(curProg);
    const incMastered = isMastered(incProg);
    const eitherMastered = curMastered || incMastered;

    const streak = eitherMastered
      ? Math.max(2, curProg.streak || 0, incProg.streak || 0)
      : Math.max(curProg.streak || 0, incProg.streak || 0);
    const flagged = eitherMastered ? false : Boolean(curProg.flagged || incProg.flagged);
    const studied = Boolean(curProg.studied || incProg.studied || streak > 0);
    const correctCount = Math.max(curProg.correctCount || 0, incProg.correctCount || 0);
    const attemptCount = Math.max(curProg.attemptCount || 0, incProg.attemptCount || 0);
    const lastResult =
      streak > 0 || curProg.lastResult === 'correct' || incProg.lastResult === 'correct'
        ? ('correct' as const)
        : (incProg.lastResult ?? curProg.lastResult);

    mergedQuestions[qId] = {
      streak,
      flagged,
      studied,
      correctCount,
      attemptCount,
      ...(lastResult ? { lastResult } : {}),
    };
  }

  const historyMap = new Map<string, ExamHistoryItem>();
  for (const item of current.examHistory) {
    historyMap.set(item.id, item);
  }
  for (const item of incoming.examHistory) {
    if (!historyMap.has(item.id)) {
      historyMap.set(item.id, item);
    }
  }
  const mergedHistory = Array.from(historyMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30);

  return {
    version: 1,
    questions: mergedQuestions,
    examHistory: mergedHistory,
    lastSubject: current.lastSubject,
    lastMode: current.lastMode,
    lastTier: current.lastTier ?? 'hardcore',
    subjectMigratedVnr: true,
    tierMigratedHardcore: true,
  };
}
