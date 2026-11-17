import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  Layers,
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

  // Reset chapter & active session when switching subjects
  useEffect(() => {
    setSelectedChapter(chapters[0]?.chapter ?? 1);
    setActiveStageIndex(null);
    setQueue([]);
    setSelectedOptions([]);
    setGradedState(null);
    setTurnFlagged(false);
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
    },
    [currentQuestion, gradedState, progress.questions, turnFlagged, onRecordAttempt]
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
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Session Header */}
        <div className="rounded-2xl border border-[#D5E3EC] bg-white p-5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleExitSession}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] px-3.5 py-1.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/70 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Danh sách chặng</span>
            </button>

            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              <span className="rounded-md border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                Chương {selectedChapter}
              </span>
              <span>{activeStage.title}</span>
              <span className="text-[#64748B] dark:text-[#94A3B8]">·</span>
              <span className="font-normal text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                {activeStage.questions.length} câu
              </span>
            </div>

            {currentQuestion ? (
              <div className="rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-3 py-1 text-xs font-semibold text-[#0284C7] tabular-nums dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                Còn {queue.length} câu
              </div>
            ) : (
              <div className="rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-3 py-1 text-xs font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                Hoàn thành
              </div>
            )}
          </div>

          {/* Stage mastery progress bar */}
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Tiến độ chặng</span>
              <span className="font-semibold text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                Đã thuộc {stageStats.mastered}/{stageStats.total} ({stageStats.percent}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#0B1120]">
              <div
                className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                style={{ width: `${stageStats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stage Completion Card */}
        {!currentQuestion ? (
          <div className="rounded-2xl border border-[#D5E3EC] bg-white p-8 text-center shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#5EEAD4] bg-[#F0FDFA] text-[#0D9488] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#14B8A6]">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Hoàn thành chặng!
            </h2>
            <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              Bạn đã hoàn thành {activeStage.title} (Chương {selectedChapter} —{' '}
              {activeStage.questions.length} câu hỏi).
            </p>

            <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#5EEAD4] bg-[#F0FDFA] p-3 dark:border-[#2DD4BF] dark:bg-[#134E4A]/40">
                <div className="text-lg font-bold text-[#115E59] tabular-nums dark:text-[#2DD4BF]">
                  {stageStats.mastered}
                </div>
                <div className="text-xs font-medium text-[#115E59] dark:text-[#14B8A6]">
                  Đã thuộc
                </div>
              </div>
              <div className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] p-3 dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60">
                <div className="text-lg font-bold text-[#4F46E5] tabular-nums dark:text-[#818CF8]">
                  {stageStats.hesitant}
                </div>
                <div className="text-xs font-medium text-[#4F46E5] dark:text-[#818CF8]">
                  Phân vân
                </div>
              </div>
              <div className="rounded-xl border border-[#D5E3EC] bg-[#F8FAFC] p-3 dark:border-[#334155] dark:bg-[#1E293B]/60">
                <div className="text-lg font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                  {stageStats.unlearned}
                </div>
                <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  Chưa thuộc
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {hasNextStage && (
                <button
                  type="button"
                  onClick={() => startStageSession(activeStage.index + 1)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
                >
                  <span>Sang Chặng {activeStage.index + 2}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => startStageSession(activeStage.index, true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] px-4 py-2.5 text-sm font-semibold text-[#0284C7] transition hover:bg-[#BAE6FD]/60 dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] dark:hover:bg-[#0284C7]/25"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Ôn tập lại chặng này</span>
              </button>

              {onResetStage && (
                <button
                  type="button"
                  onClick={handleResetAndRestartStage}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-sm font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1E293B]"
                >
                  <span>Học lại chặng</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExitSession}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#0284C7] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#94A3B8] dark:hover:border-[#38BDF8] dark:hover:text-[#F8FAFC]"
              >
                <span>Quay lại danh sách</span>
              </button>
            </div>
          </div>
        ) : (
          /* Question Card */
          <div
            key={`${currentQuestion.id}-${turnCounter}`}
            className="rounded-2xl border border-[#D5E3EC] bg-white p-7 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-9"
          >
            {/* Card top badges + Phân vân toggle */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#D5E3EC] pb-4 dark:border-[#1E293B]">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const baseState = getMasteryState(progress.questions[currentQuestion.id]);
                  const displayState = turnFlagged ? 'hesitant' : baseState;
                  if (displayState === 'mastered') {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-1 text-xs font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
                        Đã thuộc
                      </span>
                    );
                  }
                  if (displayState === 'hesitant') {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-xs font-semibold text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
                        Phân vân
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5E3EC] bg-[#F1F6F9] px-2.5 py-1 text-xs font-semibold text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                      Chưa thuộc
                    </span>
                  );
                })()}

                {currentQuestion.isMultiSelect && (
                  <span className="inline-flex items-center rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                    Chọn nhiều đáp án
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleFlag}
                aria-pressed={turnFlagged}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  turnFlagged
                    ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] shadow-xs dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                    : 'border-[#D5E3EC] bg-white text-[#64748B] hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#94A3B8] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#1E1B4B]/60 dark:hover:text-[#818CF8]'
                }`}
              >
                <Flag
                  className={`h-3.5 w-3.5 ${
                    turnFlagged
                      ? 'fill-[#4F46E5] text-[#4F46E5] dark:fill-[#818CF8] dark:text-[#818CF8]'
                      : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                />
                <span>Phân vân</span>
                <kbd
                  className={`ml-0.5 rounded px-1 py-0.5 font-mono text-[10px] ${
                    turnFlagged
                      ? 'border border-[#C7D2FE] bg-white text-[#4F46E5] dark:border-[#818CF8]/40 dark:bg-[#0B1120] dark:text-[#818CF8]'
                      : 'border border-[#D5E3EC] bg-[#F1F6F9] text-[#64748B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#94A3B8]'
                  }`}
                >
                  F
                </kbd>
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-[19px] font-semibold leading-[1.65] text-[#0F172A] dark:text-[#F8FAFC] sm:text-[20px]">
              {currentQuestion.question}
            </h3>

            {/* Options */}
            <div className="mt-6 space-y-3.5">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedOptions.includes(opt.key);
                const isCorrectOption = currentQuestion.correctAnswers
                  .map(c => c.toUpperCase())
                  .includes(opt.key.toUpperCase());
                const isGraded = gradedState !== null;

                let containerCls =
                  'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:translate-x-1 dark:border-[#334155] dark:bg-[#1E293B]/50 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20';
                let badgeCls =
                  'border-[#D5E3EC] bg-[#F1F6F9] text-[#1E293B] dark:border-[#475569] dark:bg-[#0B1120] dark:text-[#E2E8F0]';

                if (!isGraded && isSelected) {
                  containerCls =
                    'border-[#0284C7] bg-[#E0F2FE] text-[#0F172A] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/25 dark:text-[#F8FAFC] dark:ring-[#38BDF8]';
                  badgeCls = 'border-[#0284C7] bg-[#0284C7] text-white dark:border-[#38BDF8]';
                } else if (isGraded) {
                  if (isCorrectOption) {
                    containerCls =
                      'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#CCFBF1]';
                    badgeCls =
                      'border-[#0D9488] bg-[#0D9488] text-white dark:border-[#14B8A6] dark:bg-[#14B8A6] dark:text-[#0B1120]';
                  } else if (isSelected && !isCorrectOption) {
                    containerCls =
                      'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]';
                    badgeCls =
                      'border-[#E11D48] bg-[#E11D48] text-white dark:border-[#FB7185] dark:bg-[#FB7185] dark:text-[#0B1120]';
                  } else {
                    containerCls =
                      'border-[#D5E3EC] bg-[#F8FAFC] text-[#64748B] dark:border-[#1E293B] dark:bg-[#0B1120]/50 dark:text-[#94A3B8]';
                    badgeCls =
                      'border-[#D5E3EC] bg-[#F1F6F9] text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]';
                  }
                }

                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isGraded}
                    onClick={() => handleOptionClick(opt.key)}
                    className={`flex w-full items-start gap-3.5 rounded-xl border p-4 px-5 text-left transition-all duration-150 ${containerCls} ${
                      isGraded ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition ${badgeCls}`}
                    >
                      {opt.key}
                    </span>

                    <span className="flex-1 pt-0.5 text-[16px] font-medium leading-relaxed">
                      {opt.text}
                    </span>

                    <span className="mt-1 flex shrink-0 items-center gap-1.5">
                      {!isGraded && (
                        <kbd className="hidden rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[10px] text-[#64748B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#94A3B8] sm:inline-block">
                          {idx + 1}
                        </kbd>
                      )}
                      {isGraded && isCorrectOption && (
                        <Check className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                      )}
                      {isGraded && isSelected && !isCorrectOption && (
                        <X className="h-4 w-4 text-[#E11D48] dark:text-[#FB7185]" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Multi-select submit button */}
            {gradedState === null && currentQuestion.isMultiSelect && (
              <div className="mt-5 flex items-center justify-end">
                <button
                  type="button"
                  disabled={selectedOptions.length === 0}
                  onClick={() => gradeSubmission(selectedOptions)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#64748B] dark:border dark:border-[#38BDF8]/50 dark:disabled:border-[#334155] dark:disabled:bg-[#1E293B] dark:disabled:text-[#64748B]"
                >
                  <span>Kiểm tra đáp án</span>
                  <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-100 sm:inline-block">
                    Enter
                  </kbd>
                </button>
              </div>
            )}

            {/* Graded feedback & explanation */}
            {gradedState !== null && (
              <div className="mt-6 space-y-5 border-t border-[#D5E3EC] pt-5 dark:border-[#1E293B]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm font-semibold ${
                      gradedState.isCorrect
                        ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                        : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]'
                    }`}
                  >
                    {gradedState.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                        <span>Chính xác!</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-[#E11D48] dark:text-[#FB7185]" />
                        <span>
                          Chưa chính xác · Đáp án đúng:{' '}
                          {currentQuestion.correctAnswers.join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  {turnFlagged && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]">
                      <Flag className="h-3.5 w-3.5 text-[#4F46E5] dark:text-[#818CF8]" />
                      Đang đánh dấu phân vân
                    </span>
                  )}
                </div>

                <RichExplanation question={currentQuestion} />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
                  >
                    <span>Câu tiếp theo</span>
                    <ArrowRight className="h-4 w-4" />
                    <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-100 sm:inline-block">
                      Enter
                    </kbd>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        {currentQuestion && (
          <div className="hidden sm:flex items-center justify-center gap-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span>
              <kbd className="rounded border border-[#D5E3EC] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#E2E8F0]">
                1-4
              </kbd>{' '}
              hoặc{' '}
              <kbd className="rounded border border-[#D5E3EC] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#E2E8F0]">
                A-D
              </kbd>{' '}
              chọn đáp án
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded border border-[#D5E3EC] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#E2E8F0]">
                F
              </kbd>{' '}
              Phân vân
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded border border-[#D5E3EC] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#E2E8F0]">
                Enter
              </kbd>{' '}
              /{' '}
              <kbd className="rounded border border-[#D5E3EC] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#1E293B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#E2E8F0]">
                Space
              </kbd>{' '}
              tiếp tục
            </span>
          </div>
        )}
      </div>
    );
  }

  // Chapter & Stage Overview
  return (
    <div>
      {/* Header Banner */}
      <div className="mb-8 rounded-2xl border border-[#D5E3EC] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">Học cuốn chiếu</h2>
                <span className="rounded-md border border-[#BAE6FD] bg-[#E0F2FE] px-2 py-0.5 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  {subjectMeta.code}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Chia nhỏ câu hỏi theo từng chặng để học chắc từng phần.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">Tiến độ chương đang chọn</div>
              <div className="font-bold text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                {chapterStats.mastered}/{chapterStats.total} câu đã thuộc ({chapterStats.percent}%)
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Selector */}
        <div className="mt-5 flex flex-wrap gap-2.5">
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
                    ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-sm hover:bg-[#0369A1] dark:border-[#38BDF8]/60'
                    : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20'
                }`}
              >
                <span className="font-semibold">Chương {ch.chapter}</span>
                <span className="rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2 py-0.5 text-xs font-semibold text-[#115E59] tabular-nums dark:border-[#2DD4BF]/70 dark:bg-[#0B1120]/85 dark:text-[#2DD4BF]">
                  {stats.percent}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Overall Chapter Progress Bar */}
        {currentChapterMeta && (
          <div className="mt-5 rounded-xl border border-[#D5E3EC] bg-[#F8FAFC] p-4 dark:border-[#334155] dark:bg-[#0B1120]/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                Chương {currentChapterMeta.chapter}: {currentChapterMeta.title}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-[#115E59] tabular-nums dark:text-[#2DD4BF]">
                  <span className="h-2 w-2 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
                  Đã thuộc: {chapterStats.mastered}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#4F46E5] tabular-nums dark:text-[#818CF8]">
                  <span className="h-2 w-2 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
                  Phân vân: {chapterStats.hesitant}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                  <span className="h-2 w-2 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                  Chưa thuộc: {chapterStats.unlearned}
                </span>
              </div>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]">
              <div
                className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                style={{ width: `${chapterStats.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stage Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map(stage => {
          const stats = getStageStats(stage.questions, progress);
          const isCompleted = stats.mastered === stats.total && stats.total > 0;

          return (
            <button
              key={stage.index}
              type="button"
              onClick={() => startStageSession(stage.index)}
              className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-6 text-left shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] ${
                isCompleted
                  ? 'border-[#5EEAD4] hover:border-[#0D9488] dark:border-[#2DD4BF]/60 dark:hover:border-[#14B8A6]'
                  : 'border-[#D5E3EC] hover:border-[#0284C7] dark:border-[#1E293B] dark:hover:border-[#38BDF8]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${
                        isCompleted
                          ? 'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]'
                          : 'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                      }`}
                    >
                      {stage.index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{stage.title}</div>
                      <div className="text-xs text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                        {stage.questions.length} câu · Câu {stage.startIndex}–{stage.endIndex}
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-0.5 text-xs font-bold text-[#115E59] tabular-nums dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                    {stats.percent}%
                  </span>
                </div>

                {/* Stage progress bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <span>Đã thuộc</span>
                    <span className="font-semibold text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                      {stats.mastered}/{stats.total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#0B1120]">
                    <div
                      className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                {/* 3 Status counts */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-[#5EEAD4] bg-[#F0FDFA] px-2 py-1.5 text-center dark:border-[#2DD4BF] dark:bg-[#134E4A]/40">
                    <div className="text-sm font-bold text-[#115E59] tabular-nums dark:text-[#2DD4BF]">
                      {stats.mastered}
                    </div>
                    <div className="text-[11px] font-medium text-[#115E59] dark:text-[#14B8A6]">
                      Đã thuộc
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-1.5 text-center dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60">
                    <div className="text-sm font-bold text-[#4F46E5] tabular-nums dark:text-[#818CF8]">
                      {stats.hesitant}
                    </div>
                    <div className="text-[11px] font-medium text-[#4F46E5] dark:text-[#818CF8]">
                      Phân vân
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#D5E3EC] bg-[#F8FAFC] px-2 py-1.5 text-center dark:border-[#334155] dark:bg-[#1E293B]/60">
                    <div className="text-sm font-bold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                      {stats.unlearned}
                    </div>
                    <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                      Chưa thuộc
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#D5E3EC] pt-3 text-xs font-semibold dark:border-[#1E293B]">
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1.5 text-[#0D9488] dark:text-[#2DD4BF]">
                    <CheckCircle2 className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                    Đã thuộc toàn bộ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#0284C7] dark:text-[#38BDF8]">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {stats.mastered > 0 || stats.hesitant > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-[#64748B] transition group-hover:translate-x-0.5 group-hover:text-[#0284C7] dark:text-[#94A3B8] dark:group-hover:text-[#38BDF8]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
