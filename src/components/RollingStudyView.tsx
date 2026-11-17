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
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Session Header */}
        <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleExitSession}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Danh sách chặng</span>
            </button>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                Chương {selectedChapter}
              </span>
              <span>{activeStage.title}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-normal tabular-nums">
                {activeStage.questions.length} câu
              </span>
            </div>

            {currentQuestion ? (
              <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 tabular-nums border border-sky-200">
                Còn {queue.length} câu
              </div>
            ) : (
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                Hoàn thành
              </div>
            )}
          </div>

          {/* Stage mastery progress bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Tiến độ chặng</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                Đã thuộc {stageStats.mastered}/{stageStats.total} ({stageStats.percent}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${stageStats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stage Completion Card */}
        {!currentQuestion ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Hoàn thành chặng!</h2>
            <p className="mt-2 text-sm text-slate-600">
              Bạn đã hoàn thành {activeStage.title} (Chương {selectedChapter} —{' '}
              {activeStage.questions.length} câu hỏi).
            </p>

            <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                <div className="text-lg font-bold text-emerald-700 tabular-nums">
                  {stageStats.mastered}
                </div>
                <div className="text-xs font-medium text-emerald-700">Đã thuộc</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <div className="text-lg font-bold text-amber-700 tabular-nums">
                  {stageStats.hesitant}
                </div>
                <div className="text-xs font-medium text-amber-700">Phân vân</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-lg font-bold text-slate-700 tabular-nums">
                  {stageStats.unlearned}
                </div>
                <div className="text-xs font-medium text-slate-600">Chưa thuộc</div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {hasNextStage && (
                <button
                  type="button"
                  onClick={() => startStageSession(activeStage.index + 1)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  <span>Sang Chặng {activeStage.index + 2}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => startStageSession(activeStage.index, true)}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Ôn tập lại chặng này</span>
              </button>

              {onResetStage && (
                <button
                  type="button"
                  onClick={handleResetAndRestartStage}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span>Học lại chặng</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExitSession}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <span>Quay lại danh sách</span>
              </button>
            </div>
          </div>
        ) : (
          /* Question Card */
          <div
            key={`${currentQuestion.id}-${turnCounter}`}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm"
          >
            {/* Card top badges + Phân vân toggle */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const baseState = getMasteryState(progress.questions[currentQuestion.id]);
                  const displayState = turnFlagged ? 'hesitant' : baseState;
                  if (displayState === 'mastered') {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Đã thuộc
                      </span>
                    );
                  }
                  if (displayState === 'hesitant') {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                        Phân vân
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Chưa thuộc
                    </span>
                  );
                })()}

                {currentQuestion.isMultiSelect && (
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    Chọn nhiều đáp án
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleFlag}
                aria-pressed={turnFlagged}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  turnFlagged
                    ? 'border-[#F59E0B] bg-[#F59E0B] text-white shadow-sm'
                    : 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Phân vân</span>
                <kbd
                  className={`ml-0.5 rounded px-1 py-0.5 font-mono text-[10px] ${
                    turnFlagged ? 'bg-amber-600/80 text-white' : 'bg-white text-amber-700 border border-amber-200'
                  }`}
                >
                  F
                </kbd>
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-base sm:text-lg font-semibold leading-relaxed text-slate-900">
              {currentQuestion.question}
            </h3>

            {/* Options */}
            <div className="mt-5 space-y-2.5">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedOptions.includes(opt.key);
                const isCorrectOption = currentQuestion.correctAnswers
                  .map(c => c.toUpperCase())
                  .includes(opt.key.toUpperCase());
                const isGraded = gradedState !== null;

                let containerCls =
                  'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40 text-slate-800';
                let badgeCls = 'border-slate-200 bg-slate-50 text-slate-600';

                if (!isGraded && isSelected) {
                  containerCls = 'border-[#0284C7] bg-sky-50 text-sky-950 ring-1 ring-[#0284C7]';
                  badgeCls = 'border-[#0284C7] bg-[#0284C7] text-white';
                } else if (isGraded) {
                  if (isCorrectOption) {
                    containerCls = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                    badgeCls = 'border-emerald-600 bg-emerald-600 text-white';
                  } else if (isSelected && !isCorrectOption) {
                    containerCls = 'border-rose-400 bg-rose-50 text-rose-950';
                    badgeCls = 'border-rose-500 bg-rose-500 text-white';
                  } else {
                    containerCls = 'border-slate-200 bg-slate-50/50 text-slate-500';
                    badgeCls = 'border-slate-200 bg-slate-100 text-slate-400';
                  }
                }

                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isGraded}
                    onClick={() => handleOptionClick(opt.key)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${containerCls} ${
                      isGraded ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition ${badgeCls}`}
                    >
                      {opt.key}
                    </span>

                    <span className="flex-1 text-sm sm:text-[15px] leading-relaxed">
                      {opt.text}
                    </span>

                    <span className="mt-0.5 shrink-0 flex items-center gap-1.5">
                      {!isGraded && (
                        <kbd className="hidden sm:inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </kbd>
                      )}
                      {isGraded && isCorrectOption && (
                        <Check className="h-4 w-4 text-emerald-600" />
                      )}
                      {isGraded && isSelected && !isCorrectOption && (
                        <X className="h-4 w-4 text-rose-500" />
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
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <span>Kiểm tra đáp án</span>
                  <kbd className="hidden sm:inline-block rounded bg-sky-700/60 px-1.5 py-0.5 font-mono text-[10px] text-sky-100">
                    Enter
                  </kbd>
                </button>
              </div>
            )}

            {/* Graded feedback & explanation */}
            {gradedState !== null && (
              <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      gradedState.isCorrect
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {gradedState.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Chính xác!</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        <span>
                          Chưa chính xác · Đáp án đúng:{' '}
                          {currentQuestion.correctAnswers.join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  {turnFlagged && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <Flag className="h-3.5 w-3.5 text-[#F59E0B]" />
                      Đang đánh dấu phân vân
                    </span>
                  )}
                </div>

                <RichExplanation question={currentQuestion} />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    <span>Câu tiếp theo</span>
                    <ArrowRight className="h-4 w-4" />
                    <kbd className="hidden sm:inline-block rounded bg-sky-700/60 px-1.5 py-0.5 font-mono text-[10px] text-sky-100">
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
          <div className="hidden sm:flex items-center justify-center gap-4 text-xs text-slate-400">
            <span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                1-4
              </kbd>{' '}
              hoặc{' '}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                A-D
              </kbd>{' '}
              chọn đáp án
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                F
              </kbd>{' '}
              Phân vân
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                Enter
              </kbd>{' '}
              /{' '}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-sky-100 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0284C7] border border-sky-200">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Học cuốn chiếu</h2>
                <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                  {subjectMeta.code}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                Chia nhỏ câu hỏi theo từng chặng để học chắc từng phần.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="text-xs text-slate-500">Tiến độ chương đang chọn</div>
              <div className="font-bold text-slate-900 tabular-nums">
                {chapterStats.mastered}/{chapterStats.total} câu đã thuộc ({chapterStats.percent}%)
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Selector */}
        <div className="mt-5 flex flex-wrap gap-2">
          {chapters.map(ch => {
            const isSelected = ch.chapter === selectedChapter;
            const chQuestions = allSubjectQuestions.filter(q => q.chapter === ch.chapter);
            const stats = getStageStats(chQuestions, progress);

            return (
              <button
                key={ch.chapter}
                type="button"
                onClick={() => setSelectedChapter(ch.chapter)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-sm transition ${
                  isSelected
                    ? 'border-[#0284C7] bg-sky-50 text-sky-900 shadow-sm ring-1 ring-[#0284C7]/30'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/40'
                }`}
              >
                <span className="font-semibold">Chương {ch.chapter}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    stats.percent === 100
                      ? 'bg-emerald-100 text-emerald-700'
                      : isSelected
                        ? 'bg-[#0284C7] text-white'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stats.percent}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Overall Chapter Progress Bar */}
        {currentChapterMeta && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">
                Chương {currentChapterMeta.chapter}: {currentChapterMeta.title}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 tabular-nums">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Đã thuộc: {chapterStats.mastered}
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-700 tabular-nums">
                  <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                  Phân vân: {chapterStats.hesitant}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-600 tabular-nums">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Chưa thuộc: {chapterStats.unlearned}
                </span>
              </div>
            </div>

            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0284C7] to-emerald-500 transition-all duration-300"
                style={{ width: `${chapterStats.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stage Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map(stage => {
          const stats = getStageStats(stage.questions, progress);
          const isCompleted = stats.mastered === stats.total && stats.total > 0;

          return (
            <button
              key={stage.index}
              type="button"
              onClick={() => startStageSession(stage.index)}
              className={`group flex flex-col justify-between rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isCompleted
                  ? 'border-emerald-200 hover:border-emerald-300'
                  : 'border-slate-200 hover:border-sky-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-50 text-[#0284C7]'
                      }`}
                    >
                      {stage.index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{stage.title}</div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {stage.questions.length} câu · Câu {stage.startIndex}–{stage.endIndex}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-sky-50 text-[#0284C7]'
                    }`}
                  >
                    {stats.percent}%
                  </span>
                </div>

                {/* Stage progress bar */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Đã thuộc</span>
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {stats.mastered}/{stats.total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-[#0284C7]'
                      }`}
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                {/* 3 Status counts */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-emerald-50/80 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-emerald-700 tabular-nums">
                      {stats.mastered}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-700">Đã thuộc</div>
                  </div>
                  <div className="rounded-lg bg-amber-50/80 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-amber-700 tabular-nums">
                      {stats.hesitant}
                    </div>
                    <div className="text-[11px] font-medium text-amber-700">Phân vân</div>
                  </div>
                  <div className="rounded-lg bg-slate-100/80 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-slate-700 tabular-nums">
                      {stats.unlearned}
                    </div>
                    <div className="text-[11px] font-medium text-slate-600">Chưa thuộc</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold">
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Đã thuộc toàn bộ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#0284C7]">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {stats.mastered > 0 || stats.hesitant > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0284C7]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
