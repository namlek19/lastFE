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
  Grid3X3,
  Menu,
  RotateCw,
  Shuffle,
  X,
} from 'lucide-react';
import { getChaptersBySubject, getQuestionsBySubject, SUBJECTS } from '../data';
import { QuestionItem, SubjectId, UserProgressStore } from '../types/quiz';
import { getDetailedMasteryState, isMastered } from '../utils/storage';
import { RichExplanation } from './RichExplanation';

export interface FlashcardViewProps {
  subject: SubjectId;
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

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  subject,
  progress,
  onMarkStudied,
  onToggleMastered,
  onToggleFlag,
}) => {
  const subjectMeta = SUBJECTS[subject];
  const chapters = useMemo(() => getChaptersBySubject(subject), [subject]);
  const allSubjectQuestions = useMemo(() => getQuestionsBySubject(subject), [subject]);

  const [selectedChapter, setSelectedChapter] = useState<number>(() => chapters[0]?.chapter ?? 1);
  const [filter, setFilter] = useState<FlashcardFilter>('all');
  const [lockedFilterIds, setLockedFilterIds] = useState<string[] | null>(null);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isGridOpen, setIsGridOpen] = useState<boolean>(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef<boolean>(false);

  // Reset state when switching subject
  useEffect(() => {
    const firstChapter = chapters[0]?.chapter ?? 1;
    setSelectedChapter(firstChapter);
    setFilter('all');
    setLockedFilterIds(null);
    setIsShuffled(false);
    setShuffledIds(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowExplanation(false);
    setIsMobileSheetOpen(false);
  }, [subject, chapters]);

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

  const handleSelectChapter = (chapterNum: number) => {
    setSelectedChapter(chapterNum);
    setFilter('all');
    setLockedFilterIds(null);
    setIsShuffled(false);
    setShuffledIds(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowExplanation(false);
  };

  const handleApplyFilter = (nextFilter: FlashcardFilter) => {
    setIsFlipped(false);
    setShowExplanation(false);
    setCurrentIndex(0);

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
    setIsFlipped((prev) => {
      const next = !prev;
      if (next) {
        onMarkStudied(currentQuestion.id);
      } else {
        setShowExplanation(false);
      }
      return next;
    });
  }, [currentQuestion, onMarkStudied]);

  const goToPrev = useCallback(() => {
    if (safeIndex <= 0) return;
    setIsFlipped(false);
    setShowExplanation(false);
    setCurrentIndex((idx) => Math.max(0, idx - 1));
  }, [safeIndex]);

  const goToNext = useCallback(() => {
    if (safeIndex >= deck.length - 1) return;
    setIsFlipped(false);
    setShowExplanation(false);
    setCurrentIndex((idx) => Math.min(deck.length - 1, idx + 1));
  }, [safeIndex, deck.length]);

  const jumpToCard = (idx: number) => {
    setIsFlipped(false);
    setShowExplanation(false);
    setCurrentIndex(idx);
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
        onToggleMastered(currentQuestion.id);
        return;
      }

      if (lower === 'f') {
        e.preventDefault();
        onToggleFlag(currentQuestion.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, goToPrev, goToNext, handleFlipCard, onToggleMastered, onToggleFlag]);

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
        <span className="inline-flex items-center gap-1 rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
          <Check className="h-3 w-3 shrink-0" />
          <span>Đã thuộc</span>
        </span>
      );
    }
    if (currentState === 'hesitant') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]">
          <Flag className="h-3 w-3 shrink-0 fill-current" />
          <span>Phân vân</span>
        </span>
      );
    }
    if (currentState === 'pass1' || currentState === 'studied') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0369A1] dark:bg-[#38BDF8]" />
          <span>Đã học</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-[#EAF1F8] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#5B6E88] dark:bg-[#18243C] dark:text-[#7E91B0]">
        Chưa thuộc
      </span>
    );
  };

  const renderCardActionButtons = (q: QuestionItem) => (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" onClick={(e) => e.stopPropagation()}>
      {/* Green Flag: Đã thuộc */}
      <button
        type="button"
        data-no-keyflip="true"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMastered(q.id);
        }}
        aria-pressed={isCurrentMastered}
        title="Đánh dấu Đã thuộc (Phím G)"
        className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:px-3 ${
          isCurrentMastered
            ? 'border-[#0D9488] bg-[#0D9488] text-white shadow-xs hover:bg-[#0F766E] dark:border-[#14B8A6] dark:bg-[#14B8A6] dark:text-[#070B14] dark:hover:bg-[#2DD4BF]'
            : 'border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] hover:bg-[#CCFBF1] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF] dark:hover:bg-[#0D9488]/25'
        }`}
      >
        <Flag className={`h-3.5 w-3.5 shrink-0 ${isCurrentMastered ? 'fill-current' : ''}`} />
        <span>Đã thuộc</span>
        <kbd
          className={`ml-0.5 hidden rounded px-1 font-mono text-[10px] md:inline-block ${
            isCurrentMastered
              ? 'bg-white/20 text-white dark:bg-[#070B14]/20 dark:text-[#070B14]'
              : 'border border-[#5EEAD4] bg-white text-[#0F766E] dark:border-[#14B8A6]/40 dark:bg-[#070B14] dark:text-[#2DD4BF]'
          }`}
        >
          G
        </kbd>
      </button>

      {/* Indigo Flag: Phân vân */}
      <button
        type="button"
        data-no-keyflip="true"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFlag(q.id);
        }}
        aria-pressed={isCurrentFlagged}
        title="Đánh dấu Phân vân (Phím F)"
        className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:px-3 ${
          isCurrentFlagged
            ? 'border-[#A5B4FC] bg-[#EEF2FF] text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]'
            : 'border-[#D4E1EE] bg-[#F8FAFC] text-[#5B6E88] hover:border-[#A5B4FC] hover:bg-[#EEF2FF] hover:text-[#4338CA] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#7E91B0] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#6366F1]/15 dark:hover:text-[#A5B4FC]'
        }`}
      >
        <Flag className={`h-3.5 w-3.5 shrink-0 ${isCurrentFlagged ? 'fill-current' : ''}`} />
        <span>Phân vân</span>
        <kbd className="ml-0.5 hidden rounded border border-current/25 px-1 font-mono text-[10px] opacity-80 md:inline-block">
          F
        </kbd>
      </button>
    </div>
  );

  const correctOptionItems = useMemo(() => {
    if (!currentQuestion) return [];
    const upperSet = new Set(currentQuestion.correctAnswers.map((k) => k.toUpperCase()));
    return currentQuestion.options.filter((opt) => upperSet.has(opt.key.toUpperCase()));
  }, [currentQuestion]);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr] lg:gap-8">
        {/* Desktop Chapter Sidebar */}
        <aside className="hidden md:block">
          <div className="sticky top-28 rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] p-5 shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none">
            <div className="mb-4 flex items-center justify-between border-b border-[#D4E1EE] pb-3.5 dark:border-[#18243C]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                    Bộ thẻ theo chương
                  </h2>
                  <p className="tabular-nums text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
                    {subjectMasteredCount}/{allSubjectQuestions.length} câu đã thuộc
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-220px)] space-y-3.5 overflow-y-auto pr-1">
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
                    className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-[#0284C7] bg-[#E0F2FE] shadow-xs dark:border-[#38BDF8] dark:bg-[#0284C7]/20'
                        : 'border-[#D4E1EE] bg-white hover:border-[#0284C7] hover:bg-[#E0F2FE]/50 dark:border-[#18243C] dark:bg-[#111B2E] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          active
                            ? 'text-[#0369A1] dark:text-[#38BDF8]'
                            : 'text-[#5B6E88] dark:text-[#7E91B0]'
                        }`}
                      >
                        Chương {ch.chapter}
                      </span>
                      <span className="tabular-nums rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                        {stat.pct}% Đã thuộc
                      </span>
                    </div>

                    <p
                      className={`mt-1.5 line-clamp-2 text-sm font-semibold leading-snug ${
                        active
                          ? 'text-[#0369A1] dark:text-[#F8FAFC]'
                          : 'text-[#0B1324] dark:text-[#E2E8F0]'
                      }`}
                    >
                      {ch.title}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#5B6E88] dark:text-[#7E91B0]">
                      <span className="tabular-nums">Đã học {stat.studied}/{ch.count}</span>
                      <span className="tabular-nums font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                        Thuộc {stat.mastered}/{stat.total}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#D4E1EE] dark:bg-[#070B14]">
                      <div
                        className="h-full rounded-full bg-[#0D9488] transition-all duration-300 dark:bg-[#14B8A6]"
                        style={{ width: `${stat.pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Flashcard Area */}
        <div className="min-w-0">
          {/* Mobile Compact 1-Row Toolbar (< 768px) */}
          <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-semibold text-[#0B1324] shadow-xs transition active:scale-[0.99] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
                <span className="truncate tabular-nums">
                  Chương {selectedChapter} • Thẻ {deck.length > 0 ? safeIndex + 1 : 0}/{deck.length}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#5B6E88] dark:text-[#7E91B0]" />
            </button>

            <button
              type="button"
              onClick={handleToggleShuffle}
              aria-pressed={isShuffled}
              title="Trộn thẻ ngẫu nhiên"
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                isShuffled
                  ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#38BDF8]'
                  : 'border-[#D4E1EE] bg-[#F8FAFC] text-[#5B6E88] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#7E91B0]'
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Desktop Top Filter & Shuffle Bar */}
          <div className="mb-5 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] px-5 py-3.5 shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none md:flex">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#5B6E88] dark:text-[#7E91B0]">
                <Filter className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
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
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-[#0369A1] bg-[#0369A1] text-white hover:bg-[#0284C7] dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]'
                        : 'border-[#D4E1EE] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[#EAF1F8] text-[#5B6E88] dark:bg-[#070B14] dark:text-[#7E91B0]'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-no-keyflip="true"
                onClick={handleToggleShuffle}
                aria-pressed={isShuffled}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  isShuffled
                    ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#38BDF8]'
                    : 'border-[#D4E1EE] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]'
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>{isShuffled ? 'Đang trộn thẻ' : 'Trộn thẻ'}</span>
              </button>

              {deck.length > 0 && (
                <button
                  type="button"
                  data-no-keyflip="true"
                  onClick={() => setIsGridOpen((prev) => !prev)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D4E1EE] bg-white px-3 py-1.5 text-xs font-semibold text-[#0369A1] transition-colors hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#38BDF8] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span>Danh sách thẻ</span>
                  {isGridOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Empty Deck State vs 3D Flashcard */}
          {!currentQuestion ? (
            <div className="rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] px-5 py-10 text-center shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none sm:px-6 sm:py-12">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                Không có thẻ nào trong bộ lọc này
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5B6E88] dark:text-[#7E91B0]">
                Hãy chuyển sang bộ lọc "Tất cả" hoặc chọn một chương khác để tiếp tục lật thẻ.
              </p>
              {filter !== 'all' && (
                <button
                  type="button"
                  data-no-keyflip="true"
                  onClick={() => handleApplyFilter('all')}
                  className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
                >
                  <span>Xem tất cả thẻ</span>
                </button>
              )}
            </div>
          ) : (
            <>
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
                    className={`[grid-area:card] flex min-h-[340px] flex-col justify-between rounded-2xl border border-[#BBD0E6] border-t-2 border-t-[#0284C7] bg-white p-4 shadow-[0_12px_30px_-8px_rgba(3,105,161,0.12)] dark:border-[#253759] dark:border-t-2 dark:border-t-[#38BDF8] dark:bg-[#111B2E] dark:shadow-[0_12px_32px_-8px_rgba(2,132,199,0.18)] sm:min-h-[390px] sm:p-7 md:p-8 ${
                      isFlipped ? 'pointer-events-none' : ''
                    }`}
                  >
                    {/* Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4E1EE] pb-3 dark:border-[#18243C] sm:pb-4">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="tabular-nums rounded-full bg-[#EAF1F8] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-[#0B1324] dark:bg-[#18243C] dark:text-[#F8FAFC] sm:px-3 sm:py-1">
                          Thẻ {safeIndex + 1} / {deck.length}
                        </span>
                        {renderStatusBadge()}
                      </div>

                      {renderCardActionButtons(currentQuestion)}
                    </div>

                    {/* Center Question Prompt */}
                    <div className="my-auto flex flex-col items-center justify-center py-6 text-center sm:py-10">
                      {currentQuestion.isMultiSelect && (
                        <span className="mb-3 inline-flex items-center rounded-full border border-[#7DD3FC] bg-[#E0F2FE] px-3 py-0.5 text-xs font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                          Chọn nhiều đáp án ({currentQuestion.correctAnswers.length} ý đúng)
                        </span>
                      )}
                      <h2 className="max-w-2xl text-[17px] font-semibold leading-[1.6] text-[#0B1324] dark:text-[#F8FAFC] sm:text-[20px] md:text-[22px] md:leading-[1.6]">
                        {currentQuestion.question}
                      </h2>
                    </div>

                    {/* Bottom Flip Hint */}
                    <div className="flex items-center justify-center gap-2 border-t border-[#D4E1EE]/70 pt-3 text-xs font-medium text-[#5B6E88] dark:border-[#18243C] dark:text-[#7E91B0]">
                      <RotateCw className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                      <span>Chạm thẻ để lật</span>
                    </div>
                  </div>

                  {/* ================= BACK FACE (ANSWER) ================= */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                    className={`[grid-area:card] flex min-h-[340px] flex-col justify-between rounded-2xl border border-[#5EEAD4] border-t-2 border-t-[#0D9488] bg-white p-4 shadow-[0_12px_30px_-8px_rgba(3,105,161,0.12)] dark:border-[#14B8A6]/60 dark:border-t-2 dark:border-t-[#2DD4BF] dark:bg-[#111B2E] dark:shadow-[0_12px_32px_-8px_rgba(2,132,199,0.18)] sm:min-h-[390px] sm:p-7 md:p-8 ${
                      !isFlipped ? 'pointer-events-none' : ''
                    }`}
                  >
                    {/* Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4E1EE] pb-3 dark:border-[#18243C] sm:pb-4">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="tabular-nums rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF] sm:px-3 sm:py-1">
                          Đáp án • Thẻ {safeIndex + 1}/{deck.length}
                        </span>
                        {renderStatusBadge()}
                      </div>

                      {renderCardActionButtons(currentQuestion)}
                    </div>

                    {/* Center Answer Box (Minimal & High-Impact) */}
                    <div className="my-auto flex flex-col justify-center py-5 sm:py-8">
                      <p className="mb-3 line-clamp-2 text-center text-xs font-medium text-[#5B6E88] dark:text-[#7E91B0] sm:text-sm">
                        {currentQuestion.question}
                      </p>

                      <div className="mx-auto w-full max-w-2xl space-y-2.5 rounded-2xl border border-[#5EEAD4] bg-[#E6F7F5] p-4 text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF] sm:p-6">
                        {correctOptionItems.map((opt) => (
                          <div key={opt.key} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0D9488] text-xs font-bold text-white dark:bg-[#14B8A6] dark:text-[#070B14]">
                              {opt.key}
                            </span>
                            <span className="flex-1 text-[16px] font-bold leading-relaxed sm:text-[18px] md:text-[20px]">
                              {opt.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Toggle Explanation */}
                    <div
                      className="border-t border-[#D4E1EE]/70 pt-3 dark:border-[#18243C]"
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
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#0369A1] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]"
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
                          className="cursor-pointer text-xs text-[#5B6E88] hover:text-[#0284C7] dark:text-[#7E91B0] dark:hover:text-[#38BDF8]"
                        >
                          Chạm thẻ để lật
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

              {/* Desktop Navigation Controls (< Thẻ trước | Lật thẻ | Thẻ tiếp >) */}
              <div className="mt-5 hidden flex-col gap-3 rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] p-4 shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none md:flex">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    data-no-keyflip="true"
                    disabled={safeIndex === 0}
                    onClick={goToPrev}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D4E1EE] bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0369A1] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A] dark:hover:text-[#38BDF8]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Thẻ trước</span>
                  </button>

                  <button
                    type="button"
                    data-no-keyflip="true"
                    onClick={handleFlipCard}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] px-6 py-2.5 text-sm font-semibold text-[#0369A1] transition hover:bg-[#BAE6FD]/70 dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] dark:hover:bg-[#0284C7]/25"
                  >
                    <RotateCw className="h-4 w-4" />
                    <span>Lật thẻ</span>
                  </button>

                  <button
                    type="button"
                    data-no-keyflip="true"
                    disabled={safeIndex >= deck.length - 1}
                    onClick={goToNext}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0369A1] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-40 dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
                  >
                    <span>Thẻ tiếp</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[#D4E1EE]/70 pt-2.5 text-[11px] text-[#5B6E88] dark:border-[#18243C] dark:text-[#7E91B0]">
                  <span>
                    <kbd className="rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#E2E8F0]">
                      ←
                    </kbd>{' '}
                    /{' '}
                    <kbd className="rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#E2E8F0]">
                      →
                    </kbd>{' '}
                    Thẻ trước / tiếp
                  </span>
                  <span>
                    <kbd className="rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#E2E8F0]">
                      Space
                    </kbd>{' '}
                    /{' '}
                    <kbd className="rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#E2E8F0]">
                      Enter
                    </kbd>{' '}
                    Lật thẻ
                  </span>
                  <span>
                    <kbd className="rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#E2E8F0]">
                      G
                    </kbd>{' '}
                    Cờ xanh lá Đã thuộc
                  </span>
                  <span>
                    <kbd className="rounded border border-[#D4E1EE] bg-white px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#18243C] dark:bg-[#070B14] dark:text-[#E2E8F0]">
                      F
                    </kbd>{' '}
                    Phân vân
                  </span>
                </div>
              </div>

              {/* Desktop Collapsible Flashcard Grid */}
              <div className="hidden md:block">
                <AnimatePresence initial={false}>
                  {isGridOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="mt-6 overflow-hidden"
                    >
                      <div className="rounded-2xl border border-[#D4E1EE] bg-[#F8FAFC] p-6 shadow-xs dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-none">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <span className="tabular-nums text-xs font-bold uppercase tracking-wide text-[#0B1324] dark:text-[#F8FAFC]">
                            Danh sách thẻ ({deck.length})
                          </span>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5B6E88] dark:text-[#7E91B0]">
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
                              Đã thuộc
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] dark:bg-[#38BDF8]" />
                              Đã học
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#4338CA] dark:bg-[#A5B4FC]" />
                              Phân vân
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-10 md:grid-cols-12">
                          {deck.map((q, idx) => {
                            const st = getDetailedMasteryState(progress.questions[q.id]);
                            const isActive = idx === safeIndex;

                            let cellStyle =
                              'border-[#D4E1EE] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#1C2D4A]';

                            if (st === 'hesitant') {
                              cellStyle =
                                'border-[#A5B4FC] bg-[#EEF2FF] text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]';
                            } else if (st === 'mastered') {
                              cellStyle =
                                'border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]';
                            } else if (st === 'pass1' || st === 'studied') {
                              cellStyle =
                                'border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]';
                            }

                            return (
                              <button
                                key={q.id}
                                type="button"
                                data-no-keyflip="true"
                                onClick={() => jumpToCard(idx)}
                                className={`tabular-nums relative flex h-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-all ${cellStyle} ${
                                  isActive
                                    ? 'ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#0C1322]'
                                    : ''
                                }`}
                              >
                                {idx + 1}
                                {st === 'hesitant' && (
                                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#4338CA] dark:bg-[#A5B4FC]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar: [ < Trước ] | [ ↻ Lật thẻ ] | [ Tiếp > ] */}
      {currentQuestion && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D4E1EE] bg-[#F8FAFC]/95 px-3.5 pt-2.5 pb-safe shadow-[0_-6px_20px_-4px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#18243C] dark:bg-[#0C1322]/95 dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.5)] md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safeIndex === 0}
              onClick={goToPrev}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D4E1EE] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#1E293B] transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Trước</span>
            </button>

            <button
              type="button"
              onClick={handleFlipCard}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] px-3 py-2.5 text-xs font-semibold text-[#0369A1] transition active:scale-[0.99] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Lật thẻ</span>
            </button>

            <button
              type="button"
              disabled={safeIndex >= deck.length - 1}
              onClick={goToNext}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0369A1] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]"
            >
              <span>Tiếp</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet Drawer: Chapters + Filter + Shuffle + Card Grid */}
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
              className="fixed inset-0 z-50 bg-[#0B1324]/50 backdrop-blur-[2px] dark:bg-[#070B14]/75 md:hidden"
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
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-[#D4E1EE] bg-[#F8FAFC] shadow-2xl dark:border-[#18243C] dark:bg-[#0C1322] md:hidden"
            >
              <div className="flex flex-col items-center border-b border-[#D4E1EE] px-4 pb-3 pt-2.5 dark:border-[#18243C]">
                <div className="mb-2.5 h-1 w-10 rounded-full bg-[#D4E1EE] dark:bg-[#253759]" />
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                      {subjectMeta.code} • Bộ thẻ Flashcard
                    </h3>
                    <p className="text-xs text-[#0D9488] tabular-nums dark:text-[#14B8A6]">
                      Lật thẻ → Đã học • Bấm cờ xanh lá → Đã thuộc
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileSheetOpen(false)}
                    aria-label="Đóng ngăn kéo"
                    className="cursor-pointer rounded-xl border border-[#D4E1EE] bg-white p-1.5 text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-4">
                {/* Filter & Shuffle */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#5B6E88] dark:text-[#7E91B0]">
                    <span>Lọc trạng thái (Chương {selectedChapter})</span>
                    <button
                      type="button"
                      onClick={handleToggleShuffle}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold normal-case ${
                        isShuffled
                          ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#38BDF8]'
                          : 'border-[#D4E1EE] bg-white text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#7E91B0]'
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
                          className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${
                            active
                              ? 'border-[#0369A1] bg-[#0369A1] text-white dark:border-[#38BDF8]/50 dark:bg-[#0284C7]'
                              : 'border-[#D4E1EE] bg-white text-[#1E293B] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]'
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
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5B6E88] dark:text-[#7E91B0]">
                    Chọn chương
                  </div>
                  <div className="space-y-2">
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
                          className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                            active
                              ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#F8FAFC]'
                              : 'border-[#D4E1EE] bg-white text-[#1E293B] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold">
                              Chương {ch.chapter}{' '}
                              <span className="font-normal text-[#5B6E88] dark:text-[#7E91B0]">
                                (Thuộc {stat.mastered}/{stat.total})
                              </span>
                            </div>
                            <div className="truncate text-xs opacity-85">{ch.title}</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]">
                            {stat.pct}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card Number Grid */}
                {deck.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5B6E88] dark:text-[#7E91B0]">
                      Bảng số thẻ ({deck.length})
                    </div>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                      {deck.map((q, idx) => {
                        const st = getDetailedMasteryState(progress.questions[q.id]);
                        const isActive = idx === safeIndex;

                        let cellStyle =
                          'border-[#D4E1EE] bg-white text-[#1E293B] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#E2E8F0]';

                        if (st === 'hesitant') {
                          cellStyle =
                            'border-[#A5B4FC] bg-[#EEF2FF] text-[#4338CA] dark:border-[#818CF8]/50 dark:bg-[#6366F1]/15 dark:text-[#A5B4FC]';
                        } else if (st === 'mastered') {
                          cellStyle =
                            'border-[#5EEAD4] bg-[#E6F7F5] text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]';
                        } else if (st === 'pass1' || st === 'studied') {
                          cellStyle =
                            'border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]';
                        }

                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => {
                              jumpToCard(idx);
                              setIsMobileSheetOpen(false);
                            }}
                            className={`tabular-nums relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition ${cellStyle} ${
                              isActive
                                ? 'ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#0C1322]'
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
