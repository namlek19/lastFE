export type SubjectId = 'mln131' | 'vnr202';

export type StudyMode = 'chapter' | 'rolling' | 'flashcard' | 'exam';

export type StudyTier = 'lazymax' | 'lazy' | 'hardcore';

export interface QuestionOption {
  key: string; // "A" | "B" | "C" | "D" | "E"
  text: string;
}

export interface QuestionItem {
  id: string;
  chapter: number;
  chapterTitle: string;
  question: string;
  options: QuestionOption[];
  correctAnswers: string[];
  isMultiSelect: boolean;
  explanation: string;
  note: string;
}

export type MasteryStatus = 'unlearned' | 'hesitant' | 'wrong' | 'mastered';

export type ThreeStateMastery = 'unlearned' | 'hesitant' | 'mastered';

export type DetailedMasteryState = 'unlearned' | 'studied' | 'pass1' | 'hesitant' | 'mastered';

export interface QuestionProgress {
  streak: number;
  flagged: boolean;
  lastResult?: 'correct' | 'wrong';
  correctCount: number;
  attemptCount: number;
  studied?: boolean;
}

export type ExamType = 'standard' | 'mastered';

export interface ExamHistoryItem {
  id: string;
  subject: SubjectId;
  examType?: ExamType;
  timestamp: number;
  totalQuestions: number;
  correctCount: number;
  scoreOn10: number;
  durationSeconds: number;
  chapterBreakdown: Record<number, { correct: number; total: number }>;
}

export interface UserProgressStore {
  version: 1;
  questions: Record<string, QuestionProgress>;
  examHistory: ExamHistoryItem[];
  lastSubject: SubjectId;
  lastMode: StudyMode;
  lastTier?: StudyTier;
  subjectMigratedVnr?: boolean;
  tierMigratedHardcore?: boolean;
}
