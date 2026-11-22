import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChapterMeta, getQuestionsForExamPaper, isAnswerCorrect, SUBJECTS } from '../data';
import {
  ExamHistoryItem,
  ExamType,
  QuestionItem,
  SubjectId,
  UserProgressStore,
} from '../types/quiz';
import { isMastered } from '../utils/storage';
import { useIsDesktopLg } from '../utils/useIsDesktopLg';
import { RichExplanation } from './RichExplanation';
import { SakugaMangaTag, SakugaProgressBar } from './SakugaVfx';

interface MockExamViewProps {
  subject: SubjectId;
  questions: QuestionItem[];
  chapters: ChapterMeta[];
  progress: UserProgressStore;
  onSaveExamResult: (result: ExamHistoryItem) => void;
  onRecordAttempt: (qId: string, isCorrect: boolean) => void;
  onRecordAttemptsBatch?: (attempts: readonly { questionId: string; isCorrect: boolean }[]) => void;
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

  function generateMockExam(allQuestions: QuestionItem[], subject: SubjectId): QuestionItem[] {
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

  interface ExamTimerPillProps {
    timerEnabled: boolean;
    initialDurationSec: number;
    sessionSeq: number;
    elapsedSecondsRef: React.MutableRefObject<number>;
    onTimeUp: () => void;
    onToggleTimer?: () => void;
    compact?: boolean;
  }

  /**
   * Isolated 1-second timer pill so 60-minute countdown ticks never re-render
   * the surrounding 60-question MockExamView tree.
   */
  const ExamTimerPill: React.FC<ExamTimerPillProps> = memo(
    ({
      timerEnabled,
      initialDurationSec,
      sessionSeq,
      elapsedSecondsRef,
      onTimeUp,
      onToggleTimer,
      compact = false,
    }) => {
      const [elapsed, setElapsed] = useState<number>(() => elapsedSecondsRef.current);
      const onTimeUpRef = useRef(onTimeUp);
      onTimeUpRef.current = onTimeUp;

      useEffect(() => {
        setElapsed(elapsedSecondsRef.current);
      }, [sessionSeq, elapsedSecondsRef]);

      useEffect(() => {
        const timerId = window.setInterval(() => {
          const next = elapsedSecondsRef.current + 1;
          elapsedSecondsRef.current = next;
          setElapsed(next);
          if (timerEnabled && initialDurationSec - next <= 0) {
            onTimeUpRef.current();
          }
        }, 1000);
        return () => window.clearInterval(timerId);
      }, [elapsedSecondsRef, initialDurationSec, timerEnabled]);

      useEffect(() => {
        if (timerEnabled && initialDurationSec - elapsedSecondsRef.current <= 0) {
          onTimeUpRef.current();
        }
      }, [elapsedSecondsRef, initialDurationSec, timerEnabled]);

      const remaining = Math.max(0, initialDurationSec - elapsed);
      const isLowTime = timerEnabled && remaining < WARNING_THRESHOLD_SECONDS;
      const clockText = timerEnabled ? formatClock(remaining) : formatClock(elapsed);

      if (compact) {
        return (
          <button
            type="button"
            onClick={onToggleTimer}
            title={
              timerEnabled
                ? 'Đang bật đếm ngược (chạm để tắt)'
                : 'Đang tắt đếm ngược (chạm để bật)'
            }
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold tabular-nums transition ${
              !timerEnabled
                ? 'border-[#D5CFC2] bg-[#EAE6DD] text-[#656058] dark:border-[#262925] dark:bg-[#161816] dark:text-[#9CA39B]'
                : isLowTime
                  ? 'animate-pulse border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                  : 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
            }`}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{clockText}</span>
          </button>
        );
      }

      return (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold tabular-nums transition-colors ${
            !timerEnabled
              ? 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]'
              : isLowTime
                ? 'animate-pulse border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                : 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
          }`}
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span>{clockText}</span>
        </div>
      );
    }
  );
  ExamTimerPill.displayName = 'ExamTimerPill';

  export const MockExamView: React.FC<MockExamViewProps> = ({
    subject,
    questions: allSubjectQuestions,
    chapters: subjectChapters,
    progress,
    onSaveExamResult,
    onRecordAttempt,
    onRecordAttemptsBatch,
    onToggleFlag,
    onFlagQuestions,
  }) => {
    const isDesktopLg = useIsDesktopLg();
    const subjectMeta = SUBJECTS[subject];

    const [phase, setPhase] = useState<ExamPhase>('lobby');
    const [examType, setExamType] = useState<ExamType>(() =>
      SUBJECTS[subject].examPapers?.length ? 'past_exam' : 'standard'
    );
    const [activeExamType, setActiveExamType] = useState<ExamType>('standard');
    const [selectedExamCode, setSelectedExamCode] = useState<string>(
      () => SUBJECTS[subject].examPapers?.[0]?.code ?? ''
    );
    const [activeExamCode, setActiveExamCode] = useState<string>('');
    const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
    const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [initialDurationSec, setInitialDurationSec] = useState<number>(EXAM_DURATION_SECONDS);
    const [sessionSeq, setSessionSeq] = useState<number>(0);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
    const [lastResult, setLastResult] = useState<ExamHistoryItem | null>(null);
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('wrong');
    const [focusedReviewId, setFocusedReviewId] = useState<string | null>(null);
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
    const [isMobileResultsSheetOpen, setIsMobileResultsSheetOpen] = useState<boolean>(false);
    const [bulkFlaggedConfirm, setBulkFlaggedConfirm] = useState<number | null>(null);

    const submittedRef = useRef<boolean>(false);
    const elapsedSecondsRef = useRef<number>(0);
    const reviewSectionRef = useRef<HTMLElement | null>(null);

    // Mastered question pool for the selected subject (always full Hardcore set)
    const masteredPool = useMemo(
      () => allSubjectQuestions.filter(q => isMastered(progress.questions[q.id])),
      [allSubjectQuestions, progress.questions]
    );
    const masteredCount = masteredPool.length;

    const masteredCountByChapter = useMemo(() => {
      const map = new Map<number, number>();
      for (const q of masteredPool) {
        map.set(q.chapter, (map.get(q.chapter) ?? 0) + 1);
      }
      return map;
    }, [masteredPool]);

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
      elapsedSecondsRef.current = 0;
      setPhase('lobby');
      setExamType(SUBJECTS[subject].examPapers?.length ? 'past_exam' : 'standard');
      setSelectedExamCode(SUBJECTS[subject].examPapers?.[0]?.code ?? '');
      setActiveExamCode('');
      setExamQuestions([]);
      setAnswers({});
      setCurrentIndex(0);
      setInitialDurationSec(EXAM_DURATION_SECONDS);
      setSessionSeq(s => s + 1);
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
      let chosenCode = '';

      if (examType === 'mastered') {
        const currentMastered = allSubjectQuestions.filter(q =>
          isMastered(progress.questions[q.id])
        );
        if (currentMastered.length === 0) return;
        generated = fisherYatesShuffle(currentMastered).slice(0, subjectMeta.examTotal);
        const mins =
          currentMastered.length >= subjectMeta.examTotal
            ? 45
            : Math.max(5, Math.round(currentMastered.length * 0.75));
        durationSec = mins * 60;
      } else if (examType === 'past_exam' && selectedExamCode) {
        generated = getQuestionsForExamPaper(allSubjectQuestions, selectedExamCode);
        if (generated.length === 0) {
          generated = generateMockExam(allSubjectQuestions, subject);
        }
        chosenCode = selectedExamCode;
        durationSec = EXAM_DURATION_SECONDS;
      } else {
        generated = generateMockExam(allSubjectQuestions, subject);
        durationSec = EXAM_DURATION_SECONDS;
      }

      submittedRef.current = false;
      elapsedSecondsRef.current = 0;
      setActiveExamType(examType);
      setActiveExamCode(chosenCode);
      setExamQuestions(generated);
      setAnswers({});
      setCurrentIndex(0);
      setInitialDurationSec(durationSec);
      setSessionSeq(s => s + 1);
      setConfirmSubmitOpen(false);
      setLastResult(null);
      setFocusedReviewId(null);
      setIsMobileSheetOpen(false);
      setIsMobileResultsSheetOpen(false);
      setBulkFlaggedConfirm(null);
      setPhase('active');
  }, [allSubjectQuestions, examType, progress.questions, selectedExamCode, subject, subjectMeta.examTotal]);

  const handleSubmitExam = useCallback(() => {
    if (submittedRef.current || examQuestions.length === 0) return;
    submittedRef.current = true;
    setConfirmSubmitOpen(false);

    const chapterBreakdown: Record<number, { correct: number; total: number }> = {};
    for (const chKey of Object.keys(subjectMeta.examQuotas)) {
      chapterBreakdown[Number(chKey)] = { correct: 0, total: 0 };
    }

    let correctCount = 0;
    const batchAttempts: { questionId: string; isCorrect: boolean }[] = [];

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

      if ((activeExamType === 'standard' || activeExamType === 'past_exam') && selected.length > 0) {
        batchAttempts.push({ questionId: q.id, isCorrect: correct });
      } else if (activeExamType === 'mastered' && correct && selected.length > 0) {
        batchAttempts.push({ questionId: q.id, isCorrect: true });
      }
    }

    if (batchAttempts.length > 0) {
      if (onRecordAttemptsBatch) {
        onRecordAttemptsBatch(batchAttempts);
      } else {
        for (const item of batchAttempts) {
          onRecordAttempt(item.questionId, item.isCorrect);
        }
      }
    }

    const totalQuestions = examQuestions.length;
    const scoreOn10 = Math.round((correctCount / totalQuestions) * 100) / 10;

    const result: ExamHistoryItem = {
      id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subject,
      examType: activeExamType,
      ...(activeExamCode ? { examCode: activeExamCode } : {}),
      timestamp: Date.now(),
      totalQuestions,
      correctCount,
      scoreOn10,
      durationSeconds: elapsedSecondsRef.current,
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
    examQuestions,
    onRecordAttempt,
    onRecordAttemptsBatch,
    onSaveExamResult,
    subject,
    subjectMeta.examQuotas,
  ]);

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

      if (['1', '2', '3', '4', '5', '6'].includes(key)) {
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

  // Graded details for results view only (0 work while taking exam or on lobby)
  const gradedItems = useMemo(() => {
    if (phase !== 'results') return [];
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
  }, [answers, examQuestions, phase, progress.questions]);

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
    const isPastExamMode = examType === 'past_exam';
    const hasPastExams = Boolean(subjectMeta.examPapers && subjectMeta.examPapers.length > 0);
    const unitLabel = subjectMeta.chapterUnitLabel ?? 'Chương';
    const selectedPaperMeta = subjectMeta.examPapers?.find(p => p.code === selectedExamCode);
    const currentPlannedQuestions = isMasteredMode
      ? masteredExamMeta.questionCount
      : isPastExamMode && selectedPaperMeta
        ? selectedPaperMeta.questionCount
        : subjectMeta.examTotal;
    const currentPlannedMinutes = isMasteredMode ? masteredExamMeta.durationMinutes : 60;
    const isStartDisabled = isMasteredMode && masteredCount === 0;

    return (
      <div className="w-full">
        <div className="flex w-full flex-col items-start gap-6 lg:flex-row lg:gap-8 xl:gap-10">
          {/* Main Exam Setup Card */}
          <section className="w-full min-w-0 flex-1 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5CFC2] pb-4 dark:border-[#262925] sm:pb-5">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${isMasteredMode
                    ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]'
                    : 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                    }`}
                >
                  {isMasteredMode ? (
                    <Sparkles className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                  ) : (
                    <ListChecks className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#A5B4FC]" />
                  )}
                  {isMasteredMode
                    ? currentPlannedQuestions > 0
                      ? `Đề thi thử ${currentPlannedQuestions} câu`
                      : 'Ôn các câu đã học'
                    : isPastExamMode && selectedPaperMeta
                      ? `Đề gốc ${selectedPaperMeta.code} • ${selectedPaperMeta.questionCount} câu`
                      : `Đề thi thử ${subjectMeta.examTotal} câu`}
                </span>
                <h2 className="mt-2.5 text-lg font-bold text-[#18181B] dark:text-[#F5F5F4] sm:text-xl">
                  Thi thử trộn đề — {subjectMeta.code}
                </h2>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-1.5 text-xs font-medium text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] sm:px-3.5 sm:py-2">
                <Clock className="h-4 w-4 text-[#4338CA] dark:text-[#818CF8]" />
                <span className="tabular-nums">
                  {currentPlannedMinutes > 0
                    ? `Thời lượng chuẩn: ${currentPlannedMinutes} phút`
                    : 'Chưa có câu đã thuộc'}
                </span>
              </div>
            </div>

            {/* Exam Mode Selector Cards */}
            <div className="mt-4 sm:mt-5">
              <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                Chọn chế độ đề thi
              </div>

              <div className={`grid grid-cols-1 gap-3 ${hasPastExams ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {/* Mode 1 (Default when hasPastExams): Official Past Exam Paper */}
                {hasPastExams && (
                  <button
                    type="button"
                    onClick={() => setExamType('past_exam')}
                    className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${examType === 'past_exam'
                      ? 'border-[#4338CA] bg-[#EEF2FF] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:bg-[#312E81]/35 dark:ring-[#818CF8]'
                      : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold ${examType === 'past_exam'
                          ? 'text-[#3730A3] dark:text-[#A5B4FC]'
                          : 'text-[#18181B] dark:text-[#F5F5F4]'
                          }`}
                      >
                        Thi theo mã đề cũ
                      </span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${examType === 'past_exam'
                          ? 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8] dark:bg-[#4338CA] dark:text-white'
                          : 'border-[#C6BEB0] dark:border-[#323833]'
                          }`}
                      >
                        {examType === 'past_exam' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[#A5B4FC] bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#3730A3] tabular-nums dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                        {subjectMeta.examPapers!.length} đề gốc • {subjectMeta.examTotal} câu
                      </span>
                    </div>
                  </button>
                )}

                {/* Mode 2: Standard Curriculum Exam */}
                <button
                  type="button"
                  onClick={() => setExamType('standard')}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${examType === 'standard'
                    ? 'border-[#4338CA] bg-[#EEF2FF] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:bg-[#312E81]/35 dark:ring-[#818CF8]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold ${examType === 'standard'
                        ? 'text-[#3730A3] dark:text-[#A5B4FC]'
                        : 'text-[#18181B] dark:text-[#F5F5F4]'
                        }`}
                    >
                      Đề chuẩn đề cương (random)
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${examType === 'standard'
                        ? 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8] dark:bg-[#4338CA] dark:text-white'
                        : 'border-[#C6BEB0] dark:border-[#323833]'
                        }`}
                    >
                      {examType === 'standard' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-md border border-[#A5B4FC] bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#3730A3] tabular-nums dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                      {subjectMeta.examTotal} câu • 60 phút
                    </span>
                  </div>
                </button>

                {/* Mode 3: Mastered Pool Review Exam */}
                <button
                  type="button"
                  onClick={() => setExamType('mastered')}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${examType === 'mastered'
                    ? 'border-[#10B981] bg-[#D1FAE5] ring-1 ring-[#10B981] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:ring-[#10B981]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#10B981] hover:bg-[#D1FAE5]/60 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#10B981] dark:hover:bg-[#064E3B]/30'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold ${examType === 'mastered'
                        ? 'text-[#064E3B] dark:text-[#34D399]'
                        : 'text-[#18181B] dark:text-[#F5F5F4]'
                        }`}
                    >
                      Ôn các câu đã học
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${examType === 'mastered'
                        ? 'border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]'
                        : 'border-[#C6BEB0] dark:border-[#323833]'
                        }`}
                    >
                      {examType === 'mastered' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#064E3B] tabular-nums dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]">
                      Kho đã thuộc: {masteredCount} câu
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mode Details: Standard Chapter Quota Matrix vs Past Exam Picker vs Mastered Pool Summary */}
            {examType === 'standard' ? (
              <div className="mt-5 sm:mt-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  <span>
                    Cấu trúc phân bổ câu hỏi
                    {subjectMeta.hasUnspecifiedChapterQuotas
                      ? ` (Phủ đều cả ${subjectMeta.chapters.length} ${unitLabel}s)`
                      : ''}
                  </span>
                  <span className="tabular-nums text-[#4338CA] dark:text-[#A5B4FC]">
                    Tổng {subjectMeta.examTotal} câu
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {subjectMeta.chapters.map(ch => {
                    const quota = subjectMeta.examQuotas[ch.chapter] ?? 0;
                    return (
                      <div
                        key={ch.chapter}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2.5 dark:border-[#2C302B] dark:bg-[#1C1F1C] sm:px-4 sm:py-3"
                      >
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-[#44403C] dark:text-[#D4D4D8]">
                            {unitLabel} {ch.chapter}
                          </span>
                          <span className="block truncate text-[11px] text-[#656058] dark:text-[#9CA39B]">
                            {ch.title}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-lg border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-bold text-[#3730A3] tabular-nums dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                          {subjectMeta.hasUnspecifiedChapterQuotas ? 'Có trong đề' : `${quota} câu`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : isPastExamMode && hasPastExams ? (
              <div className="mt-5 sm:mt-6">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  <span>Chọn mã đề thi gốc muốn làm</span>
                  <span className="tabular-nums text-[#92400E] dark:text-[#FDE68A]">
                    {subjectMeta.examPapers!.length} đề chính thức
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {subjectMeta.examPapers!.map(paper => {
                    const isSelected = paper.code === selectedExamCode;
                    const paperQuestions = getQuestionsForExamPaper(allSubjectQuestions, paper.code);
                    const paperMastered = paperQuestions.filter(q =>
                      isMastered(progress.questions[q.id])
                    ).length;

                    return (
                      <button
                        key={paper.code}
                        type="button"
                        onClick={() => setSelectedExamCode(paper.code)}
                        className={`flex cursor-pointer flex-col justify-between gap-2 rounded-xl border p-3 text-left transition ${isSelected
                          ? 'border-[#D97706] bg-[#FEF3C7] ring-1 ring-[#D97706] dark:border-[#FBBF24] dark:bg-[#78350F]/45 dark:ring-[#FBBF24]'
                          : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#D97706] hover:bg-[#FEF3C7]/60 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#FBBF24] dark:hover:bg-[#78350F]/25'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black tracking-wide text-[#18181B] dark:text-[#F5F5F4]">
                            {paper.code}
                          </span>
                          <span className="rounded-md border border-[#F59E0B] bg-white px-2 py-0.5 text-[10.5px] font-bold text-[#92400E] tabular-nums dark:border-[#FBBF24]/50 dark:bg-[#161816] dark:text-[#FDE68A]">
                            {paper.questionCount} câu
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#656058] dark:text-[#9CA39B]">
                          <span className="truncate">{paper.label}</span>
                          <span className="shrink-0 font-semibold text-[#047857] tabular-nums dark:text-[#34D399]">
                            Thuộc {paperMastered}/{paperQuestions.length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3.5 sm:mt-6">
                <div className="rounded-xl border border-[#10B981] bg-[#D1FAE5]/70 p-4 dark:border-[#10B981] dark:bg-[#064E3B]/45 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669] dark:text-[#34D399]" />
                      <span className="text-sm font-bold text-[#064E3B] tabular-nums dark:text-[#34D399]">
                        Kho đã thuộc: {masteredCount} câu
                      </span>
                    </div>
                    {masteredCount > 0 && (
                      <span className="rounded-full border border-[#10B981] bg-white px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#064E3B] tabular-nums dark:border-[#10B981]/60 dark:bg-[#1C1F1C] dark:text-[#34D399]">
                        Đề thi thử {currentPlannedQuestions} câu • {currentPlannedMinutes} phút
                      </span>
                    )}
                  </div>

                  {masteredCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#10B981]/40 pt-3 dark:border-[#10B981]/30">
                      {subjectMeta.chapters.map(ch => {
                        const chMastered = masteredCountByChapter.get(ch.chapter) ?? 0;
                        return (
                          <span
                            key={ch.chapter}
                            className="rounded-md border border-[#10B981] bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#064E3B] tabular-nums dark:border-[#10B981]/60 dark:bg-[#1C1F1C] dark:text-[#34D399]"
                          >
                            {unitLabel} {ch.chapter}: {chMastered} câu
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {masteredCount === 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] p-4 text-xs leading-relaxed text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] sm:text-sm">
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
            <div className="mt-5 flex flex-col gap-3.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-4 dark:border-[#2C302B] dark:bg-[#1C1F1C] sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
              <button
                type="button"
                onClick={() => setTimerEnabled(prev => !prev)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg text-left transition-colors"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${timerEnabled
                    ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                    : 'border-[#D5CFC2] bg-[#EAE6DD] text-[#656058] dark:border-[#262925] dark:bg-[#161816] dark:text-[#9CA39B]'
                    }`}
                >
                  {timerEnabled ? <Timer className="h-5 w-5" /> : <TimerOff className="h-5 w-5" />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#18181B] dark:text-[#F5F5F4]">
                  <span>
                    Đếm ngược {currentPlannedMinutes > 0 ? currentPlannedMinutes : 45} phút
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${timerEnabled
                      ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                      : 'border-[#D5CFC2] bg-[#EAE6DD] text-[#656058] dark:border-[#262925] dark:bg-[#161816] dark:text-[#9CA39B]'
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
                className="sakuga-btn inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-6 py-3.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3] sm:w-auto sm:py-3"
              >
                <Play className="h-4 w-4 fill-current" />
                Bắt đầu làm bài
              </button>
            </div>
          </section>

          {/* Recent Exam History Card */}
          <section className="flex w-full shrink-0 flex-col rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8 lg:w-[400px] xl:w-[440px]">
            <div className="flex items-center justify-between border-b border-[#D5CFC2] pb-4 dark:border-[#262925] sm:pb-5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#4338CA] dark:text-[#818CF8]" />
                <h3 className="text-base font-bold text-[#18181B] dark:text-[#F5F5F4]">
                  Lịch sử thi gần đây
                </h3>
              </div>
              <span className="rounded-full border border-[#D5CFC2] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#44403C] tabular-nums dark:border-[#3F3F46] dark:bg-[#27272A] dark:text-[#D4D4D8]">
                {subjectHistory.length} lượt
              </span>
            </div>

            {subjectHistory.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                  <Award className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#18181B] dark:text-[#F5F5F4]">
                  Chưa có bài thi thử {subjectMeta.code} nào
                </p>
                <p className="mt-1 max-w-xs text-xs text-[#656058] dark:text-[#9CA39B]">
                  Hoàn thành một đề thi để xem điểm số và phân tích từng chương tại đây.
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 sm:mt-5">
                {subjectHistory.map(item => {
                  const passed = item.scoreOn10 >= 5;
                  const isItemMasteredMode = item.examType === 'mastered';
                  const isItemPastExamMode = item.examType === 'past_exam';
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#C6BEB0] bg-white p-3.5 transition hover:border-[#4338CA] dark:border-[#323833] dark:bg-[#1E221F] dark:hover:border-[#818CF8] sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums ${passed
                              ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]'
                              : 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                              }`}
                          >
                            {item.scoreOn10.toFixed(1)}đ
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-[#18181B] tabular-nums dark:text-[#F5F5F4]">
                                {item.correctCount}/{item.totalQuestions} câu đúng
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${isItemMasteredMode
                                  ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]'
                                  : isItemPastExamMode
                                    ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#92400E] dark:border-[#FBBF24]/60 dark:bg-[#78350F]/55 dark:text-[#FDE68A]'
                                    : 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                                  }`}
                              >
                                {isItemMasteredMode
                                  ? 'Ôn đã thuộc'
                                  : isItemPastExamMode && item.examCode
                                    ? `Đề ${item.examCode}`
                                    : 'Đề đề cương'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-[#656058] dark:text-[#9CA39B]">
                              {formatDateTimeVi(item.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-[#656058] tabular-nums dark:text-[#9CA39B]">
                          <div className="font-medium text-[#292524] dark:text-[#E7E5E4]">
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
                              className="rounded-md border border-[#D5CFC2] bg-[#FAF9F5] px-2 py-0.5 text-[11px] font-medium text-[#656058] tabular-nums dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#9CA39B]"
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

    return (
      <>
        <div className="flex w-full flex-col items-start gap-6 lg:flex-row lg:gap-8 xl:gap-10">
          {/* Desktop Navigator Sidebar */}
          {isDesktopLg && (
          <aside className="w-full shrink-0 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-6 shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] lg:sticky lg:top-20 lg:order-1 lg:w-[360px] xl:w-[380px]">
            <div className="flex items-center justify-between border-b border-[#D5CFC2] pb-3.5 dark:border-[#262925]">
              <h4 className="text-sm font-bold text-[#18181B] tabular-nums dark:text-[#F5F5F4]">
                Bảng câu hỏi ({examQuestions.length} câu)
              </h4>
              <span className="text-xs font-medium text-[#656058] tabular-nums dark:text-[#9CA39B]">
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
                      ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                      : flagged
                        ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]'
                        : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                      } ${flagged && isAnswered ? 'border-[#A21CAF] dark:border-[#D946EF]' : ''} ${isCurrent
                        ? 'z-10 ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                        : ''
                      }`}
                  >
                    {idx + 1}
                    {flagged && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#A21CAF] ring-2 ring-[#EAE6DD] dark:bg-[#F5D0FE] dark:ring-[#161816]"
                        aria-label="Phân vân"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#D5CFC2] pt-3.5 text-[11px] text-[#656058] dark:border-[#262925] dark:text-[#9CA39B]">
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded border border-[#4338CA] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:ring-[#818CF8]" />
                <span>Đang xem</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded border border-[#A5B4FC] bg-[#EEF2FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30" />
                <span>Đã chọn</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative h-3.5 w-3.5 rounded border border-[#F0ABFC] bg-[#FAE8FF] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20">
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#A21CAF] dark:bg-[#F5D0FE]" />
                </span>
                <span>Phân vân</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded border border-[#D5CFC2] bg-[#FAF9F5] dark:border-[#2C302B] dark:bg-[#1C1F1C]" />
                <span>Chưa làm</span>
              </div>
            </div>
          </aside>
          )}

          {/* Right Column: Top Toolbars + Question Card */}
          <div className="w-full min-w-0 flex-1 space-y-4 lg:order-2">
            {/* Mobile / Tablet Compact 1-Line Toolbar (< 1024px) */}
            {!isDesktopLg && (
            <div className="flex w-full items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(true)}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#EAE6DD] px-3 py-2 text-left text-xs font-semibold text-[#18181B] shadow-xs transition active:scale-[0.99] dark:border-[#262925] dark:bg-[#161816] dark:text-[#F5F5F4]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Menu className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#818CF8]" />
                  <span className="truncate tabular-nums">
                    Câu {currentIndex + 1}/{examQuestions.length} • Đã làm {answeredCount}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#656058] dark:text-[#9CA39B]" />
              </button>

              <ExamTimerPill
                compact
                timerEnabled={timerEnabled}
                initialDurationSec={initialDurationSec}
                sessionSeq={sessionSeq}
                elapsedSecondsRef={elapsedSecondsRef}
                onTimeUp={handleSubmitExam}
                onToggleTimer={() => setTimerEnabled(prev => !prev)}
              />

              <button
                type="button"
                onClick={requestSubmit}
                className="sakuga-btn inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-[#4338CA] px-3 py-2 text-xs font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Nộp</span>
              </button>
            </div>
            )}

            {/* Desktop Sticky Top Bar (>= 1024px) */}
            {isDesktopLg && (
            <div className="sticky top-20 z-20 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD]/[0.97] px-5 py-3.5 shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816]/[0.97] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)]">
              <div className="flex flex-wrap items-center gap-3">
                {/* Countdown Timer + Toggle */}
                <div className="flex items-center gap-2">
                  <ExamTimerPill
                    timerEnabled={timerEnabled}
                    initialDurationSec={initialDurationSec}
                    sessionSeq={sessionSeq}
                    elapsedSecondsRef={elapsedSecondsRef}
                    onTimeUp={handleSubmitExam}
                  />

                  <button
                    type="button"
                    onClick={() => setTimerEnabled(prev => !prev)}
                    title={timerEnabled ? 'Tắt đồng hồ đếm ngược' : 'Bật đồng hồ đếm ngược'}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-2.5 py-1.5 text-xs font-medium text-[#656058] transition hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC]"
                  >
                    {timerEnabled ? (
                      <>
                        <TimerOff className="h-3.5 w-3.5" />
                        <span>Tắt đếm ngược</span>
                      </>
                    ) : (
                      <>
                        <Timer className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#818CF8]" />
                        <span>Bật đếm ngược</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Answered Progress */}
                <div className="flex items-center gap-2.5 border-l border-[#D5CFC2] pl-3 dark:border-[#262925]">
                  <span className="text-xs font-semibold text-[#292524] tabular-nums dark:text-[#E7E5E4]">
                    Đã làm: <span className="text-[#4338CA] dark:text-[#818CF8]">{answeredCount}</span>/{examQuestions.length} câu
                  </span>
                  <SakugaProgressBar
                    percent={
                      examQuestions.length > 0
                        ? Math.round((answeredCount / examQuestions.length) * 100)
                        : 0
                    }
                    className="h-2 w-24"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={requestSubmit}
                className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                <Send className="h-4 w-4" />
                Nộp bài
              </button>
            </div>
            )}

            {/* Question Card (Focal Point Elevation) */}
            <div className="w-full rounded-3xl border-2 border-[#27272A] bg-white p-4 shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] dark:border-2 dark:border-[#52525B] dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:p-6 sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)] md:p-8">
              {/* Header Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-2.5 dark:border-[#2C322D] dark:bg-[#141714]">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="rounded-lg bg-[#4338CA] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] sm:py-1">
                    Câu {currentIndex + 1} / {examQuestions.length}
                  </span>
                  <span className="rounded-lg border border-[#D5CFC2] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#44403C] dark:border-[#3F3F46] dark:bg-[#27272A] dark:text-[#D4D4D8] sm:py-1 sm:text-xs">
                    Chương {currentQuestion.chapter}
                    <span className="hidden sm:inline">: {currentQuestion.chapterTitle}</span>
                  </span>
                  {currentQuestion.isMultiSelect && (
                    <span className="rounded-lg border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0C4A6E]/35 dark:text-[#7DD3FC] sm:py-1 sm:text-xs">
                      Chọn nhiều đáp án
                    </span>
                  )}
                  {isFlagged && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#F0ABFC] bg-[#FAE8FF] px-2 py-0.5 text-[11px] font-semibold text-[#A21CAF] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] md:hidden">
                      <Flag className="h-3 w-3 fill-current" />
                      Phân vân
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleFlag(currentQuestion.id)}
                  className={`sakuga-btn hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold md:inline-flex ${isFlagged
                    ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                    : 'border-[#D5CFC2] bg-[#F8F6F0] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#F0ABFC] hover:bg-[#FAE8FF] hover:text-[#A21CAF] dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#353B36] dark:hover:border-[#D946EF]/50 dark:hover:bg-[#D946EF]/20 dark:hover:text-[#F5D0FE]'
                    }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${isFlagged
                      ? 'fill-[#A21CAF] text-[#A21CAF] dark:fill-[#F5D0FE] dark:text-[#F5D0FE]'
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
              <div className="mt-3.5 rounded-2xl border border-[#E2DDD2] border-l-4 border-l-[#4338CA] bg-[#FAF8F3] p-4 dark:border-[#2C322D] dark:border-l-4 dark:border-l-[#818CF8] dark:bg-[#161917] sm:mt-5 sm:p-5">
                <h3 className="max-w-[78ch] text-[17px] font-semibold leading-[1.6] text-[#18181B] dark:text-[#F5F5F4] sm:text-[19px] sm:leading-[1.65] lg:text-[20px]">
                  {currentQuestion.question}
                </h3>
              </div>

              {/* Options List */}
              <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3.5">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedKeys.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectOption(currentQuestion, opt.key)}
                      className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 px-3.5 text-left transition-[border-color,background-color,color,transform] duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${isSelected
                        ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:bg-[#312E81]/35 dark:text-[#F5F5F4] dark:ring-[#818CF8]'
                        : 'border-[#D5CFC2] bg-[#F8F6F0] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] md:hover:translate-x-1 dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                        }`}
                    >
                      <span
                        className={`sakuga-option-badge mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold sm:h-7 sm:w-7 ${isSelected
                          ? 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8] dark:bg-[#4338CA] dark:text-white'
                          : 'border-[#C6BEB0] bg-white text-[#4338CA] group-hover:border-[#4338CA] group-hover:bg-[#4338CA] group-hover:text-white dark:border-[#353B36] dark:bg-[#161816] dark:text-[#A5B4FC] dark:group-hover:border-[#818CF8] dark:group-hover:bg-[#4338CA] dark:group-hover:text-white'
                          }`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1 pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                        {opt.text}
                      </span>
                      <span className="mt-1 hidden font-mono text-[11px] text-[#656058] dark:text-[#9CA39B] md:inline-block">
                        {optIdx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop Bottom Navigation */}
              <div className="mt-7 hidden w-full flex-wrap items-center justify-between gap-3 border-t border-[#D5CFC2] pt-5 dark:border-[#323833] md:flex">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#F8F6F0] px-4 py-2.5 text-sm font-medium text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#353B36] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Câu trước
                </button>

                <div className="flex items-center gap-3 text-xs text-[#656058] dark:text-[#9CA39B]">
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
                    className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
                  >
                    Câu tiếp
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={requestSubmit}
                    className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
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
        {!isDesktopLg && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D5CFC2] bg-[#EAE6DD]/[0.97] px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(28,25,23,0.08)] dark:border-[#262925] dark:bg-[#161816]/[0.97] dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.5)] md:hidden">
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              className="sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2.5 text-xs font-semibold text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#353B36]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Trước</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFlag(currentQuestion.id)}
              aria-pressed={isFlagged}
              className={`sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold ${isFlagged
                ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#353B36]'
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
                className="sakuga-btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                <span>Câu tiếp</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={requestSubmit}
                className="sakuga-btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                <Send className="h-4 w-4" />
                <span>Nộp bài ngay</span>
              </button>
            )}
          </div>
        </div>
        )}

        {/* Mobile / Tablet 60-Question Bottom Sheet */}
        {!isDesktopLg && (
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
                className="fixed inset-0 z-50 bg-[#18181B]/60 dark:bg-[#0B0D0B]/82"
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
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D5CFC2] bg-[#EAE6DD] shadow-2xl dark:border-[#262925] dark:bg-[#161816] lg:hidden"
              >
                <div className="flex flex-col items-center border-b border-[#D5CFC2] px-4 pb-3 pt-2.5 dark:border-[#262925]">
                  <div className="mb-2.5 h-1 w-10 rounded-full bg-[#C6BEB0] dark:bg-[#323833]" />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                        Bảng câu hỏi ({examQuestions.length} câu)
                      </h3>
                      <p className="text-xs text-[#656058] tabular-nums dark:text-[#9CA39B]">
                        Đã chọn {answeredCount} • Còn {unansweredCount} câu trống
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileSheetOpen(false)}
                      aria-label="Đóng ngăn kéo"
                      className="cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1.5 text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 overflow-y-auto px-4 pb-6 pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#656058] dark:text-[#9CA39B]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#A5B4FC] bg-[#EEF2FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30" />
                      Đã chọn
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#F0ABFC] bg-[#FAE8FF] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20" />
                      Phân vân
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#D5CFC2] bg-[#FAF9F5] dark:border-[#2C302B] dark:bg-[#1C1F1C]" />
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
                            ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                            : flagged
                              ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]'
                              : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]'
                            } ${flagged && isAnswered ? 'border-[#A21CAF] dark:border-[#D946EF]' : ''} ${isCurrent
                              ? 'z-10 ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                              : ''
                            }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span
                              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#A21CAF] ring-2 ring-[#EAE6DD] dark:bg-[#F5D0FE] dark:ring-[#161816]"
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
        )}

        {/* Submit Confirmation Modal */}
        {confirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/60 p-4 dark:bg-[#0B0D0B]/82">
            <div className="w-full max-w-md rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-5 shadow-xl dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#18181B] dark:text-[#F5F5F4]">
                    Xác nhận nộp bài?
                  </h3>
                  <p className="mt-1 text-sm text-[#656058] dark:text-[#9CA39B]">
                    Bạn còn{' '}
                    <span className="font-semibold text-[#BE123C] tabular-nums dark:text-[#FDA4AF]">
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
                  className="sakuga-btn cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2 text-sm font-medium text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#353B36] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC]"
                >
                  Tiếp tục làm bài
                </button>
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="sakuga-btn cursor-pointer rounded-xl bg-[#4338CA] px-4 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
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
  const spentSeconds = lastResult?.durationSeconds ?? elapsedSecondsRef.current;
  const breakdown = lastResult?.chapterBreakdown ?? {};
  const resultExamType = lastResult?.examType ?? activeExamType;
  const isResultMasteredMode = resultExamType === 'mastered';

  return (
    <>
      <div className="w-full space-y-6 lg:space-y-8">
        {/* Top Score Summary & Actions */}
        <section className="rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-7 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border sm:h-20 sm:w-20 ${scoreOn10 >= 5
                  ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]'
                  : 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                  }`}
              >
                <span className="text-xl font-extrabold leading-none tabular-nums sm:text-2xl">
                  {scoreOn10.toFixed(1)}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80 sm:text-[11px]">
                  / 10 điểm
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                    <Award className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#A5B4FC]" />
                    Kết quả thi thử {subjectMeta.code}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${isResultMasteredMode
                      ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]'
                      : 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                      }`}
                  >
                    {isResultMasteredMode ? 'Ôn đã thuộc' : 'Đề đề cương'}
                  </span>
                  <SakugaMangaTag
                    label={scoreOn10 >= 5 ? 'COMPLETE! ✓' : 'KEEP GOING!'}
                    tone={scoreOn10 >= 5 ? 'emerald' : 'amber'}
                  />
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-[#18181B] tabular-nums dark:text-[#F5F5F4] sm:text-xl">
                  Đúng {correctTotal}/{totalCount} câu (
                  {totalCount > 0 ? Math.round((correctTotal / totalCount) * 100) : 0}%)
                </h2>
                <p className="mt-0.5 text-xs text-[#656058] tabular-nums dark:text-[#9CA39B] sm:text-sm">
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
                  className={`sakuga-btn inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold sm:w-auto sm:text-sm ${bulkFlaggedConfirm !== null
                    ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-none dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]'
                    : 'border-[#A21CAF] bg-[#A21CAF] text-white shadow-[2px_2px_0_0_#F0ABFC] hover:bg-[#86198F] dark:border-[#D946EF]/60 dark:bg-[#A21CAF] dark:shadow-[2px_2px_0_0_#701A75] dark:hover:bg-[#86198F]'
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
                className="sakuga-btn inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-xs font-medium text-[#292524] shadow-[3px_3px_0_0_#C7D2FE] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC] sm:w-auto sm:text-sm"
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span>Xem lại bài làm</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('lobby')}
                className="sakuga-btn inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-5 py-2.5 text-xs font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3] sm:w-auto sm:text-sm"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>Thi đề khác</span>
              </button>
            </div>
          </div>

          {bulkFlaggedConfirm !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#F0ABFC] bg-[#FAE8FF] px-3.5 py-2.5 text-xs font-medium text-[#A21CAF] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Đã cập nhật {bulkFlaggedConfirm} câu làm sai từ trạng thái{' '}
                <strong>Đã thuộc</strong> sang <strong>Phân vân</strong> để bạn ôn tập kỹ lại!
              </span>
            </div>
          )}

          {/* Chapter Breakdown Table + Desktop 60-cell Navigator */}
          <div className="mt-5 flex w-full flex-col gap-6 border-t border-[#D5CFC2] pt-5 dark:border-[#262925] sm:mt-7 sm:pt-7 lg:flex-row lg:gap-8 xl:gap-10">
            {/* Detailed Score Breakdown Table by Chapter */}
            <div className="min-w-0 flex-1">
              <h3 className="mb-3 text-sm font-bold text-[#18181B] dark:text-[#F5F5F4] sm:mb-3.5">
                Chi tiết điểm theo từng chương
              </h3>
              <div className="overflow-hidden rounded-xl border border-[#D5CFC2] dark:border-[#2C302B]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#656058] dark:bg-[#1C1F1C] dark:text-[#9CA39B] sm:text-xs">
                    <tr>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3">Chương</th>
                      <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Đúng / Tổng</th>
                      <th className="w-28 px-3 py-2.5 sm:w-40 sm:px-4 sm:py-3">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5CFC2] bg-white dark:divide-[#262925] dark:bg-[#1E221F]">
                    {
                      subjectChapters.map(ch => {
                        const stat = breakdown[ch.chapter] ?? { correct: 0, total: 0 };
                        const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;

                        return (
                          <tr key={ch.chapter}>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <div className="font-semibold text-[#18181B] dark:text-[#F5F5F4]">
                                Chương {ch.chapter}
                              </div>
                              <div className="line-clamp-1 text-[11px] text-[#656058] dark:text-[#9CA39B] sm:text-xs">
                                {ch.title}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-[#292524] tabular-nums dark:text-[#E7E5E4] sm:px-4 sm:py-3">
                              {stat.correct}/{stat.total}
                            </td>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <div className="flex items-center gap-2">
                                <SakugaProgressBar percent={pct} className="h-2 flex-1" />
                                <span className="w-8 text-right text-[11px] font-semibold text-[#656058] tabular-nums dark:text-[#9CA39B] sm:w-9 sm:text-xs">
                                  {pct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* Desktop Results Navigator (hidden on Mobile/Tablet — moved to Bottom Sheet) */}
            {isDesktopLg && (
            <div className="shrink-0 lg:w-[380px]">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#18181B] tabular-nums dark:text-[#F5F5F4]">
                  Bản đồ kết quả {gradedItems.length} câu
                </h3>
                <span className="text-xs text-[#656058] dark:text-[#9CA39B]">
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
                      ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] hover:bg-[#A7F3D0] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399] dark:hover:bg-[#064E3B]/80'
                      : 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] hover:bg-[#FECDD3] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF] dark:hover:bg-[#E11D48]/30'
                      } ${focusedReviewId === item.question.id
                        ? 'ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                        : ''
                      }`}
                  >
                    {item.index + 1}
                    {item.isFlagged && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#A21CAF] ring-2 ring-[#EAE6DD] dark:bg-[#F5D0FE] dark:ring-[#161816]"
                        aria-label="Phân vân"
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#656058] dark:text-[#9CA39B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[#10B981] bg-[#D1FAE5] dark:border-[#10B981] dark:bg-[#064E3B]/55" />
                  Đúng ({correctTotal})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[#FDA4AF] bg-[#FFE4E6] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20" />
                  Sai / Bỏ trống ({wrongCount})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#A21CAF] dark:bg-[#F5D0FE]" />
                  Phân vân ({flaggedInExamCount})
                </span>
              </div>
            </div>
            )}
          </div>
        </section>

        {/* Review Filter Tabs & Detailed Question Cards */}
        <section ref={reviewSectionRef} className="space-y-4 lg:space-y-6">
          {/* Mobile/Tablet 1-Line Toolbar (< 1024px) opening Results Bottom Sheet */}
          {!isDesktopLg && (
          <div>
            <button
              type="button"
              onClick={() => setIsMobileResultsSheetOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-2.5 text-left text-xs font-semibold text-[#18181B] shadow-xs transition active:scale-[0.99] dark:border-[#262925] dark:bg-[#161816] dark:text-[#F5F5F4]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#818CF8]" />
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
              <ChevronDown className="h-4 w-4 shrink-0 text-[#656058] dark:text-[#9CA39B]" />
            </button>
          </div>
          )}

          {/* Desktop Review Filter Tabs */}
          {isDesktopLg && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-[#D5CFC2] bg-[#EAE6DD] p-1 shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
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
                    className={`sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${active
                      ? 'bg-[#4338CA] text-white shadow-xs hover:bg-[#3730A3] dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                      : 'text-[#292524] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#E7E5E4] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC]'
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active
                        ? 'bg-white/20 text-white'
                        : 'border border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]'
                        }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {filteredReviewItems.length === 0 ? (
            <div className="rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-8 text-center shadow-[0_8px_24px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-10">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#059669] dark:text-[#34D399]" />
              <p className="mt-3 text-base font-semibold text-[#18181B] dark:text-[#F5F5F4]">
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
                const correctSet = new Set(q.correctAnswers.map(c => c.toUpperCase()));
                const suspectSet = new Set((q.suspectedAnswers ?? []).map(c => c.toUpperCase()));
                const selectedSet = new Set(selected.map(s => s.toUpperCase()));

                return (
                  <article
                    key={q.id}
                    id={`exam-review-q-${q.id}`}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 340px' }}
                    className={`scroll-mt-24 rounded-3xl border-2 border-[#27272A] bg-white p-4 shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] transition dark:border-2 dark:border-[#52525B] dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:p-6 sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)] md:p-8 ${isHighlighted ? 'ring-2 ring-[#4338CA]/40 dark:ring-[#818CF8]/40' : ''
                      }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-2.5 dark:border-[#2C322D] dark:bg-[#141714]">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-lg bg-[#4338CA] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] sm:py-1">
                          Câu {index + 1}
                        </span>
                        <span className="rounded-lg border border-[#D5CFC2] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#44403C] dark:border-[#3F3F46] dark:bg-[#27272A] dark:text-[#D4D4D8] sm:py-1 sm:text-xs">
                          Chương {q.chapter}
                          <span className="hidden sm:inline">: {q.chapterTitle}</span>
                        </span>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-[11px] font-semibold text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399] sm:py-1 sm:text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                            Đúng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#FDA4AF] bg-[#FFE4E6] px-2.5 py-0.5 text-[11px] font-semibold text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF] sm:py-1 sm:text-xs">
                            <XCircle className="h-3.5 w-3.5 text-[#BE123C] dark:text-[#FDA4AF]" />
                            {isSkipped ? 'Bỏ trống' : 'Sai'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleFlag(q.id)}
                        className={`sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold sm:px-3 ${isFlagged
                          ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#D946EF]/50 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                          : 'border-[#D5CFC2] bg-[#F8F6F0] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#F0ABFC] hover:bg-[#FAE8FF] hover:text-[#A21CAF] dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#353B36] dark:hover:border-[#D946EF]/50 dark:hover:bg-[#D946EF]/20 dark:hover:text-[#F5D0FE]'
                          }`}
                      >
                        <Flag
                          className={`h-3.5 w-3.5 ${isFlagged
                            ? 'fill-[#A21CAF] text-[#A21CAF] dark:fill-[#F5D0FE] dark:text-[#F5D0FE]'
                            : ''
                            }`}
                        />
                        <span>Phân vân</span>
                      </button>
                    </div>

                    <div className="mt-3.5 rounded-2xl border border-[#E2DDD2] border-l-4 border-l-[#4338CA] bg-[#FAF8F3] p-4 dark:border-[#2C322D] dark:border-l-4 dark:border-l-[#818CF8] dark:bg-[#161917] sm:mt-5 sm:p-5">
                      <h4 className="max-w-[78ch] text-[17px] font-semibold leading-[1.6] text-[#18181B] dark:text-[#F5F5F4] sm:text-[19px] sm:leading-[1.65]">
                        {q.question}
                      </h4>
                    </div>

                    <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                      {q.options.map(opt => {
                        const optUpper = opt.key.toUpperCase();
                        const isCorrectOpt = correctSet.has(optUpper);
                        const isSuspectedOpt = !isCorrectOpt && suspectSet.has(optUpper);
                        const isUserSelected = selectedSet.has(optUpper);

                        let rowStyle =
                          'border-[#D5CFC2] bg-[#F8F6F0] text-[#292524] dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#E7E5E4]';
                        let badgeStyle =
                          'border-[#C6BEB0] bg-white text-[#292524] dark:border-[#353B36] dark:bg-[#161816] dark:text-[#E7E5E4]';

                        if (isCorrectOpt) {
                          rowStyle =
                            'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#ECFDF5]';
                          badgeStyle =
                            'border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]';
                        } else if (isSuspectedOpt) {
                          rowStyle =
                            'border-2 border-[#EC4899] bg-[#FCE7F3] text-[#9D174D] dark:border-2 dark:border-[#F472B6] dark:bg-[#831843]/45 dark:text-[#FCE7F3]';
                          badgeStyle =
                            'border-[#DB2777] bg-[#EC4899] text-white dark:border-[#F472B6] dark:bg-[#EC4899] dark:text-white';
                        } else if (isUserSelected) {
                          rowStyle =
                            'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]';
                          badgeStyle =
                            'border-[#BE123C] bg-[#BE123C] text-white dark:border-[#FB7185] dark:bg-[#E11D48] dark:text-white';
                        }

                        return (
                          <div
                            key={opt.key}
                            className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3 px-3.5 sm:flex-nowrap sm:gap-3 sm:p-4 sm:px-5 ${rowStyle}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`sakuga-option-badge mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold sm:h-7 sm:w-7 ${badgeStyle}`}
                              >
                                {opt.key}
                              </span>
                              <span className="pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                                {opt.text}
                              </span>
                            </div>

                            {(isUserSelected || isCorrectOpt || isSuspectedOpt) && (
                              <div className="ml-9 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold sm:ml-0">
                                {isUserSelected && (
                                  <span
                                    className={`rounded-md border px-2 py-0.5 ${isCorrectOpt
                                      ? 'border-[#10B981] bg-white text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/80 dark:text-[#34D399]'
                                      : isSuspectedOpt
                                        ? 'border-[#EC4899] bg-white text-[#BE185D] dark:border-[#F472B6] dark:bg-[#831843]/80 dark:text-[#FBCFE8]'
                                        : 'border-[#FDA4AF] bg-white text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/25 dark:text-[#FDA4AF]'
                                      }`}
                                  >
                                    Bạn chọn
                                  </span>
                                )}
                                {isSuspectedOpt && (
                                  <SakugaMangaTag label="???" tone="pink" animateBurst={false} />
                                )}
                                {isCorrectOpt && (
                                  <span className="rounded-md border border-[#10B981] bg-white px-2 py-0.5 text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/80 dark:text-[#34D399]">
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
      {!isDesktopLg && (
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
              className="fixed inset-0 z-50 bg-[#18181B]/60 dark:bg-[#0B0D0B]/82"
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
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D5CFC2] bg-[#EAE6DD] shadow-2xl dark:border-[#262925] dark:bg-[#161816] lg:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D5CFC2] px-4 pb-3 pt-2.5 dark:border-[#262925]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#C6BEB0] dark:bg-[#323833]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#18181B] tabular-nums dark:text-[#F5F5F4]">
                      Bản đồ kết quả {gradedItems.length} câu
                    </h3>
                    <p className="text-xs text-[#656058] tabular-nums dark:text-[#9CA39B]">
                      Đúng {correctTotal} • Sai {wrongCount} • Phân vân {flaggedInExamCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileResultsSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1.5 text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-4">
                {/* 3 Filter Tabs */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
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
                            ? 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8]/50 dark:bg-[#4338CA]'
                            : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]'
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
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
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
                          ? 'border-[#10B981] bg-[#D1FAE5] text-[#064E3B] dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#34D399]'
                          : 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/50 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                          } ${focusedReviewId === item.question.id
                            ? 'ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                            : ''
                          }`}
                      >
                        {item.index + 1}
                        {item.isFlagged && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#A21CAF] ring-2 ring-[#EAE6DD] dark:bg-[#F5D0FE] dark:ring-[#161816]"
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
      )}
    </>
  );
};

export default MockExamView;
