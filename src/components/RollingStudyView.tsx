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
import {
  SakugaBorderFire,
  SakugaBurst,
  SakugaEvent,
  SakugaMangaTag,
  SakugaProgressBar,
} from './SakugaVfx';

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
  const [sakugaEvent, setSakugaEvent] = useState<SakugaEvent | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const explanationRef = useRef<HTMLDivElement>(null);
  const shakeTimerRef = useRef<number | null>(null);

  const clearShake = useCallback(() => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setIsShaking(false);
  }, []);

  const triggerShake = useCallback(() => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }
    setIsShaking(true);
    shakeTimerRef.current = window.setTimeout(() => {
      setIsShaking(false);
      shakeTimerRef.current = null;
    }, 240);
  }, []);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

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
    setSakugaEvent(null);
    clearShake();
    setIsChapterSheetOpen(false);
    setIsStageSheetOpen(false);
  }, [subject, chapters, clearShake]);

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
      setSakugaEvent(null);
      clearShake();
      setTurnCounter(c => c + 1);
      setTurnFlagged(
        initialQueue[0] ? Boolean(progress.questions[initialQueue[0].id]?.flagged) : false
      );
    },
    [stages, progress, clearShake]
  );

  const handleExitSession = useCallback(() => {
    setActiveStageIndex(null);
    setQueue([]);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnFlagged(false);
    setSakugaEvent(null);
    clearShake();
  }, [clearShake]);

  const handleResetAndRestartStage = useCallback(() => {
    if (!activeStage) return;
    if (onResetStage) {
      onResetStage(activeStage.questions.map(q => q.id));
    }
    setQueue([...activeStage.questions]);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnFlagged(false);
    setSakugaEvent(null);
    clearShake();
    setTurnCounter(c => c + 1);
  }, [activeStage, onResetStage, clearShake]);

  const gradeSubmission = useCallback(
    (chosenKeys: string[]) => {
      if (!currentQuestion || gradedState !== null || chosenKeys.length === 0) return;

      const isCorrect = isAnswerCorrect(chosenKeys, currentQuestion.correctAnswers);
      const prevProgress = progress.questions[currentQuestion.id];
      const prevStreak = prevProgress?.streak ?? 0;
      const currentFlagged = turnFlagged;
      const nextStreak = isCorrect && !currentFlagged ? prevStreak + 1 : 0;

      setGradedState({ isCorrect, nextStreak });
      if (!isCorrect) {
        triggerShake();
      }
      onRecordAttempt(currentQuestion.id, isCorrect, currentFlagged);
      scrollToExplanationOnMobile();
    },
    [
      currentQuestion,
      gradedState,
      progress.questions,
      turnFlagged,
      onRecordAttempt,
      scrollToExplanationOnMobile,
      triggerShake,
    ]
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
    setSakugaEvent({ id: Date.now(), variant: 'ok', label: 'OK!' });
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
    setSakugaEvent(null);
    clearShake();
    setTurnCounter(c => c + 1);
  }, [currentQuestion, gradedState, queue, turnFlagged, clearShake]);

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
        <div className="flex w-full flex-col items-start gap-6 pb-20 lg:flex-row lg:gap-8 xl:gap-10 lg:pb-0">
          {/* Desktop Session Sidebar (>= 1024px) */}
          <aside className="hidden w-full shrink-0 lg:sticky lg:top-20 lg:block lg:w-[360px] xl:w-[380px]">
            <div className="rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-5 shadow-xs dark:border-[#262925] dark:bg-[#161816] dark:shadow-none">
              <div className="flex items-center justify-between gap-2 border-b border-[#D5CFC2] pb-3.5 dark:border-[#262925]">
                <button
                  type="button"
                  onClick={handleExitSession}
                  className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-1.5 text-xs font-semibold text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Danh sách chặng</span>
                </button>

                {currentQuestion ? (
                  <div className="rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-1 text-xs font-semibold text-[#3730A3] tabular-nums dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                    Còn {queue.length} câu
                  </div>
                ) : (
                  <div className="rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-1 text-xs font-semibold text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                    Hoàn thành
                  </div>
                )}
              </div>

              {/* Chapter & Active Stage Meta */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-[#D5CFC2] bg-white px-2 py-0.5 text-xs font-semibold text-[#44403C] dark:border-[#3F3F46] dark:bg-[#27272A] dark:text-[#D4D4D8]">
                    Chương {selectedChapter}
                  </span>
                  <span className="text-xs font-medium text-[#656058] tabular-nums dark:text-[#9CA39B]">
                    {activeStage.questions.length} câu · Câu {activeStage.startIndex}–{activeStage.endIndex}
                  </span>
                </div>
                <h2 className="mt-2 text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                  {activeStage.title}
                </h2>
                {currentChapterMeta && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[#656058] dark:text-[#9CA39B]">
                    {currentChapterMeta.title}
                  </p>
                )}
              </div>

              {/* Stage mastery progress bar */}
              <div
                className={`relative mt-4 rounded-xl border bg-[#FAF9F5] p-3.5 dark:bg-[#1C1F1C] ${
                  stageStats.percent >= 100
                    ? 'border-[#10B981] ring-2 ring-[#34D399]/35 dark:border-[#10B981]/80 dark:ring-[#34D399]/30'
                    : stageStats.percent >= 50
                      ? 'border-[#F59E0B]/70 dark:border-[#F59E0B]/55'
                      : 'border-[#D5CFC2] dark:border-[#2C302B]'
                }`}
              >
                <SakugaBorderFire percent={stageStats.percent} radius={12} compact />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#656058] dark:text-[#9CA39B]">Tiến độ chặng</span>
                  <span className="font-semibold text-[#047857] tabular-nums dark:text-[#34D399]">
                    {stageStats.mastered}/{stageStats.total} ({stageStats.percent}%)
                  </span>
                </div>
                <SakugaProgressBar percent={stageStats.percent} className="mt-2 h-2 w-full" />
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-medium tabular-nums">
                  <span className="text-[#047857] dark:text-[#34D399]">
                    Thuộc: {stageStats.mastered}
                  </span>
                  <span className="text-[#A21CAF] dark:text-[#F5D0FE]">
                    Phân vân: {stageStats.hesitant}
                  </span>
                  <span className="text-[#656058] dark:text-[#9CA39B]">
                    Chưa: {stageStats.unlearned}
                  </span>
                </div>
              </div>

              {/* Stage Switcher List */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  <span>Các chặng trong chương</span>
                  <span className="tabular-nums">{stages.length} chặng</span>
                </div>

                <div className="max-h-[calc(100vh-450px)] min-h-[140px] space-y-2 overflow-y-auto pr-1">
                  {stages.map(stage => {
                    const stats = getStageStats(stage.questions, progress);
                    const isCurrentStage = stage.index === activeStage.index;
                    return (
                      <button
                        key={stage.index}
                        type="button"
                        onClick={() => startStageSession(stage.index)}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                          isCurrentStage
                            ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] shadow-xs dark:border-[#818CF8] dark:bg-[#312E81]/30 dark:text-[#F5F5F4]'
                            : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold">
                            {stage.title} · Câu {stage.startIndex}–{stage.endIndex}
                          </div>
                          <div className="text-[11px] text-[#656058] tabular-nums dark:text-[#9CA39B]">
                            Thuộc {stats.mastered}/{stats.total} · Phân vân {stats.hesitant}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-bold text-[#047857] tabular-nums dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                          {stats.percent}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Practice Area */}
          <div className="w-full min-w-0 flex-1 space-y-3 sm:space-y-5">
            {/* Mobile & Tablet Unified Interactive Progress Card (< 1024px) */}
            <div className="px-1 pt-1 lg:hidden">
              <button
                type="button"
                onClick={() => setIsStageSheetOpen(true)}
                className={`relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-[#EAE6DD] px-3.5 py-2.5 text-left shadow-xs transition active:scale-[0.99] dark:bg-[#161816] ${
                  stageStats.percent >= 100
                    ? 'border-[#10B981] ring-2 ring-[#34D399]/35 dark:border-[#10B981]/80 dark:ring-[#34D399]/30'
                    : stageStats.percent >= 50
                      ? 'border-[#F59E0B]/70 dark:border-[#F59E0B]/55'
                      : 'border-[#D5CFC2] dark:border-[#262925]'
                }`}
              >
                <SakugaBorderFire percent={stageStats.percent} radius={12} compact />

                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#18181B] dark:text-[#F5F5F4]">
                    <Menu className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#818CF8]" />
                    <span className="truncate tabular-nums">
                      C{selectedChapter} • {activeStage.title}
                    </span>
                    {currentQuestion ? (
                      <span className="shrink-0 rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-bold text-[#3730A3] tabular-nums dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                        Còn {queue.length}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-[#10B981] bg-[#D1FAE5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                        Xong
                      </span>
                    )}
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`tabular-nums rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        stageStats.percent >= 50
                          ? 'border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]'
                          : 'border-[#F59E0B]/60 bg-[#FEF3C7] text-[#92400E] dark:border-[#F59E0B]/45 dark:bg-[#92400E]/25 dark:text-[#FDE68A]'
                      }`}
                    >
                      {stageStats.mastered}/{stageStats.total} ({stageStats.percent}%)
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#656058] dark:text-[#9CA39B]" />
                  </span>
                </div>

                <SakugaProgressBar percent={stageStats.percent} className="h-1.5 w-full" />
              </button>
            </div>

            {/* Stage Completion Card */}
            {!currentQuestion ? (
              <div className="relative rounded-3xl border-2 border-[#059669] bg-white p-6 text-center shadow-[4px_4px_0_0_#6EE7B7,0_14px_28px_-12px_rgba(5,150,105,0.14)] dark:border-2 dark:border-[#10B981] dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#065F46,0_18px_36px_-12px_rgba(0,0,0,0.8)] sm:p-8 sm:shadow-[6px_6px_0_0_#6EE7B7,0_16px_32px_-12px_rgba(5,150,105,0.14)] dark:sm:shadow-[6px_6px_0_0_#065F46,0_20px_40px_-12px_rgba(0,0,0,0.8)]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#10B981] bg-[#D1FAE5] text-[#059669] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399] sm:h-16 sm:w-16">
                  <Trophy className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <SakugaMangaTag label="COMPLETE! ✓" tone="emerald" className="mb-2" />
                <h2 className="text-xl font-bold text-[#18181B] dark:text-[#F5F5F4] sm:text-2xl">
                  Hoàn thành chặng!
                </h2>
                <p className="mt-2 text-sm text-[#656058] dark:text-[#9CA39B]">
                  Bạn đã hoàn thành {activeStage.title} (Chương {selectedChapter} —{' '}
                  {activeStage.questions.length} câu hỏi).
                </p>

                <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="rounded-xl border border-[#10B981] bg-[#D1FAE5] p-3 dark:border-[#10B981] dark:bg-[#059669]/30">
                    <div className="text-lg font-bold text-[#047857] tabular-nums dark:text-[#34D399]">
                      {stageStats.mastered}
                    </div>
                    <div className="text-xs font-medium text-[#047857] dark:text-[#34D399]">
                      Đã thuộc
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#F0ABFC] bg-[#FAE8FF] p-3 dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20">
                    <div className="text-lg font-bold text-[#A21CAF] tabular-nums dark:text-[#F5D0FE]">
                      {stageStats.hesitant}
                    </div>
                    <div className="text-xs font-medium text-[#A21CAF] dark:text-[#F5D0FE]">
                      Phân vân
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#D5CFC2] bg-[#EAE6DD] p-3 dark:border-[#2C302B] dark:bg-[#252A26]">
                    <div className="text-lg font-bold text-[#18181B] tabular-nums dark:text-[#F5F5F4]">
                      {stageStats.unlearned}
                    </div>
                    <div className="text-xs font-medium text-[#656058] dark:text-[#9CA39B]">
                      Chưa thuộc
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                  {hasNextStage && (
                    <button
                      type="button"
                      onClick={() => startStageSession(activeStage.index + 1)}
                      className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
                    >
                      <span>Sang Chặng {activeStage.index + 2}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startStageSession(activeStage.index, true)}
                    className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] px-4 py-2.5 text-sm font-semibold text-[#3730A3] shadow-[2px_2px_0_0_#C7D2FE] hover:bg-[#E0E7FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:bg-[#312E81]/45"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Ôn tập lại chặng này</span>
                  </button>

                  {onResetStage && (
                    <button
                      type="button"
                      onClick={handleResetAndRestartStage}
                      className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-sm font-medium text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25"
                    >
                      <span>Học lại chặng</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExitSession}
                    className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-sm font-medium text-[#656058] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#A5B4FC]"
                  >
                    <span>Quay lại danh sách</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Question Card */
              <div
                key={`${currentQuestion.id}-${turnCounter}`}
                className={`relative rounded-3xl border-2 border-[#27272A] bg-white p-4 shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] dark:border-2 dark:border-[#52525B] dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:p-6 sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)] md:p-8 ${
                  isShaking ? 'sakuga-shake' : ''
                }`}
              >
                <SakugaBurst
                  event={sakugaEvent?.variant === 'ok' ? sakugaEvent : null}
                  className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 sm:left-auto sm:right-10 sm:translate-x-0"
                />
                {/* Card top badges + Desktop Phân vân toggle */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-2.5 dark:border-[#2C322D] dark:bg-[#141714] sm:mb-5">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {(() => {
                      const qProg = progress.questions[currentQuestion.id];
                      const effectiveStreak =
                        gradedState !== null ? gradedState.nextStreak : (qProg?.streak ?? 0);
                      const isWrongState =
                        gradedState !== null ? !gradedState.isCorrect : qProg?.lastResult === 'wrong';

                      if (turnFlagged) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0ABFC] bg-[#FAE8FF] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] sm:py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#A21CAF] dark:bg-[#F5D0FE]" />
                            Phân vân
                          </span>
                        );
                      }
                      if (effectiveStreak >= 2) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399] sm:py-1">
                            <span>✓ Đã thuộc (2/2)</span>
                            <span className="tracking-tighter opacity-90" aria-hidden="true">
                              ●●
                            </span>
                          </span>
                        );
                      }
                      if (effectiveStreak === 1) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F59E0B] bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D] sm:py-1">
                            <span>✓ Đúng 1/2 lần</span>
                            <span className="tracking-tighter opacity-90" aria-hidden="true">
                              ●○
                            </span>
                          </span>
                        );
                      }
                      if (isWrongState) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FDA4AF] bg-[#FFE4E6] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#BE123C] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF] sm:py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#BE123C] dark:bg-[#FDA4AF]" />
                            Đã trả lời sai
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5CFC2] bg-[#EAE6DD] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#656058] dark:border-[#2C302B] dark:bg-[#252A26] dark:text-[#9CA39B] sm:py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#656058] dark:bg-[#9CA39B]" />
                          Chưa thuộc
                        </span>
                      );
                    })()}

                    {currentQuestion.isMultiSelect && (
                      <span className="inline-flex items-center rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0C4A6E]/35 dark:text-[#7DD3FC] sm:py-1 sm:text-xs">
                        Chọn nhiều đáp án
                      </span>
                    )}
                  </div>

                  {/* Desktop Flag Button */}
                  <button
                    type="button"
                    onClick={handleToggleFlag}
                    aria-pressed={turnFlagged}
                    className={`sakuga-btn hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold lg:inline-flex ${
                      turnFlagged
                        ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                        : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#F0ABFC] hover:bg-[#FAE8FF] hover:text-[#A21CAF] hover:shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#E879F9]/55 dark:hover:bg-[#D946EF]/20 dark:hover:text-[#F5D0FE] dark:hover:shadow-[2px_2px_0_0_#701A75]'
                    }`}
                  >
                    <Flag
                      className={`h-3.5 w-3.5 ${
                        turnFlagged
                          ? 'fill-[#A21CAF] text-[#A21CAF] dark:fill-[#F5D0FE] dark:text-[#F5D0FE]'
                          : 'text-[#656058] dark:text-[#9CA39B]'
                      }`}
                    />
                    <span>Phân vân</span>
                    <kbd
                      className={`ml-0.5 hidden rounded px-1 py-0.5 font-mono text-[10px] lg:inline-block ${
                        turnFlagged
                          ? 'border border-[#F0ABFC] bg-white text-[#A21CAF] dark:border-[#E879F9]/40 dark:bg-[#0F100E] dark:text-[#F5D0FE]'
                          : 'border border-[#D5CFC2] bg-white text-[#656058] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#9CA39B]'
                      }`}
                    >
                      F
                    </kbd>
                  </button>
                </div>

                {/* Question Text */}
                <div className="rounded-2xl border border-[#E2DDD2] border-l-4 border-l-[#4338CA] bg-[#FAF8F3] p-4 dark:border-[#2C322D] dark:border-l-4 dark:border-l-[#818CF8] dark:bg-[#161917] sm:p-5">
                  <h3 className="max-w-[78ch] text-[17px] font-semibold leading-[1.6] text-[#18181B] dark:text-[#F5F5F4] sm:text-[19px] sm:leading-[1.65] md:text-[20px]">
                    {currentQuestion.question}
                  </h3>
                </div>

                {/* Options */}
                <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOptions.includes(opt.key);
                    const isCorrectOption = currentQuestion.correctAnswers
                      .map(c => c.toUpperCase())
                      .includes(opt.key.toUpperCase());
                    const isGraded = gradedState !== null;

                    let containerCls =
                      'border-[#D5CFC2] bg-[#F8F6F0] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] md:hover:translate-x-1 dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25';
                    let badgeCls =
                      'border-[#C6BEB0] bg-white text-[#4338CA] group-hover:border-[#4338CA] group-hover:bg-[#4338CA] group-hover:text-white dark:border-[#353B36] dark:bg-[#161816] dark:text-[#A5B4FC] dark:group-hover:border-[#818CF8] dark:group-hover:bg-[#4338CA] dark:group-hover:text-white';

                    if (!isGraded && isSelected) {
                      containerCls =
                        'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:bg-[#312E81]/35 dark:text-[#F5F5F4] dark:ring-[#818CF8]';
                      badgeCls =
                        'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8] dark:bg-[#4338CA] dark:text-white';
                    } else if (isGraded) {
                      if (isCorrectOption) {
                        containerCls =
                          'border-2 border-[#059669] bg-[#F8F6F0] text-[#064E3B] ring-2 ring-[#10B981]/20 dark:border-2 dark:border-[#10B981] dark:bg-[#252A26] dark:text-[#ECFDF5] dark:ring-2 dark:ring-[#10B981]/25';
                        badgeCls =
                          'sakuga-green-key-arrival border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]';
                      } else if (isSelected && !isCorrectOption) {
                        containerCls =
                          'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]';
                        badgeCls =
                          'border-[#E11D48] bg-[#E11D48] text-white dark:border-[#FB7185] dark:bg-[#FB7185] dark:text-[#0F100E]';
                      } else {
                        containerCls =
                          'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] dark:border-[#262925] dark:bg-[#161816]/70 dark:text-[#9CA39B]';
                        badgeCls =
                          'border-[#D5CFC2] bg-[#EAE6DD] text-[#656058] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#9CA39B]';
                      }
                    }

                    const upperCorrect = currentQuestion.correctAnswers.map(c => c.toUpperCase());
                    const showSuccessTag = isGraded && gradedState.isCorrect && isCorrectOption;
                    const hasWrongSelected = selectedOptions.some(
                      k => !upperCorrect.includes(k.toUpperCase())
                    );
                    const missTargetKeys = hasWrongSelected
                      ? selectedOptions.filter(k => !upperCorrect.includes(k.toUpperCase()))
                      : upperCorrect.filter(
                          k => !selectedOptions.some(s => s.toUpperCase() === k)
                        );
                    const showMissTag =
                      isGraded &&
                      !gradedState.isCorrect &&
                      missTargetKeys.some(k => k.toUpperCase() === opt.key.toUpperCase());

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={isGraded}
                        onClick={() => handleOptionClick(opt.key)}
                        className={`group relative flex w-full items-start gap-3 rounded-xl border p-3 px-3.5 text-left transition-all duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${containerCls} ${
                          isGraded ? 'cursor-default' : 'cursor-pointer'
                        }`}
                      >
                        {isGraded && isCorrectOption && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[10px]"
                          >
                            <span className="sakuga-green-wave absolute inset-0 bg-[#D1FAE5] dark:bg-[#064E3B]/65" />
                          </span>
                        )}

                        <span
                          className={`relative z-10 sakuga-option-badge mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold sm:h-7 sm:w-7 ${badgeCls}`}
                        >
                          {opt.key}
                        </span>

                        <span className="relative z-10 flex-1 pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                          {opt.text}
                        </span>

                        <span className="relative z-10 mt-0.5 flex shrink-0 items-center gap-1.5 sm:gap-2">
                          {showSuccessTag && (
                            <SakugaMangaTag
                              label={!turnFlagged && gradedState.nextStreak >= 2 ? 'CLEAR! ✓' : 'NICE!'}
                              tone={!turnFlagged && gradedState.nextStreak >= 2 ? 'emerald' : 'amber'}
                            />
                          )}
                          {showMissTag && <SakugaMangaTag label="MISS!" tone="rose" />}
                          {!isGraded && (
                            <kbd className="hidden rounded border border-[#D5CFC2] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#656058] dark:border-[#353B36] dark:bg-[#161816] dark:text-[#9CA39B] lg:inline-block">
                              {idx + 1}
                            </kbd>
                          )}
                          {isGraded && isCorrectOption && (
                            <Check className="h-4 w-4 text-[#059669] dark:text-[#34D399]" />
                          )}
                          {isGraded && isSelected && !isCorrectOption && (
                            <X className="h-4 w-4 text-[#BE123C] dark:text-[#FDA4AF]" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Desktop Multi-select submit button */}
                {gradedState === null && currentQuestion.isMultiSelect && (
                  <div className="mt-5 hidden items-center justify-end lg:flex">
                    <button
                      type="button"
                      disabled={selectedOptions.length === 0}
                      onClick={() => gradeSubmission(selectedOptions)}
                      className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:border disabled:border-[#D5CFC2] disabled:bg-[#EAE6DD] disabled:text-[#656058] disabled:shadow-none dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3] dark:disabled:border-[#2C302B] dark:disabled:bg-[#252A26] dark:disabled:text-[#9CA39B] dark:disabled:shadow-none"
                    >
                      <span>Kiểm tra đáp án</span>
                      <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white lg:inline-block">
                        Enter
                      </kbd>
                    </button>
                  </div>
                )}

                {/* Graded explanation & Next button with auto-scroll target */}
                {gradedState !== null && (
                  <div
                    ref={explanationRef}
                    className="mt-5 scroll-mt-4 scroll-mb-24 space-y-4 border-t border-[#D5CFC2] pt-4 dark:border-[#262925] sm:mt-6 sm:space-y-5 sm:pt-5"
                  >
                    <RichExplanation question={currentQuestion} />

                    <div className="hidden justify-end lg:flex">
                      <button
                        type="button"
                        onClick={handleNext}
                        className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
                      >
                        <span>Câu tiếp theo</span>
                        <ArrowRight className="h-4 w-4" />
                        <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white lg:inline-block">
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
              <div className="hidden items-center justify-center gap-4 text-xs text-[#656058] dark:text-[#9CA39B] lg:flex">
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#EAE6DD] px-1.5 py-0.5 font-mono text-[11px] text-[#292524] dark:border-[#262925] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    1-4
                  </kbd>{' '}
                  hoặc{' '}
                  <kbd className="rounded border border-[#D5CFC2] bg-[#EAE6DD] px-1.5 py-0.5 font-mono text-[11px] text-[#292524] dark:border-[#262925] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    A-D
                  </kbd>{' '}
                  chọn đáp án
                </span>
                <span>·</span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#EAE6DD] px-1.5 py-0.5 font-mono text-[11px] text-[#292524] dark:border-[#262925] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    F
                  </kbd>{' '}
                  Phân vân
                </span>
                <span>·</span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#EAE6DD] px-1.5 py-0.5 font-mono text-[11px] text-[#292524] dark:border-[#262925] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    Enter
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-[#D5CFC2] bg-[#EAE6DD] px-1.5 py-0.5 font-mono text-[11px] text-[#292524] dark:border-[#262925] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    Space
                  </kbd>{' '}
                  tiếp tục
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile & Tablet Sticky Bottom Action Bar (< 1024px) */}
        {currentQuestion && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D5CFC2] bg-[#EAE6DD]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(28,25,23,0.08)] backdrop-blur dark:border-[#262925] dark:bg-[#161816]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.65)] lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleExitSession}
                className="sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2.5 text-xs font-semibold text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Chặng</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFlag}
                aria-pressed={turnFlagged}
                className={`sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                  turnFlagged
                    ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#2C302B]'
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
                  className="sakuga-btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3] dark:disabled:shadow-none"
                >
                  <Check className="h-4 w-4" />
                  <span>Kiểm tra ({selectedOptions.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={gradedState === null}
                  onClick={handleNext}
                  className="sakuga-btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3] dark:disabled:shadow-none"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile & Tablet Stage Switcher Bottom Sheet (< 1024px) */}
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
                className="fixed inset-0 z-50 bg-[#18181B]/50 backdrop-blur-[2px] dark:bg-[#0F100E]/75 lg:hidden"
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
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[#D5CFC2] bg-[#EAE6DD] shadow-2xl dark:border-[#262925] dark:bg-[#161816] lg:hidden"
              >
                <div className="flex flex-col items-center border-b border-[#D5CFC2] px-4 pb-3 pt-2.5 dark:border-[#262925]">
                  <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D5CFC2] dark:bg-[#323833]" />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                        Chương {selectedChapter} • Chọn chặng
                      </h3>
                      <p className="text-xs text-[#047857] tabular-nums dark:text-[#34D399]">
                        {chapterStats.mastered}/{chapterStats.total} câu đã thuộc ({chapterStats.percent}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStageSheetOpen(false)}
                      aria-label="Đóng ngăn kéo"
                      className="cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1.5 text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3.5 overflow-y-auto px-4 pb-6 pt-4">
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
                        className={`relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border px-3.5 py-3 text-left transition ${
                          isCurrentStage
                            ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] dark:border-[#818CF8] dark:bg-[#312E81]/30 dark:text-[#F5F5F4]'
                            : stats.percent >= 100
                              ? 'border-[#10B981] bg-[#FAF9F5] ring-2 ring-[#34D399]/35 text-[#292524] dark:border-[#10B981]/80 dark:bg-[#1C1F1C] dark:ring-[#34D399]/30 dark:text-[#E7E5E4]'
                              : stats.percent >= 50
                                ? 'border-[#F59E0B]/70 bg-[#FAF9F5] text-[#292524] dark:border-[#F59E0B]/55 dark:bg-[#1C1F1C] dark:text-[#E7E5E4]'
                                : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]'
                        }`}
                      >
                        <SakugaBorderFire percent={stats.percent} radius={12} compact />

                        <div className="flex w-full items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold">
                              {stage.title} · Câu {stage.startIndex}–{stage.endIndex}
                            </div>
                            <div className="text-[11px] text-[#656058] tabular-nums dark:text-[#9CA39B]">
                              Thuộc {stats.mastered}/{stats.total} · Phân vân {stats.hesitant}
                            </div>
                          </div>
                          <span className="rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-bold text-[#047857] tabular-nums dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                            {stats.percent}%
                          </span>
                        </div>

                        <SakugaProgressBar percent={stats.percent} className="h-1.5 w-full" />
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setIsStageSheetOpen(false);
                      handleExitSession();
                    }}
                    className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-xs font-semibold text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
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
      <div className="w-full">
        {/* Header Banner */}
        <div className="mb-5 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 shadow-xs dark:border-[#262925] dark:bg-[#161816] dark:shadow-none sm:p-6 md:mb-8 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] sm:h-11 sm:w-11">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#18181B] dark:text-[#F5F5F4] sm:text-xl">
                  Học cuốn chiếu
                </h2>
                <span className="rounded-md border border-[#D5CFC2] bg-white px-2 py-0.5 text-xs font-semibold text-[#44403C] dark:border-[#3F3F46] dark:bg-[#27272A] dark:text-[#D4D4D8]">
                  {subjectMeta.code}
                </span>
              </div>
            </div>

            <div className="hidden items-center gap-4 text-sm sm:flex">
              <div className="text-right">
                <div className="text-xs text-[#656058] dark:text-[#9CA39B]">Tiến độ chương đang chọn</div>
                <div className="font-bold text-[#047857] tabular-nums dark:text-[#34D399]">
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
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3.5 py-2.5 text-left text-xs font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#818CF8]" />
                <span className="truncate">
                  Chương {selectedChapter}: {currentChapterMeta?.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-bold text-[#047857] tabular-nums dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                  {chapterStats.percent}%
                </span>
                <ChevronDown className="h-4 w-4 text-[#656058] dark:text-[#9CA39B]" />
              </span>
            </button>
          </div>

          {/* Desktop Chapter Selector (>= 768px) */}
          <div className="mt-5 hidden flex-wrap items-center justify-between gap-2.5 md:flex">
            {chapters.map(ch => {
              const isSelected = ch.chapter === selectedChapter;
              const chQuestions = allSubjectQuestions.filter(q => q.chapter === ch.chapter);
              const stats = getStageStats(chQuestions, progress);

              return (
                <button
                  key={ch.chapter}
                  type="button"
                  onClick={() => setSelectedChapter(ch.chapter)}
                  className={`flex min-w-[135px] flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'border-[#4338CA] bg-[#4338CA] text-white shadow-sm hover:border-[#3730A3] hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white dark:hover:bg-[#3730A3]'
                      : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                  }`}
                >
                  <span className="font-semibold">Chương {ch.chapter}</span>
                  <span className="rounded-full border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-xs font-semibold text-[#047857] tabular-nums dark:border-[#10B981]/60 dark:bg-[#0F100E]/85 dark:text-[#34D399]">
                    {stats.percent}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Overall Chapter Progress Bar */}
          {currentChapterMeta && (
            <div
              className={`relative mt-3.5 rounded-xl border bg-[#FAF9F5] p-3.5 dark:bg-[#1C1F1C] sm:mt-5 sm:p-4 ${
                chapterStats.percent >= 100
                  ? 'border-[#10B981] ring-2 ring-[#34D399]/35 dark:border-[#10B981]/80 dark:ring-[#34D399]/30'
                  : chapterStats.percent >= 50
                    ? 'border-[#F59E0B]/70 dark:border-[#F59E0B]/55'
                    : 'border-[#D5CFC2] dark:border-[#2C302B]'
              }`}
            >
              <SakugaBorderFire percent={chapterStats.percent} radius={12} />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="hidden text-sm font-semibold text-[#3730A3] dark:text-[#A5B4FC] md:block">
                  Chương {currentChapterMeta.chapter}: {currentChapterMeta.title}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                  <span className="inline-flex items-center gap-1.5 text-[#047857] tabular-nums dark:text-[#34D399]">
                    <span className="h-2 w-2 rounded-full bg-[#059669] dark:bg-[#10B981]" />
                    Đã thuộc: {chapterStats.mastered}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#A21CAF] tabular-nums dark:text-[#F5D0FE]">
                    <span className="h-2 w-2 rounded-full bg-[#A21CAF] dark:bg-[#F5D0FE]" />
                    Phân vân: {chapterStats.hesitant}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#656058] tabular-nums dark:text-[#9CA39B]">
                    <span className="h-2 w-2 rounded-full bg-[#656058] dark:bg-[#9CA39B]" />
                    Chưa thuộc: {chapterStats.unlearned}
                  </span>
                </div>
              </div>

              <SakugaProgressBar
                percent={chapterStats.percent}
                className="mt-2.5 h-2 w-full sm:mt-3 sm:h-2.5"
              />
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
                className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border bg-[#EAE6DD] p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#161816] dark:shadow-none sm:p-6 ${
                  isCompleted
                    ? 'border-[#10B981] ring-2 ring-[#34D399]/35 shadow-[0_0_16px_rgba(16,185,129,0.22)] hover:border-[#059669] hover:bg-[#ECFDF5] dark:border-[#10B981]/80 dark:ring-[#34D399]/30 dark:shadow-[0_0_18px_rgba(52,211,153,0.22)] dark:hover:border-[#34D399] dark:hover:bg-[#059669]/20'
                    : stats.percent >= 50
                      ? 'border-[#F59E0B]/70 hover:border-[#059669] hover:bg-[#ECFDF5]/60 dark:border-[#F59E0B]/55 dark:hover:border-[#34D399] dark:hover:bg-[#059669]/15'
                      : 'border-[#D5CFC2] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#262925] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                }`}
              >
                <SakugaBorderFire percent={stats.percent} radius={16} />
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${
                          isCompleted
                            ? 'border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]'
                            : 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                        }`}
                      >
                        {stage.index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-[#18181B] dark:text-[#F5F5F4]">{stage.title}</div>
                        <div className="text-xs text-[#656058] tabular-nums dark:text-[#9CA39B]">
                          {stage.questions.length} câu · Câu {stage.startIndex}–{stage.endIndex}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-bold text-[#047857] tabular-nums dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                      {stats.percent}%
                    </span>
                  </div>

                  {/* Stage progress bar */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-[#656058] dark:text-[#9CA39B]">
                      <span>Đã thuộc</span>
                      <span className="font-semibold text-[#047857] tabular-nums dark:text-[#34D399]">
                        {stats.mastered}/{stats.total}
                      </span>
                    </div>
                    <SakugaProgressBar percent={stats.percent} className="h-2 w-full" />
                  </div>

                  {/* 3 Status counts */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-[#10B981] bg-[#D1FAE5] px-2 py-1.5 text-center dark:border-[#10B981] dark:bg-[#059669]/30">
                      <div className="text-sm font-bold text-[#047857] tabular-nums dark:text-[#34D399]">
                        {stats.mastered}
                      </div>
                      <div className="text-[11px] font-medium text-[#047857] dark:text-[#34D399]">
                        Đã thuộc
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#F0ABFC] bg-[#FAE8FF] px-2 py-1.5 text-center dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20">
                      <div className="text-sm font-bold text-[#A21CAF] tabular-nums dark:text-[#F5D0FE]">
                        {stats.hesitant}
                      </div>
                      <div className="text-[11px] font-medium text-[#A21CAF] dark:text-[#F5D0FE]">
                        Phân vân
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#D5CFC2] bg-[#FAF9F5] px-2 py-1.5 text-center dark:border-[#2C302B] dark:bg-[#252A26]">
                      <div className="text-sm font-bold text-[#18181B] tabular-nums dark:text-[#F5F5F4]">
                        {stats.unlearned}
                      </div>
                      <div className="text-[11px] font-medium text-[#656058] dark:text-[#9CA39B]">
                        Chưa thuộc
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex w-full items-center justify-between border-t border-[#D5CFC2] pt-3 text-xs font-semibold dark:border-[#262925]">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 text-[#047857] dark:text-[#34D399]">
                      <CheckCircle2 className="h-4 w-4 text-[#059669] dark:text-[#34D399]" />
                      Đã thuộc toàn bộ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#3730A3] dark:text-[#818CF8]">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {stats.mastered > 0 || stats.hesitant > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
                    </span>
                  )}
                  <ChevronRight
                    className={`h-4 w-4 text-[#656058] transition group-hover:translate-x-0.5 dark:text-[#9CA39B] ${
                      isCompleted
                        ? 'group-hover:text-[#059669] dark:group-hover:text-[#34D399]'
                        : 'group-hover:text-[#4338CA] dark:group-hover:text-[#818CF8]'
                    }`}
                  />
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
              className="fixed inset-0 z-50 bg-[#18181B]/50 backdrop-blur-[2px] dark:bg-[#0F100E]/75 md:hidden"
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
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[#D5CFC2] bg-[#EAE6DD] shadow-2xl dark:border-[#262925] dark:bg-[#161816] md:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D5CFC2] px-4 pb-3 pt-2.5 dark:border-[#262925]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D5CFC2] dark:bg-[#323833]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                      {subjectMeta.code} • Chọn chương
                    </h3>
                    <p className="text-xs text-[#656058] dark:text-[#9CA39B]">
                      Chạm vào chương để xem các chặng học
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChapterSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1.5 text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
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
                          ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] dark:border-[#818CF8] dark:bg-[#312E81]/30 dark:text-[#F5F5F4]'
                          : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold">
                          Chương {ch.chapter}{' '}
                          <span className="font-normal text-[#656058] dark:text-[#9CA39B]">
                            ({stats.mastered}/{stats.total} câu)
                          </span>
                        </div>
                        <div className="truncate text-xs opacity-85">{ch.title}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-semibold text-[#047857] tabular-nums dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
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
