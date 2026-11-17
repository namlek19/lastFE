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
      <div className="space-y-6 md:space-y-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Main Exam Setup Card */}
          <section className="lg:col-span-7 rounded-2xl border border-[#D5E3EC] bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5E3EC] pb-4 dark:border-[#1E293B] sm:pb-5">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                    isMasteredMode
                      ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                      : 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                  }`}
                >
                  {isMasteredMode ? (
                    <Sparkles className="h-3.5 w-3.5 text-[#0D9488] dark:text-[#14B8A6]" />
                  ) : (
                    <ListChecks className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                  )}
                  {isMasteredMode
                    ? currentPlannedQuestions > 0
                      ? `Đề thi thử ${currentPlannedQuestions} câu`
                      : 'Ôn câu đã thuộc'
                    : `Đề thi thử ${subjectMeta.examTotal} câu`}
                </span>
                <h2 className="mt-2.5 text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] sm:text-xl">
                  Thi thử trộn đề — {subjectMeta.code}
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8] sm:text-sm">
                  {subjectMeta.name}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0] sm:px-3.5 sm:py-2">
                <Clock className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
                <span className="tabular-nums">
                  {currentPlannedMinutes > 0
                    ? `Thời lượng chuẩn: ${currentPlannedMinutes} phút`
                    : 'Chưa có câu đã thuộc'}
                </span>
              </div>
            </div>

            {/* 2-Mode Exam Selector Cards (Mobile-First grid-cols-1 sm:grid-cols-2 gap-3) */}
            <div className="mt-4 sm:mt-5">
              <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                Chọn chế độ đề thi
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Mode 1: Standard Curriculum Exam */}
                <button
                  type="button"
                  onClick={() => setExamType('standard')}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${
                    examType === 'standard'
                      ? 'border-[#0284C7] bg-[#E0F2FE] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:ring-[#38BDF8]'
                      : 'border-[#D5E3EC] bg-white hover:border-[#0284C7] hover:bg-[#F1F6F9] dark:border-[#334155] dark:bg-[#1E293B]/50 dark:hover:border-[#38BDF8]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold ${
                          examType === 'standard'
                            ? 'text-[#0284C7] dark:text-[#38BDF8]'
                            : 'text-[#0F172A] dark:text-[#F8FAFC]'
                        }`}
                      >
                        Đề chuẩn đề cương (60 câu)
                      </span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          examType === 'standard'
                            ? 'border-[#0284C7] bg-[#0284C7] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#0B1120]'
                            : 'border-[#CBD5E1] dark:border-[#475569]'
                        }`}
                      >
                        {examType === 'standard' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Chia câu chuẩn tỷ lệ từng chương theo cấu trúc đề thi chính thức.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-md border border-[#BAE6FD] bg-white px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#0284C7] tabular-nums dark:border-[#38BDF8]/40 dark:bg-[#0B1120] dark:text-[#38BDF8]">
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
                      ? 'border-[#0D9488] bg-[#F0FDFA] ring-1 ring-[#0D9488] dark:border-[#2DD4BF] dark:bg-[#134E4A]/35 dark:ring-[#2DD4BF]'
                      : 'border-[#D5E3EC] bg-white hover:border-[#0D9488] hover:bg-[#F0FDFA]/60 dark:border-[#334155] dark:bg-[#1E293B]/50 dark:hover:border-[#2DD4BF]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold ${
                          examType === 'mastered'
                            ? 'text-[#115E59] dark:text-[#2DD4BF]'
                            : 'text-[#0F172A] dark:text-[#F8FAFC]'
                        }`}
                      >
                        Ôn tổng hợp câu đã thuộc (Tối đa 60 câu)
                      </span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          examType === 'mastered'
                            ? 'border-[#0D9488] bg-[#0D9488] text-white dark:border-[#2DD4BF] dark:bg-[#2DD4BF] dark:text-[#0B1120]'
                            : 'border-[#CBD5E1] dark:border-[#475569]'
                        }`}
                      >
                        {examType === 'mastered' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Chọn ngẫu nhiên không phân biệt chương từ các câu đã đánh dấu Đã thuộc.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#5EEAD4] bg-white px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#115E59] tabular-nums dark:border-[#2DD4BF]/50 dark:bg-[#0B1120] dark:text-[#2DD4BF]">
                      Kho câu đã thuộc: {masteredCount} câu
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mode Details: Standard Chapter Quota Matrix vs Mastered Pool Summary */}
            {!isMasteredMode ? (
              <div className="mt-5 sm:mt-6">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                  <span>Cấu trúc phân bổ câu hỏi</span>
                  <span className="tabular-nums text-[#0284C7] dark:text-[#38BDF8]">
                    Tổng {subjectMeta.examTotal} câu
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                  {subjectMeta.chapters.map(ch => {
                    const quota = subjectMeta.examQuotas[ch.chapter] ?? 0;
                    return (
                      <div
                        key={ch.chapter}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9]/70 px-3.5 py-2.5 dark:border-[#334155] dark:bg-[#1E293B]/45 sm:px-4 sm:py-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                            Chương {ch.chapter}
                          </div>
                          <div
                            className="truncate text-xs text-[#64748B] dark:text-[#94A3B8]"
                            title={ch.title}
                          >
                            {ch.title}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-1 text-xs font-bold text-[#115E59] tabular-nums dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                          {quota} câu
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3.5 sm:mt-6">
                <div className="rounded-xl border border-[#5EEAD4] bg-[#F0FDFA]/70 p-4 dark:border-[#2DD4BF]/50 dark:bg-[#134E4A]/25 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
                      <span className="text-sm font-bold text-[#115E59] tabular-nums dark:text-[#2DD4BF]">
                        Kho câu đã thuộc: {masteredCount} câu
                      </span>
                    </div>
                    {masteredCount > 0 && (
                      <span className="rounded-full border border-[#5EEAD4] bg-white px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#115E59] tabular-nums dark:border-[#2DD4BF] dark:bg-[#0B1120] dark:text-[#2DD4BF]">
                        Đề thi thử {currentPlannedQuestions} câu • {currentPlannedMinutes} phút
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs leading-relaxed text-[#115E59]/90 dark:text-[#CCFBF1]/90 sm:text-sm">
                    Chọn ngẫu nhiên không phân biệt chương từ các câu bạn đã đánh dấu Đã thuộc.
                  </p>

                  {masteredCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#5EEAD4]/60 pt-3 dark:border-[#2DD4BF]/30">
                      {subjectMeta.chapters.map(ch => {
                        const chMastered = masteredPool.filter(q => q.chapter === ch.chapter).length;
                        return (
                          <span
                            key={ch.chapter}
                            className="rounded-md border border-[#5EEAD4] bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#115E59] tabular-nums dark:border-[#2DD4BF]/40 dark:bg-[#0B1120] dark:text-[#2DD4BF]"
                          >
                            Chương {ch.chapter}: {chMastered} câu đã thuộc
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {masteredCount === 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-[#BAE6FD] bg-[#E0F2FE]/80 p-4 text-xs leading-relaxed text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] sm:text-sm">
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
            <div className="mt-5 flex flex-col gap-3.5 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9]/70 p-4 dark:border-[#334155] dark:bg-[#0B1120]/70 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
              <button
                type="button"
                onClick={() => setTimerEnabled(prev => !prev)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg text-left transition-colors"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    timerEnabled
                      ? 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/20 dark:text-[#38BDF8]'
                      : 'border-[#D5E3EC] bg-white text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                  }`}
                >
                  {timerEnabled ? <Timer className="h-5 w-5" /> : <TimerOff className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    <span>
                      Đếm ngược {currentPlannedMinutes > 0 ? currentPlannedMinutes : 45} phút
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        timerEnabled
                          ? 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                          : 'border-[#D5E3EC] bg-white text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {timerEnabled ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {timerEnabled
                      ? `Tự động nộp bài khi hết ${String(
                          currentPlannedMinutes > 0 ? currentPlannedMinutes : 45
                        ).padStart(2, '0')}:00 (có thể tắt/bật khi đang làm).`
                      : 'Làm bài thoải mái không giới hạn thời gian.'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={isStartDisabled}
                onClick={startNewExam}
                className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#38BDF8]/50 sm:w-auto sm:py-3"
              >
                <Play className="h-4 w-4 fill-current" />
                Bắt đầu làm bài
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] sm:mt-5">
              <span>• Trộn ngẫu nhiên không trùng câu hỏi</span>
              <span>• Chấm điểm &amp; giải thích sau khi nộp bài</span>
              <span className="hidden md:inline">
                • Phím tắt: 1-5 / A-E chọn đáp án, Space/Enter qua câu, F phân vân
              </span>
            </div>
          </section>

          {/* Recent Exam History Card */}
          <section className="lg:col-span-5 flex flex-col rounded-2xl border border-[#D5E3EC] bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="flex items-center justify-between border-b border-[#D5E3EC] pb-4 dark:border-[#1E293B] sm:pb-5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
                <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Lịch sử thi gần đây
                </h3>
              </div>
              <span className="rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-0.5 text-xs font-semibold text-[#115E59] tabular-nums dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                {subjectHistory.length} lượt
              </span>
            </div>

            {subjectHistory.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  <Award className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Chưa có bài thi thử {subjectMeta.code} nào
                </p>
                <p className="mt-1 max-w-xs text-xs text-[#64748B] dark:text-[#94A3B8]">
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
                      className="rounded-xl border border-[#D5E3EC] bg-[#F1F6F9]/70 p-3.5 transition hover:border-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/45 dark:hover:border-[#38BDF8] sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums ${
                              passed
                                ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                                : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]'
                            }`}
                          >
                            {item.scoreOn10.toFixed(1)}đ
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                                {item.correctCount}/{item.totalQuestions} câu đúng
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                                  isItemMasteredMode
                                    ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                                    : 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                                }`}
                              >
                                {isItemMasteredMode ? 'Ôn đã thuộc' : 'Đề đề cương'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                              {formatDateTimeVi(item.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                          <div className="font-medium text-[#1E293B] dark:text-[#E2E8F0]">
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
                              className="rounded-md border border-[#D5E3EC] bg-white px-2 py-0.5 text-[11px] font-medium text-[#64748B] tabular-nums dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#94A3B8]"
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
        <div className="space-y-3 lg:space-y-6">
          {/* Mobile / Tablet Compact 1-Line Toolbar (< 1024px) */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-xl border border-[#D5E3EC] bg-white px-3 py-2 text-left text-xs font-semibold text-[#0F172A] shadow-xs transition active:scale-[0.99] dark:border-[#1E293B] dark:bg-[#111827] dark:text-[#F8FAFC]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
                <span className="truncate tabular-nums">
                  Câu {currentIndex + 1}/{examQuestions.length} • Đã làm {answeredCount}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] dark:text-[#94A3B8]" />
            </button>

            <button
              type="button"
              onClick={() => setTimerEnabled(prev => !prev)}
              title={timerEnabled ? 'Đang bật đếm ngược (chạm để tắt)' : 'Đang tắt đếm ngược (chạm để bật)'}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold tabular-nums transition ${!timerEnabled
                  ? 'border-[#D5E3EC] bg-white text-[#64748B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94A3B8]'
                  : isLowTime
                    ? 'animate-pulse border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/60 dark:text-[#FB7185]'
                    : 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{timerEnabled ? formatClock(remainingSeconds) : formatClock(elapsedSeconds)}</span>
            </button>

            <button
              type="button"
              onClick={requestSubmit}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-[#0284C7] px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Nộp</span>
            </button>
          </div>

          {/* Desktop Sticky Top Bar (>= 1024px) */}
          <div className="sticky top-28 z-20 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5E3EC] bg-white/95 px-5 py-3.5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] backdrop-blur dark:border-[#1E293B] dark:bg-[#111827]/95 dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)] lg:flex">
            <div className="flex flex-wrap items-center gap-3">
              {/* Countdown Timer + Toggle */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold tabular-nums transition-colors ${!timerEnabled
                      ? 'border-[#D5E3EC] bg-[#F1F6F9] text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                      : isLowTime
                        ? 'animate-pulse border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/60 dark:text-[#FB7185]'
                        : 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5E3EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#0284C7] hover:bg-[#F1F6F9] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#94A3B8] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
                >
                  {timerEnabled ? (
                    <>
                      <TimerOff className="h-3.5 w-3.5" />
                      <span>Tắt đếm ngược</span>
                    </>
                  ) : (
                    <>
                      <Timer className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                      <span>Bật đếm ngược</span>
                    </>
                  )}
                </button>
              </div>

              {/* Answered Progress */}
              <div className="flex items-center gap-2.5 border-l border-[#D5E3EC] pl-3 dark:border-[#334155]">
                <span className="text-xs font-semibold text-[#1E293B] tabular-nums dark:text-[#E2E8F0]">
                  Đã làm: <span className="text-[#0D9488] dark:text-[#14B8A6]">{answeredCount}</span>/{examQuestions.length} câu
                </span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#0B1120]">
                  <div
                    className="h-full rounded-full bg-[#0D9488] transition-all duration-200 dark:bg-[#14B8A6]"
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
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
            >
              <Send className="h-4 w-4" />
              Nộp bài
            </button>
          </div>

          {/* Main Active Grid: Question Card + 60-Cell Navigator */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Question Card */}
            <div className="lg:col-span-8 rounded-2xl border border-[#D5E3EC] bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-7 lg:p-9">
              {/* Header Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5E3EC] pb-3 dark:border-[#1E293B] sm:pb-4">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums dark:border dark:border-[#38BDF8]/50 sm:py-1">
                    Câu {currentIndex + 1} / {examQuestions.length}
                  </span>
                  <span className="rounded-lg border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] sm:py-1 sm:text-xs">
                    Chương {currentQuestion.chapter}
                    <span className="hidden sm:inline">: {currentQuestion.chapterTitle}</span>
                  </span>
                  {currentQuestion.isMultiSelect && (
                    <span className="rounded-lg border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-0.5 text-[11px] font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF] sm:py-1 sm:text-xs">
                      Chọn nhiều đáp án
                    </span>
                  )}
                  {isFlagged && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8] md:hidden">
                      <Flag className="h-3 w-3 fill-current" />
                      Phân vân
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleFlag(currentQuestion.id)}
                  className={`hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition md:inline-flex ${isFlagged
                      ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                      : 'border-[#D5E3EC] bg-white text-[#64748B] hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#94A3B8] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#1E1B4B]/60 dark:hover:text-[#818CF8]'
                    }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      isFlagged
                        ? 'fill-[#4F46E5] text-[#4F46E5] dark:fill-[#818CF8] dark:text-[#818CF8]'
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
              <h3 className="mt-3.5 text-[17px] font-semibold leading-[1.6] text-[#0F172A] dark:text-[#F8FAFC] sm:mt-5 sm:text-[19px] sm:leading-[1.65] lg:text-[20px]">
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
                      className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 px-3.5 text-left transition-all duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${isSelected
                          ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0F172A] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/25 dark:text-[#F8FAFC] dark:ring-[#38BDF8]'
                          : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE]/60 md:hover:translate-x-1 dark:border-[#334155] dark:bg-[#1E293B]/50 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20'
                        }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition sm:h-7 sm:w-7 ${isSelected
                            ? 'border-[#0284C7] bg-[#0284C7] text-white dark:border-[#38BDF8]'
                            : 'border-[#D5E3EC] bg-[#F1F6F9] text-[#1E293B] dark:border-[#475569] dark:bg-[#0B1120] dark:text-[#E2E8F0]'
                          }`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1 pt-0.5 text-[15px] font-medium leading-relaxed text-[#1E293B] dark:text-[#E2E8F0] sm:text-[16px]">
                        {opt.text}
                      </span>
                      <span className="mt-1 hidden font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] md:inline-block">
                        {optIdx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop Bottom Navigation */}
              <div className="mt-7 hidden flex-wrap items-center justify-between gap-3 border-t border-[#D5E3EC] pt-5 dark:border-[#1E293B] md:flex">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0284C7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Câu trước
                </button>

                <div className="flex items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
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
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
                  >
                    Câu tiếp
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={requestSubmit}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115E59] dark:bg-[#14B8A6] dark:text-[#0B1120] dark:hover:bg-[#2DD4BF]"
                  >
                    <Send className="h-4 w-4" />
                    Nộp bài ngay
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Navigator Sidebar */}
            <aside className="hidden lg:col-span-4 lg:block rounded-2xl border border-[#D5E3EC] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-[#D5E3EC] pb-3.5 dark:border-[#1E293B]">
                <h4 className="text-sm font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                  Bảng câu hỏi ({examQuestions.length} câu)
                </h4>
                <span className="text-xs font-medium text-[#64748B] tabular-nums dark:text-[#94A3B8]">
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
                          ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/25 dark:text-[#38BDF8]'
                          : flagged
                            ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                            : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#F1F6F9] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20'
                        } ${flagged && isAnswered ? 'border-[#4F46E5] dark:border-[#818CF8]' : ''} ${isCurrent ? 'z-10 ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#111827]' : ''
                        }`}
                    >
                      {idx + 1}
                      {flagged && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#4F46E5] ring-2 ring-white dark:bg-[#818CF8] dark:ring-[#111827]"
                          aria-label="Phân vân"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#D5E3EC] pt-3.5 text-[11px] text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-[#0284C7] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:ring-[#38BDF8]" />
                  <span>Đang xem</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-[#0284C7] bg-[#E0F2FE] dark:border-[#38BDF8] dark:bg-[#0284C7]/25" />
                  <span>Đã chọn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative h-3.5 w-3.5 rounded border border-[#C7D2FE] bg-[#EEF2FF] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60">
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
                  </span>
                  <span>Phân vân</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-[#D5E3EC] bg-white dark:border-[#334155] dark:bg-[#1E293B]/60" />
                  <span>Chưa làm</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Mobile Sticky Bottom Navigation Bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D5E3EC] bg-white/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#1E293B] dark:bg-[#111827]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.5)] md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] px-3 py-2.5 text-xs font-semibold text-[#1E293B] transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#E2E8F0]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Trước</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFlag(currentQuestion.id)}
              aria-pressed={isFlagged}
              className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${isFlagged
                  ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                  : 'border-[#D5E3EC] bg-white text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'
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
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0284C7] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
              >
                <span>Câu tiếp</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={requestSubmit}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#115E59] dark:bg-[#14B8A6] dark:text-[#0B1120]"
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
                className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px] dark:bg-[#0B1120]/75 lg:hidden"
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
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D5E3EC] bg-white shadow-2xl dark:border-[#1E293B] dark:bg-[#111827] lg:hidden"
              >
                <div className="flex flex-col items-center border-b border-[#D5E3EC] px-4 pb-3 pt-2.5 dark:border-[#1E293B]">
                  <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D5E3EC] dark:bg-[#334155]" />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        Bảng câu hỏi ({examQuestions.length} câu)
                      </h3>
                      <p className="text-xs text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                        Đã chọn {answeredCount} • Còn {unansweredCount} câu trống
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileSheetOpen(false)}
                      aria-label="Đóng ngăn kéo"
                      className="cursor-pointer rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] p-1.5 text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#E2E8F0]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 overflow-y-auto px-4 pb-6 pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#0284C7] bg-[#E0F2FE] dark:border-[#38BDF8] dark:bg-[#0284C7]/25" />
                      Đã chọn
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#C7D2FE] bg-[#EEF2FF] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60" />
                      Phân vân
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded border border-[#D5E3EC] bg-white dark:border-[#334155] dark:bg-[#1E293B]/60" />
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
                              ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/25 dark:text-[#38BDF8]'
                              : flagged
                                ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                                : 'border-[#D5E3EC] bg-white text-[#1E293B] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0]'
                            } ${flagged && isAnswered ? 'border-[#4F46E5] dark:border-[#818CF8]' : ''} ${isCurrent ? 'z-10 ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#111827]' : ''
                            }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span
                              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#4F46E5] ring-2 ring-white dark:bg-[#818CF8] dark:ring-[#111827]"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px] dark:bg-[#0B1120]/75">
            <div className="w-full max-w-md rounded-2xl border border-[#D5E3EC] bg-white p-5 shadow-xl dark:border-[#334155] dark:bg-[#111827] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/50 dark:bg-[#4C0519]/50 dark:text-[#FB7185]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Xác nhận nộp bài?
                  </h3>
                  <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Bạn còn{' '}
                    <span className="font-semibold text-[#E11D48] tabular-nums dark:text-[#FB7185]">
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
                  className="cursor-pointer rounded-xl border border-[#D5E3EC] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] hover:border-[#0284C7] hover:bg-[#F1F6F9] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8]"
                >
                  Tiếp tục làm bài
                </button>
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="cursor-pointer rounded-xl bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
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
      <div className="space-y-6 lg:space-y-8">
        {/* Top Score Summary & Actions */}
        <section className="rounded-2xl border border-[#D5E3EC] bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-7 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border sm:h-20 sm:w-20 ${
                  scoreOn10 >= 5
                    ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                    : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]'
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
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                    <Award className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                    Kết quả thi thử {subjectMeta.code}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                      isResultMasteredMode
                        ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                        : 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                    }`}
                  >
                    {isResultMasteredMode ? 'Ôn đã thuộc' : 'Đề đề cương'}
                  </span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC] sm:text-xl">
                  Đúng {correctTotal}/{totalCount} câu (
                  {totalCount > 0 ? Math.round((correctTotal / totalCount) * 100) : 0}%)
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B] tabular-nums dark:text-[#94A3B8] sm:text-sm">
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
                      ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                      : 'border-[#4F46E5] bg-[#4F46E5] text-white shadow-xs hover:bg-[#4338CA] dark:border-[#818CF8]/60 dark:bg-[#4F46E5] dark:hover:bg-[#4338CA]'
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
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-xs font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#F1F6F9] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8] sm:w-auto sm:text-sm"
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span>Xem lại bài làm</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('lobby')}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50 sm:w-auto sm:text-sm"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>Thi đề khác</span>
              </button>
            </div>
          </div>

          {bulkFlaggedConfirm !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-2.5 text-xs font-medium text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8] sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Đã cập nhật {bulkFlaggedConfirm} câu làm sai từ trạng thái{' '}
                <strong>Đã thuộc</strong> sang <strong>Phân vân</strong> để bạn ôn tập kỹ lại!
              </span>
            </div>
          )}

          {/* Chapter Breakdown Table + Desktop 60-cell Navigator */}
          <div className="mt-5 grid grid-cols-1 gap-6 border-t border-[#D5E3EC] pt-5 dark:border-[#1E293B] sm:mt-7 sm:pt-7 lg:grid-cols-12 lg:gap-8">
            {/* Detailed Score Breakdown Table by Chapter */}
            <div className="lg:col-span-7">
              <h3 className="mb-3 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] sm:mb-3.5">
                Chi tiết điểm theo từng chương
              </h3>
              <div className="overflow-hidden rounded-xl border border-[#D5E3EC] dark:border-[#334155]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F1F6F9] text-[11px] font-semibold uppercase text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8] sm:text-xs">
                    <tr>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3">Chương</th>
                      <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Đúng / Tổng</th>
                      <th className="w-28 px-3 py-2.5 sm:w-40 sm:px-4 sm:py-3">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E3EC] bg-white dark:divide-[#1E293B] dark:bg-[#0B1120]/60">
                    {subjectMeta.chapters.map(ch => {
                      const stat = breakdown[ch.chapter] ?? { correct: 0, total: 0 };
                      const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                      const barColor =
                        pct >= 80
                          ? 'bg-[#0D9488] dark:bg-[#14B8A6]'
                          : pct >= 50
                            ? 'bg-[#0284C7] dark:bg-[#38BDF8]'
                            : 'bg-[#E11D48] dark:bg-[#FB7185]';

                      return (
                        <tr key={ch.chapter}>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                            <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                              Chương {ch.chapter}
                            </div>
                            <div className="line-clamp-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] sm:text-xs">
                              {ch.title}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-[#1E293B] tabular-nums dark:text-[#E2E8F0] sm:px-4 sm:py-3">
                            {stat.correct}/{stat.total}
                          </td>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-[11px] font-semibold text-[#64748B] tabular-nums dark:text-[#94A3B8] sm:w-9 sm:text-xs">
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
            <div className="hidden lg:col-span-5 lg:block">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                  Bản đồ kết quả {gradedItems.length} câu
                </h3>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
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
                        ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] hover:bg-[#CCFBF1] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF] dark:hover:bg-[#134E4A]/70'
                        : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185] dark:hover:bg-[#4C0519]/80'
                      } ${focusedReviewId === item.question.id ? 'ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#111827]' : ''}`}
                  >
                    {item.index + 1}
                    {item.isFlagged && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#4F46E5] ring-2 ring-white dark:bg-[#818CF8] dark:ring-[#111827]"
                        aria-label="Phân vân"
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[#5EEAD4] bg-[#F0FDFA] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40" />
                  Đúng ({correctTotal})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[#FECDD3] bg-[#FFF1F2] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50" />
                  Sai / Bỏ trống ({wrongCount})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
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
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D5E3EC] bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[#0F172A] shadow-xs transition active:scale-[0.99] dark:border-[#1E293B] dark:bg-[#111827] dark:text-[#F8FAFC]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
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
              <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] dark:text-[#94A3B8]" />
            </button>
          </div>

          {/* Desktop Review Filter Tabs */}
          <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <div className="inline-flex rounded-xl border border-[#D5E3EC] bg-white p-1 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
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
                        ? 'bg-[#0284C7] text-white shadow-xs hover:bg-[#0369A1]'
                        : 'text-[#1E293B] hover:bg-[#E0F2FE] hover:text-[#0284C7] dark:text-[#E2E8F0] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]'
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active
                          ? 'bg-white/20 text-white'
                          : 'bg-[#F1F6F9] text-[#64748B] dark:bg-[#0B1120] dark:text-[#94A3B8]'
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
            <div className="rounded-2xl border border-[#D5E3EC] bg-white p-8 text-center shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-10">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#0D9488] dark:text-[#14B8A6]" />
              <p className="mt-3 text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
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
                    className={`rounded-2xl border bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] transition dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-7 lg:p-8 ${isHighlighted
                        ? 'border-[#0284C7] ring-2 ring-[#0284C7]/20 dark:border-[#38BDF8] dark:ring-[#38BDF8]/25'
                        : 'border-[#D5E3EC] dark:border-[#1E293B]'
                      }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5E3EC] pb-3 dark:border-[#1E293B] sm:pb-4">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums dark:border dark:border-[#38BDF8]/50 sm:py-1">
                          Câu {index + 1}
                        </span>
                        <span className="rounded-lg border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] sm:py-1 sm:text-xs">
                          Chương {q.chapter}
                          <span className="hidden sm:inline">: {q.chapterTitle}</span>
                        </span>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-0.5 text-[11px] font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF] sm:py-1 sm:text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#0D9488] dark:text-[#14B8A6]" />
                            Đúng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185] sm:py-1 sm:text-xs">
                            <XCircle className="h-3.5 w-3.5 text-[#E11D48] dark:text-[#FB7185]" />
                            {isSkipped ? 'Bỏ trống' : 'Sai'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleFlag(q.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition sm:px-3 ${isFlagged
                            ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                            : 'border-[#D5E3EC] bg-white text-[#64748B] hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#94A3B8] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#1E1B4B]/60 dark:hover:text-[#818CF8]'
                          }`}
                      >
                        <Flag
                          className={`h-3.5 w-3.5 ${
                            isFlagged
                              ? 'fill-[#4F46E5] text-[#4F46E5] dark:fill-[#818CF8] dark:text-[#818CF8]'
                              : ''
                          }`}
                        />
                        <span>Phân vân</span>
                      </button>
                    </div>

                    <h4 className="mt-3.5 text-[17px] font-semibold leading-[1.6] text-[#0F172A] dark:text-[#F8FAFC] sm:mt-5 sm:text-[19px] sm:leading-[1.65]">
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
                          'border-[#D5E3EC] bg-white text-[#1E293B] dark:border-[#334155] dark:bg-[#1E293B]/45 dark:text-[#E2E8F0]';
                        let badgeStyle =
                          'border-[#D5E3EC] bg-[#F1F6F9] text-[#1E293B] dark:border-[#475569] dark:bg-[#0B1120] dark:text-[#E2E8F0]';

                        if (isCorrectOpt) {
                          rowStyle =
                            'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#CCFBF1]';
                          badgeStyle =
                            'border-[#0D9488] bg-[#0D9488] text-white dark:border-[#14B8A6] dark:bg-[#14B8A6] dark:text-[#0B1120]';
                        } else if (isUserSelected) {
                          rowStyle =
                            'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]';
                          badgeStyle =
                            'border-[#E11D48] bg-[#E11D48] text-white dark:border-[#FB7185] dark:bg-[#FB7185] dark:text-[#0B1120]';
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
                                        ? 'border-[#5EEAD4] bg-[#CCFBF1] text-[#115E59] dark:border-[#2DD4BF]/60 dark:bg-[#134E4A]/70 dark:text-[#5EEAD4]'
                                        : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/50 dark:bg-[#4C0519]/60 dark:text-[#FB7185]'
                                      }`}
                                  >
                                    Bạn chọn
                                  </span>
                                )}
                                {isCorrectOpt && (
                                  <span className="rounded-md border border-[#5EEAD4] bg-[#CCFBF1] px-2 py-0.5 text-[#115E59] dark:border-[#2DD4BF]/60 dark:bg-[#134E4A]/70 dark:text-[#5EEAD4]">
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
              className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px] dark:bg-[#0B1120]/75 lg:hidden"
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
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D5E3EC] bg-white shadow-2xl dark:border-[#1E293B] dark:bg-[#111827] lg:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D5E3EC] px-4 pb-3 pt-2.5 dark:border-[#1E293B]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D5E3EC] dark:bg-[#334155]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                      Bản đồ kết quả {gradedItems.length} câu
                    </h3>
                    <p className="text-xs text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                      Đúng {correctTotal} • Sai {wrongCount} • Phân vân {flaggedInExamCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileResultsSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] p-1.5 text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#E2E8F0]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-4">
                {/* 3 Filter Tabs */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
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
                              ? 'border-[#0284C7] bg-[#0284C7] text-white'
                              : 'border-[#D5E3EC] bg-[#F8FAFC] text-[#1E293B] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0]'
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
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
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
                            ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                            : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]'
                          } ${focusedReviewId === item.question.id ? 'ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#111827]' : ''}`}
                      >
                        {item.index + 1}
                        {item.isFlagged && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#4F46E5] ring-2 ring-white dark:bg-[#818CF8] dark:ring-[#111827]"
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
