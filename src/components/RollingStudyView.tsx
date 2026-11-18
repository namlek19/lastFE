import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Layers,
  Menu,
  Play,
  RotateCcw,
  Trophy,
  X,
} from 'lucide-react';
import { getChaptersBySubject, getQuestionsBySubject, isAnswerCorrect, SUBJECTS } from '../data';
import { QuestionItem, SubjectId, UserProgressStore } from '../types/quiz';
import { getMasteryState, isMastered } from '../utils/storage';
import { RichExplanation } from './RichExplanation';

export interface RollingStudyViewProps {
  subject: SubjectId;
  progress: UserProgressStore;
  onRecordAttempt: (qId: string, isCorrect: boolean, flagged?: boolean) => void;
  onToggleFlag: (qId: string) => void;
  onResetStage?: (questionIds: string[]) => void;
}

interface StageGroup {
  index: number;
  title: string;
  startIndex: number;
  endIndex: number;
  questions: QuestionItem[];
}

interface GradedTurnState {
  isCorrect: boolean;
  nextStreak: number;
}

const STAGE_SIZE = 18;
const MIN_STAGE_SIZE = 15;
const MAX_STAGE_SIZE = 20;

function splitIntoStages(questions: QuestionItem[]): StageGroup[] {
  const total = questions.length;
  if (total === 0) return [];

  if (total <= MAX_STAGE_SIZE) {
    return [
      {
        index: 0,
        title: 'Chặng 1',
        startIndex: 1,
        endIndex: total,
        questions,
      },
    ];
  }

  const minStages = Math.ceil(total / MAX_STAGE_SIZE);
  const maxStages = Math.max(minStages, Math.floor(total / MIN_STAGE_SIZE));
  const idealStages = Math.round(total / STAGE_SIZE);
  const stageCount = Math.min(maxStages, Math.max(minStages, idealStages));

  const baseSize = Math.floor(total / stageCount);
  const remainder = total % stageCount;

  const stages: StageGroup[] = [];
  let cursor = 0;

  for (let i = 0; i < stageCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const slice = questions.slice(cursor, cursor + size);
    stages.push({
      index: i,
      title: `Chặng ${i + 1}`,
      startIndex: cursor + 1,
      endIndex: cursor + size,
      questions: slice,
    });
    cursor += size;
  }

  return stages;
}

function getStageStats(questions: QuestionItem[], progress: UserProgressStore) {
  let mastered = 0;
  let hesitant = 0;
  let unlearned = 0;

  for (const q of questions) {
    const state = getMasteryState(progress.questions[q.id]);
    if (state === 'mastered') mastered += 1;
    else if (state === 'hesitant') hesitant += 1;
    else unlearned += 1;
  }

  const total = questions.length;
  const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return { mastered, hesitant, unlearned, total, percent };
}

export const RollingStudyView: React.FC<RollingStudyViewProps> = ({
  subject,
  progress,
  onRecordAttempt,
  onToggleFlag,
  onResetStage,
}) => {
  const subjectMeta = SUBJECTS[subject];
  const chapters = useMemo(() => getChaptersBySubject(subject), [subject]);
  const allSubjectQuestions = useMemo(() => getQuestionsBySubject(subject), [subject]);

  const [selectedChapter, setSelectedChapter] = useState<number>(() => chapters[0]?.chapter ?? 1);
  const [activeStageIndex, setActiveStageIndex] = useState<number | null>(null);
  const [queue, setQueue] = useState<QuestionItem[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [gradedState, setGradedState] = useState<GradedTurnState | null>(null);
  const [turnFlagged, setTurnFlagged] = useState<boolean>(false);
  const [turnCounter, setTurnCounter] = useState<number>(0);
  const [isChapterSheetOpen, setIsChapterSheetOpen] = useState<boolean>(false);
  const [isStageSheetOpen, setIsStageSheetOpen] = useState<boolean>(false);

  const explanationRef = useRef<HTMLDivElement>(null);

  const scrollToExplanationOnMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      window.setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 90);
    }
  }, []);

  // Reset chapter & active session when switching subjects
  useEffect(() => {
    setSelectedChapter(chapters[0]?.chapter ?? 1);
    setActiveStageIndex(null);
    setQueue([]);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnFlagged(false);
    setIsChapterSheetOpen(false);
    setIsStageSheetOpen(false);
  }, [subject, chapters]);

  const chapterQuestions = useMemo(
    () => allSubjectQuestions.filter(q => q.chapter === selectedChapter),
    [allSubjectQuestions, selectedChapter]
  );

  const stages = useMemo(() => splitIntoStages(chapterQuestions), [chapterQuestions]);

  const chapterStats = useMemo(
    () => getStageStats(chapterQuestions, progress),
    [chapterQuestions, progress]
  );

  const currentChapterMeta = useMemo(
    () => chapters.find(c => c.chapter === selectedChapter),
    [chapters, selectedChapter]
  );

  const activeStage = activeStageIndex !== null ? stages[activeStageIndex] ?? null : null;
  const currentQuestion = queue[0] ?? null;

  // Sync turnFlagged whenever the head of the queue or turnCounter changes
  useEffect(() => {
    if (currentQuestion) {
      setTurnFlagged(Boolean(progress.questions[currentQuestion.id]?.flagged));
    } else {
      setTurnFlagged(false);
    }
    // Intentionally only reset on new turn/question, not on every progress change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, turnCounter]);

  const startStageSession = useCallback(
    (stageIndex: number, forceAll = false) => {
      const targetStage = stages[stageIndex];
      if (!targetStage) return;

      const initialQueue = forceAll
        ? [...targetStage.questions]
        : targetStage.questions.filter(q => !isMastered(progress.questions[q.id]));

      setActiveStageIndex(stageIndex);
      setQueue(initialQueue);
      setSelectedOptions([]);
      setGradedState(null);
      setTurnCounter(c => c + 1);
      setTurnFlagged(
        initialQueue[0] ? Boolean(progress.questions[initialQueue[0].id]?.flagged) : false
      );
    },
    [stages, progress]
  );

  const handleExitSession = useCallback(() => {
    setActiveStageIndex(null);
    setQueue([]);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnFlagged(false);
  }, []);

  const handleResetAndRestartStage = useCallback(() => {
    if (!activeStage) return;
    if (onResetStage) {
      onResetStage(activeStage.questions.map(q => q.id));
    }
    setQueue([...activeStage.questions]);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnFlagged(false);
    setTurnCounter(c => c + 1);
  }, [activeStage, onResetStage]);

  const gradeSubmission = useCallback(
    (chosenKeys: string[]) => {
      if (!currentQuestion || gradedState !== null || chosenKeys.length === 0) return;

      const isCorrect = isAnswerCorrect(chosenKeys, currentQuestion.correctAnswers);
      const prevProgress = progress.questions[currentQuestion.id];
      const prevStreak = prevProgress?.streak ?? 0;
      const currentFlagged = turnFlagged;
      const nextStreak = isCorrect && !currentFlagged ? prevStreak + 1 : 0;

      setGradedState({ isCorrect, nextStreak });
      onRecordAttempt(currentQuestion.id, isCorrect, currentFlagged);
      scrollToExplanationOnMobile();
    },
    [currentQuestion, gradedState, progress.questions, turnFlagged, onRecordAttempt, scrollToExplanationOnMobile]
  );

  const handleOptionClick = useCallback(
    (key: string) => {
      if (!currentQuestion || gradedState !== null) return;

      if (currentQuestion.isMultiSelect) {
        setSelectedOptions(prev =>
          prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
      } else {
        setSelectedOptions([key]);
        gradeSubmission([key]);
      }
    },
    [currentQuestion, gradedState, gradeSubmission]
  );

  const handleToggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setTurnFlagged(prev => !prev);
    if (gradedState !== null) {
      setGradedState(prev => (prev ? { ...prev, nextStreak: 0 } : prev));
    }
    onToggleFlag(currentQuestion.id);
  }, [currentQuestion, gradedState, onToggleFlag]);

  const handleNext = useCallback(() => {
    if (!currentQuestion || gradedState === null) return;

    const remaining = queue.slice(1);
    const currentFlagged = turnFlagged;
    let nextQueue: QuestionItem[];

    if (!gradedState.isCorrect || currentFlagged) {
      const offset = 3 + Math.floor(Math.random() * 3);
      const insertAt = Math.min(remaining.length, offset);
      nextQueue = [...remaining.slice(0, insertAt), currentQuestion, ...remaining.slice(insertAt)];
    } else if (gradedState.nextStreak < 2) {
      const offset = 4 + Math.floor(Math.random() * 2);
      const insertAt = Math.min(remaining.length, offset);
      nextQueue = [...remaining.slice(0, insertAt), currentQuestion, ...remaining.slice(insertAt)];
    } else {
      nextQueue = remaining;
    }

    setQueue(nextQueue);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnCounter(c => c + 1);
  }, [currentQuestion, gradedState, queue, turnFlagged]);

  // PC Keyboard Shortcuts: 1-5 / A-E, F, Enter / Space
  useEffect(() => {
    if (activeStageIndex === null || !currentQuestion) return;

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

      const key = e.key;

      if (key === 'f' || key === 'F') {
        e.preventDefault();
        handleToggleFlag();
        return;
      }

      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        if (gradedState !== null) {
          handleNext();
        } else if (currentQuestion.isMultiSelect && selectedOptions.length > 0) {
          gradeSubmission(selectedOptions);
        }
        return;
      }

      if (gradedState === null) {
        let optionIndex = -1;
        if (/^[1-5]$/.test(key)) {
          optionIndex = Number(key) - 1;
        } else if (/^[a-eA-E]$/.test(key)) {
          const upper = key.toUpperCase();
          optionIndex = currentQuestion.options.findIndex(o => o.key.toUpperCase() === upper);
        }

        if (optionIndex >= 0 && optionIndex < currentQuestion.options.length) {
          e.preventDefault();
          handleOptionClick(currentQuestion.options[optionIndex].key);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeStageIndex,
    currentQuestion,
    gradedState,
    selectedOptions,
    handleOptionClick,
    handleToggleFlag,
    handleNext,
    gradeSubmission,
  ]);

  // Active Practice Session View
  if (activeStage !== null) {
    const stageStats = getStageStats(activeStage.questions, progress);
    const hasNextStage = activeStage.index + 1 < stages.length;

    return (
      <>
        <div className="mx-auto max-w-3xl space-y-3 md:space-y-6">
          {/* Mobile Compact 1-Line Session Toolbar (< 768px) */}
          <div className="flex items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setIsStageSheetOpen(true)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-semibold text-[#0B1324] shadow-xs transition active:scale-[0.99] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
                <span className="truncate tabular-nums">
                  C{selectedChapter} • {activeStage.title} ({stageStats.percent}%)
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#5B6E88] dark:text-[#7E91B0]" />
            </button>

            {currentQuestion ? (
              <span className="shrink-0 rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-2 text-xs font-semibold text-[#0369A1] tabular-nums dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                Còn {queue.length}
              </span>
            ) : (
              <span className="shrink-0 rounded-xl border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-2 text-xs font-semibold text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                Xong
              </span>
            )}
          </div>

          {/* Desktop Session Header (>= 768px) */}
          <div className="hidden rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] p-5 shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none md:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleExitSession}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D4E1EE] bg-white px-3.5 py-1.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A] dark:hover:text-[#38BDF8]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Danh sách chặng</span>
              </button>

              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1324] dark:text-[#F8FAFC]">
                <span className="rounded-md border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  Chương {selectedChapter}
                </span>
                <span>{activeStage.title}</span>
                <span className="text-[#5B6E88] dark:text-[#7E91B0]">·</span>
                <span className="font-normal text-[#5B6E88] tabular-nums dark:text-[#7E91B0]">
                  {activeStage.questions.length} câu
                </span>
              </div>

              {currentQuestion ? (
                <div className="rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-3 py-1 text-xs font-semibold text-[#0369A1] tabular-nums dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  Còn {queue.length} câu
                </div>
              ) : (
                <div className="rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-3 py-1 text-xs font-semibold text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                  Hoàn thành
                </div>
              )}
            </div>

            {/* Stage mastery progress bar */}
            <div className="mt-3.5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[#5B6E88] dark:text-[#7E91B0]">
                <span>Tiến độ chặng</span>
                <span className="font-semibold text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                  Đã thuộc {stageStats.mastered}/{stageStats.total} ({stageStats.percent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#D4E1EE] dark:bg-[#070B14]">
                <div
                  className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                  style={{ width: `${stageStats.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stage Completion Card */}
          {!currentQuestion ? (
            <div className="rounded-2xl border border-[#BBD0E6] border-t-2 border-t-[#0D9488] bg-white p-5 text-center shadow-[0_12px_30px_-8px_rgba(3,105,161,0.12)] dark:border-[#253759] dark:border-t-2 dark:border-t-[#14B8A6] dark:bg-[#111B2E] dark:shadow-[0_12px_32px_-8px_rgba(2,132,199,0.18)] sm:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF] sm:h-16 sm:w-16">
                <Trophy className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-xl font-bold text-[#0B1324] dark:text-[#F8FAFC] sm:text-2xl">
                Hoàn thành chặng!
              </h2>
              <p className="mt-2 text-sm text-[#5B6E88] dark:text-[#7E91B0]">
                Bạn đã hoàn thành {activeStage.title} (Chương {selectedChapter} —{' '}
                {activeStage.questions.length} câu hỏi).
              </p>

              <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-xl border border-[#5EEAD4] bg-[#E6F7F5] p-3 dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15">
                  <div className="text-lg font-bold text-[#0F766E] tabular-nums dark:text-[#2DD4BF]">
                    {stageStats.mastered}
                  </div>
                  <div className="text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF]">
                    Đã thuộc
                  </div>
                </div>
                <div className="rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] p-3 dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15">
                  <div className="text-lg font-bold text-[#4338CA] tabular-nums dark:text-[#A5B4FC]">
                    {stageStats.hesitant}
                  </div>
                  <div className="text-xs font-medium text-[#4338CA] dark:text-[#A5B4FC]">
                    Phân vân
                  </div>
                </div>
                <div className="rounded-xl border border-[#D4E1EE] bg-[#EAF1F8] p-3 dark:border-[#18243C] dark:bg-[#18243C]">
                  <div className="text-lg font-bold text-[#0B1324] tabular-nums dark:text-[#F8FAFC]">
                    {stageStats.unlearned}
                  </div>
                  <div className="text-xs font-medium text-[#5B6E88] dark:text-[#7E91B0]">
                    Chưa thuộc
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                {hasNextStage && (
                  <button
                    type="button"
                    onClick={() => startStageSession(activeStage.index + 1)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0369A1] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0284C7] dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
                  >
                    <span>Sang Chặng {activeStage.index + 2}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => startStageSession(activeStage.index, true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] px-4 py-2.5 text-sm font-semibold text-[#0369A1] transition hover:bg-[#BAE6FD]/70 dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] dark:hover:bg-[#0284C7]/25"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Ôn tập lại chặng này</span>
                </button>

                {onResetStage && (
                  <button
                    type="button"
                    onClick={handleResetAndRestartStage}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]"
                  >
                    <span>Học lại chặng</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExitSession}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-[#5B6E88] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#7E91B0] dark:hover:border-[#38BDF8] dark:hover:text-[#F8FAFC]"
                >
                  <span>Quay lại danh sách</span>
                </button>
              </div>
            </div>
          ) : (
            /* Question Card */
            <div
              key={`${currentQuestion.id}-${turnCounter}`}
              className="rounded-2xl border border-[#BBD0E6] border-t-2 border-t-[#0284C7] bg-white p-4 shadow-[0_12px_30px_-8px_rgba(3,105,161,0.12)] dark:border-[#253759] dark:border-t-2 dark:border-t-[#38BDF8] dark:bg-[#111B2E] dark:shadow-[0_12px_32px_-8px_rgba(2,132,199,0.18)] sm:p-7 md:p-8"
            >
              {/* Card top badges + Desktop Phân vân toggle */}
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#D4E1EE] pb-3 dark:border-[#18243C] sm:mb-5 sm:pb-4">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {(() => {
                    const qProg = progress.questions[currentQuestion.id];
                    const effectiveStreak =
                      gradedState !== null ? gradedState.nextStreak : (qProg?.streak ?? 0);
                    const isWrongState =
                      gradedState !== null ? !gradedState.isCorrect : qProg?.lastResult === 'wrong';

                    if (turnFlagged) {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC] sm:py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#4338CA] dark:bg-[#A5B4FC]" />
                          Phân vân
                        </span>
                      );
                    }
                    if (effectiveStreak >= 2) {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF] sm:py-1">
                          <span>✓ Đã thuộc (2/2)</span>
                          <span className="tracking-tighter opacity-90" aria-hidden="true">
                            ●●
                          </span>
                        </span>
                      );
                    }
                    if (effectiveStreak === 1) {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] sm:py-1">
                          <span>✓ Đúng 1/2 lần</span>
                          <span className="tracking-tighter opacity-90" aria-hidden="true">
                            ●○
                          </span>
                        </span>
                      );
                    }
                    if (isWrongState) {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#E11D48] dark:border-[#FB7185]/50 dark:bg-[#F43F5E]/15 dark:text-[#FDA4AF] sm:py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48] dark:bg-[#FDA4AF]" />
                          Đã trả lời sai
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF1F8] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#5B6E88] dark:bg-[#18243C] dark:text-[#7E91B0] sm:py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#5B6E88] dark:bg-[#7E91B0]" />
                        Chưa thuộc
                      </span>
                    );
                  })()}

                  {currentQuestion.isMultiSelect && (
                    <span className="inline-flex items-center rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] sm:py-1 sm:text-xs">
                      Chọn nhiều đáp án
                    </span>
                  )}
                </div>

                {/* Desktop Flag Button */}
                <button
                  type="button"
                  onClick={handleToggleFlag}
                  aria-pressed={turnFlagged}
                  className={`hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition md:inline-flex ${
                    turnFlagged
                      ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#4338CA] shadow-xs dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]'
                      : 'border-[#D4E1EE] bg-[#F8FAFC] text-[#5B6E88] hover:border-[#A5B4FC] hover:bg-[#EEF2FF] hover:text-[#4338CA] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#7E91B0] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#6366F1]/15 dark:hover:text-[#A5B4FC]'
                  }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      turnFlagged
                        ? 'fill-[#4338CA] text-[#4338CA] dark:fill-[#A5B4FC] dark:text-[#A5B4FC]'
                        : 'text-[#5B6E88] dark:text-[#7E91B0]'
                    }`}
                  />
                  <span>Phân vân</span>
                  <kbd
                    className={`ml-0.5 hidden rounded px-1 py-0.5 font-mono text-[10px] md:inline-block ${
                      turnFlagged
                        ? 'border border-[#A5B4FC] bg-white text-[#4338CA] dark:border-[#818CF8]/40 dark:bg-[#070B14] dark:text-[#A5B4FC]'
                        : 'border border-[#D4E1EE] bg-white text-[#5B6E88] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#7E91B0]'
                    }`}
                  >
                    F
                  </kbd>
                </button>
              </div>

              {/* Question Text */}
              <h3 className="text-[17px] font-semibold leading-[1.6] text-[#0B1324] dark:text-[#F8FAFC] sm:text-[19px] sm:leading-[1.65] md:text-[20px]">
                {currentQuestion.question}
              </h3>

              {/* Options */}
              <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3.5">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOptions.includes(opt.key);
                  const isCorrectOption = currentQuestion.correctAnswers
                    .map(c => c.toUpperCase())
                    .includes(opt.key.toUpperCase());
                  const isGraded = gradedState !== null;

                  let containerCls =
                    'border-[#C7D8EA] bg-[#F4F8FC] text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] md:hover:translate-x-1 dark:border-[#2B4066] dark:bg-[#162238] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]';
                  let badgeCls =
                    'border-[#C7D8EA] bg-white text-[#1E293B] group-hover:border-[#0284C7] group-hover:bg-[#0284C7] group-hover:text-white dark:border-[#2B4066] dark:bg-[#0C1322] dark:text-[#E2E8F0] dark:group-hover:border-[#38BDF8] dark:group-hover:bg-[#0284C7] dark:group-hover:text-white';

                  if (!isGraded && isSelected) {
                    containerCls =
                      'border-[#0284C7] bg-[#E0F2FE] text-[#0B1324] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#F8FAFC] dark:ring-[#38BDF8]';
                    badgeCls = 'border-[#0369A1] bg-[#0369A1] text-white dark:border-[#38BDF8] dark:bg-[#0284C7]';
                  } else if (isGraded) {
                    if (isCorrectOption) {
                      containerCls =
                        'border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]';
                      badgeCls =
                        'border-[#0D9488] bg-[#0D9488] text-white dark:border-[#14B8A6] dark:bg-[#14B8A6] dark:text-[#070B14]';
                    } else if (isSelected && !isCorrectOption) {
                      containerCls =
                        'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/50 dark:bg-[#F43F5E]/15 dark:text-[#FDA4AF]';
                      badgeCls =
                        'border-[#E11D48] bg-[#E11D48] text-white dark:border-[#FB7185] dark:bg-[#FB7185] dark:text-[#070B14]';
                    } else {
                      containerCls =
                        'border-[#D4E1EE] bg-[#F8FAFC] text-[#5B6E88] dark:border-[#18243C] dark:bg-[#0C1322]/70 dark:text-[#7E91B0]';
                      badgeCls =
                        'border-[#D4E1EE] bg-[#EAF1F8] text-[#5B6E88] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#7E91B0]';
                    }
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isGraded}
                      onClick={() => handleOptionClick(opt.key)}
                      className={`group flex w-full items-start gap-3 rounded-xl border p-3 px-3.5 text-left transition-all duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${containerCls} ${
                        isGraded ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition sm:h-7 sm:w-7 ${badgeCls}`}
                      >
                        {opt.key}
                      </span>

                      <span className="flex-1 pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                        {opt.text}
                      </span>

                      <span className="mt-1 flex shrink-0 items-center gap-1.5">
                        {!isGraded && (
                          <kbd className="hidden rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#5B6E88] dark:border-[#2B4066] dark:bg-[#0C1322] dark:text-[#7E91B0] md:inline-block">
                            {idx + 1}
                          </kbd>
                        )}
                        {isGraded && isCorrectOption && (
                          <Check className="h-4 w-4 text-[#0D9488] dark:text-[#2DD4BF]" />
                        )}
                        {isGraded && isSelected && !isCorrectOption && (
                          <X className="h-4 w-4 text-[#E11D48] dark:text-[#FDA4AF]" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop Multi-select submit button */}
              {gradedState === null && currentQuestion.isMultiSelect && (
                <div className="mt-5 hidden items-center justify-end md:flex">
                  <button
                    type="button"
                    disabled={selectedOptions.length === 0}
                    onClick={() => gradeSubmission(selectedOptions)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0369A1] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:bg-[#EAF1F8] disabled:text-[#5B6E88] dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1] dark:disabled:border-[#18243C] dark:disabled:bg-[#18243C] dark:disabled:text-[#7E91B0]"
                  >
                    <span>Kiểm tra đáp án</span>
                    <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-100 md:inline-block">
                      Enter
                    </kbd>
                  </button>
                </div>
              )}

              {/* Graded feedback & explanation with auto-scroll target */}
              {gradedState !== null && (
                <div
                  ref={explanationRef}
                  className="mt-5 scroll-mt-4 scroll-mb-24 space-y-4 border-t border-[#D4E1EE] pt-4 dark:border-[#18243C] sm:mt-6 sm:space-y-5 sm:pt-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold sm:px-3.5 sm:text-sm ${
                        gradedState.isCorrect
                          ? 'border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]'
                          : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/50 dark:bg-[#F43F5E]/15 dark:text-[#FDA4AF]'
                      }`}
                    >
                      {gradedState.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-[#0D9488] dark:text-[#2DD4BF]" />
                          <span>
                            Chính xác!{' '}
                            {!turnFlagged && gradedState.nextStreak >= 2
                              ? '• ✓ Đã thuộc (2/2) ●●'
                              : !turnFlagged && gradedState.nextStreak === 1
                                ? '• ✓ Đúng 1/2 lần ●○'
                                : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-[#E11D48] dark:text-[#FDA4AF]" />
                          <span>
                            Chưa đúng · Đáp án đúng:{' '}
                            {currentQuestion.correctAnswers.join(', ')}
                          </span>
                        </>
                      )}
                    </div>

                    {turnFlagged && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]">
                        <Flag className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#A5B4FC]" />
                        Đang đánh dấu phân vân
                      </span>
                    )}
                  </div>

                  <RichExplanation question={currentQuestion} />

                  <div className="hidden justify-end md:flex">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0369A1] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0284C7] dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
                    >
                      <span>Câu tiếp theo</span>
                      <ArrowRight className="h-4 w-4" />
                      <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-100 md:inline-block">
                        Enter
                      </kbd>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop Keyboard shortcuts hint */}
          {currentQuestion && (
            <div className="hidden items-center justify-center gap-4 text-xs text-[#5B6E88] dark:text-[#7E91B0] md:flex">
              <span>
                <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0]">
                  1-4
                </kbd>{' '}
                hoặc{' '}
                <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0]">
                  A-D
                </kbd>{' '}
                chọn đáp án
              </span>
              <span>·</span>
              <span>
                <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0]">
                  F
                </kbd>{' '}
                Phân vân
              </span>
              <span>·</span>
              <span>
                <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0]">
                  Enter
                </kbd>{' '}
                /{' '}
                <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0]">
                  Space
                </kbd>{' '}
                tiếp tục
              </span>
            </div>
          )}
        </div>

        {/* Mobile Sticky Bottom Action Bar */}
        {currentQuestion && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D4E1EE] bg-[#F8FAFC]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#18243C] dark:bg-[#0C1322]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.5)] md:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitSession}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D4E1EE] bg-white px-3 py-2.5 text-xs font-semibold text-[#1E293B] transition dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Chặng</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFlag}
                aria-pressed={turnFlagged}
                className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  turnFlagged
                    ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]'
                    : 'border-[#D4E1EE] bg-white text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#7E91B0]'
                }`}
              >
                <Flag className={`h-3.5 w-3.5 ${turnFlagged ? 'fill-current' : ''}`} />
                <span>Phân vân</span>
              </button>

              {gradedState === null && currentQuestion.isMultiSelect ? (
                <button
                  type="button"
                  disabled={selectedOptions.length === 0}
                  onClick={() => gradeSubmission(selectedOptions)}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0369A1] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
                >
                  <Check className="h-4 w-4" />
                  <span>Kiểm tra ({selectedOptions.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={gradedState === null}
                  onClick={handleNext}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0369A1] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Stage Switcher Bottom Sheet */}
        <AnimatePresence>
          {isStageSheetOpen && (
            <>
              <motion.div
                key="rolling-stage-sheet-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setIsStageSheetOpen(false)}
                className="fixed inset-0 z-50 bg-[#0B1324]/50 backdrop-blur-[2px] dark:bg-[#070B14]/75 md:hidden"
              />
              <motion.div
                key="rolling-stage-sheet-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Danh sách chặng học"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 360 }}
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[#D4E1EE] bg-[#F8FAFC] shadow-2xl dark:border-[#18243C] dark:bg-[#0C1322] md:hidden"
              >
                <div className="flex flex-col items-center border-b border-[#D4E1EE] px-4 pb-3 pt-2.5 dark:border-[#18243C]">
                  <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D4E1EE] dark:bg-[#253759]" />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                        Chương {selectedChapter} • Chọn chặng
                      </h3>
                      <p className="text-xs text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                        {chapterStats.mastered}/{chapterStats.total} câu đã thuộc ({chapterStats.percent}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStageSheetOpen(false)}
                      aria-label="Đóng ngăn kéo"
                      className="cursor-pointer rounded-xl border border-[#D4E1EE] bg-white p-1.5 text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 overflow-y-auto px-4 pb-6 pt-4">
                  {stages.map(stage => {
                    const stats = getStageStats(stage.questions, progress);
                    const isCurrentStage = stage.index === activeStage.index;
                    return (
                      <button
                        key={stage.index}
                        type="button"
                        onClick={() => {
                          startStageSession(stage.index);
                          setIsStageSheetOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                          isCurrentStage
                            ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#F8FAFC]'
                            : 'border-[#D4E1EE] bg-white text-[#1E293B] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">
                            {stage.title} · Câu {stage.startIndex}–{stage.endIndex}
                          </div>
                          <div className="text-[11px] text-[#5B6E88] tabular-nums dark:text-[#7E91B0]">
                            Thuộc {stats.mastered}/{stats.total} · Phân vân {stats.hesitant}
                          </div>
                        </div>
                        <span className="rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-bold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                          {stats.percent}%
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setIsStageSheetOpen(false);
                      handleExitSession();
                    }}
                    className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D4E1EE] bg-white px-4 py-2.5 text-xs font-semibold text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Về tổng quan danh sách chương</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Chapter & Stage Overview
  return (
    <>
      <div>
        {/* Header Banner */}
        <div className="mb-5 rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] p-4 shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none sm:p-6 md:mb-8 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] sm:h-11 sm:w-11">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#0B1324] dark:text-[#F8FAFC] sm:text-xl">
                  Học cuốn chiếu
                </h2>
                <span className="rounded-md border border-[#7DD3FC] bg-[#E0F2FE] px-2 py-0.5 text-xs font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  {subjectMeta.code}
                </span>
              </div>
            </div>

            <div className="hidden items-center gap-4 text-sm sm:flex">
              <div className="text-right">
                <div className="text-xs text-[#5B6E88] dark:text-[#7E91B0]">Tiến độ chương đang chọn</div>
                <div className="font-bold text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                  {chapterStats.mastered}/{chapterStats.total} câu đã thuộc ({chapterStats.percent}%)
                </div>
              </div>
            </div>
          </div>

          {/* Mobile 1-Line Chapter Picker Button (< 768px) */}
          <div className="mt-4 md:hidden">
            <button
              type="button"
              onClick={() => setIsChapterSheetOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D4E1EE] bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#F8FAFC]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
                <span className="truncate">
                  Chương {selectedChapter}: {currentChapterMeta?.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2 py-0.5 text-[11px] font-bold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                  {chapterStats.percent}%
                </span>
                <ChevronDown className="h-4 w-4 text-[#5B6E88] dark:text-[#7E91B0]" />
              </span>
            </button>
          </div>

          {/* Desktop Chapter Selector (>= 768px) */}
          <div className="mt-5 hidden flex-wrap gap-2.5 md:flex">
            {chapters.map(ch => {
              const isSelected = ch.chapter === selectedChapter;
              const chQuestions = allSubjectQuestions.filter(q => q.chapter === ch.chapter);
              const stats = getStageStats(chQuestions, progress);

              return (
                <button
                  key={ch.chapter}
                  type="button"
                  onClick={() => setSelectedChapter(ch.chapter)}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'border-[#0369A1] bg-[#0369A1] text-white shadow-sm hover:bg-[#0284C7] dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]'
                      : 'border-[#D4E1EE] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]'
                  }`}
                >
                  <span className="font-semibold">Chương {ch.chapter}</span>
                  <span className="rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2 py-0.5 text-xs font-semibold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#070B14]/85 dark:text-[#2DD4BF]">
                    {stats.percent}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Overall Chapter Progress Bar */}
          {currentChapterMeta && (
            <div className="mt-3.5 rounded-xl border border-[#D4E1EE] bg-white p-3.5 dark:border-[#18243C] dark:bg-[#111B2E] sm:mt-5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="hidden text-sm font-semibold text-[#0369A1] dark:text-[#38BDF8] md:block">
                  Chương {currentChapterMeta.chapter}: {currentChapterMeta.title}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                  <span className="inline-flex items-center gap-1.5 text-[#0F766E] tabular-nums dark:text-[#2DD4BF]">
                    <span className="h-2 w-2 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
                    Đã thuộc: {chapterStats.mastered}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#4338CA] tabular-nums dark:text-[#A5B4FC]">
                    <span className="h-2 w-2 rounded-full bg-[#4338CA] dark:bg-[#A5B4FC]" />
                    Phân vân: {chapterStats.hesitant}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#5B6E88] tabular-nums dark:text-[#7E91B0]">
                    <span className="h-2 w-2 rounded-full bg-[#5B6E88] dark:bg-[#7E91B0]" />
                    Chưa thuộc: {chapterStats.unlearned}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#D4E1EE] dark:bg-[#070B14] sm:mt-3 sm:h-2.5">
                <div
                  className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                  style={{ width: `${chapterStats.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stage Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {stages.map(stage => {
            const stats = getStageStats(stage.questions, progress);
            const isCompleted = stats.mastered === stats.total && stats.total > 0;

            return (
              <button
                key={stage.index}
                type="button"
                onClick={() => startStageSession(stage.index)}
                className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-[#F8FAFC] p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#0C1322] dark:shadow-none sm:p-6 ${
                  isCompleted
                    ? 'border-[#5EEAD4] hover:border-[#0D9488] dark:border-[#14B8A6]/60 dark:hover:border-[#2DD4BF]'
                    : 'border-[#D4E1EE] hover:border-[#0284C7] dark:border-[#18243C] dark:hover:border-[#38BDF8]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${
                          isCompleted
                            ? 'border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]'
                            : 'border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                        }`}
                      >
                        {stage.index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-[#0B1324] dark:text-[#F8FAFC]">{stage.title}</div>
                        <div className="text-xs text-[#5B6E88] tabular-nums dark:text-[#7E91B0]">
                          {stage.questions.length} câu · Câu {stage.startIndex}–{stage.endIndex}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-bold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                      {stats.percent}%
                    </span>
                  </div>

                  {/* Stage progress bar */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-[#5B6E88] dark:text-[#7E91B0]">
                      <span>Đã thuộc</span>
                      <span className="font-semibold text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                        {stats.mastered}/{stats.total}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#D4E1EE] dark:bg-[#070B14]">
                      <div
                        className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* 3 Status counts */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-[#5EEAD4] bg-[#E6F7F5] px-2 py-1.5 text-center dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15">
                      <div className="text-sm font-bold text-[#0F766E] tabular-nums dark:text-[#2DD4BF]">
                        {stats.mastered}
                      </div>
                      <div className="text-[11px] font-medium text-[#0F766E] dark:text-[#2DD4BF]">
                        Đã thuộc
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#A5B4FC] bg-[#EEF2FF] px-2 py-1.5 text-center dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15">
                      <div className="text-sm font-bold text-[#4338CA] tabular-nums dark:text-[#A5B4FC]">
                        {stats.hesitant}
                      </div>
                      <div className="text-[11px] font-medium text-[#4338CA] dark:text-[#A5B4FC]">
                        Phân vân
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#D4E1EE] bg-[#EAF1F8] px-2 py-1.5 text-center dark:border-[#18243C] dark:bg-[#18243C]">
                      <div className="text-sm font-bold text-[#0B1324] tabular-nums dark:text-[#F8FAFC]">
                        {stats.unlearned}
                      </div>
                      <div className="text-[11px] font-medium text-[#5B6E88] dark:text-[#7E91B0]">
                        Chưa thuộc
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#D4E1EE] pt-3 text-xs font-semibold dark:border-[#18243C]">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 text-[#0D9488] dark:text-[#2DD4BF]">
                      <CheckCircle2 className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                      Đã thuộc toàn bộ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#0369A1] dark:text-[#38BDF8]">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {stats.mastered > 0 || stats.hesitant > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[#5B6E88] transition group-hover:translate-x-0.5 group-hover:text-[#0284C7] dark:text-[#7E91B0] dark:group-hover:text-[#38BDF8]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Chapter Picker Bottom Sheet */}
      <AnimatePresence>
        {isChapterSheetOpen && (
          <>
            <motion.div
              key="rolling-chapter-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setIsChapterSheetOpen(false)}
              className="fixed inset-0 z-50 bg-[#0B1324]/50 backdrop-blur-[2px] dark:bg-[#070B14]/75 md:hidden"
            />
            <motion.div
              key="rolling-chapter-sheet-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Chọn chương học"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[#D4E1EE] bg-[#F8FAFC] shadow-2xl dark:border-[#18243C] dark:bg-[#0C1322] md:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D4E1EE] px-4 pb-3 pt-2.5 dark:border-[#18243C]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D4E1EE] dark:bg-[#253759]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                      {subjectMeta.code} • Chọn chương
                    </h3>
                    <p className="text-xs text-[#5B6E88] dark:text-[#7E91B0]">
                      Chạm vào chương để xem các chặng học
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChapterSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D4E1EE] bg-white p-1.5 text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 overflow-y-auto px-4 pb-6 pt-4">
                {chapters.map(ch => {
                  const isSelected = ch.chapter === selectedChapter;
                  const chQuestions = allSubjectQuestions.filter(q => q.chapter === ch.chapter);
                  const stats = getStageStats(chQuestions, progress);
                  return (
                    <button
                      key={ch.chapter}
                      type="button"
                      onClick={() => {
                        setSelectedChapter(ch.chapter);
                        setIsChapterSheetOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#F8FAFC]'
                          : 'border-[#D4E1EE] bg-white text-[#1E293B] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold">
                          Chương {ch.chapter}{' '}
                          <span className="font-normal text-[#5B6E88] dark:text-[#7E91B0]">
                            ({stats.mastered}/{stats.total} câu)
                          </span>
                        </div>
                        <div className="truncate text-xs opacity-85">{ch.title}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-semibold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                        {stats.percent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
