import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  History,
  ListChecks,
  Play,
  RotateCcw,
  Send,
  Timer,
  TimerOff,
  XCircle,
} from 'lucide-react';
import { getQuestionsBySubject, isAnswerCorrect, SUBJECTS } from '../data';
import { ExamHistoryItem, QuestionItem, SubjectId, UserProgressStore } from '../types/quiz';
import { RichExplanation } from './RichExplanation';

interface MockExamViewProps {
  subject: SubjectId;
  progress: UserProgressStore;
  onSaveExamResult: (result: ExamHistoryItem) => void;
  onRecordAttempt: (qId: string, isCorrect: boolean) => void;
  onToggleFlag: (qId: string) => void;
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
}) => {
  const subjectMeta = SUBJECTS[subject];

  const [phase, setPhase] = useState<ExamPhase>('lobby');
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

  const submittedRef = useRef<boolean>(false);

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
  }, [subject]);

  const subjectHistory = useMemo(
    () => progress.examHistory.filter(item => item.subject === subject),
    [progress.examHistory, subject]
  );

  const startNewExam = useCallback(() => {
    const generated = generateMockExam(subject);
    submittedRef.current = false;
    setExamQuestions(generated);
    setAnswers({});
    setCurrentIndex(0);
    setRemainingSeconds(EXAM_DURATION_SECONDS);
    setElapsedSeconds(0);
    setConfirmSubmitOpen(false);
    setLastResult(null);
    setFocusedReviewId(null);
    setPhase('active');
  }, [subject]);

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

      if (selected.length > 0) {
        onRecordAttempt(q.id, correct);
      }
    }

    const totalQuestions = examQuestions.length;
    const scoreOn10 = Math.round((correctCount / totalQuestions) * 100) / 10;

    const result: ExamHistoryItem = {
      id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subject,
      timestamp: Date.now(),
      totalQuestions,
      correctCount,
      scoreOn10,
      durationSeconds: elapsedSeconds,
      chapterBreakdown,
    };

    onSaveExamResult(result);
    setLastResult(result);
    setReviewFilter(correctCount < totalQuestions ? 'wrong' : 'all');
    setPhase('results');
  }, [
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

  // =========================
  // PHASE 1: PRE-EXAM LOBBY
  // =========================
  if (phase === 'lobby') {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Exam Setup Card */}
          <section className="lg:col-span-7 rounded-2xl border border-[#D5E3EC] bg-white p-8 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5E3EC] pb-5 dark:border-[#1E293B]">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-3 py-1 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  <ListChecks className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                  Đề thi thử {subjectMeta.examTotal} câu
                </span>
                <h2 className="mt-2.5 text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Thi thử trộn đề — {subjectMeta.code}
                </h2>
                <p className="mt-0.5 text-sm text-[#64748B] dark:text-[#94A3B8]">{subjectMeta.name}</p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] px-3.5 py-2 text-xs font-medium text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0]">
                <Clock className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
                <span className="tabular-nums">Thời lượng chuẩn: 60 phút</span>
              </div>
            </div>

            {/* Chapter Quota Matrix */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                <span>Cấu trúc phân bổ câu hỏi theo chương</span>
                <span className="tabular-nums text-[#0284C7] dark:text-[#38BDF8]">
                  Tổng {subjectMeta.examTotal} câu
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {subjectMeta.chapters.map(ch => {
                  const quota = subjectMeta.examQuotas[ch.chapter] ?? 0;
                  return (
                    <div
                      key={ch.chapter}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9]/70 px-4 py-3 dark:border-[#334155] dark:bg-[#1E293B]/45"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                          Chương {ch.chapter}
                        </div>
                        <div className="truncate text-xs text-[#64748B] dark:text-[#94A3B8]" title={ch.title}>
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

            {/* Timer Toggle + Start Action */}
            <div className="mt-6 flex flex-col gap-4 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9]/70 p-5 dark:border-[#334155] dark:bg-[#0B1120]/70 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setTimerEnabled(prev => !prev)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg text-left transition-colors"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${timerEnabled
                      ? 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/20 dark:text-[#38BDF8]'
                      : 'border-[#D5E3EC] bg-white text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                    }`}
                >
                  {timerEnabled ? <Timer className="h-5 w-5" /> : <TimerOff className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    <span>Đếm ngược 60 phút</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${timerEnabled
                          ? 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                          : 'border-[#D5E3EC] bg-white text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                        }`}
                    >
                      {timerEnabled ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {timerEnabled
                        ? 'Tự động nộp bài khi hết 60:00 (có thể tắt/bật khi đang làm).'
                        : 'Làm bài thoải mái không giới hạn thời gian.'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={startNewExam}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] active:scale-[0.99] dark:border dark:border-[#38BDF8]/50"
              >
                <Play className="h-4 w-4 fill-current" />
                Bắt đầu làm bài
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>• Trộn ngẫu nhiên không trùng câu hỏi</span>
              <span>• Chấm điểm &amp; giải thích sau khi nộp bài</span>
              <span>• Phím tắt: 1-5 / A-E chọn đáp án, Space/Enter qua câu, F phân vân</span>
            </div>
          </section>

          {/* Recent Exam History Card */}
          <section className="lg:col-span-5 flex flex-col rounded-2xl border border-[#D5E3EC] bg-white p-8 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-[#D5E3EC] pb-5 dark:border-[#1E293B]">
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
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  <Award className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Chưa có bài thi thử {subjectMeta.code} nào
                </p>
                <p className="mt-1 max-w-xs text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Hoàn thành một đề thi 60 câu để xem điểm số và phân tích từng chương tại đây.
                </p>
              </div>
            ) : (
              <div className="mt-5 max-h-[380px] space-y-3 overflow-y-auto pr-1">
                {subjectHistory.map(item => {
                  const passed = item.scoreOn10 >= 5;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#D5E3EC] bg-[#F1F6F9]/70 p-4 transition hover:border-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/45 dark:hover:border-[#38BDF8]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums ${passed
                                ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                                : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]'
                              }`}
                          >
                            {item.scoreOn10.toFixed(1)}đ
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                              {item.correctCount}/{item.totalQuestions} câu đúng
                            </div>
                            <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                              {formatDateTimeVi(item.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                          <div className="font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                            {formatClock(item.durationSeconds)}
                          </div>
                          <div>Thời gian làm</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(item.chapterBreakdown)
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
      <div className="space-y-6">
        {/* Sticky Top Bar */}
        <div className="sticky top-28 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5E3EC] bg-white/95 px-5 py-3.5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] backdrop-blur dark:border-[#1E293B] dark:bg-[#111827]/95 dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)]">
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
                    <span className="hidden sm:inline">Tắt đếm ngược</span>
                  </>
                ) : (
                  <>
                    <Timer className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                    <span className="hidden sm:inline">Bật đếm ngược</span>
                  </>
                )}
              </button>
            </div>

            {/* Answered Progress */}
            <div className="flex items-center gap-2.5 border-l border-[#D5E3EC] pl-3 dark:border-[#334155]">
              <span className="text-xs font-semibold text-[#1E293B] tabular-nums dark:text-[#E2E8F0]">
                Đã làm: <span className="text-[#0D9488] dark:text-[#14B8A6]">{answeredCount}</span>/{examQuestions.length} câu
              </span>
              <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#0B1120] sm:block">
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
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Question Card */}
          <div className="lg:col-span-8 rounded-2xl border border-[#D5E3EC] bg-white p-7 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-9">
            {/* Header Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5E3EC] pb-4 dark:border-[#1E293B]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[#0284C7] px-2.5 py-1 text-xs font-bold text-white tabular-nums dark:border dark:border-[#38BDF8]/50">
                  Câu {currentIndex + 1} / {examQuestions.length}
                </span>
                <span className="rounded-lg border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  Chương {currentQuestion.chapter}: {currentQuestion.chapterTitle}
                </span>
                {currentQuestion.isMultiSelect && (
                  <span className="rounded-lg border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-1 text-xs font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                    Chọn nhiều đáp án
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onToggleFlag(currentQuestion.id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isFlagged
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
                <kbd className="ml-0.5 rounded border border-current/25 px-1 font-mono text-[10px]">
                  F
                </kbd>
              </button>
            </div>

            {/* Question Prompt */}
            <h3 className="mt-5 text-[19px] font-semibold leading-[1.65] text-[#0F172A] dark:text-[#F8FAFC] sm:text-[20px]">
              {currentQuestion.question}
            </h3>

            {/* Options List */}
            <div className="mt-6 space-y-3.5">
              {currentQuestion.options.map((opt, optIdx) => {
                const isSelected = selectedKeys.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestion, opt.key)}
                    className={`flex w-full cursor-pointer items-start gap-3.5 rounded-xl border p-4 px-5 text-left transition-all duration-150 ${isSelected
                        ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0F172A] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/25 dark:text-[#F8FAFC] dark:ring-[#38BDF8]'
                        : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:translate-x-1 hover:border-[#0284C7] hover:bg-[#E0F2FE]/60 dark:border-[#334155] dark:bg-[#1E293B]/50 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20'
                      }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition ${isSelected
                          ? 'border-[#0284C7] bg-[#0284C7] text-white dark:border-[#38BDF8]'
                          : 'border-[#D5E3EC] bg-[#F1F6F9] text-[#1E293B] dark:border-[#475569] dark:bg-[#0B1120] dark:text-[#E2E8F0]'
                        }`}
                    >
                      {opt.key}
                    </span>
                    <span className="flex-1 pt-0.5 text-[16px] font-medium leading-relaxed text-[#1E293B] dark:text-[#E2E8F0]">
                      {opt.text}
                    </span>
                    <span className="mt-1 hidden font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] sm:inline-block">
                      {optIdx + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Navigation */}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#D5E3EC] pt-5 dark:border-[#1E293B]">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0284C7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
              >
                <ChevronLeft className="h-4 w-4" />
                Câu trước
              </button>

              <div className="hidden items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8] md:flex">
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

          {/* 60-Cell Navigator Sidebar */}
          <aside className="lg:col-span-4 rounded-2xl border border-[#D5E3EC] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-[#D5E3EC] pb-3.5 dark:border-[#1E293B]">
              <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Bảng câu hỏi (60 câu)
              </h4>
              <span className="text-xs font-medium text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                Còn {unansweredCount} câu trống
              </span>
            </div>

            <div className="mt-4 grid grid-cols-6 gap-2.5 sm:grid-cols-10 lg:grid-cols-6">
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

        {/* Submit Confirmation Modal */}
        {confirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px] dark:bg-[#0B1120]/75">
            <div className="w-full max-w-md rounded-2xl border border-[#D5E3EC] bg-white p-6 shadow-xl dark:border-[#334155] dark:bg-[#111827] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)]">
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
      </div>
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

  return (
    <div className="space-y-8">
      {/* Top Score Summary & Actions */}
      <section className="rounded-2xl border border-[#D5E3EC] bg-white p-7 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border ${scoreOn10 >= 5
                  ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                  : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]'
                }`}
            >
              <span className="text-2xl font-extrabold leading-none tabular-nums">
                {scoreOn10.toFixed(1)}
              </span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                / 10 điểm
              </span>
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                <Award className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                Kết quả thi thử {subjectMeta.code}
              </span>
              <h2 className="mt-1.5 text-xl font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                Đúng {correctTotal}/{totalCount} câu (
                {totalCount > 0 ? Math.round((correctTotal / totalCount) * 100) : 0}%)
              </h2>
              <p className="mt-0.5 text-sm text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                Thời gian hoàn thành: {formatDurationVi(spentSeconds)} ({formatClock(spentSeconds)})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase('lobby')}
              className="cursor-pointer rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#F1F6F9] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
            >
              Về màn hình chính
            </button>
            <button
              type="button"
              onClick={startNewExam}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
            >
              <RotateCcw className="h-4 w-4" />
              Làm đề mới
            </button>
          </div>
        </div>

        {/* Chapter Breakdown Table + 60-cell Navigator */}
        <div className="mt-7 grid grid-cols-1 gap-8 border-t border-[#D5E3EC] pt-7 dark:border-[#1E293B] lg:grid-cols-12">
          {/* Detailed Score Breakdown Table by Chapter */}
          <div className="lg:col-span-7">
            <h3 className="mb-3.5 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Chi tiết điểm theo từng chương
            </h3>
            <div className="overflow-hidden rounded-xl border border-[#D5E3EC] dark:border-[#334155]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F1F6F9] text-xs font-semibold uppercase text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-4 py-3">Chương</th>
                    <th className="px-4 py-3 text-right">Đúng / Tổng</th>
                    <th className="w-40 px-4 py-3">Tỷ lệ</th>
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
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            Chương {ch.chapter}
                          </div>
                          <div className="line-clamp-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {ch.title}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#1E293B] tabular-nums dark:text-[#E2E8F0]">
                          {stat.correct}/{stat.total}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-xs font-semibold text-[#64748B] tabular-nums dark:text-[#94A3B8]">
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

          {/* Results 60-cell Navigator */}
          <div className="lg:col-span-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Bản đồ kết quả 60 câu
              </h3>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Nhấn vào ô để xem chi tiết
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-10 lg:grid-cols-6">
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
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${active
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
          <div className="rounded-2xl border border-[#D5E3EC] bg-white p-10 text-center shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#0D9488] dark:text-[#14B8A6]" />
            <p className="mt-3 text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              {reviewFilter === 'wrong'
                ? 'Tuyệt vời! Bạn không làm sai câu nào trong đề thi này.'
                : 'Không có câu hỏi nào đang được đánh dấu phân vân.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReviewItems.map(({ question: q, index, selected, isCorrect, isFlagged }) => {
              const isHighlighted = focusedReviewId === q.id;
              const isSkipped = selected.length === 0;

              return (
                <article
                  key={q.id}
                  id={`exam-review-q-${q.id}`}
                  className={`rounded-2xl border bg-white p-7 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] transition dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-8 ${isHighlighted
                      ? 'border-[#0284C7] ring-2 ring-[#0284C7]/20 dark:border-[#38BDF8] dark:ring-[#38BDF8]/25'
                      : 'border-[#D5E3EC] dark:border-[#1E293B]'
                    }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5E3EC] pb-4 dark:border-[#1E293B]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-[#0284C7] px-2.5 py-1 text-xs font-bold text-white tabular-nums dark:border dark:border-[#38BDF8]/50">
                        Câu {index + 1}
                      </span>
                      <span className="rounded-lg border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                        Chương {q.chapter}: {q.chapterTitle}
                      </span>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-1 text-xs font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0D9488] dark:text-[#14B8A6]" />
                          Đúng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1 text-xs font-semibold text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]">
                          <XCircle className="h-3.5 w-3.5 text-[#E11D48] dark:text-[#FB7185]" />
                          {isSkipped ? 'Bỏ trống' : 'Sai'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleFlag(q.id)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition ${isFlagged
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

                  <h4 className="mt-5 text-[19px] font-semibold leading-[1.65] text-[#0F172A] dark:text-[#F8FAFC]">
                    {q.question}
                  </h4>

                  <div className="mt-5 space-y-3">
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
                          className={`flex items-start justify-between gap-3 rounded-xl border p-4 px-5 ${rowStyle}`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${badgeStyle}`}
                            >
                              {opt.key}
                            </span>
                            <span className="pt-0.5 text-[16px] font-medium leading-relaxed">
                              {opt.text}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold">
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
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <RichExplanation question={q} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
