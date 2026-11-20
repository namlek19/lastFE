import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Filter,
  Flag,
  Menu,
  RotateCw,
  Shuffle,
  X,
} from 'lucide-react';
import { getChaptersBySubject, getQuestionsBySubject, SUBJECTS } from '../data';
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

export interface FlashcardViewProps {
  subject: SubjectId;
  tier: StudyTier;
  progress: UserProgressStore;
  onMarkStudied: (qId: string) => void;
  onToggleMastered: (qId: string) => void;
  onToggleFlag: (qId: string) => void;
}

type FlashcardFilter = 'all' | 'unlearned' | 'studied' | 'flagged' | 'mastered';

function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function findFirstUnmasteredIndex(
  questions: readonly QuestionItem[],
  progressMap: Record<string, QuestionProgress>
): number {
  const idx = questions.findIndex((q) => !isMastered(progressMap[q.id]));
  return idx >= 0 ? idx : 0;
}

function findEarliestUnmasteredTarget(
  chapters: readonly { chapter: number }[],
  allQuestions: readonly QuestionItem[],
  progressMap: Record<string, QuestionProgress>
): { chapter: number; index: number } {
  for (const ch of chapters) {
    const chQuestions = allQuestions.filter((q) => q.chapter === ch.chapter);
    const idx = chQuestions.findIndex((q) => !isMastered(progressMap[q.id]));
    if (idx >= 0) {
      return { chapter: ch.chapter, index: idx };
    }
  }
  return { chapter: chapters[0]?.chapter ?? 1, index: 0 };
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  subject,
  tier,
  progress,
  onMarkStudied,
  onToggleMastered,
  onToggleFlag,
}) => {
  const subjectMeta = SUBJECTS[subject];
  const chapters = useMemo(() => getChaptersBySubject(subject, tier), [subject, tier]);
  const allSubjectQuestions = useMemo(() => getQuestionsBySubject(subject, tier), [subject, tier]);

  const [selectedChapter, setSelectedChapter] = useState<number>(
    () => findEarliestUnmasteredTarget(chapters, allSubjectQuestions, progress.questions).chapter
  );
  const [filter, setFilter] = useState<FlashcardFilter>('all');
  const [lockedFilterIds, setLockedFilterIds] = useState<string[] | null>(null);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(
    () => findEarliestUnmasteredTarget(chapters, allSubjectQuestions, progress.questions).index
  );
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'grid'>('chapters');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [sakugaEvent, setSakugaEvent] = useState<SakugaEvent | null>(null);
  const [justMasteredId, setJustMasteredId] = useState<string | null>(null);
  const [masteredBurstSeq, setMasteredBurstSeq] = useState<number>(0);

  const mobileProgressRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef<boolean>(false);

  const scrollToProgressOnMobile = useCallback(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    window.requestAnimationFrame(() => {
      const el = mobileProgressRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const headerEl = document.querySelector('header');
      const isHeaderSticky =
        headerEl && window.getComputedStyle(headerEl).position === 'sticky';
      const stickyHeaderBottom = isHeaderSticky
        ? Math.max(0, headerEl.getBoundingClientRect().bottom)
        : 0;
      const desiredTop = stickyHeaderBottom + 12;
      const delta = rect.top - desiredTop;
      if (delta < -6) {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }
    });
  }, []);

  // Jump to earliest non-mastered card when switching subject or study tier
  useEffect(() => {
    const target = findEarliestUnmasteredTarget(
      chapters,
      allSubjectQuestions,
      progressRef.current.questions
    );
    setSelectedChapter(target.chapter);
    setFilter('all');
    setLockedFilterIds(null);
    setIsShuffled(false);
    setShuffledIds(null);
    setCurrentIndex(target.index);
    setIsFlipped(false);
    setShowExplanation(false);
    setSidebarTab('chapters');
    setIsMobileSheetOpen(false);
    setSakugaEvent(null);
    setJustMasteredId(null);
}, [subject, tier, chapters, allSubjectQuestions]);

const chapterQuestions = useMemo(
  () => allSubjectQuestions.filter((q) => q.chapter === selectedChapter),
  [allSubjectQuestions, selectedChapter]
);

// Live filter counts for current chapter
const filterCounts = useMemo(() => {
  let unlearned = 0;
  let studied = 0;
  let flagged = 0;
  let mastered = 0;

  for (const q of chapterQuestions) {
    const st = getDetailedMasteryState(progress.questions[q.id]);
    if (st === 'unlearned') unlearned += 1;
    else if (st === 'studied' || st === 'pass1') studied += 1;
    else if (st === 'hesitant') flagged += 1;
    else if (st === 'mastered') mastered += 1;
  }

  return {
    all: chapterQuestions.length,
    unlearned,
    studied,
    flagged,
    mastered,
  };
}, [chapterQuestions, progress.questions]);

// Compute per-chapter stats
const chapterStats = useMemo(() => {
  const stats = new Map<number, { mastered: number; studied: number; total: number; pct: number }>();
  for (const ch of chapters) {
    stats.set(ch.chapter, { mastered: 0, studied: 0, total: ch.count, pct: 0 });
  }
  for (const q of allSubjectQuestions) {
    const entry = stats.get(q.chapter);
    if (!entry) continue;
    const qp = progress.questions[q.id];
    const st = getDetailedMasteryState(qp);
    if (st === 'mastered') {
      entry.mastered += 1;
      entry.studied += 1;
    } else if (st !== 'unlearned') {
      entry.studied += 1;
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

// Stabilized deck so flipping/marking a card doesn't immediately remove it mid-view
const deck: QuestionItem[] = useMemo(() => {
  let base = chapterQuestions;
  if (filter !== 'all' && lockedFilterIds) {
    const idSet = new Set(lockedFilterIds);
    base = chapterQuestions.filter((q) => idSet.has(q.id));
  }
  if (isShuffled && shuffledIds) {
    const map = new Map(base.map((q) => [q.id, q]));
    return shuffledIds.map((id) => map.get(id)).filter((q): q is QuestionItem => Boolean(q));
  }
  return base;
}, [chapterQuestions, filter, lockedFilterIds, isShuffled, shuffledIds]);

const safeIndex = deck.length > 0 ? Math.min(currentIndex, deck.length - 1) : 0;
const currentQuestion = deck[safeIndex] ?? null;

const currentProgress = currentQuestion ? progress.questions[currentQuestion.id] : undefined;
const currentState = getDetailedMasteryState(currentProgress);
const isCurrentMastered = currentState === 'mastered';
const isCurrentFlagged = currentState === 'hesitant';
const isJustMastered = Boolean(currentQuestion && justMasteredId === currentQuestion.id);
const activeChapterStat = chapterStats.get(selectedChapter) ?? {
  mastered: 0,
  studied: 0,
  total: chapterQuestions.length,
  pct: 0,
};

const handleSelectChapter = (chapterNum: number) => {
  const nextChapterQuestions = allSubjectQuestions.filter((q) => q.chapter === chapterNum);
  setSelectedChapter(chapterNum);
  setFilter('all');
  setLockedFilterIds(null);
  setIsShuffled(false);
  setShuffledIds(null);
  setCurrentIndex(findFirstUnmasteredIndex(nextChapterQuestions, progress.questions));
  setIsFlipped(false);
  setShowExplanation(false);
  setSakugaEvent(null);
  setJustMasteredId(null);
};

const handleApplyFilter = (nextFilter: FlashcardFilter) => {
  setIsFlipped(false);
  setShowExplanation(false);
  setCurrentIndex(0);
  setJustMasteredId(null);

  if (nextFilter === 'all') {
    setFilter('all');
    setLockedFilterIds(null);
    if (isShuffled) {
      setShuffledIds(shuffleArray(chapterQuestions.map((q) => q.id)));
    }
    return;
  }

  const matchingIds = chapterQuestions
    .filter((q) => {
      const st = getDetailedMasteryState(progress.questions[q.id]);
      if (nextFilter === 'unlearned') return st === 'unlearned';
      if (nextFilter === 'studied') return st === 'studied' || st === 'pass1';
      if (nextFilter === 'flagged') return st === 'hesitant';
      if (nextFilter === 'mastered') return st === 'mastered';
      return true;
    })
    .map((q) => q.id);

  setFilter(nextFilter);
  setLockedFilterIds(matchingIds);
  if (isShuffled) {
    setShuffledIds(shuffleArray(matchingIds));
  }
};

const handleToggleShuffle = () => {
  setIsFlipped(false);
  setShowExplanation(false);
  setCurrentIndex(0);
  setJustMasteredId(null);

  if (!isShuffled) {
    const currentIds = deck.map((q) => q.id);
    setIsShuffled(true);
    setShuffledIds(shuffleArray(currentIds));
  } else {
    setIsShuffled(false);
    setShuffledIds(null);
  }
};

const handleFlipCard = useCallback(() => {
  if (!currentQuestion) return;
  setJustMasteredId(null);
  setIsFlipped((prev) => {
    const next = !prev;
    if (next) {
      onMarkStudied(currentQuestion.id);
    } else {
      setShowExplanation(false);
    }
    return next;
  });
  setSakugaEvent({ id: Date.now(), variant: 'ok', label: 'FLIP!' });
}, [currentQuestion, onMarkStudied]);

const handleToggleMastered = useCallback(
  (qId: string) => {
    const wasMastered = isMastered(progress.questions[qId]);
    onToggleMastered(qId);
    if (!wasMastered) {
      setSakugaEvent(null);
      setJustMasteredId(qId);
      setMasteredBurstSeq((seq) => seq + 1);
    } else {
      setJustMasteredId(null);
    }
  },
  [onToggleMastered, progress.questions]
);

const handleToggleFlag = useCallback(
  (qId: string) => {
    onToggleFlag(qId);
  },
  [onToggleFlag]
);

const goToPrev = useCallback(() => {
  if (safeIndex <= 0) return;
  setIsFlipped(false);
  setShowExplanation(false);
  setJustMasteredId(null);
  setCurrentIndex((idx) => Math.max(0, idx - 1));
  scrollToProgressOnMobile();
}, [safeIndex, scrollToProgressOnMobile]);

const goToNext = useCallback(() => {
  if (safeIndex >= deck.length - 1) return;
  setIsFlipped(false);
  setShowExplanation(false);
  setJustMasteredId(null);
  setCurrentIndex((idx) => Math.min(deck.length - 1, idx + 1));
  scrollToProgressOnMobile();
}, [safeIndex, deck.length, scrollToProgressOnMobile]);

const jumpToCard = (idx: number) => {
  setIsFlipped(false);
  setShowExplanation(false);
  setJustMasteredId(null);
  setCurrentIndex(idx);
  scrollToProgressOnMobile();
};

// Desktop keyboard shortcuts: ArrowLeft, ArrowRight, Space/Enter, G (Mastered), F (Flagged)
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

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrev();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
      return;
    }

    if (e.key === ' ' || e.key === 'Enter') {
      if (target && target.closest('button[data-no-keyflip="true"]')) {
        return;
      }
      e.preventDefault();
      handleFlipCard();
      return;
    }

    const lower = e.key.toLowerCase();
    if (lower === 'g') {
      e.preventDefault();
      handleToggleMastered(currentQuestion.id);
      return;
    }

    if (lower === 'f') {
      e.preventDefault();
      handleToggleFlag(currentQuestion.id);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentQuestion, goToPrev, goToNext, handleFlipCard, handleToggleMastered, handleToggleFlag]);

// Mobile Touch Swipe handlers
const handleTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 1) return;
  didSwipeRef.current = false;
  touchStartRef.current = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY,
  };
};

const handleTouchEnd = (e: React.TouchEvent) => {
  if (!touchStartRef.current || e.changedTouches.length !== 1) return;
  const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
  const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
  touchStartRef.current = null;

  if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
    didSwipeRef.current = true;
    if (deltaX < 0) {
      goToNext();
    } else {
      goToPrev();
    }
  }
};

const handleCardSurfaceClick = () => {
  if (didSwipeRef.current) {
    didSwipeRef.current = false;
    return;
  }
  handleFlipCard();
};

const renderStatusBadge = () => {
  if (currentState === 'mastered') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#10B981] bg-[#D1FAE5] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
        <Check className="h-3 w-3 shrink-0 text-[#059669] dark:text-[#34D399]" />
        <span>Đã thuộc</span>
      </span>
    );
  }
  if (currentState === 'hesitant') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#F0ABFC] bg-[#FAE8FF] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]">
        <Flag className="h-3 w-3 shrink-0 fill-current" />
        <span>Phân vân</span>
      </span>
    );
  }
  if (currentState === 'pass1' || currentState === 'studied') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F59E0B] bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B45309] dark:bg-[#FCD34D]" />
        <span>Đã học</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#D5CFC2] bg-[#EAE6DD] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#656058] dark:border-[#2C302B] dark:bg-[#252A26] dark:text-[#9CA39B]">
      Chưa thuộc
    </span>
  );
};

const renderCardActionButtons = (q: QuestionItem, isFaceVisible: boolean) => (
  <div
    className="relative z-10 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Green Flag: Đã thuộc */}
    <button
      type="button"
      data-no-keyflip="true"
      onClick={(e) => {
        e.stopPropagation();
        handleToggleMastered(q.id);
      }}
      aria-pressed={isCurrentMastered}
      title="Đánh dấu Đã thuộc (Phím G)"
      className={`sakuga-btn relative inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shadow-[2px_2px_0_0_#6EE7B7] dark:shadow-[2px_2px_0_0_#065F46] sm:px-3 ${isCurrentMastered
          ? 'border-[#059669] bg-[#059669] text-white hover:bg-[#047857] dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16] dark:hover:bg-[#34D399]'
          : 'border-[#10B981] bg-[#D1FAE5] text-[#047857] hover:bg-[#A7F3D0] dark:border-[#10B981]/60 dark:bg-[#059669]/25 dark:text-[#34D399] dark:hover:bg-[#059669]/35'
        }`}
    >
      {isFlipped && isFaceVisible && !isCurrentMastered && (
        <SakugaBorderFire percent={78} radius={12} mini />
      )}
      <Flag className={`h-3.5 w-3.5 shrink-0 ${isCurrentMastered ? 'fill-current' : ''}`} />
      <span>Đã thuộc</span>
      <kbd
        className={`ml-0.5 hidden rounded px-1 font-mono text-[10px] md:inline-block ${isCurrentMastered
            ? 'bg-white/20 text-white dark:bg-[#052E16]/20 dark:text-[#052E16]'
            : 'border border-[#10B981] bg-white text-[#047857] dark:border-[#10B981]/50 dark:bg-[#0F100E] dark:text-[#34D399]'
          }`}
      >
        G
      </kbd>
    </button>

    {/* Violet Flag: Phân vân */}
    <button
      type="button"
      data-no-keyflip="true"
      onClick={(e) => {
        e.stopPropagation();
        handleToggleFlag(q.id);
      }}
      aria-pressed={isCurrentFlagged}
      title="Đánh dấu Phân vân (Phím F)"
      className={`sakuga-btn inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-3 ${isCurrentFlagged
          ? 'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE] dark:shadow-[2px_2px_0_0_#701A75]'
          : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#F0ABFC] hover:bg-[#FAE8FF] hover:text-[#A21CAF] hover:shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#E879F9]/55 dark:hover:bg-[#D946EF]/20 dark:hover:text-[#F5D0FE] dark:hover:shadow-[2px_2px_0_0_#701A75]'
        }`}
    >
      <Flag className={`h-3.5 w-3.5 shrink-0 ${isCurrentFlagged ? 'fill-current' : ''}`} />
      <span>Phân vân</span>
      <kbd className="ml-0.5 hidden rounded border border-current/25 px-1 font-mono text-[10px] opacity-80 md:inline-block">
        F
      </kbd>
    </button>

    {isCurrentMastered && (
      <SakugaMangaTag
        key={`clear-${q.id}-${masteredBurstSeq}`}
        label="CLEAR! ✓"
        tone="emerald"
        animateBurst={isJustMastered && isFaceVisible}
      />
    )}
  </div>
);

const correctOptionItems = useMemo(() => {
  if (!currentQuestion) return [];
  const upperSet = new Set(currentQuestion.correctAnswers.map((k) => k.toUpperCase()));
  return currentQuestion.options.filter((opt) => upperSet.has(opt.key.toUpperCase()));
}, [currentQuestion]);

const suspectedOptionItems = useMemo(() => {
  if (!currentQuestion || !currentQuestion.suspectedAnswers?.length) return [];
  const correctSet = new Set(currentQuestion.correctAnswers.map((k) => k.toUpperCase()));
  const suspectSet = new Set(currentQuestion.suspectedAnswers.map((k) => k.toUpperCase()));
  return currentQuestion.options.filter(
    (opt) => suspectSet.has(opt.key.toUpperCase()) && !correctSet.has(opt.key.toUpperCase())
  );
}, [currentQuestion]);

return (
  <>
    <div className="flex w-full flex-col items-start gap-6 lg:flex-row lg:gap-8 xl:gap-10">
      {/* Desktop Sidebar (>= 1024px) with 2 Tabs: Chương | Bảng thẻ */}
      <aside className="hidden w-full shrink-0 lg:sticky lg:top-20 lg:block lg:w-[360px] xl:w-[380px]">
        <div className="rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-5 shadow-xs dark:border-[#262925] dark:bg-[#161816] dark:shadow-none">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#D5CFC2] pb-3.5 dark:border-[#262925]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                  Bộ thẻ theo chương
                </h2>
                <p className="tabular-nums text-xs font-semibold text-[#047857] dark:text-[#34D399]">
                  {subjectMasteredCount}/{allSubjectQuestions.length} câu đã thuộc
                </p>
              </div>
            </div>
          </div>

          {/* 2-Tab Switcher: Chương | Bảng thẻ */}
          <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1 dark:border-[#2C302B] dark:bg-[#1C1F1C]">
            <button
              type="button"
              data-no-keyflip="true"
              onClick={() => setSidebarTab('chapters')}
              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition ${sidebarTab === 'chapters'
                  ? 'border-[#4338CA] bg-[#4338CA] text-white shadow-xs hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                  : 'border-transparent text-[#656058] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                }`}
            >
              Chương ({chapters.length})
            </button>
            <button
              type="button"
              data-no-keyflip="true"
              onClick={() => setSidebarTab('grid')}
              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition ${sidebarTab === 'grid'
                  ? 'border-[#4338CA] bg-[#4338CA] text-white shadow-xs hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                  : 'border-transparent text-[#656058] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                }`}
            >
              Bảng thẻ ({deck.length})
            </button>
          </div>

          {sidebarTab === 'chapters' ? (
            <div className="grid max-h-[calc(100vh-280px)] grid-cols-1 gap-4 overflow-y-auto px-2.5 py-2.5">
              {chapters.map((ch) => {
                const stat = chapterStats.get(ch.chapter) ?? {
                  mastered: 0,
                  studied: 0,
                  total: ch.count,
                  pct: 0,
                };
                const active = ch.chapter === selectedChapter;

                return (
                  <button
                    key={ch.chapter}
                    type="button"
                    data-no-keyflip="true"
                    onClick={() => handleSelectChapter(ch.chapter)}
                    className={`relative w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${active
                        ? 'border-[#4338CA] bg-[#EEF2FF] text-[#18181B] shadow-xs dark:border-[#818CF8] dark:bg-[#312E81]/30 dark:text-[#F5F5F4]'
                        : stat.pct >= 100
                          ? 'border-[#10B981] bg-[#FAF9F5] ring-2 ring-[#34D399]/35 hover:border-[#059669] hover:bg-[#ECFDF5] dark:border-[#10B981]/80 dark:bg-[#1C1F1C] dark:ring-[#34D399]/30 dark:hover:border-[#34D399] dark:hover:bg-[#059669]/20'
                          : stat.pct >= 50
                            ? 'border-[#F59E0B]/70 bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#F59E0B]/55 dark:bg-[#1C1F1C] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30'
                            : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30'
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

                    <p
                      className={`mt-1.5 line-clamp-2 text-sm font-semibold leading-snug ${active
                          ? 'text-[#18181B] dark:text-[#F5F5F4]'
                          : 'text-[#292524] dark:text-[#E7E5E4]'
                        }`}
                    >
                      {ch.title}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#656058] dark:text-[#9CA39B]">
                      <span className="tabular-nums">Đã học {stat.studied}/{ch.count}</span>
                      <span className="tabular-nums font-medium text-[#292524] dark:text-[#E7E5E4]">
                        Thuộc {stat.mastered}/{stat.total}
                      </span>
                    </div>

                    <SakugaProgressBar percent={stat.pct} className="mt-2 h-1.5 w-full" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              {/* Compact Legend */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2 text-[11px] font-medium text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#059669] dark:bg-[#10B981]" />
                  Thuộc
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#F59E0B] dark:bg-[#FCD34D]" />
                  Đã học
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#A21CAF] dark:bg-[#F5D0FE]" />
                  Phân vân
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-[#C6BEB0] bg-[#EAE6DD] dark:border-[#353B36] dark:bg-[#252A26]" />
                  Chưa
                </span>
              </div>

              {deck.length === 0 ? (
                <div className="rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-6 text-center text-xs text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]">
                  Không có thẻ nào trong bộ lọc này.
                </div>
              ) : (
                <div className="grid max-h-[calc(100vh-330px)] grid-cols-6 gap-2 overflow-y-auto p-1">
                  {deck.map((q, idx) => {
                    const st = getDetailedMasteryState(progress.questions[q.id]);
                    const isActive = idx === safeIndex;

                    let cellStyle =
                      'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]';

                    if (st === 'hesitant') {
                      cellStyle =
                        'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]';
                    } else if (st === 'mastered') {
                      cellStyle =
                        'border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]';
                    } else if (st === 'pass1' || st === 'studied') {
                      cellStyle =
                        'border-[#F59E0B] bg-[#FEF3C7] text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]';
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        data-no-keyflip="true"
                        onClick={() => jumpToCard(idx)}
                        className={`tabular-nums relative flex h-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-all ${cellStyle} ${isActive
                            ? 'ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                            : ''
                          }`}
                      >
                        {idx + 1}
                        {st === 'hesitant' && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#A21CAF] dark:bg-[#F5D0FE]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Flashcard Area */}
      <div className="w-full min-w-0 flex-1">
        {/* Mobile & Tablet Unified Interactive Progress & Filter Card (< 1024px) */}
        <div ref={mobileProgressRef} className="mb-3.5 px-1 pt-1 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileSheetOpen(true)}
            className={`relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-[#EAE6DD] px-3.5 py-2.5 text-left shadow-xs transition active:scale-[0.99] dark:bg-[#161816] ${activeChapterStat.pct >= 100
                ? 'border-[#10B981] ring-2 ring-[#34D399]/35 dark:border-[#10B981]/80 dark:ring-[#34D399]/30'
                : activeChapterStat.pct >= 50
                  ? 'border-[#F59E0B]/70 dark:border-[#F59E0B]/55'
                  : 'border-[#D5CFC2] dark:border-[#262925]'
              }`}
          >
            <SakugaBorderFire percent={activeChapterStat.pct} radius={12} compact />

            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#18181B] dark:text-[#F5F5F4]">
                <Menu className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#818CF8]" />
                <span className="truncate tabular-nums">
                  Chương {selectedChapter} • Thẻ {deck.length > 0 ? safeIndex + 1 : 0}/{deck.length}
                </span>
                {filter !== 'all' && (
                  <span className="shrink-0 rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-bold text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                    {filter === 'unlearned'
                      ? 'Chưa'
                      : filter === 'studied'
                        ? 'Đã học'
                        : filter === 'flagged'
                          ? 'Phân vân'
                          : 'Thuộc'}
                  </span>
                )}
                {isShuffled && (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-bold text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                    <Shuffle className="h-2.5 w-2.5" />
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

        {/* Desktop Top Filter & Shuffle Bar (>= 1024px) */}
        <div className="mb-5 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-5 py-3.5 shadow-xs dark:border-[#262925] dark:bg-[#161816] dark:shadow-none lg:flex">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#656058] dark:text-[#9CA39B]">
              <Filter className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#818CF8]" />
              Lọc thẻ:
            </span>

            {(
              [
                { id: 'all', label: 'Tất cả', count: filterCounts.all },
                { id: 'unlearned', label: 'Chưa thuộc', count: filterCounts.unlearned },
                { id: 'studied', label: 'Đã học', count: filterCounts.studied },
                { id: 'flagged', label: 'Phân vân', count: filterCounts.flagged },
                { id: 'mastered', label: 'Đã thuộc', count: filterCounts.mastered },
              ] as const
            ).map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-no-keyflip="true"
                  onClick={() => handleApplyFilter(item.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${active
                      ? 'border-[#4338CA] bg-[#4338CA] text-white hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                      : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                    }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${active
                        ? 'bg-white/20 text-white'
                        : 'bg-[#EAE6DD] text-[#656058] dark:bg-[#0F100E] dark:text-[#9CA39B]'
                      }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              data-no-keyflip="true"
              onClick={handleToggleShuffle}
              aria-pressed={isShuffled}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isShuffled
                  ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                  : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>{isShuffled ? 'Đang trộn thẻ' : 'Trộn thẻ'}</span>
            </button>
          </div>
        </div>

        {/* Empty Deck State vs 3D Flashcard */}
        {!currentQuestion ? (
          <div className="rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-5 py-10 text-center shadow-xs dark:border-[#262925] dark:bg-[#161816] dark:shadow-none sm:px-6 sm:py-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#18181B] dark:text-[#F5F5F4]">
              Không có thẻ nào trong bộ lọc này
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[#656058] dark:text-[#9CA39B]">
              Hãy chuyển sang bộ lọc "Tất cả" hoặc chọn một chương khác để tiếp tục lật thẻ.
            </p>
            {filter !== 'all' && (
              <button
                type="button"
                data-no-keyflip="true"
                onClick={() => handleApplyFilter('all')}
                className="sakuga-btn mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_0_#C7D2FE] hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]"
              >
                <span>Xem tất cả thẻ</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Non-rotated outer wrapper so SakugaBurst never mirrors during 3D Y-flip */}
            <div className="relative">
              <SakugaBurst
                event={sakugaEvent}
                className="pointer-events-none absolute -top-3 left-1/2 z-30 -translate-x-1/2 sm:left-auto sm:right-10 sm:translate-x-0"
              />

              {/* 3D Flip Card Container */}
              <div
                style={{ perspective: '1000px' }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="select-none"
              >
                <div
                  onClick={handleCardSurfaceClick}
                  style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                  className="grid cursor-pointer [grid-template-areas:'card']"
                >
                  {/* ================= FRONT FACE (QUESTION) ================= */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(0deg)',
                    }}
                    className={`[grid-area:card] flex min-h-[340px] flex-col justify-between rounded-3xl border-2 bg-white p-4 transition-colors duration-200 dark:bg-[#1E221F] sm:min-h-[390px] sm:p-6 md:p-8 ${isCurrentMastered
                        ? 'border-[#059669] shadow-[4px_4px_0_0_#6EE7B7,0_14px_28px_-12px_rgba(5,150,105,0.14)] dark:border-[#10B981] dark:shadow-[4px_4px_0_0_#065F46,0_18px_36px_-12px_rgba(0,0,0,0.8)] sm:shadow-[6px_6px_0_0_#6EE7B7,0_16px_32px_-12px_rgba(5,150,105,0.14)] dark:sm:shadow-[6px_6px_0_0_#065F46,0_20px_40px_-12px_rgba(0,0,0,0.8)]'
                        : 'border-[#27272A] shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] dark:border-[#52525B] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)]'
                      } ${isFlipped ? 'pointer-events-none' : ''}`}
                  >
                    {/* Top Bar */}
                    <div
                      className={`relative flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 transition-colors duration-200 ${isCurrentMastered
                          ? 'border-[#10B981] bg-[#EEF2FF] dark:border-[#10B981]/60 dark:bg-[#312E81]/40'
                          : 'border-[#A5B4FC] bg-[#EEF2FF] dark:border-[#6366F1]/50 dark:bg-[#312E81]/40'
                        }`}
                    >
                      {isCurrentMastered && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[15px]"
                        >
                          <span
                            key={`front-bar-wave-${currentQuestion.id}-${masteredBurstSeq}`}
                            className={
                              isJustMastered && !isFlipped
                                ? 'sakuga-green-wave absolute inset-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                                : 'absolute inset-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                            }
                          />
                        </span>
                      )}

                      <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span
                          className={`tabular-nums rounded-lg border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap transition-colors sm:px-3 sm:py-1 ${isCurrentMastered
                              ? `${isJustMastered && !isFlipped ? 'sakuga-purple-to-green-arrival ' : ''
                              }border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]`
                              : 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8]/60 dark:bg-[#4338CA] dark:text-white'
                            }`}
                        >
                          Thẻ {safeIndex + 1} / {deck.length}
                        </span>
                        {renderStatusBadge()}
                      </div>

                      {renderCardActionButtons(currentQuestion, !isFlipped)}
                    </div>

                    {/* Center Question Prompt */}
                    <div
                      className={`relative mx-auto my-4 flex w-full max-w-2xl flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl px-5 py-6 text-center sm:px-8 sm:py-8 ${isCurrentMastered
                          ? 'border-2 border-[#059669] bg-[#EEF2FF]/65 ring-2 ring-[#10B981]/20 dark:border-2 dark:border-[#10B981] dark:bg-[#1E1B4B]/45 dark:ring-2 dark:ring-[#10B981]/25'
                          : 'border border-dashed border-[#A5B4FC] bg-[#EEF2FF]/65 dark:border-[#6366F1]/45 dark:bg-[#1E1B4B]/45'
                        }`}
                    >
                      {isCurrentMastered && (
                        <span
                          key={`front-stage-wave-${currentQuestion.id}-${masteredBurstSeq}`}
                          aria-hidden="true"
                          className={
                            isJustMastered && !isFlipped
                              ? 'sakuga-green-wave pointer-events-none absolute inset-0 z-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                              : 'pointer-events-none absolute inset-0 z-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                          }
                        />
                      )}

                      {currentQuestion.isMultiSelect && (
                        <span className="relative z-10 mb-3 inline-flex items-center rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-3 py-0.5 text-xs font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0C4A6E]/35 dark:text-[#7DD3FC]">
                          Chọn nhiều đáp án ({currentQuestion.correctAnswers.length} ý đúng)
                        </span>
                      )}
                      <h2
                        className={`relative z-10 max-w-2xl text-[17px] font-semibold leading-[1.6] sm:text-[20px] md:text-[22px] md:leading-[1.6] ${isCurrentMastered
                            ? 'text-[#064E3B] dark:text-[#ECFDF5]'
                            : 'text-[#18181B] dark:text-[#F5F5F4]'
                          }`}
                      >
                        {currentQuestion.question}
                      </h2>
                    </div>

                    {/* Bottom Flip Hint */}
                    <div className="flex items-center justify-between gap-2 border-t border-[#D5CFC2]/80 pt-3 text-xs font-medium text-[#656058] dark:border-[#262925] dark:text-[#9CA39B]">
                      <span className="text-[11px] font-medium">Mặt trước</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-1 text-xs font-semibold text-[#3730A3] dark:border-[#2C322D] dark:bg-[#141714] dark:text-[#A5B4FC]">
                        <RotateCw className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#818CF8]" />
                        <span>Chạm thẻ để lật</span>
                      </span>
                    </div>
                  </div>

                  {/* ================= BACK FACE (ANSWER) ================= */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                    className={`[grid-area:card] flex min-h-[340px] flex-col justify-between rounded-3xl border-2 bg-white p-4 transition-colors duration-200 dark:bg-[#1E221F] sm:min-h-[390px] sm:p-6 md:p-8 ${isCurrentMastered
                        ? 'border-[#059669] shadow-[4px_4px_0_0_#6EE7B7,0_14px_28px_-12px_rgba(5,150,105,0.14)] dark:border-[#10B981] dark:shadow-[4px_4px_0_0_#065F46,0_18px_36px_-12px_rgba(0,0,0,0.8)] sm:shadow-[6px_6px_0_0_#6EE7B7,0_16px_32px_-12px_rgba(5,150,105,0.14)] dark:sm:shadow-[6px_6px_0_0_#065F46,0_20px_40px_-12px_rgba(0,0,0,0.8)]'
                        : 'border-[#27272A] shadow-[4px_4px_0_0_#C7D2FE,0_14px_28px_-12px_rgba(24,24,27,0.10)] dark:border-[#52525B] dark:shadow-[4px_4px_0_0_#312E81,0_18px_36px_-12px_rgba(0,0,0,0.75)] sm:shadow-[6px_6px_0_0_#C7D2FE,0_16px_32px_-12px_rgba(24,24,27,0.10)] dark:sm:shadow-[6px_6px_0_0_#312E81,0_20px_40px_-12px_rgba(0,0,0,0.75)]'
                      } ${!isFlipped ? 'pointer-events-none' : ''}`}
                  >
                    {/* Top Bar */}
                    <div
                      className={`relative flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 transition-colors duration-200 ${isCurrentMastered
                          ? 'border-[#10B981] bg-[#EEF2FF] dark:border-[#10B981]/60 dark:bg-[#312E81]/40'
                          : 'border-[#A5B4FC] bg-[#EEF2FF] dark:border-[#6366F1]/50 dark:bg-[#312E81]/40'
                        }`}
                    >
                      {isCurrentMastered && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[15px]"
                        >
                          <span
                            key={`back-bar-wave-${currentQuestion.id}-${masteredBurstSeq}`}
                            className={
                              isJustMastered && isFlipped
                                ? 'sakuga-green-wave absolute inset-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                                : 'absolute inset-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                            }
                          />
                        </span>
                      )}

                      <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span
                          className={`tabular-nums rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap transition-colors sm:px-3 sm:py-1 ${isCurrentMastered
                              ? `${isJustMastered && isFlipped ? 'sakuga-purple-to-green-arrival ' : ''
                              }border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]`
                              : 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8]/60 dark:bg-[#4338CA] dark:text-white'
                            }`}
                        >
                          Đáp án • Thẻ {safeIndex + 1}/{deck.length}
                        </span>
                        {renderStatusBadge()}
                      </div>

                      {renderCardActionButtons(currentQuestion, isFlipped)}
                    </div>

                    {/* Center Answer Box (Purple on flip, sweeps Purple -> Emerald when Mastered) */}
                    <div className="my-auto flex flex-col justify-center py-5 sm:py-8">
                      <p className="mb-3 line-clamp-2 text-center text-xs font-medium text-[#656058] dark:text-[#9CA39B] sm:text-sm">
                        {currentQuestion.question}
                      </p>

                      <div
                        className={`relative mx-auto w-full max-w-2xl space-y-2.5 overflow-hidden rounded-2xl border-2 p-4 sm:p-6 ${isCurrentMastered
                            ? 'border-[#059669] bg-[#EEF2FF] text-[#064E3B] ring-2 ring-[#10B981]/20 dark:border-[#10B981] dark:bg-[#1E1B4B]/85 dark:text-[#ECFDF5] dark:ring-2 dark:ring-[#10B981]/25'
                            : 'border-[#4338CA] bg-[#EEF2FF] text-[#1E1B4B] ring-2 ring-[#818CF8]/20 dark:border-[#818CF8] dark:bg-[#1E1B4B]/85 dark:text-[#EEF2FF] dark:ring-2 dark:ring-[#818CF8]/25'
                          }`}
                      >
                        {isCurrentMastered && (
                          <span
                            key={`back-answer-wave-${currentQuestion.id}-${masteredBurstSeq}`}
                            aria-hidden="true"
                            className={
                              isJustMastered && isFlipped
                                ? 'sakuga-green-wave pointer-events-none absolute inset-0 z-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                                : 'pointer-events-none absolute inset-0 z-0 bg-[#D1FAE5] dark:bg-[#064E3B]'
                            }
                          />
                        )}

                        {correctOptionItems.map((opt) => (
                          <div key={opt.key} className="relative z-10 flex items-start gap-3">
                            <span
                              className={`sakuga-option-badge mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${isCurrentMastered
                                  ? `${isJustMastered && isFlipped ? 'sakuga-purple-to-green-arrival ' : ''
                                  }border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]`
                                  : 'border-[#4338CA] bg-[#4338CA] text-white dark:border-[#818CF8] dark:bg-[#4338CA] dark:text-white'
                                }`}
                            >
                              {opt.key}
                            </span>
                            <span className="flex-1 text-[16px] font-bold leading-relaxed sm:text-[18px] md:text-[20px]">
                              {opt.text}
                            </span>
                          </div>
                        ))}
                      </div>

                      {suspectedOptionItems.length > 0 && (
                        <div className="mx-auto mt-3 w-full max-w-2xl space-y-2 rounded-2xl border-2 border-[#EC4899] bg-[#FCE7F3] p-3.5 text-[#9D174D] ring-2 ring-[#F472B6]/20 dark:border-[#F472B6] dark:bg-[#831843]/45 dark:text-[#FCE7F3] dark:ring-[#F472B6]/20 sm:p-4">
                          {suspectedOptionItems.map((opt) => (
                            <div key={opt.key} className="flex flex-wrap items-start justify-between gap-2.5 sm:flex-nowrap">
                              <div className="flex items-start gap-3">
                                <span className="sakuga-option-badge mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#DB2777] bg-[#EC4899] text-xs font-bold text-white dark:border-[#F472B6] dark:bg-[#EC4899] dark:text-white">
                                  {opt.key}
                                </span>
                                <span className="flex-1 text-[15px] font-semibold leading-relaxed sm:text-[16px]">
                                  {opt.text}
                                </span>
                              </div>
                              <SakugaMangaTag
                                label="???"
                                tone="pink"
                                animateBurst={isFlipped}
                                className="shrink-0"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Toggle Explanation */}
                    <div
                      className="border-t border-[#D5CFC2]/80 pt-3 dark:border-[#262925]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          data-no-keyflip="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowExplanation((prev) => !prev);
                          }}
                          className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] px-3 py-1.5 text-xs font-semibold text-[#3730A3] shadow-[2px_2px_0_0_#C7D2FE] hover:border-[#4338CA] hover:bg-[#E0E7FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/50"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{showExplanation ? 'Ẩn giải thích' : 'Xem giải thích'}</span>
                          {showExplanation ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <span
                          onClick={handleFlipCard}
                          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#656058] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:text-[#A5B4FC]"
                        >
                          <RotateCw className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#818CF8]" />
                          <span>Chạm thẻ để lật</span>
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <RichExplanation question={currentQuestion} className="mt-3" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop & Tablet Navigation Controls (< Thẻ trước | Lật thẻ | Thẻ tiếp >) */}
            <div className="mt-5 hidden flex-col gap-3 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 shadow-xs dark:border-[#262925] dark:bg-[#161816] dark:shadow-none md:flex">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  data-no-keyflip="true"
                  disabled={safeIndex === 0}
                  onClick={goToPrev}
                  className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-sm font-semibold text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Thẻ trước</span>
                </button>

                <button
                  type="button"
                  data-no-keyflip="true"
                  onClick={handleFlipCard}
                  className="sakuga-btn inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] px-6 py-2.5 text-sm font-semibold text-[#3730A3] shadow-[3px_3px_0_0_#C7D2FE] hover:border-[#4338CA] hover:bg-[#E0E7FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/50"
                >
                  <RotateCw className="h-4 w-4" />
                  <span>Lật thẻ</span>
                </button>

                <button
                  type="button"
                  data-no-keyflip="true"
                  disabled={safeIndex >= deck.length - 1}
                  onClick={goToNext}
                  className="sakuga-btn relative inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4338CA] px-5 py-2.5 text-sm font-semibold text-white shadow-[2px_2px_0_0_#C7D2FE] hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:bg-[#3730A3]"
                >
                  {isFlipped && safeIndex < deck.length - 1 && (
                    <SakugaBorderFire percent={78} radius={12} mini />
                  )}
                  <span>Thẻ tiếp</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[#D5CFC2]/80 pt-2.5 text-[11px] text-[#656058] dark:border-[#262925] dark:text-[#9CA39B]">
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#E7E5E4]">
                    ←
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#E7E5E4]">
                    →
                  </kbd>{' '}
                  Thẻ trước / tiếp
                </span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#E7E5E4]">
                    Space
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#E7E5E4]">
                    Enter
                  </kbd>{' '}
                  Lật thẻ
                </span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#E7E5E4]">
                    G
                  </kbd>{' '}
                  Cờ xanh lá Đã thuộc
                </span>
                <span>
                  <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[#292524] dark:border-[#2C302B] dark:bg-[#0F100E] dark:text-[#E7E5E4]">
                    F
                  </kbd>{' '}
                  Phân vân
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>

    {/* Mobile Sticky Bottom Navigation Bar (< 768px): [ < Trước ] | [ ↻ Lật thẻ ] | [ Tiếp > ] */}
    {currentQuestion && (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D5CFC2] bg-[#EAE6DD]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(28,25,23,0.08)] backdrop-blur dark:border-[#262925] dark:bg-[#161816]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.65)] md:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={goToPrev}
            className="sakuga-btn inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3.5 py-2.5 text-xs font-semibold text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#2C302B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Trước</span>
          </button>

          <button
            type="button"
            onClick={handleFlipCard}
            className="sakuga-btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] px-3 py-2.5 text-xs font-semibold text-[#3730A3] shadow-[3px_3px_0_0_#C7D2FE] hover:border-[#4338CA] hover:bg-[#E0E7FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/50"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Lật thẻ</span>
          </button>

          <button
            type="button"
            disabled={safeIndex >= deck.length - 1}
            onClick={goToNext}
            className="sakuga-btn relative inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-[2px_2px_0_0_#C7D2FE] hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:bg-[#3730A3]"
          >
            {isFlipped && safeIndex < deck.length - 1 && (
              <SakugaBorderFire percent={78} radius={12} mini />
            )}
            <span>Tiếp</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )}

    {/* Mobile & Tablet Bottom Sheet Drawer (< 1024px): Chapters + Filter + Shuffle + Card Grid */}
    <AnimatePresence>
      {isMobileSheetOpen && (
        <>
          <motion.div
            key="flashcard-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setIsMobileSheetOpen(false)}
            className="fixed inset-0 z-50 bg-[#18181B]/50 backdrop-blur-[2px] dark:bg-[#0F100E]/75 lg:hidden"
          />
          <motion.div
            key="flashcard-sheet-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Chọn chương, bộ lọc và thẻ Flashcard"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D5CFC2] bg-[#EAE6DD] shadow-2xl dark:border-[#262925] dark:bg-[#161816] lg:hidden"
          >
            <div className="flex flex-col items-center border-b border-[#D5CFC2] px-4 pb-3 pt-2.5 dark:border-[#262925]">
              <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D5CFC2] dark:bg-[#323833]" />
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                    {subjectMeta.code} • Bộ thẻ Flashcard
                  </h3>
                  <p className="text-xs text-[#656058] tabular-nums dark:text-[#9CA39B]">
                    Lật thẻ → <span className="font-semibold text-[#B45309] dark:text-[#FCD34D]">Đã học</span> • Bấm cờ xanh lá →{' '}
                    <span className="font-semibold text-[#047857] dark:text-[#34D399]">Đã thuộc</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(false)}
                  aria-label="Đóng ngăn kéo"
                  className="cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1.5 text-[#656058] transition hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-4">
              {/* Filter & Shuffle */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  <span>Lọc trạng thái (Chương {selectedChapter})</span>
                  <button
                    type="button"
                    onClick={handleToggleShuffle}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold normal-case transition ${isShuffled
                        ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                        : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                      }`}
                  >
                    <Shuffle className="h-3 w-3" />
                    <span>{isShuffled ? 'Đang trộn thẻ' : 'Trộn thẻ'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'all', label: 'Tất cả', count: filterCounts.all },
                      { id: 'unlearned', label: 'Chưa thuộc', count: filterCounts.unlearned },
                      { id: 'studied', label: 'Đã học', count: filterCounts.studied },
                      { id: 'flagged', label: 'Phân vân', count: filterCounts.flagged },
                      { id: 'mastered', label: 'Đã thuộc', count: filterCounts.mastered },
                    ] as const
                  ).map((item) => {
                    const active = filter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleApplyFilter(item.id);
                          setIsMobileSheetOpen(false);
                        }}
                        className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${active
                            ? 'border-[#4338CA] bg-[#4338CA] text-white hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                            : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                          }`}
                      >
                        {item.label} ({item.count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chapter List */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                  Chọn chương
                </div>
                <div className="space-y-3.5 px-1.5 py-1.5">
                  {chapters.map((ch) => {
                    const stat = chapterStats.get(ch.chapter) ?? {
                      mastered: 0,
                      studied: 0,
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
                                ? 'border-[#F59E0B]/70 bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#F59E0B]/55 dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30'
                                : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30'
                          }`}
                      >
                        <SakugaBorderFire percent={stat.pct} radius={12} compact />

                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`text-xs font-bold ${active ? 'text-[#3730A3] dark:text-[#A5B4FC]' : ''}`}>
                              Chương {ch.chapter}{' '}
                              <span className="font-normal text-[#656058] dark:text-[#9CA39B]">
                                (Thuộc {stat.mastered}/{stat.total})
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

              {/* Card Number Grid */}
              {deck.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#656058] dark:text-[#9CA39B]">
                    Bảng số thẻ ({deck.length})
                  </div>
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                    {deck.map((q, idx) => {
                      const st = getDetailedMasteryState(progress.questions[q.id]);
                      const isActive = idx === safeIndex;

                      let cellStyle =
                        'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]';

                      if (st === 'hesitant') {
                        cellStyle =
                          'border-[#F0ABFC] bg-[#FAE8FF] text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]';
                      } else if (st === 'mastered') {
                        cellStyle =
                          'border-[#10B981] bg-[#D1FAE5] text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]';
                      } else if (st === 'pass1' || st === 'studied') {
                        cellStyle =
                          'border-[#F59E0B] bg-[#FEF3C7] text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]';
                      }

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            jumpToCard(idx);
                            setIsMobileSheetOpen(false);
                          }}
                          className={`tabular-nums relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition ${cellStyle} ${isActive
                              ? 'ring-2 ring-[#4338CA] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#818CF8] dark:ring-offset-[#161816]'
                              : ''
                            }`}
                        >
                          {idx + 1}
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
