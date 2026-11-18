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
        <div className="flex w-full flex-col items-start justify-between gap-8 pb-20 lg:flex-row lg:gap-12 lg:pb-0">
          {/* Desktop Session Sidebar (>= 1024px) */}
          <aside className="hidden w-full shrink-0 lg:sticky lg:top-28 lg:block lg:w-[340px]">
            <div className="rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-5 shadow-xs dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-none">
              <div className="flex items-center justify-between gap-2 border-b border-[#D2DACB] pb-3.5 dark:border-[#222E27]">
                <button
                  type="button"
                  onClick={handleExitSession}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-1.5 text-xs font-semibold text-[#243329] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24] dark:hover:text-[#F3F6F4]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Danh sách chặng</span>
                </button>

                {currentQuestion ? (
                  <div className="rounded-full border border-[#B8C7B0] bg-[#E3EFE8] px-2.5 py-1 text-xs font-semibold text-[#2E6F4E] tabular-nums dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                    Còn {queue.length} câu
                  </div>
                ) : (
                  <div className="rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-1 text-xs font-semibold text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                    Hoàn thành
                  </div>
                )}
              </div>

              {/* Chapter & Active Stage Meta */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-[#B8C7B0] bg-[#E3EFE8] px-2 py-0.5 text-xs font-semibold text-[#2E6F4E] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                    Chương {selectedChapter}
                  </span>
                  <span className="text-xs font-medium text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                    {activeStage.questions.length} câu · Câu {activeStage.startIndex}–{activeStage.endIndex}
                  </span>
                </div>
                <h2 className="mt-2 text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">
                  {activeStage.title}
                </h2>
                {currentChapterMeta && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[#5C6E60] dark:text-[#8B9E91]">
                    {currentChapterMeta.title}
                  </p>
                )}
              </div>

              {/* Stage mastery progress bar */}
              <div className="mt-4 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-3.5 dark:border-[#25332B] dark:bg-[#17201B]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#5C6E60] dark:text-[#8B9E91]">Tiến độ chặng</span>
                  <span className="font-semibold text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                    {stageStats.mastered}/{stageStats.total} ({stageStats.percent}%)
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#D2DACB] dark:bg-[#0D120F]">
                  <div
                    className="h-full rounded-full bg-[#1F8A65] transition-all duration-300 dark:bg-[#38A179]"
                    style={{ width: `${stageStats.percent}%` }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-medium tabular-nums">
                  <span className="text-[#0F5C41] dark:text-[#6EE7B7]">
                    Thuộc: {stageStats.mastered}
                  </span>
                  <span className="text-[#6D28D9] dark:text-[#D8B4FE]">
                    Phân vân: {stageStats.hesitant}
                  </span>
                  <span className="text-[#5C6E60] dark:text-[#8B9E91]">
                    Chưa: {stageStats.unlearned}
                  </span>
                </div>
              </div>

              {/* Stage Switcher List */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#5C6E60] dark:text-[#8B9E91]">
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
                            ? 'border-[#2E6F4E] bg-[#E3EFE8] text-[#142018] shadow-xs dark:border-[#52B788] dark:bg-[#263B31] dark:text-[#F3F6F4]'
                            : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E3EFE8] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold">
                            {stage.title} · Câu {stage.startIndex}–{stage.endIndex}
                          </div>
                          <div className="text-[11px] text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                            Thuộc {stats.mastered}/{stats.total} · Phân vân {stats.hesitant}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2 py-0.5 text-[11px] font-bold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
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
          <div className="w-full min-w-0 flex-1 space-y-3 sm:space-y-5 lg:max-w-[1040px]">
            {/* Mobile & Tablet Compact 1-Line Session Toolbar (< 1024px) */}
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setIsStageSheetOpen(true)}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D2DACB] bg-[#E8ECE4] px-3 py-2 text-left text-xs font-semibold text-[#142018] shadow-xs transition active:scale-[0.99] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#F3F6F4]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Menu className="h-4 w-4 shrink-0 text-[#2E6F4E] dark:text-[#52B788]" />
                  <span className="truncate tabular-nums">
                    C{selectedChapter} • {activeStage.title} ({stageStats.percent}%)
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#5C6E60] dark:text-[#8B9E91]" />
              </button>

              {currentQuestion ? (
                <span className="shrink-0 rounded-xl border border-[#B8C7B0] bg-[#E3EFE8] px-2.5 py-2 text-xs font-semibold text-[#2E6F4E] tabular-nums dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                  Còn {queue.length}
                </span>
              ) : (
                <span className="shrink-0 rounded-xl border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-2 text-xs font-semibold text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                  Xong
                </span>
              )}
            </div>

            {/* Stage Completion Card */}
            {!currentQuestion ? (
              <div className="rounded-2xl border border-[#BCC9B4] border-t-2 border-t-[#1F8A65] bg-white p-5 text-center shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] dark:border-[#31453A] dark:border-t-2 dark:border-t-[#38A179] dark:bg-[#1B2620] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] sm:p-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7] sm:h-16 sm:w-16">
                  <Trophy className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <h2 className="text-xl font-bold text-[#142018] dark:text-[#F3F6F4] sm:text-2xl">
                  Hoàn thành chặng!
                </h2>
                <p className="mt-2 text-sm text-[#5C6E60] dark:text-[#8B9E91]">
                  Bạn đã hoàn thành {activeStage.title} (Chương {selectedChapter} —{' '}
                  {activeStage.questions.length} câu hỏi).
                </p>

                <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="rounded-xl border border-[#68B99A] bg-[#E1F3EC] p-3 dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15">
                    <div className="text-lg font-bold text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                      {stageStats.mastered}
                    </div>
                    <div className="text-xs font-medium text-[#0F5C41] dark:text-[#6EE7B7]">
                      Đã thuộc
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#C9B3E6] bg-[#F3EDF9] p-3 dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15">
                    <div className="text-lg font-bold text-[#6D28D9] tabular-nums dark:text-[#D8B4FE]">
                      {stageStats.hesitant}
                    </div>
                    <div className="text-xs font-medium text-[#6D28D9] dark:text-[#D8B4FE]">
                      Phân vân
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#D2DACB] bg-[#E8ECE4] p-3 dark:border-[#25332B] dark:bg-[#222E27]">
                    <div className="text-lg font-bold text-[#142018] tabular-nums dark:text-[#F3F6F4]">
                      {stageStats.unlearned}
                    </div>
                    <div className="text-xs font-medium text-[#5C6E60] dark:text-[#8B9E91]">
                      Chưa thuộc
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                  {hasNextStage && (
                    <button
                      type="button"
                      onClick={() => startStageSession(activeStage.index + 1)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#2E6F4E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
                    >
                      <span>Sang Chặng {activeStage.index + 2}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startStageSession(activeStage.index, true)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#B8C7B0] bg-[#E3EFE8] px-4 py-2.5 text-sm font-semibold text-[#2E6F4E] transition hover:bg-[#D5E6DC] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] dark:hover:bg-[#357A58]/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Ôn tập lại chặng này</span>
                  </button>

                  {onResetStage && (
                    <button
                      type="button"
                      onClick={handleResetAndRestartStage}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-4 py-2.5 text-sm font-medium text-[#243329] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24]"
                    >
                      <span>Học lại chặng</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExitSession}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-4 py-2.5 text-sm font-medium text-[#5C6E60] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#2E6F4E] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91] dark:hover:border-[#52B788] dark:hover:text-[#F3F6F4]"
                  >
                    <span>Quay lại danh sách</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Question Card */
              <div
                key={`${currentQuestion.id}-${turnCounter}`}
                className="rounded-2xl border border-[#BCC9B4] border-t-2 border-t-[#2E6F4E] bg-white p-4 shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] dark:border-[#31453A] dark:border-t-2 dark:border-t-[#52B788] dark:bg-[#1B2620] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] sm:p-7 md:p-8"
              >
                {/* Card top badges + Desktop Phân vân toggle */}
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#D2DACB] pb-3 dark:border-[#222E27] sm:mb-5 sm:pb-4">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {(() => {
                      const qProg = progress.questions[currentQuestion.id];
                      const effectiveStreak =
                        gradedState !== null ? gradedState.nextStreak : (qProg?.streak ?? 0);
                      const isWrongState =
                        gradedState !== null ? !gradedState.isCorrect : qProg?.lastResult === 'wrong';

                      if (turnFlagged) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9B3E6] bg-[#F3EDF9] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE] sm:py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#6D28D9] dark:bg-[#D8B4FE]" />
                            Phân vân
                          </span>
                        );
                      }
                      if (effectiveStreak >= 2) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7] sm:py-1">
                            <span>✓ Đã thuộc (2/2)</span>
                            <span className="tracking-tighter opacity-90" aria-hidden="true">
                              ●●
                            </span>
                          </span>
                        );
                      }
                      if (effectiveStreak === 1) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5CBA7] bg-[#FEF5E7] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#B45309] dark:border-[#F59E0B]/50 dark:bg-[#F59E0B]/15 dark:text-[#FCD34D] sm:py-1">
                            <span>✓ Đúng 1/2 lần</span>
                            <span className="tracking-tighter opacity-90" aria-hidden="true">
                              ●○
                            </span>
                          </span>
                        );
                      }
                      if (isWrongState) {
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2B8AE] bg-[#FDF0ED] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5] sm:py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C2412D] dark:bg-[#FCA5A5]" />
                            Đã trả lời sai
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D2DACB] bg-[#E8ECE4] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#5C6E60] dark:border-[#25332B] dark:bg-[#222E27] dark:text-[#8B9E91] sm:py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#5C6E60] dark:bg-[#8B9E91]" />
                          Chưa thuộc
                        </span>
                      );
                    })()}

                    {currentQuestion.isMultiSelect && (
                      <span className="inline-flex items-center rounded-full border border-[#B8C7B0] bg-[#E3EFE8] px-2.5 py-0.5 text-[11px] font-semibold text-[#2E6F4E] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] sm:py-1 sm:text-xs">
                        Chọn nhiều đáp án
                      </span>
                    )}
                  </div>

                  {/* Desktop Flag Button */}
                  <button
                    type="button"
                    onClick={handleToggleFlag}
                    aria-pressed={turnFlagged}
                    className={`hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition lg:inline-flex ${
                      turnFlagged
                        ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] shadow-xs dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                        : 'border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] hover:border-[#C9B3E6] hover:bg-[#F3EDF9] hover:text-[#6D28D9] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91] dark:hover:border-[#C084FC]/50 dark:hover:bg-[#A855F7]/15 dark:hover:text-[#D8B4FE]'
                    }`}
                  >
                    <Flag
                      className={`h-3.5 w-3.5 ${
                        turnFlagged
                          ? 'fill-[#6D28D9] text-[#6D28D9] dark:fill-[#D8B4FE] dark:text-[#D8B4FE]'
                          : 'text-[#5C6E60] dark:text-[#8B9E91]'
                      }`}
                    />
                    <span>Phân vân</span>
                    <kbd
                      className={`ml-0.5 hidden rounded px-1 py-0.5 font-mono text-[10px] lg:inline-block ${
                        turnFlagged
                          ? 'border border-[#C9B3E6] bg-white text-[#6D28D9] dark:border-[#C084FC]/40 dark:bg-[#0D120F] dark:text-[#D8B4FE]'
                          : 'border border-[#D2DACB] bg-white text-[#5C6E60] dark:border-[#25332B] dark:bg-[#0D120F] dark:text-[#8B9E91]'
                      }`}
                    >
                      F
                    </kbd>
                  </button>
                </div>

                {/* Question Text */}
                <h3 className="text-[17px] font-semibold leading-[1.6] text-[#142018] dark:text-[#F3F6F4] sm:text-[19px] sm:leading-[1.65] md:text-[20px]">
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
                      'border-[#C5D1BE] bg-[#F5F7F2] text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E6F0EA] md:hover:translate-x-1 dark:border-[#384F42] dark:bg-[#223029] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#2A3C33]';
                    let badgeCls =
                      'border-[#B8C7B0] bg-white text-[#2E6F4E] group-hover:border-[#2E6F4E] group-hover:bg-[#2E6F4E] group-hover:text-white dark:border-[#384F42] dark:bg-[#151E19] dark:text-[#74C69D] dark:group-hover:border-[#52B788] dark:group-hover:bg-[#357A58] dark:group-hover:text-white';

                    if (!isGraded && isSelected) {
                      containerCls =
                        'border-[#2E6F4E] bg-[#E3EFE8] text-[#142018] ring-1 ring-[#2E6F4E] dark:border-[#52B788] dark:bg-[#263B31] dark:text-[#F3F6F4] dark:ring-[#52B788]';
                      badgeCls =
                        'border-[#2E6F4E] bg-[#2E6F4E] text-white dark:border-[#52B788] dark:bg-[#357A58] dark:text-white';
                    } else if (isGraded) {
                      if (isCorrectOption) {
                        containerCls =
                          'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]';
                        badgeCls =
                          'border-[#1F8A65] bg-[#1F8A65] text-white dark:border-[#38A179] dark:bg-[#38A179] dark:text-[#0D120F]';
                      } else if (isSelected && !isCorrectOption) {
                        containerCls =
                          'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]';
                        badgeCls =
                          'border-[#C2412D] bg-[#C2412D] text-white dark:border-[#E05A47] dark:bg-[#E05A47] dark:text-[#0D120F]';
                      } else {
                        containerCls =
                          'border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] dark:border-[#222E27] dark:bg-[#131A16]/70 dark:text-[#8B9E91]';
                        badgeCls =
                          'border-[#D2DACB] bg-[#E8ECE4] text-[#5C6E60] dark:border-[#25332B] dark:bg-[#0D120F] dark:text-[#8B9E91]';
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
                            <kbd className="hidden rounded border border-[#D2DACB] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#5C6E60] dark:border-[#384F42] dark:bg-[#151E19] dark:text-[#8B9E91] lg:inline-block">
                              {idx + 1}
                            </kbd>
                          )}
                          {isGraded && isCorrectOption && (
                            <Check className="h-4 w-4 text-[#1F8A65] dark:text-[#6EE7B7]" />
                          )}
                          {isGraded && isSelected && !isCorrectOption && (
                            <X className="h-4 w-4 text-[#C2412D] dark:text-[#FCA5A5]" />
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
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#2E6F4E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#23583D] disabled:cursor-not-allowed disabled:border disabled:border-[#D2DACB] disabled:bg-[#E8ECE4] disabled:text-[#5C6E60] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649] dark:disabled:border-[#25332B] dark:disabled:bg-[#222E27] dark:disabled:text-[#8B9E91]"
                    >
                      <span>Kiểm tra đáp án</span>
                      <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white lg:inline-block">
                        Enter
                      </kbd>
                    </button>
                  </div>
                )}

                {/* Graded feedback & explanation with auto-scroll target */}
                {gradedState !== null && (
                  <div
                    ref={explanationRef}
                    className="mt-5 scroll-mt-4 scroll-mb-24 space-y-4 border-t border-[#D2DACB] pt-4 dark:border-[#222E27] sm:mt-6 sm:space-y-5 sm:pt-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold sm:px-3.5 sm:text-sm ${
                          gradedState.isCorrect
                            ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                            : 'border-[#F2B8AE] bg-[#FDF0ED] text-[#C2412D] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5]'
                        }`}
                      >
                        {gradedState.isCorrect ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-[#1F8A65] dark:text-[#6EE7B7]" />
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
                            <X className="h-4 w-4 text-[#C2412D] dark:text-[#FCA5A5]" />
                            <span>
                              Chưa đúng · Đáp án đúng:{' '}
                              {currentQuestion.correctAnswers.join(', ')}
                            </span>
                          </>
                        )}
                      </div>

                      {turnFlagged && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#C9B3E6] bg-[#F3EDF9] px-2.5 py-1 text-xs font-medium text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]">
                          <Flag className="h-3.5 w-3.5 text-[#6D28D9] dark:text-[#D8B4FE]" />
                          Đang đánh dấu phân vân
                        </span>
                      )}
                    </div>

                    <RichExplanation question={currentQuestion} />

                    <div className="hidden justify-end lg:flex">
                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#2E6F4E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
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
              <div className="hidden items-center justify-center gap-4 text-xs text-[#5C6E60] dark:text-[#8B9E91] lg:flex">
                <span>
                  <kbd className="rounded border border-[#D2DACB] bg-[#E8ECE4] px-1.5 py-0.5 font-mono text-[11px] text-[#243329] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#DDE5DF]">
                    1-4
                  </kbd>{' '}
                  hoặc{' '}
                  <kbd className="rounded border border-[#D2DACB] bg-[#E8ECE4] px-1.5 py-0.5 font-mono text-[11px] text-[#243329] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#DDE5DF]">
                    A-D
                  </kbd>{' '}
                  chọn đáp án
                </span>
                <span>·</span>
                <span>
                  <kbd className="rounded border border-[#D2DACB] bg-[#E8ECE4] px-1.5 py-0.5 font-mono text-[11px] text-[#243329] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#DDE5DF]">
                    F
                  </kbd>{' '}
                  Phân vân
                </span>
                <span>·</span>
                <span>
                  <kbd className="rounded border border-[#D2DACB] bg-[#E8ECE4] px-1.5 py-0.5 font-mono text-[11px] text-[#243329] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#DDE5DF]">
                    Enter
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-[#D2DACB] bg-[#E8ECE4] px-1.5 py-0.5 font-mono text-[11px] text-[#243329] dark:border-[#222E27] dark:bg-[#131A16] dark:text-[#DDE5DF]">
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
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D2DACB] bg-[#E8ECE4]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(30,58,42,0.08)] backdrop-blur dark:border-[#222E27] dark:bg-[#131A16]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.5)] lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleExitSession}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-2.5 text-xs font-semibold text-[#243329] transition dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
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
                    ? 'border-[#C9B3E6] bg-[#F3EDF9] text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]'
                    : 'border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91]'
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
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2E6F4E] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#23583D] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
                >
                  <Check className="h-4 w-4" />
                  <span>Kiểm tra ({selectedOptions.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={gradedState === null}
                  onClick={handleNext}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2E6F4E] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#23583D] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]"
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
                className="fixed inset-0 z-50 bg-[#142018]/50 backdrop-blur-[2px] dark:bg-[#0D120F]/75 lg:hidden"
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
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[#D2DACB] bg-[#E8ECE4] shadow-2xl dark:border-[#222E27] dark:bg-[#131A16] lg:hidden"
              >
                <div className="flex flex-col items-center border-b border-[#D2DACB] px-4 pb-3 pt-2.5 dark:border-[#222E27]">
                  <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D2DACB] dark:bg-[#31453A]" />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">
                        Chương {selectedChapter} • Chọn chặng
                      </h3>
                      <p className="text-xs text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                        {chapterStats.mastered}/{chapterStats.total} câu đã thuộc ({chapterStats.percent}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStageSheetOpen(false)}
                      aria-label="Đóng ngăn kéo"
                      className="cursor-pointer rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-1.5 text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
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
                            ? 'border-[#2E6F4E] bg-[#E3EFE8] text-[#142018] dark:border-[#52B788] dark:bg-[#263B31] dark:text-[#F3F6F4]'
                            : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">
                            {stage.title} · Câu {stage.startIndex}–{stage.endIndex}
                          </div>
                          <div className="text-[11px] text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                            Thuộc {stats.mastered}/{stats.total} · Phân vân {stats.hesitant}
                          </div>
                        </div>
                        <span className="rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-xs font-bold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
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
                    className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-4 py-2.5 text-xs font-semibold text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
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
        <div className="mb-5 rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] p-4 shadow-xs dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-none sm:p-6 md:mb-8 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8C7B0] bg-[#E3EFE8] text-[#2E6F4E] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] sm:h-11 sm:w-11">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#142018] dark:text-[#F3F6F4] sm:text-xl">
                  Học cuốn chiếu
                </h2>
                <span className="rounded-md border border-[#B8C7B0] bg-[#E3EFE8] px-2 py-0.5 text-xs font-semibold text-[#2E6F4E] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                  {subjectMeta.code}
                </span>
              </div>
            </div>

            <div className="hidden items-center gap-4 text-sm sm:flex">
              <div className="text-right">
                <div className="text-xs text-[#5C6E60] dark:text-[#8B9E91]">Tiến độ chương đang chọn</div>
                <div className="font-bold text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
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
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3.5 py-2.5 text-left text-xs font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#2E6F4E] dark:text-[#52B788]" />
                <span className="truncate">
                  Chương {selectedChapter}: {currentChapterMeta?.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2 py-0.5 text-[11px] font-bold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                  {chapterStats.percent}%
                </span>
                <ChevronDown className="h-4 w-4 text-[#5C6E60] dark:text-[#8B9E91]" />
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
                      ? 'border-[#2E6F4E] bg-[#2E6F4E] text-white shadow-sm hover:bg-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]'
                      : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E3EFE8] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24]'
                  }`}
                >
                  <span className="font-semibold">Chương {ch.chapter}</span>
                  <span className="rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2 py-0.5 text-xs font-semibold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#0D120F]/85 dark:text-[#6EE7B7]">
                    {stats.percent}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Overall Chapter Progress Bar */}
          {currentChapterMeta && (
            <div className="mt-3.5 rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-3.5 dark:border-[#25332B] dark:bg-[#17201B] sm:mt-5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="hidden text-sm font-semibold text-[#2E6F4E] dark:text-[#74C69D] md:block">
                  Chương {currentChapterMeta.chapter}: {currentChapterMeta.title}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                  <span className="inline-flex items-center gap-1.5 text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                    <span className="h-2 w-2 rounded-full bg-[#1F8A65] dark:bg-[#38A179]" />
                    Đã thuộc: {chapterStats.mastered}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#6D28D9] tabular-nums dark:text-[#D8B4FE]">
                    <span className="h-2 w-2 rounded-full bg-[#6D28D9] dark:bg-[#D8B4FE]" />
                    Phân vân: {chapterStats.hesitant}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                    <span className="h-2 w-2 rounded-full bg-[#5C6E60] dark:bg-[#8B9E91]" />
                    Chưa thuộc: {chapterStats.unlearned}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#D2DACB] dark:bg-[#0D120F] sm:mt-3 sm:h-2.5">
                <div
                  className="h-full rounded-full bg-[#1F8A65] transition-all duration-300 dark:bg-[#38A179]"
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
                className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-[#E8ECE4] p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#131A16] dark:shadow-none sm:p-6 ${
                  isCompleted
                    ? 'border-[#68B99A] hover:border-[#1F8A65] hover:bg-[#E3EFE8] dark:border-[#52B788]/60 dark:hover:border-[#38A179] dark:hover:bg-[#1E2B24]'
                    : 'border-[#D2DACB] hover:border-[#2E6F4E] hover:bg-[#E3EFE8] dark:border-[#222E27] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24]'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${
                          isCompleted
                            ? 'border-[#68B99A] bg-[#E1F3EC] text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]'
                            : 'border-[#B8C7B0] bg-[#E3EFE8] text-[#2E6F4E] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                        }`}
                      >
                        {stage.index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-[#142018] dark:text-[#F3F6F4]">{stage.title}</div>
                        <div className="text-xs text-[#5C6E60] tabular-nums dark:text-[#8B9E91]">
                          {stage.questions.length} câu · Câu {stage.startIndex}–{stage.endIndex}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-xs font-bold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                      {stats.percent}%
                    </span>
                  </div>

                  {/* Stage progress bar */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                      <span>Đã thuộc</span>
                      <span className="font-semibold text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                        {stats.mastered}/{stats.total}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#D2DACB] dark:bg-[#0D120F]">
                      <div
                        className="h-full rounded-full bg-[#1F8A65] transition-all duration-300 dark:bg-[#38A179]"
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* 3 Status counts */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-[#68B99A] bg-[#E1F3EC] px-2 py-1.5 text-center dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15">
                      <div className="text-sm font-bold text-[#0F5C41] tabular-nums dark:text-[#6EE7B7]">
                        {stats.mastered}
                      </div>
                      <div className="text-[11px] font-medium text-[#0F5C41] dark:text-[#6EE7B7]">
                        Đã thuộc
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#C9B3E6] bg-[#F3EDF9] px-2 py-1.5 text-center dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15">
                      <div className="text-sm font-bold text-[#6D28D9] tabular-nums dark:text-[#D8B4FE]">
                        {stats.hesitant}
                      </div>
                      <div className="text-[11px] font-medium text-[#6D28D9] dark:text-[#D8B4FE]">
                        Phân vân
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#D2DACB] bg-[#F7F8F5] px-2 py-1.5 text-center dark:border-[#25332B] dark:bg-[#222E27]">
                      <div className="text-sm font-bold text-[#142018] tabular-nums dark:text-[#F3F6F4]">
                        {stats.unlearned}
                      </div>
                      <div className="text-[11px] font-medium text-[#5C6E60] dark:text-[#8B9E91]">
                        Chưa thuộc
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex w-full items-center justify-between border-t border-[#D2DACB] pt-3 text-xs font-semibold dark:border-[#222E27]">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 text-[#0F5C41] dark:text-[#6EE7B7]">
                      <CheckCircle2 className="h-4 w-4 text-[#1F8A65] dark:text-[#38A179]" />
                      Đã thuộc toàn bộ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#2E6F4E] dark:text-[#74C69D]">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {stats.mastered > 0 || stats.hesitant > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[#5C6E60] transition group-hover:translate-x-0.5 group-hover:text-[#2E6F4E] dark:text-[#8B9E91] dark:group-hover:text-[#52B788]" />
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
              className="fixed inset-0 z-50 bg-[#142018]/50 backdrop-blur-[2px] dark:bg-[#0D120F]/75 md:hidden"
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
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[#D2DACB] bg-[#E8ECE4] shadow-2xl dark:border-[#222E27] dark:bg-[#131A16] md:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D2DACB] px-4 pb-3 pt-2.5 dark:border-[#222E27]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D2DACB] dark:bg-[#31453A]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">
                      {subjectMeta.code} • Chọn chương
                    </h3>
                    <p className="text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                      Chạm vào chương để xem các chặng học
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChapterSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-1.5 text-[#5C6E60] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]"
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
                          ? 'border-[#2E6F4E] bg-[#E3EFE8] text-[#142018] dark:border-[#52B788] dark:bg-[#263B31] dark:text-[#F3F6F4]'
                          : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold">
                          Chương {ch.chapter}{' '}
                          <span className="font-normal text-[#5C6E60] dark:text-[#8B9E91]">
                            ({stats.mastered}/{stats.total} câu)
                          </span>
                        </div>
                        <div className="truncate text-xs opacity-85">{ch.title}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-0.5 text-xs font-semibold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
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
