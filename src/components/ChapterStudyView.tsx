import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  HelpCircle,
  Menu,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import {
  getChaptersBySubject,
  getQuestionsBySubject,
  isAnswerCorrect,
  SUBJECTS,
} from '../data';
import { QuestionItem, QuestionProgress, StudyTier, SubjectId, UserProgressStore } from '../types/quiz';
import { getDetailedMasteryState, isMastered } from '../utils/storage';
import { RichExplanation } from './RichExplanation';
import {
  SakugaBorderFire,
  SakugaBurst,
  SakugaEvent,
  SakugaMangaTag,
  SakugaProgressBar,
} from './SakugaVfx';

interface ChapterStudyViewProps {
  subject: SubjectId;
  tier: StudyTier;
  progress: UserProgressStore;
  onRecordAttempt: (qId: string, isCorrect: boolean, flagged?: boolean) => void;
  onToggleFlag: (qId: string) => void;
}

type QuestionFilter = 'all' | 'wrong' | 'flagged';

interface SessionAttempt {
  selectedKeys: string[];
  graded: boolean;
  isCorrect?: boolean;
  effectiveStreak?: number;
}

function getQuestionCellClass(qp: QuestionProgress | undefined, hoverable = false): string {
  const flagged = Boolean(qp?.flagged);
  const mastered = isMastered(qp);
  const lastWrong = qp?.lastResult === 'wrong';
  const lastCorrect = qp?.lastResult === 'correct';

  if (flagged) {
    return 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]';
  }
  if (mastered) {
    return 'border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]';
  }
  if (lastWrong) {
    return 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]';
  }
  if (lastCorrect) {
    return 'border-[#F59E0B] bg-[#FEF3C7] text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]';
  }

  return hoverable
    ? 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]';
}

export const ChapterStudyView: React.FC<ChapterStudyViewProps> = ({
  subject,
  tier,
  progress,
  onRecordAttempt,
  onToggleFlag,
}) => {
  const chapters = useMemo(() => getChaptersBySubject(subject, tier), [subject, tier]);
  const allSubjectQuestions = useMemo(() => getQuestionsBySubject(subject, tier), [subject, tier]);

  const [selectedChapter, setSelectedChapter] = useState<number>(() => chapters[0]?.chapter ?? 1);
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const [lockedFilterIds, setLockedFilterIds] = useState<string[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionAttempts, setSessionAttempts] = useState<Record<string, SessionAttempt>>({});
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'grid'>('chapters');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [sakugaEvent, setSakugaEvent] = useState<SakugaEvent | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const explanationRef = useRef<HTMLDivElement>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const sakugaIdRef = useRef<number>(0);
  const prevSubjectRef = useRef<SubjectId>(subject);
  const selectedChapterRef = useRef<number>(selectedChapter);
  selectedChapterRef.current = selectedChapter;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const nextSakugaId = () => {
    const now = Date.now();
    sakugaIdRef.current = now > sakugaIdRef.current ? now : sakugaIdRef.current + 1;
    return sakugaIdRef.current;
  };

  const triggerWrongShake = () => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }
    setIsShaking(true);
    shakeTimerRef.current = window.setTimeout(() => {
      setIsShaking(false);
      shakeTimerRef.current = null;
    }, 240);
  };

  const scrollToExplanationOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      window.setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 90);
    }
  };

  // Reset cleanly on subject change; keep chapter and jump to first unmastered question on tier change
  useEffect(() => {
    const subjectChanged = prevSubjectRef.current !== subject;
    prevSubjectRef.current = subject;

    const targetChapter = subjectChanged
      ? chapters[0]?.chapter ?? 1
      : chapters.some((c) => c.chapter === selectedChapterRef.current)
        ? selectedChapterRef.current
        : chapters[0]?.chapter ?? 1;

    if (subjectChanged) {
      setSelectedChapter(targetChapter);
      setSessionAttempts({});
      setSidebarTab('chapters');
      setCurrentIndex(0);
    } else {
      if (targetChapter !== selectedChapterRef.current) {
        setSelectedChapter(targetChapter);
      }
      const targetQuestions = allSubjectQuestions.filter((q) => q.chapter === targetChapter);
      const firstUnmastered = targetQuestions.findIndex(
        (q) => !isMastered(progressRef.current.questions[q.id])
      );
      setCurrentIndex(firstUnmastered >= 0 ? firstUnmastered : 0);
    }

    setFilter('all');
    setLockedFilterIds(null);
    setIsMobileSheetOpen(false);
    setSakugaEvent(null);
    setIsShaking(false);
}, [subject, tier, chapters, allSubjectQuestions]);

const chapterQuestions = useMemo(
  () => allSubjectQuestions.filter((q) => q.chapter === selectedChapter),
  [allSubjectQuestions, selectedChapter]
);

// Live counts for quick filter pills
const filterCounts = useMemo(() => {
  let wrong = 0;
  let flagged = 0;
  for (const q of chapterQuestions) {
    const qp = progress.questions[q.id];
    if (qp?.lastResult === 'wrong') wrong += 1;
    if (qp?.flagged) flagged += 1;
  }
  return {
    all: chapterQuestions.length,
    wrong,
    flagged,
  };
}, [chapterQuestions, progress.questions]);

// Stabilized list when in wrong/flagged filter so answering a question doesn't yank it off screen mid-explanation
const filteredQuestions: QuestionItem[] = useMemo(() => {
  if (filter === 'all') return chapterQuestions;
  if (!lockedFilterIds) return chapterQuestions;
  const idSet = new Set(lockedFilterIds);
  return chapterQuestions.filter((q) => idSet.has(q.id));
}, [chapterQuestions, filter, lockedFilterIds]);

const safeIndex =
  filteredQuestions.length > 0 ? Math.min(currentIndex, filteredQuestions.length - 1) : 0;
const currentQuestion = filteredQuestions[safeIndex] ?? null;

const currentAttempt: SessionAttempt = currentQuestion
  ? sessionAttempts[currentQuestion.id] ?? { selectedKeys: [], graded: false }
  : { selectedKeys: [], graded: false };

const currentProgress = currentQuestion ? progress.questions[currentQuestion.id] : undefined;
const isFlagged = Boolean(currentProgress?.flagged);
const currentDetailedState = getDetailedMasteryState(currentProgress);

useEffect(() => {
  setSakugaEvent(null);
  setIsShaking(false);
  return () => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
  };
}, [currentQuestion?.id]);

// Compute per-chapter stats ("Đã thuộc" %)
const chapterStats = useMemo(() => {
  const stats = new Map<number, { mastered: number; total: number; pct: number }>();
  for (const ch of chapters) {
    stats.set(ch.chapter, { mastered: 0, total: ch.count, pct: 0 });
  }
  for (const q of allSubjectQuestions) {
    const entry = stats.get(q.chapter);
    if (entry && isMastered(progress.questions[q.id])) {
      entry.mastered += 1;
    }
  }
  for (const entry of stats.values()) {
    entry.pct = entry.total > 0 ? Math.round((entry.mastered / entry.total) * 100) : 0;
  }
  return stats;
}, [chapters, allSubjectQuestions, progress.questions]);

const subjectMasteredCount = useMemo(() => {
  let count = 0;
  for (const q of allSubjectQuestions) {
    if (isMastered(progress.questions[q.id])) count += 1;
  }
  return count;
}, [allSubjectQuestions, progress.questions]);

const handleSelectChapter = (chapterNum: number) => {
  setSelectedChapter(chapterNum);
  setFilter('all');
  setLockedFilterIds(null);
  setCurrentIndex(0);
};

const handleApplyFilter = (nextFilter: QuestionFilter) => {
  if (nextFilter === 'all') {
    setFilter('all');
    setLockedFilterIds(null);
    setCurrentIndex(0);
    return;
  }

  const matchingIds = chapterQuestions
    .filter((q) => {
      const qp = progress.questions[q.id];
      return nextFilter === 'wrong' ? qp?.lastResult === 'wrong' : qp?.flagged === true;
    })
    .map((q) => q.id);

  setFilter(nextFilter);
  setLockedFilterIds(matchingIds);
  setCurrentIndex(0);
};

const commitGradedAttempt = (question: QuestionItem, selectedKeys: string[]) => {
  const correct = isAnswerCorrect(selectedKeys, question.correctAnswers);
  const prevProg = progress.questions[question.id];
  const prevStreak = prevProg?.streak ?? 0;
  const flagged = Boolean(prevProg?.flagged);
  const nextStreak = correct && !flagged ? prevStreak + 1 : 0;

  setSessionAttempts((prev) => ({
    ...prev,
    [question.id]: {
      selectedKeys,
      graded: true,
      isCorrect: correct,
      effectiveStreak: nextStreak,
    },
  }));
  onRecordAttempt(question.id, correct);
  scrollToExplanationOnMobile();

  if (!correct) {
    triggerWrongShake();
  }
};

const handleSelectOption = (question: QuestionItem, optionKey: string) => {
  const existing = sessionAttempts[question.id];
  if (existing?.graded) return;

  if (!question.isMultiSelect) {
    commitGradedAttempt(question, [optionKey]);
    return;
  }

  // Multi-select: toggle option key before grading
  const prevSelected = existing?.selectedKeys ?? [];
  const exists = prevSelected.includes(optionKey);
  const nextSelected = exists
    ? prevSelected.filter((k) => k !== optionKey)
    : [...prevSelected, optionKey];

  setSessionAttempts((prev) => ({
    ...prev,
    [question.id]: { selectedKeys: nextSelected, graded: false },
  }));
};

const handleGradeMultiSelect = (question: QuestionItem) => {
  const existing = sessionAttempts[question.id];
  if (!existing || existing.graded || existing.selectedKeys.length === 0) return;

  commitGradedAttempt(question, existing.selectedKeys);
};

const handleRetryQuestion = (questionId: string) => {
  setSessionAttempts((prev) => {
    const next = { ...prev };
    delete next[questionId];
    return next;
  });
  if (shakeTimerRef.current !== null) {
    window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = null;
  }
  setIsShaking(false);
  setSakugaEvent(null);
};

const handleToggleFlag = (questionId: string) => {
  const willBeFlagged = !progress.questions[questionId]?.flagged;
  if (willBeFlagged) {
    setSessionAttempts((prev) => {
      const existing = prev[questionId];
      if (!existing?.graded) return prev;
      return {
        ...prev,
        [questionId]: { ...existing, effectiveStreak: 0 },
      };
    });
  }
  onToggleFlag(questionId);
  setSakugaEvent({ id: nextSakugaId(), variant: 'ok', label: 'OK!' });
};

const goToPrev = () => {
  setCurrentIndex((idx) => Math.max(0, idx - 1));
};

const goToNext = () => {
  setCurrentIndex((idx) => Math.min(filteredQuestions.length - 1, idx + 1));
};

const jumpToQuestion = (idx: number) => {
  setCurrentIndex(Math.max(0, Math.min(filteredQuestions.length - 1, idx)));
};

// PC keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    if (!currentQuestion) return;

    const keyLower = e.key.toLowerCase();

    // 1-6 or a-e: select/toggle option (letter F stays bound to Flag)
    const numberIndex = ['1', '2', '3', '4', '5', '6'].indexOf(keyLower);
    const letterIndex = ['a', 'b', 'c', 'd', 'e'].indexOf(keyLower);
    const optionIdx = numberIndex !== -1 ? numberIndex : letterIndex;

    if (optionIdx !== -1) {
      const option = currentQuestion.options[optionIdx];
      if (option && !currentAttempt.graded) {
        e.preventDefault();
        handleSelectOption(currentQuestion, option.key);
      }
      return;
    }

    // f / F: toggle flag
    if (keyLower === 'f') {
      e.preventDefault();
      handleToggleFlag(currentQuestion.id);
      return;
    }

    // Enter / Space: grade multi-select or advance to next question
    if (e.key === 'Enter' || e.key === ' ') {
      if (target && target.closest('button[data-native-enter="true"]')) {
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
      }

      if (
        currentQuestion.isMultiSelect &&
        !currentAttempt.graded &&
        currentAttempt.selectedKeys.length > 0
      ) {
        e.preventDefault();
        handleGradeMultiSelect(currentQuestion);
        return;
      }

      if (currentAttempt.graded && safeIndex < filteredQuestions.length - 1) {
        e.preventDefault();
        goToNext();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
});

const activeChapterMeta = chapters.find((c) => c.chapter === selectedChapter);
const activeChapterStat = chapterStats.get(selectedChapter) ?? {
  mastered: 0,
  total: chapterQuestions.length,
  pct: 0,
};
const subjectMeta = SUBJECTS[subject];

const isCurrentCorrect = currentQuestion && currentAttempt.graded
  ? currentAttempt.isCorrect ??
  isAnswerCorrect(currentAttempt.selectedKeys, currentQuestion.correctAnswers)
  : false;
const effectiveStreak = isFlagged
  ? 0
  : currentAttempt.effectiveStreak ?? currentProgress?.streak ?? 0;

return (
  <>
    <div className="flex w-full flex-col items-start gap-6 lg:flex-row lg:gap-8 xl:gap-10">
      {/* Desktop Chapter & Question Grid Sidebar (>= 1024px) */}
      <aside className="hidden w-full shrink-0 lg:sticky lg:top-20 lg:block lg:w-[360px] xl:w-[380px]">
        <div className="rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 dark:border-[#262925] dark:bg-[#161816] xl:p-5">
          {/* 2-Tab Switcher */}
          <div
            role="tablist"
            aria-label="Chế độ thanh bên"
            className="grid grid-cols-2 gap-1 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1 dark:border-[#2C302B] dark:bg-[#1C1F1C]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === 'chapters'}
              data-native-enter="true"
              onClick={() => setSidebarTab('chapters')}
              className={`cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${sidebarTab === 'chapters'
                  ? 'bg-[#4338CA] text-white dark:bg-[#4338CA] dark:text-white'
                  : 'text-[#656058] hover:bg-[#EEF2FF] hover:text-[#18181B] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/25 dark:hover:text-[#F5F5F4]'
                }`}
            >
              Danh sách chương ({chapters.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === 'grid'}
              data-native-enter="true"
              onClick={() => setSidebarTab('grid')}
              className={`cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${sidebarTab === 'grid'
                  ? 'bg-[#4338CA] text-white dark:bg-[#4338CA] dark:text-white'
                  : 'text-[#656058] hover:bg-[#EEF2FF] hover:text-[#18181B] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/25 dark:hover:text-[#F5F5F4]'
                }`}
            >
              Bảng câu hỏi ({filteredQuestions.length})
            </button>
          </div>

          {sidebarTab === 'chapters' ? (
            <>
              <div className="my-3.5 flex items-center justify-between gap-2 border-b border-[#D5CFC2] pb-3 dark:border-[#262925]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xs font-bold text-[#18181B] dark:text-[#F5F5F4]">
                      Tiến độ {subjectMeta.code}
                    </h2>
                    <p className="tabular-nums text-xs font-semibold text-[#047857] dark:text-[#34D399]">
                      {subjectMasteredCount}/{allSubjectQuestions.length} câu đã thuộc
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-native-enter="true"
                  onClick={() => setSidebarTab('grid')}
                  className="shrink-0 cursor-pointer rounded-lg border border-[#D5CFC2] bg-[#FAF9F5] px-2.5 py-1 text-[11px] font-semibold text-[#3730A3] transition-colors hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#A5B4FC] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25"
                >
                  Bảng câu ▸
                </button>
              </div>

              <div className="max-h-[calc(100vh-250px)] space-y-4 overflow-y-auto px-2.5 py-2.5">
                {chapters.map((ch) => {
                  const stat = chapterStats.get(ch.chapter) ?? {
                    mastered: 0,
                    total: ch.count,
                    pct: 0,
                  };
                  const active = ch.chapter === selectedChapter;

                  return (
                    <button
                      key={ch.chapter}
                      type="button"
                      data-native-enter="true"
                      onClick={() => handleSelectChapter(ch.chapter)}
                      className={`relative w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${active
                          ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] dark:border-[#818CF8] dark:bg-[#312E81]/30 dark:text-[#F5F5F4]'
                          : stat.pct >= 100
                            ? 'border-[#10B981] bg-[#FAF9F5] ring-2 ring-[#34D399]/35 hover:border-[#059669] hover:bg-[#ECFDF5] dark:border-[#10B981]/80 dark:bg-[#1C1F1C] dark:ring-[#34D399]/30 dark:hover:border-[#34D399] dark:hover:bg-[#059669]/20'
                            : stat.pct >= 50
                              ? 'border-[#F59E0B]/70 bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#F59E0B]/55 dark:bg-[#1C1F1C] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                              : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                        }`}
                    >
                      <SakugaBorderFire percent={stat.pct} radius={12} compact />
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-wide ${active
                              ? 'text-[#3730A3] dark:text-[#A5B4FC]'
                              : 'text-[#656058] dark:text-[#9CA39B]'
                            }`}
                        >
                          Chương {ch.chapter}
                        </span>
                        <span className="tabular-nums rounded-full border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-semibold text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                          {stat.pct}% Đã thuộc
                        </span>
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-[#18181B] dark:text-[#F5F5F4]">
                        {ch.title}
                      </p>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-[#656058] dark:text-[#9CA39B]">
                        <span className="tabular-nums">{ch.count} câu</span>
                        <span className="tabular-nums font-medium text-[#18181B] dark:text-[#F5F5F4]">
                          {stat.mastered}/{stat.total}
                        </span>
                      </div>

                      <SakugaProgressBar percent={stat.pct} className="mt-2 h-1.5 w-full" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="my-3.5 border-b border-[#D5CFC2] pb-3 dark:border-[#262925]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-[#3730A3] dark:text-[#A5B4FC]">
                      Chương {selectedChapter}
                      {filter === 'wrong'
                        ? ' • Lọc sai'
                        : filter === 'flagged'
                          ? ' • Phân vân'
                          : ''}
                    </h2>
                    {activeChapterMeta && (
                      <p className="mt-0.5 truncate text-xs font-medium text-[#292524] dark:text-[#E7E5E4]">
                        {activeChapterMeta.title}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums shrink-0 rounded-full border border-[#D5CFC2] bg-[#FAF9F5] px-2 py-0.5 text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                    {filteredQuestions.length > 0
                      ? `${safeIndex + 1}/${filteredQuestions.length}`
                      : '0 câu'}
                  </span>
                </div>

                {/* Short Color Legend */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#656058] dark:text-[#9CA39B]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-[3px] border border-[#4338CA] bg-[#FAF9F5] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:bg-[#1C1F1C] dark:ring-[#818CF8]" />
                    Đang xem
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#059669] dark:bg-[#10B981]" />
                    Đã thuộc
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                    Đúng 1/2
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#A21CAF] dark:bg-[#E879F9]" />
                    Phân vân
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E11D48] dark:bg-[#FB7185]" />
                    Sai
                  </span>
                </div>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-6 text-center text-xs text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]">
                  Không có câu hỏi nào khớp bộ lọc hiện tại.
                </div>
              ) : (
                <div className="grid max-h-[calc(100vh-290px)] grid-cols-6 gap-2 overflow-y-auto p-1">
                  {filteredQuestions.map((q, idx) => {
                    const qp = progress.questions[q.id];
                    const isActive = idx === safeIndex;
                    const flagged = Boolean(qp?.flagged);
                    const cellStyle = getQuestionCellClass(qp, true);

                    return (
                      <button
                        key={q.id}
                        type="button"
                        data-native-enter="true"
                        onClick={() => jumpToQuestion(idx)}
                        className={`tabular-nums relative flex h-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-all ${cellStyle} ${isActive
                            ? 'ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                            : ''
                          }`}
                      >
                        {idx + 1}
                        {flagged && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#A21CAF] dark:bg-[#E879F9]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="w-full min-w-0 flex-1">
        {/* Mobile & Tablet Unified Interactive Progress & Filter Card (< 1024px) */}
        <div className="mb-3.5 px-1 pt-1 sm:mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileSheetOpen(true)}
            className={`relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-[#EAE6DD] px-3.5 py-2.5 text-left transition active:scale-[0.99] dark:bg-[#161816] ${activeChapterStat.pct >= 100
                ? 'border-[#10B981] ring-2 ring-[#34D399]/35 dark:border-[#10B981]/80 dark:ring-[#34D399]/30'
                : activeChapterStat.pct >= 50
                  ? 'border-[#F59E0B]/70 dark:border-[#F59E0B]/55'
                  : 'border-[#D5CFC2] dark:border-[#262925]'
              }`}
          >
            <SakugaBorderFire percent={activeChapterStat.pct} radius={12} compact />

            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#18181B] dark:text-[#F5F5F4]">
                <Menu className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#A5B4FC]" />
                <span className="truncate tabular-nums">
                  Chương {selectedChapter} • Câu {filteredQuestions.length > 0 ? safeIndex + 1 : 0}/
                  {filteredQuestions.length}
                </span>
                {filter === 'wrong' && (
                  <span className="shrink-0 rounded-full border border-[#FDA4AF] bg-[#FFE4E6] px-1.5 py-0.5 text-[10px] font-bold text-[#BE123C] tabular-nums dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]">
                    Sai ({filterCounts.wrong})
                  </span>
                )}
                {filter === 'flagged' && (
                  <span className="shrink-0 rounded-full border border-[#F0ABFC] bg-[#FAE8FF] px-1.5 py-0.5 text-[10px] font-bold text-[#A21CAF] tabular-nums dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]">
                    Phân vân ({filterCounts.flagged})
                  </span>
                )}
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`tabular-nums rounded-full border px-2 py-0.5 text-[11px] font-bold ${activeChapterStat.pct >= 50
                      ? 'border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]'
                      : 'border-[#F59E0B]/60 bg-[#FEF3C7] text-[#92400E] dark:border-[#F59E0B]/45 dark:bg-[#92400E]/25 dark:text-[#FDE68A]'
                    }`}
                >
                  {activeChapterStat.mastered}/{activeChapterStat.total} ({activeChapterStat.pct}%)
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-lg border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]">
                  <Filter className="h-3 w-3 shrink-0" />
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </span>
              </span>
            </div>

            <SakugaProgressBar percent={activeChapterStat.pct} className="h-1.5 w-full" />
          </button>
        </div>

        {/* Desktop Quick Filter Pills (>= 1024px) */}
        <div className="mb-6 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-5 py-3.5 dark:border-[#262925] dark:bg-[#161816] lg:flex">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#656058] dark:text-[#9CA39B]">
              <Filter className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#A5B4FC]" />
              Lọc nhanh:
            </span>

            <button
              type="button"
              data-native-enter="true"
              onClick={() => handleApplyFilter('all')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${filter === 'all'
                  ? 'border-[#4338CA] bg-[#4338CA] text-white hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                  : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                }`}
            >
              <span>Tất cả câu</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${filter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EAE6DD] text-[#656058] dark:bg-[#262925] dark:text-[#9CA39B]'
                  }`}
              >
                {filterCounts.all}
              </span>
            </button>

            <button
              type="button"
              data-native-enter="true"
              onClick={() => handleApplyFilter('wrong')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${filter === 'wrong'
                  ? 'border-[#E11D48] bg-[#E11D48] text-white'
                  : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#FDA4AF] hover:bg-[#FFE4E6] hover:text-[#BE123C] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#FB7185]/55 dark:hover:bg-[#E11D48]/20 dark:hover:text-[#FDA4AF]'
                }`}
            >
              <span>Câu làm sai</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${filter === 'wrong'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FFE4E6] text-[#BE123C] dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                  }`}
              >
                {filterCounts.wrong}
              </span>
            </button>

            <button
              type="button"
              data-native-enter="true"
              onClick={() => handleApplyFilter('flagged')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${filter === 'flagged'
                  ? 'border-[#A21CAF] bg-[#A21CAF] text-white'
                  : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#F0ABFC] hover:bg-[#FAE8FF] hover:text-[#A21CAF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#E879F9]/55 dark:hover:bg-[#D946EF]/20 dark:hover:text-[#F5D0FE]'
                }`}
            >
              <span>Câu phân vân</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${filter === 'flagged'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FAE8FF] text-[#A21CAF] dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]'
                  }`}
              >
                {filterCounts.flagged}
              </span>
            </button>
          </div>
        </div>

        {/* Empty Filtered State vs Question Card */}
        {!currentQuestion ? (
          <div className="rounded-3xl border-2 border-[#27272A] bg-white px-5 py-10 text-center shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] dark:border-2 dark:border-[#52525B] dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:px-6 sm:py-12 sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#18181B] dark:text-[#F5F5F4]">
              {filter === 'wrong'
                ? 'Không có câu làm sai nào trong chương này'
                : filter === 'flagged'
                  ? 'Chưa có câu phân vân nào trong chương này'
                  : 'Không có câu hỏi nào trong chương này'}
            </h3>
            {filter !== 'all' && (
              <button
                type="button"
                data-native-enter="true"
                onClick={() => handleApplyFilter('all')}
                className="sakuga-btn mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] transition-colors hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                <span>Xem tất cả câu</span>
              </button>
            )}
          </div>
        ) : (
          <div
            className={`relative rounded-3xl border-2 border-[#27272A] bg-white p-4 shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] dark:border-2 dark:border-[#52525B] dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:p-6 sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)] md:p-8 ${isShaking ? 'sakuga-shake' : ''
              }`}
          >
            <SakugaBurst
              event={sakugaEvent?.variant === 'ok' ? sakugaEvent : null}
              className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 sm:left-auto sm:right-10 sm:translate-x-0"
            />
            {/* Top Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-2.5 dark:border-[#2C322D] dark:bg-[#141714]">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="tabular-nums rounded-lg bg-[#4338CA] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-white dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:text-white sm:px-3 sm:py-1">
                  Câu {safeIndex + 1}/{filteredQuestions.length}
                </span>

                <span className="hidden rounded-full border border-[#D5CFC2] bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#44403C] dark:border-[#3F3F46] dark:bg-[#27272A] dark:text-[#D4D4D8] sm:inline-flex">
                  Chương {currentQuestion.chapter}
                </span>

                {currentQuestion.isMultiSelect && (
                  <span className="rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0C4A6E]/35 dark:text-[#7DD3FC] sm:py-1">
                    Chọn nhiều đáp án
                  </span>
                )}

                {currentDetailedState === 'mastered' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399] sm:py-1">
                    <Check className="h-3 w-3 shrink-0" />
                    <span>Đã thuộc (2/2)</span>
                    <span
                      className="ml-0.5 tracking-tighter text-[#059669] dark:text-[#10B981]"
                      aria-hidden="true"
                    >
                      ●●
                    </span>
                  </span>
                ) : currentDetailedState === 'pass1' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B] bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D] sm:py-1">
                    <Check className="h-3 w-3 shrink-0" />
                    <span>Đúng 1/2 lần</span>
                    <span className="ml-0.5 tracking-tighter" aria-hidden="true">
                      ●○
                    </span>
                  </span>
                ) : (
                  <span className="rounded-full border border-[#D5CFC2] bg-[#EAE6DD] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#656058] dark:border-[#2C302B] dark:bg-[#252A26] dark:text-[#9CA39B] sm:py-1">
                    Chưa thuộc
                  </span>
                )}

                {isFlagged && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#F0ABFC] bg-[#FAE8FF] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] md:hidden">
                    <Flag className="h-3 w-3 fill-current" />
                    Phân vân
                  </span>
                )}
              </div>

              {/* Top Metadata Bar Right Actions: Retry (when graded) + Desktop Flag Toggle */}
              <div className="flex items-center gap-1.5">
                {currentAttempt.graded && (
                  <button
                    type="button"
                    data-native-enter="true"
                    onClick={() => handleRetryQuestion(currentQuestion.id)}
                    className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-2.5 py-1.5 text-xs font-semibold text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] transition-colors hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC] sm:px-3"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Làm lại</span>
                  </button>
                )}

                {/* Desktop Flag Toggle */}
                <button
                  type="button"
                  data-native-enter="true"
                  onClick={() => handleToggleFlag(currentQuestion.id)}
                  className={`sakuga-btn hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors md:inline-flex ${isFlagged
                      ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                      : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#F0ABFC] hover:bg-[#FAE8FF] hover:text-[#A21CAF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#E879F9]/55 dark:hover:bg-[#D946EF]/20 dark:hover:text-[#F5D0FE]'
                    }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${isFlagged
                        ? 'fill-[#A21CAF] text-[#A21CAF] dark:fill-[#F5D0FE] dark:text-[#F5D0FE]'
                        : 'text-[#656058] dark:text-[#9CA39B]'
                      }`}
                  />
                  <span>Phân vân</span>
                  <kbd className="hidden rounded border border-current/25 px-1 py-0.5 font-mono text-[10px] opacity-80 md:inline-block">
                    F
                  </kbd>
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="mt-3.5 rounded-2xl border border-[#E2DDD2] border-l-4 border-l-[#4338CA] bg-[#FAF8F3] p-4 dark:border-[#2C322D] dark:border-l-4 dark:border-l-[#818CF8] dark:bg-[#161917] sm:mt-5 sm:p-5">
              <h2 className="max-w-[78ch] text-[17px] font-semibold leading-[1.6] text-[#18181B] dark:text-[#F5F5F4] sm:text-[19px] sm:leading-[1.65] md:text-[20px]">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Options */}
            <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3.5">
              {currentQuestion.options.map((opt) => {
                const isSelected = currentAttempt.selectedKeys.includes(opt.key);
                const isCorrectOption = currentQuestion.correctAnswers.includes(opt.key);
                const isSuspectedOption =
                  !isCorrectOption &&
                  (currentQuestion.suspectedAnswers ?? [])
                    .map((k) => k.toUpperCase())
                    .includes(opt.key.toUpperCase());
                const isGraded = currentAttempt.graded;

                let containerClasses =
                  'border border-[#D5CFC2] bg-[#F8F6F0] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] md:hover:translate-x-1 dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25';
                let keyBadgeClasses =
                  'border-[#C6BEB0] bg-white text-[#4338CA] group-hover:border-[#4338CA] group-hover:bg-[#4338CA] group-hover:text-white dark:border-[#353B36] dark:bg-[#161816] dark:text-[#A5B4FC] dark:group-hover:border-[#818CF8] dark:group-hover:bg-[#4338CA] dark:group-hover:text-white';

                if (!isGraded) {
                  if (isSelected) {
                    containerClasses =
                      'border border-[#4338CA] bg-[#EEF2FF] text-[#18181B] ring-1 ring-[#4338CA] dark:border-[#818CF8] dark:bg-[#312E81]/35 dark:text-[#F5F5F4] dark:ring-[#818CF8]';
                    keyBadgeClasses =
                      'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8] dark:bg-[#4338CA] dark:text-white';
                  }
                } else {
                  if (isCorrectOption) {
                    containerClasses =
                      'border-2 border-[#059669] bg-[#F8F6F0] text-[#064E3B] ring-2 ring-[#10B981]/20 dark:border-2 dark:border-[#10B981] dark:bg-[#252A26] dark:text-[#ECFDF5] dark:ring-2 dark:ring-[#10B981]/25';
                    keyBadgeClasses =
                      'sakuga-green-key-arrival border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]';
                  } else if (isSuspectedOption) {
                    containerClasses =
                      'border-2 border-[#EC4899] bg-[#FCE7F3] text-[#9D174D] ring-2 ring-[#F472B6]/25 dark:border-2 dark:border-[#F472B6] dark:bg-[#831843]/45 dark:text-[#FCE7F3] dark:ring-2 dark:ring-[#F472B6]/25';
                    keyBadgeClasses =
                      'border-[#DB2777] bg-[#EC4899] text-white dark:border-[#F472B6] dark:bg-[#EC4899] dark:text-white';
                  } else if (isSelected && !isCorrectOption) {
                    containerClasses =
                      'border border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]';
                    keyBadgeClasses =
                      'border-[#E11D48] bg-[#E11D48] text-white dark:border-[#FB7185] dark:bg-[#FB7185] dark:text-[#18181B]';
                  } else {
                    containerClasses =
                      'border border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] dark:border-[#262925] dark:bg-[#161816]/70 dark:text-[#9CA39B]';
                    keyBadgeClasses =
                      'border-[#D5CFC2] bg-[#EAE6DD] text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]';
                  }
                }

                const hasWrongSelected = currentAttempt.selectedKeys.some(
                  (k) => !currentQuestion.correctAnswers.includes(k)
                );
                const missTargetKeys = hasWrongSelected
                  ? currentAttempt.selectedKeys.filter(
                    (k) => !currentQuestion.correctAnswers.includes(k)
                  )
                  : currentQuestion.correctAnswers.filter(
                    (k) => !currentAttempt.selectedKeys.includes(k)
                  );
                const showSuccessTag = isGraded && isCurrentCorrect && isCorrectOption;
                const showMissTag =
                  isGraded &&
                  !isCurrentCorrect &&
                  !isSuspectedOption &&
                  missTargetKeys.includes(opt.key);

                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isGraded}
                    onClick={() => handleSelectOption(currentQuestion, opt.key)}
                    className={`group relative flex w-full items-start gap-3 rounded-xl p-3 px-3.5 text-left transition-all duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${containerClasses} ${isGraded ? 'cursor-default' : 'cursor-pointer'
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
                      className={`relative z-10 sakuga-option-badge mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors sm:h-7 sm:w-7 ${keyBadgeClasses}`}
                    >
                      {opt.key}
                    </span>

                    <span className="relative z-10 flex-1 pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                      {opt.text}
                    </span>

                    {(showSuccessTag ||
                      showMissTag ||
                      (isGraded && isSuspectedOption) ||
                      (isGraded && isCorrectOption) ||
                      (isGraded && isSelected && !isCorrectOption && !isSuspectedOption)) && (
                        <span className="relative z-10 mt-0.5 flex shrink-0 items-center gap-1.5 sm:gap-2">
                          {showSuccessTag && (
                            <SakugaMangaTag
                              label={effectiveStreak >= 2 ? 'CLEAR! ✓' : 'NICE!'}
                              tone={effectiveStreak >= 2 ? 'emerald' : 'amber'}
                            />
                          )}
                          {isGraded && isSuspectedOption && (
                            <SakugaMangaTag label="???" tone="pink" />
                          )}
                          {showMissTag && <SakugaMangaTag label="MISS!" tone="rose" />}
                          {isGraded && isCorrectOption && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669] dark:text-[#10B981] sm:h-5 sm:w-5" />
                          )}
                          {isGraded && isSuspectedOption && (
                            <HelpCircle className="h-4 w-4 shrink-0 text-[#DB2777] dark:text-[#F472B6] sm:h-5 sm:w-5" />
                          )}
                          {isGraded && isSelected && !isCorrectOption && !isSuspectedOption && (
                            <XCircle className="h-4 w-4 shrink-0 text-[#E11D48] dark:text-[#FB7185] sm:h-5 sm:w-5" />
                          )}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>

            {/* Desktop Multi-select submit button */}
            {currentQuestion.isMultiSelect && !currentAttempt.graded && (
              <div className="mt-5 hidden flex-wrap items-center justify-between gap-3 md:flex">
                <span className="tabular-nums text-xs text-[#656058] dark:text-[#9CA39B]">
                  Đã chọn {currentAttempt.selectedKeys.length} đáp án
                </span>
                <button
                  type="button"
                  disabled={currentAttempt.selectedKeys.length === 0}
                  onClick={() => handleGradeMultiSelect(currentQuestion)}
                  className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
                >
                  <Check className="h-4 w-4" />
                  <span>Kiểm tra đáp án</span>
                </button>
              </div>
            )}

            {/* Smooth Rich Explanation with auto-scroll target */}
            <div ref={explanationRef} className="scroll-mt-4 scroll-mb-24">
              <AnimatePresence mode="wait">
                {currentAttempt.graded && (
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <RichExplanation question={currentQuestion} className="mt-4 sm:mt-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop & Tablet Navigation Footer */}
            <div className="mt-7 hidden items-center justify-between gap-3 border-t border-[#D5CFC2] pt-5 dark:border-[#262925] md:flex">
              <button
                type="button"
                data-native-enter="true"
                disabled={safeIndex === 0}
                onClick={goToPrev}
                className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-sm font-semibold text-[#292524] transition-colors hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#18181B] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25 dark:hover:text-[#F5F5F4]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Câu trước</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-[#656058] dark:text-[#9CA39B]">
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    1-5
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    A-E
                  </kbd>{' '}
                  Chọn
                </span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    Enter
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    Space
                  </kbd>{' '}
                  {currentQuestion.isMultiSelect && !currentAttempt.graded
                    ? 'Kiểm tra'
                    : 'Câu tiếp'}
                </span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#E7E5E4]">
                    F
                  </kbd>{' '}
                  Phân vân
                </span>
              </div>

              <button
                type="button"
                data-native-enter="true"
                disabled={safeIndex >= filteredQuestions.length - 1}
                onClick={goToNext}
                className="sakuga-btn relative inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-40 dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                {currentAttempt.graded && safeIndex < filteredQuestions.length - 1 && (
                  <SakugaBorderFire percent={78} radius={12} mini />
                )}
                <span>Câu tiếp</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Mobile Sticky Bottom Navigation Bar (< 768px) */}
    {currentQuestion && (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D5CFC2] bg-[#EAE6DD]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(28,25,23,0.09)] backdrop-blur dark:border-[#262925] dark:bg-[#161816]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.6)] md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={goToPrev}
            className="sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2.5 text-xs font-semibold text-[#292524] transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Trước</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleFlag(currentQuestion.id)}
            aria-pressed={isFlagged}
            className={`sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${isFlagged
                ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
                : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#2C302B]'
              }`}
          >
            <Flag className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
            <span>Phân vân</span>
          </button>

          {currentQuestion.isMultiSelect && !currentAttempt.graded ? (
            <button
              type="button"
              disabled={currentAttempt.selectedKeys.length === 0}
              onClick={() => handleGradeMultiSelect(currentQuestion)}
              className="sakuga-btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] transition hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
            >
              <Check className="h-4 w-4" />
              <span>Kiểm tra ({currentAttempt.selectedKeys.length})</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={safeIndex >= filteredQuestions.length - 1}
              onClick={goToNext}
              className="sakuga-btn relative inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] transition hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
            >
              {currentAttempt.graded && safeIndex < filteredQuestions.length - 1 && (
                <SakugaBorderFire percent={78} radius={12} mini />
              )}
              <span>Câu tiếp</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )}

    {/* Mobile & Tablet Bottom Sheet Drawer (< 1024px): Chapters + Filter + Question Grid */}
    <AnimatePresence>
      {isMobileSheetOpen && (
        <>
          <motion.div
            key="chapter-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setIsMobileSheetOpen(false)}
            className="fixed inset-0 z-50 bg-[#18181B]/50 backdrop-blur-[2px] dark:bg-[#0F100E]/75 lg:hidden"
          />
          <motion.div
            key="chapter-sheet-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Chọn chương, bộ lọc và số câu"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D5CFC2] bg-[#EAE6DD] shadow-2xl dark:border-[#262925] dark:bg-[#161816] lg:hidden"
          >
            {/* Drag Handle & Sheet Header */}
            <div className="flex flex-col items-center border-b border-[#D5CFC2] px-4 pb-3 pt-2.5 dark:border-[#262925]">
              <div className="mb-2.5 h-1 w-10 rounded-full bg-[#C6BEB0] dark:bg-[#323833]" />
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                    {subjectMeta.code} • Chọn chương &amp; câu hỏi
                  </h3>
                  <p className="text-xs text-[#047857] tabular-nums dark:text-[#34D399]">
                    Đúng 2 lần liên tiếp → Đã thuộc ({subjectMasteredCount}/
                    {allSubjectQuestions.length})
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

            {/* Scrollable Sheet Content */}
            <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-4">
              {/* Filter Pills */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  Bộ lọc câu hỏi (Chương {selectedChapter})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyFilter('all');
                      setIsMobileSheetOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${filter === 'all'
                        ? 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8]/50 dark:bg-[#4338CA]'
                        : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]'
                      }`}
                  >
                    Tất cả ({filterCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyFilter('wrong');
                      setIsMobileSheetOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${filter === 'wrong'
                        ? 'border-[#E11D48] bg-[#E11D48] text-white'
                        : 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                      }`}
                  >
                    Sai ({filterCounts.wrong})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyFilter('flagged');
                      setIsMobileSheetOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${filter === 'flagged'
                        ? 'border-[#A21CAF] bg-[#A21CAF] text-white'
                        : 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]'
                      }`}
                  >
                    Phân vân ({filterCounts.flagged})
                  </button>
                </div>
              </div>

              {/* Chapter List */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  Danh sách chương
                </div>
                <div className="space-y-3.5 px-1.5 py-1.5">
                  {chapters.map((ch) => {
                    const stat = chapterStats.get(ch.chapter) ?? {
                      mastered: 0,
                      total: ch.count,
                      pct: 0,
                    };
                    const active = ch.chapter === selectedChapter;
                    return (
                      <button
                        key={ch.chapter}
                        type="button"
                        onClick={() => {
                          handleSelectChapter(ch.chapter);
                          setIsMobileSheetOpen(false);
                        }}
                        className={`relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border px-3.5 py-2.5 text-left transition ${active
                            ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] dark:border-[#818CF8] dark:bg-[#312E81]/30 dark:text-[#F5F5F4]'
                            : stat.pct >= 100
                              ? 'border-[#10B981] bg-[#FAF9F5] ring-2 ring-[#34D399]/35 text-[#292524] hover:border-[#059669] hover:bg-[#ECFDF5] dark:border-[#10B981]/80 dark:bg-[#1C1F1C] dark:ring-[#34D399]/30 dark:text-[#E7E5E4] dark:hover:border-[#34D399] dark:hover:bg-[#059669]/20'
                              : stat.pct >= 50
                                ? 'border-[#F59E0B]/70 bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#F59E0B]/55 dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                                : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/25'
                          }`}
                      >
                        <SakugaBorderFire percent={stat.pct} radius={12} compact />

                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold">
                              Chương {ch.chapter}{' '}
                              <span className="font-normal text-[#656058] dark:text-[#9CA39B]">
                                ({stat.mastered}/{stat.total} câu)
                              </span>
                            </div>
                            <div className="truncate text-xs opacity-85">{ch.title}</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-semibold text-[#047857] tabular-nums dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                            {stat.pct}%
                          </span>
                        </div>

                        <SakugaProgressBar percent={stat.pct} className="h-1.5 w-full" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Number Grid */}
              {filteredQuestions.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                    <span>Bảng số câu ({filteredQuestions.length})</span>
                    {activeChapterMeta && (
                      <span className="normal-case text-[#3730A3] dark:text-[#A5B4FC]">
                        Chương {activeChapterMeta.chapter}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-2 p-0.5 sm:grid-cols-8">
                    {filteredQuestions.map((q, idx) => {
                      const qp = progress.questions[q.id];
                      const isActive = idx === safeIndex;
                      const flagged = Boolean(qp?.flagged);
                      const cellStyle = getQuestionCellClass(qp);

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            jumpToQuestion(idx);
                            setIsMobileSheetOpen(false);
                          }}
                          className={`tabular-nums relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition ${cellStyle} ${isActive
                              ? 'ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                              : ''
                            }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#A21CAF] dark:bg-[#E879F9]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </>
);
};
