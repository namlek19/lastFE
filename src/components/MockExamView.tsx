import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  History,
  ListChecks,
  Menu,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
  TimerOff,
  X,
  XCircle,
} from 'lucide-react';
import { getQuestionsBySubject, isAnswerCorrect, SUBJECTS } from '../data';
import { ExamHistoryItem, ExamType, QuestionItem, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered } from '../utils/storage';
import { RichExplanation } from './RichExplanation';

interface MockExamViewProps {
  subject: SubjectId;
  progress: UserProgressStore;
  onSaveExamResult: (result: ExamHistoryItem) => void;
  onRecordAttempt: (qId: string, isCorrect: boolean) => void;
  onToggleFlag: (qId: string) => void;
  onFlagQuestions?: (qIds: string[]) => void;
}

type ExamPhase = 'lobby' | 'active' | 'results';
type ReviewFilter = 'wrong' | 'all' | 'flagged';

const EXAM_DURATION_SECONDS = 60 * 60;
const WARNING_THRESHOLD_SECONDS = 5 * 60;

function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function generateMockExam(subject: SubjectId): QuestionItem[] {
  const allQuestions = getQuestionsBySubject(subject);
  const quotas = SUBJECTS[subject].examQuotas;
  const seenIds = new Set<string>();
  const selected: QuestionItem[] = [];

  const chapterEntries = Object.entries(quotas)
    .map(([ch, quota]) => [Number(ch), quota] as const)
    .sort((a, b) => a[0] - b[0]);

  for (const [chapter, quota] of chapterEntries) {
    const pool = allQuestions.filter(q => q.chapter === chapter && !seenIds.has(q.id));
    const shuffled = fisherYatesShuffle(pool);
    const picked = shuffled.slice(0, quota);
    for (const q of picked) {
      seenIds.add(q.id);
      selected.push(q);
    }
  }

  return fisherYatesShuffle(selected);
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDurationVi(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs} giây`;
  if (secs === 0) return `${mins} phút`;
  return `${mins} phút ${secs} giây`;
}

function formatDateTimeVi(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export const MockExamView: React.FC<MockExamViewProps> = ({
  subject,
  progress,
  onSaveExamResult,
  onRecordAttempt,
  onToggleFlag,
  onFlagQuestions,
}) => {
  const subjectMeta = SUBJECTS[subject];
  const allSubjectQuestions = useMemo(() => getQuestionsBySubject(subject), [subject]);

  const [phase, setPhase] = useState<ExamPhase>('lobby');
  const [examType, setExamType] = useState<ExamType>('standard');
  const [activeExamType, setActiveExamType] = useState<ExamType>('standard');
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(EXAM_DURATION_SECONDS);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ExamHistoryItem | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('wrong');
  const [focusedReviewId, setFocusedReviewId] = useState<string | null>(null);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [isMobileResultsSheetOpen, setIsMobileResultsSheetOpen] = useState<boolean>(false);
  const [bulkFlaggedConfirm, setBulkFlaggedConfirm] = useState<number | null>(null);

  const submittedRef = useRef<boolean>(false);
  const reviewSectionRef = useRef<HTMLElement | null>(null);

  // Mastered question pool for the selected subject
  const masteredPool = useMemo(
    () => allSubjectQuestions.filter(q => isMastered(progress.questions[q.id])),
    [allSubjectQuestions, progress.questions]
  );
  const masteredCount = masteredPool.length;

  const masteredExamMeta = useMemo(() => {
    if (masteredCount >= 60) {
      return { questionCount: 60, durationMinutes: 45 };
    }
    if (masteredCount > 0) {
      return {
        questionCount: masteredCount,
        durationMinutes: Math.max(5, Math.round(masteredCount * 0.75)),
      };
    }
    return { questionCount: 0, durationMinutes: 0 };
  }, [masteredCount]);

  // Reset exam state if subject prop changes while component remains mounted
  useEffect(() => {
    submittedRef.current = false;
    setPhase('lobby');
    setExamQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setRemainingSeconds(EXAM_DURATION_SECONDS);
    setElapsedSeconds(0);
    setConfirmSubmitOpen(false);
    setLastResult(null);
    setReviewFilter('wrong');
    setFocusedReviewId(null);
    setIsMobileSheetOpen(false);
    setIsMobileResultsSheetOpen(false);
    setBulkFlaggedConfirm(null);
  }, [subject]);

  const subjectHistory = useMemo(
    () => progress.examHistory.filter(item => item.subject === subject),
    [progress.examHistory, subject]
  );

  const startNewExam = useCallback(() => {
    let generated: QuestionItem[] = [];
    let durationSec = EXAM_DURATION_SECONDS;

    if (examType === 'mastered') {
      const currentMastered = allSubjectQuestions.filter(q =>
        isMastered(progress.questions[q.id])
      );
      if (currentMastered.length === 0) return;
      generated = fisherYatesShuffle(currentMastered).slice(0, 60);
      const mins =
        currentMastered.length >= 60
          ? 45
          : Math.max(5, Math.round(currentMastered.length * 0.75));
      durationSec = mins * 60;
    } else {
      generated = generateMockExam(subject);
      durationSec = EXAM_DURATION_SECONDS;
    }

    submittedRef.current = false;
    setActiveExamType(examType);
    setExamQuestions(generated);
    setAnswers({});
    setCurrentIndex(0);
    setRemainingSeconds(durationSec);
    setElapsedSeconds(0);
    setConfirmSubmitOpen(false);
    setLastResult(null);
    setFocusedReviewId(null);
    setIsMobileSheetOpen(false);
    setIsMobileResultsSheetOpen(false);
    setBulkFlaggedConfirm(null);
    setPhase('active');
  }, [allSubjectQuestions, examType, progress.questions, subject]);

  const handleSubmitExam = useCallback(() => {
    if (submittedRef.current || examQuestions.length === 0) return;
    submittedRef.current = true;
    setConfirmSubmitOpen(false);

    const chapterBreakdown: Record<number, { correct: number; total: number }> = {};
    for (const chKey of Object.keys(subjectMeta.examQuotas)) {
      chapterBreakdown[Number(chKey)] = { correct: 0, total: 0 };
    }

    let correctCount = 0;

    for (const q of examQuestions) {
      const selected = answers[q.id] ?? [];
      const correct = isAnswerCorrect(selected, q.correctAnswers);

      if (!chapterBreakdown[q.chapter]) {
        chapterBreakdown[q.chapter] = { correct: 0, total: 0 };
      }
      chapterBreakdown[q.chapter].total += 1;

      if (correct) {
        correctCount += 1;
        chapterBreakdown[q.chapter].correct += 1;
      }

      if (activeExamType === 'standard' && selected.length > 0) {
        onRecordAttempt(q.id, correct);
      } else if (activeExamType === 'mastered' && correct && selected.length > 0) {
        onRecordAttempt(q.id, true);
      }
    }

    const totalQuestions = examQuestions.length;
    const scoreOn10 = Math.round((correctCount / totalQuestions) * 100) / 10;

    const result: ExamHistoryItem = {
      id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subject,
      examType: activeExamType,
      timestamp: Date.now(),
      totalQuestions,
      correctCount,
      scoreOn10,
      durationSeconds: elapsedSeconds,
      chapterBreakdown,
    };

    onSaveExamResult(result);
    setLastResult(result);
    setBulkFlaggedConfirm(null);
    setReviewFilter(correctCount < totalQuestions ? 'wrong' : 'all');
    setPhase('results');
  }, [
    activeExamType,
    answers,
    elapsedSeconds,
    examQuestions,
    onRecordAttempt,
    onSaveExamResult,
    subject,
    subjectMeta.examQuotas,
  ]);

  // Active exam 1-second tick for elapsed time and optional 60-minute countdown
  useEffect(() => {
    if (phase !== 'active') return;

    const timerId = window.setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
      if (timerEnabled) {
        setRemainingSeconds(prev => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [phase, timerEnabled]);

  // Auto-submit when countdown hits 00:00 while timer is enabled
  useEffect(() => {
    if (phase === 'active' && timerEnabled && remainingSeconds === 0) {
      handleSubmitExam();
    }
  }, [phase, timerEnabled, remainingSeconds, handleSubmitExam]);

  const currentQuestion = examQuestions[currentIndex];

  const handleSelectOption = useCallback(
    (question: QuestionItem, optionKey: string) => {
      if (phase !== 'active') return;
      setAnswers(prev => {
        const current = prev[question.id] ?? [];
        if (question.isMultiSelect) {
          const exists = current.includes(optionKey);
          const next = exists ? current.filter(k => k !== optionKey) : [...current, optionKey];
          return { ...prev, [question.id]: next };
        }
        return { ...prev, [question.id]: [optionKey] };
      });
    },
    [phase]
  );

  // Keyboard shortcuts during active exam:
  // 1-5 / A-E: select option, Enter / Space: next question, F: toggle "Phân vân"
  useEffect(() => {
    if (phase !== 'active' || !currentQuestion) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (confirmSubmitOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setConfirmSubmitOpen(false);
        }
        return;
      }

      const key = e.key;
      const upper = key.toUpperCase();

      if (['1', '2', '3', '4', '5'].includes(key)) {
        const idx = Number(key) - 1;
        const opt = currentQuestion.options[idx];
        if (opt) {
          e.preventDefault();
          handleSelectOption(currentQuestion, opt.key);
        }
        return;
      }

      if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
        const opt = currentQuestion.options.find(o => o.key.toUpperCase() === upper);
        if (opt) {
          e.preventDefault();
          handleSelectOption(currentQuestion, opt.key);
        }
        return;
      }

      if (upper === 'F') {
        e.preventDefault();
        onToggleFlag(currentQuestion.id);
        return;
      }

      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        setCurrentIndex(prev => (prev < examQuestions.length - 1 ? prev + 1 : prev));
        return;
      }

      if (key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex(prev => (prev < examQuestions.length - 1 ? prev + 1 : prev));
        return;
      }

      if (key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    confirmSubmitOpen,
    currentQuestion,
    examQuestions.length,
    handleSelectOption,
    onToggleFlag,
    phase,
  ]);

  const answeredCount = useMemo(
    () => examQuestions.filter(q => (answers[q.id]?.length ?? 0) > 0).length,
    [answers, examQuestions]
  );

  const unansweredCount = examQuestions.length - answeredCount;

  const requestSubmit = () => {
    if (unansweredCount > 0) {
      setConfirmSubmitOpen(true);
    } else {
      handleSubmitExam();
    }
  };

  // Graded details for results view
  const gradedItems = useMemo(() => {
    return examQuestions.map((q, idx) => {
      const selected = answers[q.id] ?? [];
      const isCorrect = isAnswerCorrect(selected, q.correctAnswers);
      const isFlagged = Boolean(progress.questions[q.id]?.flagged);
      return {
        question: q,
        index: idx,
        selected,
        isCorrect,
        isFlagged,
      };
    });
  }, [answers, examQuestions, progress.questions]);

  const wrongCount = useMemo(
    () => gradedItems.filter(item => !item.isCorrect).length,
    [gradedItems]
  );

  const flaggedInExamCount = useMemo(
    () => gradedItems.filter(item => item.isFlagged).length,
    [gradedItems]
  );

  const filteredReviewItems = useMemo(() => {
    if (reviewFilter === 'wrong') return gradedItems.filter(item => !item.isCorrect);
    if (reviewFilter === 'flagged') return gradedItems.filter(item => item.isFlagged);
    return gradedItems;
  }, [gradedItems, reviewFilter]);

  const handleJumpToReviewQuestion = (qId: string, isCorrect: boolean, isFlagged: boolean) => {
    const visibleInCurrentFilter =
      reviewFilter === 'all' ||
      (reviewFilter === 'wrong' && !isCorrect) ||
      (reviewFilter === 'flagged' && isFlagged);

    if (!visibleInCurrentFilter) {
      setReviewFilter('all');
    }
    setFocusedReviewId(qId);

    window.setTimeout(() => {
      const el = document.getElementById(`exam-review-q-${qId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 40);
  };

  const handleFlagWrongQuestions = () => {
    const wrongIds = gradedItems.filter(item => !item.isCorrect).map(item => item.question.id);
    if (wrongIds.length === 0) return;

    if (onFlagQuestions) {
      onFlagQuestions(wrongIds);
    } else {
      for (const qId of wrongIds) {
        if (!progress.questions[qId]?.flagged) {
          onToggleFlag(qId);
        }
      }
    }
    setBulkFlaggedConfirm(wrongIds.length);
  };

  const handleScrollToReview = () => {
    reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // =========================
  // PHASE 1: PRE-EXAM LOBBY
  // =========================
  if (phase === 'lobby') {
    const isMasteredMode = examType === 'mastered';
    const currentPlannedQuestions = isMasteredMode
      ? masteredExamMeta.questionCount
      : subjectMeta.examTotal;
    const currentPlannedMinutes = isMasteredMode ? masteredExamMeta.durationMinutes : 60;
    const isStartDisabled = isMasteredMode && masteredCount === 0;

    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="flex w-full flex-col items-start justify-between gap-8 lg:flex-row lg:gap-12">
          {/* Main Exam Setup Card */}
          <section className="w-full flex-1 rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-4 shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8 lg:max-w-[1040px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D2DACB] pb-4 dark:border-[#222E27] sm:pb-5">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                    isMasteredMode
                      ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                      : 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                  }`}
                >
                  {isMasteredMode ? (
                    <Sparkles className="h-3.5 w-3.5 text-[#1F8A65] dark:text-[#6EE7B7]" />
                  ) : (
                    <ListChecks className="h-3.5 w-3.5 text-[#2E6F4E] dark:text-[#74C69D]" />
                  )}
                  {isMasteredMode
                    ? currentPlannedQuestions > 0
                      ? `Đề thi thử ${currentPlannedQuestions} câu`
                      : 'Ôn các câu đã học'
                    : `Đề thi thử ${subjectMeta.examTotal} câu`}
                </span>
                <h2 className="mt-2.5 text-lg font-bold text-[#142018] dark:text-[#F3F6F4] sm:text-xl">
                  Thi thử trộn đề — {subjectMeta.code}
                </h2>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-1.5 text-xs font-medium text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] sm:px-3.5 sm:py-2">
                <Clock className="h-4 w-4 text-[#2E6F4E] dark:text-[#74C69D]" />
                <span className="tabular-nums">
                  {currentPlannedMinutes > 0
                    ? `Thời lượng chuẩn: ${currentPlannedMinutes} phút`
                    : 'Chưa có câu đã thuộc'}
                </span>
              </div>
            </div>

            {/* 2-Mode Exam Selector Cards (Mobile-First grid-cols-1 sm:grid-cols-2 gap-3) */}
            <div className="mt-4 sm:mt-5">
              <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#5C6E60] dark:text-[#8B9E91]">
                Chọn chế độ đề thi
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Mode 1: Standard Curriculum Exam */}
                <button
                  type="button"
                  onClick={() => setExamType('standard')}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${
                    examType === 'standard'
                      ? 'border-[#2E6F4E] bg-[#E3EFE8] ring-1 ring-[#2E6F4E] dark:border-[#52B788] dark:bg-[#357A58]/20 dark:ring-[#52B788]'
                      : 'border-[#D2DACB] bg-[#F7F8F5] hover:border-[#2E6F4E] hover:bg-[#E3EFE8]/60 dark:border-[#25332B] dark:bg-[#17201B] dark:hover:border-[#52B788] dark:hover:bg-[#223029]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold ${
                        examType === 'standard'
                          ? 'text-[#23583D] dark:text-[#74C69D]'
                          : 'text-[#142018] dark:text-[#F3F6F4]'
                      }`}
                    >
                      Đề chuẩn đề cương (random)
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        examType === 'standard'
                          ? 'border-[#2E6F4E] bg-[#2E6F4E] text-white dark:border-[#52B788] dark:bg-[#357A58]'
                          : 'border-[#C5D1BE] dark:border-[#31453A]'
                      }`}
                    >
                      {examType === 'standard' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-md border border-[#9BC4AE] bg-[#E3EFE8] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#23583D] tabular-nums dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                      60 câu • 60 phút
                    </span>
                  </div>
                </button>

                {/* Mode 2: Mastered Pool Review Exam */}
                <button
                  type="button"
                  onClick={() => setExamType('mastered')}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${
                    examType === 'mastered'
                      ? 'border-[#1F8A65] bg-[#E1F3EC] ring-1 ring-[#1F8A65] dark:border-[#52B788] dark:bg-[#2E9E73]/15 dark:ring-[#52B788]'
                      : 'border-[#D2DACB] bg-[#F7F8F5] hover:border-[#1F8A65] hover:bg-[#E1F3EC]/60 dark:border-[#25332B] dark:bg-[#17201B] dark:hover:border-[#52B788] dark:hover:bg-[#223029]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold ${
                        examType === 'mastered'
                          ? 'text-[#0F5C41] dark:text-[#6EE7B7]'
                          : 'text-[#142018] dark:text-[#F3F6F4]'
                      }`}
                    >
                      Ôn các câu đã học
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        examType === 'mastered'
                          ? 'border-[#1F8A65] bg-[#1F8A65] text-white dark:border-[#52B788] dark:bg-[#38A179] dark:text-[#0D120F]'
                          : 'border-[#C5D1BE] dark:border-[#31453A]'
                      }`}
                    >
                      {examType === 'mastered' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#68B99A] bg-[#E1F3EC] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                      Kho đã thuộc: {masteredCount} câu
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mode Details: Standard Chapter Quota Matrix vs Mastered Pool Summary */}
            {!isMasteredMode ? (
              <div className="mt-5 sm:mt-6">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#5C6E60] dark:text-[#8B9E91]">
                  <span>Cấu trúc phân bổ câu hỏi</span>
                  <span className="tabular-nums text-[#23583D] dark:text-[#74C69D]">
                    Tổng {subjectMeta.examTotal} câu
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {subjectMeta.chapters.map(ch => {
                    const quota = subjectMeta.examQuotas[ch.chapter] ?? 0;
                    return (
                      <div
                        key={ch.chapter}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-2.5 dark:border-[#25332B] dark:bg-[#17201B] sm:px-4 sm:py-3"
                      >
                        <span className="text-xs font-semibold text-[#23583D] dark:text-[#74C69D]">
                          Chương {ch.chapter}
                        </span>
                        <span className="shrink-0 rounded-lg border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-xs font-bold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                          {quota} câu
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3.5 sm:mt-6">
                <div className="rounded-xl border border-[#68B99A] bg-[#E1F3EC]/75 p-4 dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1F8A65] dark:text-[#6EE7B7]" />
                      <span className="text-sm font-bold text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                        Kho đã thuộc: {masteredCount} câu
                      </span>
                    </div>
                    {masteredCount > 0 && (
                      <span className="rounded-full border border-[#68B99A] bg-white px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#17201B] dark:text-[#6EE7B7]">
                        Đề thi thử {currentPlannedQuestions} câu • {currentPlannedMinutes} phút
                      </span>
                    )}
                  </div>

                  {masteredCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#68B99A]/60 pt-3 dark:border-[#52B788]/30">
                      {subjectMeta.chapters.map(ch => {
                        const chMastered = masteredPool.filter(q => q.chapter === ch.chapter).length;
                        return (
                          <span
                            key={ch.chapter}
                            className="rounded-md border border-[#68B99A] bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#17201B] dark:text-[#6EE7B7]"
                          >
                            Chương {ch.chapter}: {chMastered} câu
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {masteredCount === 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-[#9BC4AE] bg-[#E3EFE8] p-4 text-xs leading-relaxed text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] sm:text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">
                      Bạn chưa có câu nào đạt trạng thái Đã thuộc ở môn này. Hãy học ở tab Theo
                      chương, Cuốn chiếu hoặc Flashcard trước nhé!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Timer Toggle + Start Action */}
            <div className="mt-5 flex flex-col gap-3.5 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-4 dark:border-[#25332B] dark:bg-[#17201B] sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
              <button
                type="button"
                onClick={() => setTimerEnabled(prev => !prev)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg text-left transition-colors"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    timerEnabled
                      ? 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                      : 'border-[#D2DACB] bg-[#E8ECE4] text-[#5C6E60] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#8B9E91]'
                  }`}
                >
                  {timerEnabled ? <Timer className="h-5 w-5" /> : <TimerOff className="h-5 w-5" />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#142018] dark:text-[#F3F6F4]">
                  <span>
                    Đếm ngược {currentPlannedMinutes > 0 ? currentPlannedMinutes : 45} phút
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      timerEnabled
                        ? 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                        : 'border-[#D2DACB] bg-[#E8ECE4] text-[#5C6E60] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#8B9E91]'
                    }`}
                  >
                    {timerEnabled ? 'Đang bật' : 'Đang tắt'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isStartDisabled}
                onClick={startNewExam}
                className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2E6F4E] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#23583D] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649] sm:w-auto sm:py-3"
              >
                <Play className="h-4 w-4 fill-current" />
                Bắt đầu làm bài
              </button>
            </div>
          </section>

          {/* Recent Exam History Card */}
          <section className="flex w-full shrink-0 flex-col rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-4 shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8 lg:w-[420px] xl:w-[460px]">
            <div className="flex items-center justify-between border-b border-[#D2DACB] pb-4 dark:border-[#222E27] sm:pb-5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#2E6F4E] dark:text-[#74C69D]" />
                <h3 className="text-base font-bold text-[#142018] dark:text-[#F3F6F4]">
                  Lịch sử thi gần đây
                </h3>
              </div>
              <span className="rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-xs font-semibold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                {subjectHistory.length} lượt
              </span>
            </div>

            {subjectHistory.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                  <Award className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#142018] dark:text-[#F3F6F4]">
                  Chưa có bài thi thử {subjectMeta.code} nào
                </p>
                <p className="mt-1 max-w-xs text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                  Hoàn thành một đề thi để xem điểm số và phân tích từng chương tại đây.
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 sm:mt-5">
                {subjectHistory.map(item => {
                  const passed = item.scoreOn10 >= 5;
                  const isItemMasteredMode = item.examType === 'mastered';
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#C5D1BE] bg-white p-3.5 transition hover:border-[#2E6F4E] dark:border-[#25332B] dark:bg-[#17201B] dark:hover:border-[#52B788] sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums ${
                              passed
                                ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                                : 'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]'
                            }`}
                          >
                            {item.scoreOn10.toFixed(1)}đ
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-[#142018] tabular-nums dark:text-[#F3F6F4]">
                                {item.correctCount}/{item.totalQuestions} câu đúng
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                                  isItemMasteredMode
                                    ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                                    : 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                                }`}
                              >
                                {isItemMasteredMode ? 'Ôn đã thuộc' : 'Đề đề cương'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                              {formatDateTimeVi(item.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                          <div className="font-medium text-[#243329] dark:text-[#DDE5DF]">
                            {formatClock(item.durationSeconds)}
                          </div>
                          <div>Thời gian làm</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(item.chapterBreakdown)
                          .filter(([, stat]) => stat.total > 0)
                          .sort((a, b) => Number(a[0]) - Number(b[0]))
                          .map(([ch, stat]) => (
                            <span
                              key={ch}
                              className="rounded-md border border-[#D2DACB] bg-[#F7F8F5] px-2 py-0.5 text-[11px] font-medium text-[#5C6E60] tabular-nums dark:border-[#25332B] dark:bg-[#131A16] dark:text-[#8B9E91]"
                            >
                              C{ch}: {stat.correct}/{stat.total}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // =========================
  // PHASE 2: ACTIVE EXAM
  // =========================
  if (phase === 'active' && currentQuestion) {
    const selectedKeys = answers[currentQuestion.id] ?? [];
    const isFlagged = Boolean(progress.questions[currentQuestion.id]?.flagged);
    const isLowTime = timerEnabled && remainingSeconds < WARNING_THRESHOLD_SECONDS;

    return (
      <>
        <div className="w-full space-y-3 lg:space-y-6">
          {/* Mobile / Tablet Compact 1-Line Toolbar (< 1024px) */}
          <div className="flex w-full items-center justify-between gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-xl border border-[#D2DACB] bg-[#E8ECE4] px-3 py-2 text-left text-xs font-semibold text-[#142018] shadow-xs transition active:scale-[0.99] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#F3F6F4]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#2E6F4E] dark:text-[#74C69D]" />
                <span className="truncate tabular-nums">
                  Câu {currentIndex + 1}/{examQuestions.length} • Đã làm {answeredCount}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#5C6E60] dark:text-[#8B9E91]" />
            </button>

            <button
              type="button"
              onClick={() => setTimerEnabled(prev => !prev)}
              title={timerEnabled ? 'Đang bật đếm ngược (chạm để tắt)' : 'Đang tắt đếm ngược (chạm để bật)'}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold tabular-nums transition ${!timerEnabled
                  ? 'border-[#D2DACB] bg-[#E8ECE4] text-[#5C6E60] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#8B9E91]'
                  : isLowTime
                    ? 'animate-pulse border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]'
                    : 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{timerEnabled ? formatClock(remainingSeconds) : formatClock(elapsedSeconds)}</span>
            </button>

            <button
              type="button"
              onClick={requestSubmit}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-[#2E6F4E] px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Nộp</span>
            </button>
          </div>

          {/* Desktop Sticky Top Bar (>= 1024px) */}
          <div className="sticky top-28 z-20 hidden w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D2DACB] bg-[#E8ECE4]/95 px-5 py-3.5 shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] backdrop-blur dark:border-[#222E27] dark:bg-[#131A16]/95 dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)] lg:flex">
            <div className="flex flex-wrap items-center gap-3">
              {/* Countdown Timer + Toggle */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold tabular-nums transition-colors ${!timerEnabled
                      ? 'border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91]'
                      : isLowTime
                        ? 'animate-pulse border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]'
                        : 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                    }`}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    {timerEnabled ? formatClock(remainingSeconds) : formatClock(elapsedSeconds)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setTimerEnabled(prev => !prev)}
                  title={timerEnabled ? 'Tắt đồng hồ đếm ngược' : 'Bật đồng hồ đếm ngược'}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-2.5 py-1.5 text-xs font-medium text-[#5C6E60] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91] dark:hover:border-[#52B788] dark:hover:bg-[#223029] dark:hover:text-[#74C69D]"
                >
                  {timerEnabled ? (
                    <>
                      <TimerOff className="h-3.5 w-3.5" />
                      <span>Tắt đếm ngược</span>
                    </>
                  ) : (
                    <>
                      <Timer className="h-3.5 w-3.5 text-[#2E6F4E] dark:text-[#74C69D]" />
                      <span>Bật đếm ngược</span>
                    </>
                  )}
                </button>
              </div>

              {/* Answered Progress */}
              <div className="flex items-center gap-2.5 border-l border-[#D2DACB] pl-3 dark:border-[#222E27]">
                <span className="text-xs font-semibold text-[#243329] tabular-nums dark:text-[#DDE5DF]">
                  Đã làm: <span className="text-[#0F5C41] dark:text-[#6EE7B7]">{answeredCount}</span>/{examQuestions.length} câu
                </span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-[#D2DACB] dark:bg-[#0D120F]">
                  <div
                    className="h-full rounded-full bg-[#1F8A65] transition-all duration-200 dark:bg-[#38A179]"
                    style={{
                      width: `${Math.round((answeredCount / examQuestions.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={requestSubmit}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#2E6F4E] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
            >
              <Send className="h-4 w-4" />
              Nộp bài
            </button>
          </div>

          {/* Main Active 2-Column Layout: Left 60-Cell Navigator Sidebar + Right Question Card */}
          <div className="flex w-full flex-col items-start justify-between gap-8 lg:flex-row lg:gap-12">
            {/* Desktop Navigator Sidebar */}
            <aside className="hidden w-full shrink-0 rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-6 shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] lg:sticky lg:top-28 lg:order-1 lg:block lg:w-[340px]">
              <div className="flex items-center justify-between border-b border-[#D2DACB] pb-3.5 dark:border-[#222E27]">
                <h4 className="text-sm font-bold text-[#142018] tabular-nums dark:text-[#F3F6F4]">
                  Bảng câu hỏi ({examQuestions.length} câu)
                </h4>
                <span className="text-xs font-medium text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                  Còn {unansweredCount} câu trống
                </span>
              </div>

              <div className="mt-4 grid grid-cols-6 gap-2.5">
                {examQuestions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = (answers[q.id]?.length ?? 0) > 0;
                  const flagged = Boolean(progress.questions[q.id]?.flagged);

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition ${isAnswered
                          ? 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                          : flagged
                            ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                            : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E3EFE8]/60 dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#223029]'
                        } ${flagged && isAnswered ? 'border-[#6D28D9] dark:border-[#C084FC]' : ''} ${isCurrent ? 'z-10 ring-2 ring-[#2E6F4E] ring-offset-1 ring-offset-[#E8ECE4] dark:ring-[#52B788] dark:ring-offset-[#131A16]' : ''
                        }`}
                    >
                      {idx + 1}
                      {flagged && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#6D28D9] ring-2 ring-[#E8ECE4] dark:bg-[#D8B4FE] dark:ring-[#131A16]"
                          aria-label="Phân vân"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#D2DACB] pt-3.5 text-[11px] text-[#5C6E60] dark:border-[#222E27] dark:text-[#8B9E91]">
                <div className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-[#2E6F4E] ring-1 ring-[#2E6F4E] dark:border-[#52B788] dark:ring-[#52B788]" />
                  <span>Đang xem</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-[#9BC4AE] bg-[#E3EFE8] dark:border-[#52B788]/50 dark:bg-[#357A58]/20" />
                  <span>Đã chọn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative h-3.5 w-3.5 rounded border border-[#C9B3E6] bg-[#F3EDF9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15">
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#6D28D9] dark:bg-[#D8B4FE]" />
                  </span>
                  <span>Phân vân</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-[#D2DACB] bg-[#F7F8F5] dark:border-[#25332B] dark:bg-[#17201B]" />
                  <span>Chưa làm</span>
                </div>
              </div>
            </aside>

            {/* Question Card (Focal Point Elevation) */}
            <div className="w-full min-w-0 flex-1 rounded-2xl border border-[#BCC9B4] border-t-2 border-t-[#2E6F4E] bg-white p-4 shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] dark:border-[#31453A] dark:border-t-2 dark:border-t-[#52B788] dark:bg-[#1B2620] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] sm:p-7 lg:order-2 lg:max-w-[1040px] lg:p-9">
              {/* Header Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D2DACB] pb-3 dark:border-[#31453A] sm:pb-4">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="rounded-lg bg-[#2E6F4E] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] sm:py-1">
                    Câu {currentIndex + 1} / {examQuestions.length}
                  </span>
                  <span className="rounded-lg border border-[#9BC4AE] bg-[#E3EFE8] px-2.5 py-0.5 text-[11px] font-semibold text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] sm:py-1 sm:text-xs">
                    Chương {currentQuestion.chapter}
                    <span className="hidden sm:inline">: {currentQuestion.chapterTitle}</span>
                  </span>
                  {currentQuestion.isMultiSelect && (
                    <span className="rounded-lg border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7] sm:py-1 sm:text-xs">
                      Chọn nhiều đáp án
                    </span>
                  )}
                  {isFlagged && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#C9B3E6] bg-[#F3EDF9] px-2 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE] md:hidden">
                      <Flag className="h-3 w-3 fill-current" />
                      Phân vân
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleFlag(currentQuestion.id)}
                  className={`hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition md:inline-flex ${isFlagged
                      ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                      : 'border-[#C5D1BE] bg-[#F5F7F2] text-[#5C6E60] hover:border-[#C9B3E6] hover:bg-[#F3EDF9] hover:text-[#6D28D9] dark:border-[#384F42] dark:bg-[#223029] dark:text-[#8B9E91] dark:hover:border-[#C084FC]/50 dark:hover:bg-[#A855F7]/15 dark:hover:text-[#D8B4FE]'
                    }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      isFlagged
                        ? 'fill-[#6D28D9] text-[#6D28D9] dark:fill-[#D8B4FE] dark:text-[#D8B4FE]'
                        : ''
                    }`}
                  />
                  <span>Phân vân</span>
                  <kbd className="ml-0.5 hidden rounded border border-current/25 px-1 font-mono text-[10px] md:inline-block">
                    F
                  </kbd>
                </button>
              </div>

              {/* Question Prompt */}
              <h3 className="mt-3.5 text-[17px] font-semibold leading-[1.6] text-[#142018] dark:text-[#F3F6F4] sm:mt-5 sm:text-[19px] sm:leading-[1.65] lg:text-[20px]">
                {currentQuestion.question}
              </h3>

              {/* Options List */}
              <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3.5">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedKeys.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectOption(currentQuestion, opt.key)}
                      className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 px-3.5 text-left transition-all duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${isSelected
                          ? 'border-[#2E6F4E] bg-[#E3EFE8] text-[#142018] ring-1 ring-[#2E6F4E] dark:border-[#52B788] dark:bg-[#263B31] dark:text-[#F3F6F4] dark:ring-[#52B788]'
                          : 'border-[#C5D1BE] bg-[#F5F7F2] text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E6F0EA] md:hover:translate-x-1 dark:border-[#384F42] dark:bg-[#223029] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#2A3C33]'
                        }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition sm:h-7 sm:w-7 ${isSelected
                            ? 'border-[#2E6F4E] bg-[#2E6F4E] text-white dark:border-[#52B788] dark:bg-[#357A58]'
                            : 'border-[#B8C7B0] bg-white text-[#2E6F4E] group-hover:border-[#2E6F4E] group-hover:bg-[#2E6F4E] group-hover:text-white dark:border-[#384F42] dark:bg-[#151E19] dark:text-[#74C69D] dark:group-hover:border-[#52B788] dark:group-hover:bg-[#357A58] dark:group-hover:text-white'
                          }`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1 pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                        {opt.text}
                      </span>
                      <span className="mt-1 hidden font-mono text-[11px] text-[#5C6E60] dark:text-[#8B9E91] md:inline-block">
                        {optIdx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop Bottom Navigation */}
              <div className="mt-7 hidden w-full flex-wrap items-center justify-between gap-3 border-t border-[#D2DACB] pt-5 dark:border-[#31453A] md:flex">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#C5D1BE] bg-[#F5F7F2] px-4 py-2.5 text-sm font-medium text-[#243329] transition hover:border-[#2E6F4E] hover:bg-[#E6F0EA] hover:text-[#23583D] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#384F42] dark:bg-[#223029] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#2A3C33] dark:hover:text-[#74C69D]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Câu trước
                </button>

                <div className="flex items-center gap-3 text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                  <span>1–5 / A–E: Chọn</span>
                  <span>•</span>
                  <span>Space / Enter: Câu tiếp</span>
                  <span>•</span>
                  <span>F: Phân vân</span>
                </div>

                {currentIndex < examQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex(prev => Math.min(examQuestions.length - 1, prev + 1))
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#2E6F4E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
                  >
                    Câu tiếp
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={requestSubmit}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#1F8A65] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F5C41] dark:bg-[#38A179] dark:text-[#0D120F] dark:hover:bg-[#52B788]"
                  >
                    <Send className="h-4 w-4" />
                    Nộp bài ngay
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Bottom Navigation Bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D2DACB] bg-[#E8ECE4]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(20,32,24,0.08)] backdrop-blur dark:border-[#222E27] dark:bg-[#131A16]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.5)] md:hidden">
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-2.5 text-xs font-semibold text-[#243329] transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Trước</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFlag(currentQuestion.id)}
              aria-pressed={isFlagged}
              className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${isFlagged
                  ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                  : 'border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91]'
                }`}
            >
              <Flag className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
              <span>Phân vân</span>
            </button>

            {currentIndex < examQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex(prev => Math.min(examQuestions.length - 1, prev + 1))
                }
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2E6F4E] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
              >
                <span>Câu tiếp</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={requestSubmit}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1F8A65] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#0F5C41] dark:bg-[#38A179] dark:text-[#0D120F] dark:hover:bg-[#52B788]"
              >
                <Send className="h-4 w-4" />
                <span>Nộp bài ngay</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile / Tablet 60-Question Bottom Sheet */}
        <AnimatePresence>
          {isMobileSheetOpen && (
            <>
              <motion.div
                key="exam-sheet-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setIsMobileSheetOpen(false)}
                className="fixed inset-0 z-50 bg-[#142018]/50 backdrop-blur-[2px] dark:bg-[#090D0B]/75 lg:hidden"
              />
              <motion.div
                key="exam-sheet-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Bảng 60 câu hỏi thi thử"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 360 }}
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D2DACB] bg-[#E8ECE4] shadow-2xl dark:border-[#222E27] dark:bg-[#131A16] lg:hidden"
              >
                <div className="flex flex-col items-center border-b border-[#D2DACB] px-4 pb-3 pt-2.5 dark:border-[#222E27]">
                  <div className="mb-2.5 h-1 w-10 rounded-full bg-[#C5D1BE] dark:bg-[#31453A]" />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">
                        Bảng câu hỏi ({examQuestions.length} câu)
                      </h3>
                      <p className="text-xs text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                        Đã chọn {answeredCount} • Còn {unansweredCount} câu trống
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileSheetOpen(false)}
                      aria-label="Đóng ngăn kéo"
                      className="cursor-pointer rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-1.5 text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 overflow-y-auto px-4 pb-6 pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5C6E60] dark:text-[#8B9E91]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#9BC4AE] bg-[#E3EFE8] dark:border-[#52B788]/50 dark:bg-[#357A58]/20" />
                      Đã chọn
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#C9B3E6] bg-[#F3EDF9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15" />
                      Phân vân
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#D2DACB] bg-[#F7F8F5] dark:border-[#25332B] dark:bg-[#17201B]" />
                      Chưa làm
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                    {examQuestions.map((q, idx) => {
                      const isCurrent = idx === currentIndex;
                      const isAnswered = (answers[q.id]?.length ?? 0) > 0;
                      const flagged = Boolean(progress.questions[q.id]?.flagged);

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setIsMobileSheetOpen(false);
                          }}
                          className={`relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition ${isAnswered
                              ? 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                              : flagged
                                ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                                : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]'
                            } ${flagged && isAnswered ? 'border-[#6D28D9] dark:border-[#C084FC]' : ''} ${isCurrent ? 'z-10 ring-2 ring-[#2E6F4E] ring-offset-1 ring-offset-[#E8ECE4] dark:ring-[#52B788] dark:ring-offset-[#131A16]' : ''
                            }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span
                              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#6D28D9] ring-2 ring-[#E8ECE4] dark:bg-[#D8B4FE] dark:ring-[#131A16]"
                              aria-label="Phân vân"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Submit Confirmation Modal */}
        {confirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142018]/50 p-4 backdrop-blur-[2px] dark:bg-[#090D0B]/75">
            <div className="w-full max-w-md rounded-2xl border border-[#BCC9B4] bg-white p-5 shadow-xl dark:border-[#31453A] dark:bg-[#1B2620] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#142018] dark:text-[#F3F6F4]">
                    Xác nhận nộp bài?
                  </h3>
                  <p className="mt-1 text-sm text-[#5C6E60] dark:text-[#8B9E91]">
                    Bạn còn{' '}
                    <span className="font-semibold text-[#C2412D] tabular-nums dark:text-[#FCA5A5]">
                      {unansweredCount} câu
                    </span>{' '}
                    chưa chọn đáp án. Những câu bỏ trống sẽ được tính là chưa đúng khi chấm điểm.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmSubmitOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#C5D1BE] bg-[#F5F7F2] px-4 py-2 text-sm font-medium text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E6F0EA] dark:border-[#384F42] dark:bg-[#223029] dark:text-[#DDE5DF] dark:hover:border-[#52B788]"
                >
                  Tiếp tục làm bài
                </button>
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="cursor-pointer rounded-xl bg-[#2E6F4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
                >
                  Xác nhận nộp bài
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // =========================
  // PHASE 3: RESULTS & REVIEW
  // =========================
  const totalCount = lastResult?.totalQuestions ?? examQuestions.length;
  const correctTotal =
    lastResult?.correctCount ?? gradedItems.filter(item => item.isCorrect).length;
  const scoreOn10 =
    lastResult?.scoreOn10 ?? (totalCount > 0 ? Math.round((correctTotal / totalCount) * 100) / 10 : 0);
  const spentSeconds = lastResult?.durationSeconds ?? elapsedSeconds;
  const breakdown = lastResult?.chapterBreakdown ?? {};
  const resultExamType = lastResult?.examType ?? activeExamType;
  const isResultMasteredMode = resultExamType === 'mastered';

  return (
    <>
      <div className="w-full space-y-6 lg:space-y-8">
        {/* Top Score Summary & Actions */}
        <section className="rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-4 shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-7 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border sm:h-20 sm:w-20 ${
                  scoreOn10 >= 5
                    ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                    : 'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]'
                }`}
              >
                <span className="text-xl font-extrabold leading-none tabular-nums sm:text-2xl">
                  {scoreOn10.toFixed(1)}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80 sm:text-[11px]">
                  / 10 điểm
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9BC4AE] bg-[#E3EFE8] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                    <Award className="h-3.5 w-3.5 text-[#2E6F4E] dark:text-[#74C69D]" />
                    Kết quả thi thử {subjectMeta.code}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                      isResultMasteredMode
                        ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                        : 'border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                    }`}
                  >
                    {isResultMasteredMode ? 'Ôn đã thuộc' : 'Đề đề cương'}
                  </span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-[#142018] tabular-nums dark:text-[#F3F6F4] sm:text-xl">
                  Đúng {correctTotal}/{totalCount} câu (
                  {totalCount > 0 ? Math.round((correctTotal / totalCount) * 100) : 0}%)
                </h2>
                <p className="mt-0.5 text-xs text-[#5C6E60] tabular-nums dark:text-[#8B9E91] sm:text-sm">
                  Thời gian hoàn thành: {formatDurationVi(spentSeconds)} ({formatClock(spentSeconds)})
                </p>
              </div>
            </div>

            {/* Post-Submit Action Buttons (Mobile-First: flex-col sm:flex-row gap-3 w-full) */}
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
              {isResultMasteredMode && wrongCount > 0 && (
                <button
                  type="button"
                  disabled={bulkFlaggedConfirm !== null}
                  onClick={handleFlagWrongQuestions}
                  className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition sm:w-auto sm:text-sm ${
                    bulkFlaggedConfirm !== null
                      ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                      : 'border-[#6D28D9] bg-[#6D28D9] text-white shadow-xs hover:bg-[#5B21B6] dark:border-[#C084FC]/60 dark:bg-[#6D28D9] dark:hover:bg-[#5B21B6]'
                  }`}
                >
                  <Flag className="h-4 w-4 shrink-0 fill-current" />
                  <span>
                    {bulkFlaggedConfirm !== null
                      ? `Đã đưa ${bulkFlaggedConfirm} câu làm sai về diện Phân vân`
                      : `Đưa ${wrongCount} câu làm sai về diện Phân vân`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleScrollToReview}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-4 py-2.5 text-xs font-medium text-[#243329] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#223029] dark:hover:text-[#74C69D] sm:w-auto sm:text-sm"
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span>Xem lại bài làm</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('lobby')}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2E6F4E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649] sm:w-auto sm:text-sm"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>Thi đề khác</span>
              </button>
            </div>
          </div>

          {bulkFlaggedConfirm !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#C9B3E6] bg-[#F3EDF9] px-3.5 py-2.5 text-xs font-medium text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE] sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Đã cập nhật {bulkFlaggedConfirm} câu làm sai từ trạng thái{' '}
                <strong>Đã thuộc</strong> sang <strong>Phân vân</strong> để bạn ôn tập kỹ lại!
              </span>
            </div>
          )}

          {/* Chapter Breakdown Table + Desktop 60-cell Navigator */}
          <div className="mt-5 flex w-full flex-col justify-between gap-8 border-t border-[#D2DACB] pt-5 dark:border-[#222E27] sm:mt-7 sm:pt-7 lg:flex-row lg:gap-12">
            {/* Detailed Score Breakdown Table by Chapter */}
            <div className="min-w-0 flex-1">
              <h3 className="mb-3 text-sm font-bold text-[#142018] dark:text-[#F3F6F4] sm:mb-3.5">
                Chi tiết điểm theo từng chương
              </h3>
              <div className="overflow-hidden rounded-xl border border-[#D2DACB] dark:border-[#25332B]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F7F8F5] text-[11px] font-semibold uppercase text-[#5C6E60] dark:bg-[#1B2620] dark:text-[#8B9E91] sm:text-xs">
                    <tr>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3">Chương</th>
                      <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Đúng / Tổng</th>
                      <th className="w-28 px-3 py-2.5 sm:w-40 sm:px-4 sm:py-3">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D2DACB] bg-white dark:divide-[#222E27] dark:bg-[#17201B]">
                    {subjectMeta.chapters.map(ch => {
                      const stat = breakdown[ch.chapter] ?? { correct: 0, total: 0 };
                      const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                      const barColor =
                        pct >= 80
                          ? 'bg-[#1F8A65] dark:bg-[#38A179]'
                          : pct >= 50
                            ? 'bg-[#2E6F4E] dark:bg-[#52B788]'
                            : 'bg-[#C2412D] dark:bg-[#E05A47]';

                      return (
                        <tr key={ch.chapter}>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                            <div className="font-semibold text-[#142018] dark:text-[#F3F6F4]">
                              Chương {ch.chapter}
                            </div>
                            <div className="line-clamp-1 text-[11px] text-[#5C6E60] dark:text-[#8B9E91] sm:text-xs">
                              {ch.title}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-[#243329] tabular-nums dark:text-[#DDE5DF] sm:px-4 sm:py-3">
                            {stat.correct}/{stat.total}
                          </td>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#D2DACB] dark:bg-[#0D120F]">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-[11px] font-semibold text-[#5C6E60] tabular-nums dark:text-[#8B9E91] sm:w-9 sm:text-xs">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Desktop Results Navigator (hidden on Mobile/Tablet — moved to Bottom Sheet) */}
            <div className="hidden shrink-0 lg:block lg:w-[380px]">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#142018] tabular-nums dark:text-[#F3F6F4]">
                  Bản đồ kết quả {gradedItems.length} câu
                </h3>
                <span className="text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                  Nhấn vào ô để xem chi tiết
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2.5">
                {gradedItems.map(item => (
                  <button
                    key={item.question.id}
                    type="button"
                    onClick={() =>
                      handleJumpToReviewQuestion(item.question.id, item.isCorrect, item.isFlagged)
                    }
                    className={`relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-bold tabular-nums transition ${item.isCorrect
                        ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] hover:bg-[#D0ECDF] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7] dark:hover:bg-[#2E9E73]/30'
                        : 'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] hover:bg-[#FCE3DD] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5] dark:hover:bg-[#E05A47]/25'
                      } ${focusedReviewId === item.question.id ? 'ring-2 ring-[#2E6F4E] ring-offset-1 ring-offset-[#E8ECE4] dark:ring-[#52B788] dark:ring-offset-[#131A16]' : ''}`}
                  >
                    {item.index + 1}
                    {item.isFlagged && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#6D28D9] ring-2 ring-[#E8ECE4] dark:bg-[#D8B4FE] dark:ring-[#131A16]"
                        aria-label="Phân vân"
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#5C6E60] dark:text-[#8B9E91]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[#68B99A] bg-[#E1F3EC] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15" />
                  Đúng ({correctTotal})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[#F2B8AE] bg-[#FDF0ED] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15" />
                  Sai / Bỏ trống ({wrongCount})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6D28D9] dark:bg-[#D8B4FE]" />
                  Phân vân ({flaggedInExamCount})
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Review Filter Tabs & Detailed Question Cards */}
        <section ref={reviewSectionRef} className="space-y-4 lg:space-y-6">
          {/* Mobile/Tablet 1-Line Toolbar (< 1024px) opening Results Bottom Sheet */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileResultsSheetOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D2DACB] bg-[#E8ECE4] px-3.5 py-2.5 text-left text-xs font-semibold text-[#142018] shadow-xs transition active:scale-[0.99] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#F3F6F4]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#2E6F4E] dark:text-[#74C69D]" />
                <span className="truncate tabular-nums">
                  Bản đồ {gradedItems.length} câu &amp; Lọc (
                  {reviewFilter === 'wrong'
                    ? `Sai ${wrongCount}`
                    : reviewFilter === 'flagged'
                      ? `Phân vân ${flaggedInExamCount}`
                      : `Tất cả ${gradedItems.length}`}
                  )
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#5C6E60] dark:text-[#8B9E91]" />
            </button>
          </div>

          {/* Desktop Review Filter Tabs */}
          <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <div className="inline-flex rounded-xl border border-[#D2DACB] bg-[#E8ECE4] p-1 shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
              {(
                [
                  { id: 'wrong', label: 'Câu làm sai', count: wrongCount },
                  { id: 'all', label: 'Tất cả câu', count: gradedItems.length },
                  { id: 'flagged', label: 'Câu phân vân', count: flaggedInExamCount },
                ] as const
              ).map(tab => {
                const active = reviewFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReviewFilter(tab.id)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${active
                        ? 'bg-[#2E6F4E] text-white shadow-xs hover:bg-[#23583D] dark:bg-[#357A58] dark:hover:bg-[#2B6649]'
                        : 'text-[#243329] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:text-[#DDE5DF] dark:hover:bg-[#223029] dark:hover:text-[#74C69D]'
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active
                          ? 'bg-white/20 text-white'
                          : 'border border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91]'
                        }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredReviewItems.length === 0 ? (
            <div className="rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-8 text-center shadow-[0_8px_24px_-4px_rgba(20,32,24,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-10">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#1F8A65] dark:text-[#6EE7B7]" />
              <p className="mt-3 text-base font-semibold text-[#142018] dark:text-[#F3F6F4]">
                {reviewFilter === 'wrong'
                  ? 'Tuyệt vời! Bạn không làm sai câu nào trong đề thi này.'
                  : 'Không có câu hỏi nào đang được đánh dấu phân vân.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {filteredReviewItems.map(({ question: q, index, selected, isCorrect, isFlagged }) => {
                const isHighlighted = focusedReviewId === q.id;
                const isSkipped = selected.length === 0;

                return (
                  <article
                    key={q.id}
                    id={`exam-review-q-${q.id}`}
                    className={`rounded-2xl border border-[#BCC9B4] border-t-2 border-t-[#2E6F4E] bg-white p-4 shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] transition dark:border-[#31453A] dark:border-t-2 dark:border-t-[#52B788] dark:bg-[#1B2620] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] sm:p-7 lg:p-8 ${
                      isHighlighted ? 'ring-2 ring-[#2E6F4E]/40 dark:ring-[#52B788]/40' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D2DACB] pb-3 dark:border-[#31453A] sm:pb-4">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-lg bg-[#2E6F4E] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] sm:py-1">
                          Câu {index + 1}
                        </span>
                        <span className="rounded-lg border border-[#9BC4AE] bg-[#E3EFE8] px-2.5 py-0.5 text-[11px] font-semibold text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] sm:py-1 sm:text-xs">
                          Chương {q.chapter}
                          <span className="hidden sm:inline">: {q.chapterTitle}</span>
                        </span>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7] sm:py-1 sm:text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#1F8A65] dark:text-[#6EE7B7]" />
                            Đúng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#F2B8AE] bg-[#FDF0ED] px-2.5 py-0.5 text-[11px] font-semibold text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5] sm:py-1 sm:text-xs">
                            <XCircle className="h-3.5 w-3.5 text-[#C2412D] dark:text-[#FCA5A5]" />
                            {isSkipped ? 'Bỏ trống' : 'Sai'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleFlag(q.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition sm:px-3 ${isFlagged
                            ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                            : 'border-[#C5D1BE] bg-[#F5F7F2] text-[#5C6E60] hover:border-[#C9B3E6] hover:bg-[#F3EDF9] hover:text-[#6D28D9] dark:border-[#384F42] dark:bg-[#223029] dark:text-[#8B9E91] dark:hover:border-[#C084FC]/50 dark:hover:bg-[#A855F7]/15 dark:hover:text-[#D8B4FE]'
                          }`}
                      >
                        <Flag
                          className={`h-3.5 w-3.5 ${
                            isFlagged
                              ? 'fill-[#6D28D9] text-[#6D28D9] dark:fill-[#D8B4FE] dark:text-[#D8B4FE]'
                              : ''
                          }`}
                        />
                        <span>Phân vân</span>
                      </button>
                    </div>

                    <h4 className="mt-3.5 text-[17px] font-semibold leading-[1.6] text-[#142018] dark:text-[#F3F6F4] sm:mt-5 sm:text-[19px] sm:leading-[1.65]">
                      {q.question}
                    </h4>

                    <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                      {q.options.map(opt => {
                        const isCorrectOpt = q.correctAnswers
                          .map(c => c.toUpperCase())
                          .includes(opt.key.toUpperCase());
                        const isUserSelected = selected
                          .map(s => s.toUpperCase())
                          .includes(opt.key.toUpperCase());

                        let rowStyle =
                          'border-[#C5D1BE] bg-[#F5F7F2] text-[#243329] dark:border-[#384F42] dark:bg-[#223029] dark:text-[#DDE5DF]';
                        let badgeStyle =
                          'border-[#B8C7B0] bg-white text-[#243329] dark:border-[#384F42] dark:bg-[#151E19] dark:text-[#DDE5DF]';

                        if (isCorrectOpt) {
                          rowStyle =
                            'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]';
                          badgeStyle =
                            'border-[#1F8A65] bg-[#1F8A65] text-white dark:border-[#38A179] dark:bg-[#38A179] dark:text-[#0D120F]';
                        } else if (isUserSelected) {
                          rowStyle =
                            'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]';
                          badgeStyle =
                            'border-[#C2412D] bg-[#C2412D] text-white dark:border-[#F28472] dark:bg-[#E05A47] dark:text-white';
                        }

                        return (
                          <div
                            key={opt.key}
                            className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3 px-3.5 sm:flex-nowrap sm:gap-3 sm:p-4 sm:px-5 ${rowStyle}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold sm:h-7 sm:w-7 ${badgeStyle}`}
                              >
                                {opt.key}
                              </span>
                              <span className="pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                                {opt.text}
                              </span>
                            </div>

                            {(isUserSelected || isCorrectOpt) && (
                              <div className="ml-9 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold sm:ml-0">
                                {isUserSelected && (
                                  <span
                                    className={`rounded-md border px-2 py-0.5 ${isCorrectOpt
                                        ? 'border-[#68B99A] bg-white text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/20 dark:text-[#6EE7B7]'
                                        : 'border-[#F2B8AE] bg-white text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/20 dark:text-[#FCA5A5]'
                                      }`}
                                  >
                                    Bạn chọn
                                  </span>
                                )}
                                {isCorrectOpt && (
                                  <span className="rounded-md border border-[#68B99A] bg-white px-2 py-0.5 text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/20 dark:text-[#6EE7B7]">
                                    Đáp án đúng
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 sm:mt-5">
                      <RichExplanation question={q} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Mobile/Tablet Results Navigator & Filter Bottom Sheet */}
      <AnimatePresence>
        {isMobileResultsSheetOpen && (
          <>
            <motion.div
              key="results-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setIsMobileResultsSheetOpen(false)}
              className="fixed inset-0 z-50 bg-[#142018]/50 backdrop-blur-[2px] dark:bg-[#090D0B]/75 lg:hidden"
            />
            <motion.div
              key="results-sheet-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Bản đồ kết quả và bộ lọc"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D2DACB] bg-[#E8ECE4] shadow-2xl dark:border-[#222E27] dark:bg-[#131A16] lg:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D2DACB] px-4 pb-3 pt-2.5 dark:border-[#222E27]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#C5D1BE] dark:bg-[#31453A]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#142018] tabular-nums dark:text-[#F3F6F4]">
                      Bản đồ kết quả {gradedItems.length} câu
                    </h3>
                    <p className="text-xs text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                      Đúng {correctTotal} • Sai {wrongCount} • Phân vân {flaggedInExamCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileResultsSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-1.5 text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-4">
                {/* 3 Filter Tabs */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5C6E60] dark:text-[#8B9E91]">
                    Bộ lọc xem lại
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'wrong', label: 'Làm sai', count: wrongCount },
                        { id: 'all', label: 'Tất cả', count: gradedItems.length },
                        { id: 'flagged', label: 'Phân vân', count: flaggedInExamCount },
                      ] as const
                    ).map(tab => {
                      const active = reviewFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setReviewFilter(tab.id);
                            setIsMobileResultsSheetOpen(false);
                          }}
                          className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${active
                              ? 'border-[#2E6F4E] bg-[#2E6F4E] text-white dark:border-[#52B788]/50 dark:bg-[#357A58]'
                              : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]'
                            }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 60-cell Grid */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5C6E60] dark:text-[#8B9E91]">
                    Nhấn số câu để cuộn tới câu đó
                  </div>
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                    {gradedItems.map(item => (
                      <button
                        key={item.question.id}
                        type="button"
                        onClick={() => {
                          setIsMobileResultsSheetOpen(false);
                          handleJumpToReviewQuestion(item.question.id, item.isCorrect, item.isFlagged);
                        }}
                        className={`relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-bold tabular-nums transition ${item.isCorrect
                            ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                            : 'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]'
                          } ${focusedReviewId === item.question.id ? 'ring-2 ring-[#2E6F4E] ring-offset-1 ring-offset-[#E8ECE4] dark:ring-[#52B788] dark:ring-offset-[#131A16]' : ''}`}
                      >
                        {item.index + 1}
                        {item.isFlagged && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#6D28D9] ring-2 ring-[#E8ECE4] dark:bg-[#D8B4FE] dark:ring-[#131A16]"
                            aria-label="Phân vân"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
