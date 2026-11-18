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
import { QuestionItem, QuestionProgress, SubjectId, UserProgressStore } from '../types/quiz';
import { getDetailedMasteryState, isMastered } from '../utils/storage';
import { RichExplanation } from './RichExplanation';

interface ChapterStudyViewProps {
  subject: SubjectId;
  progress: UserProgressStore;
  onRecordAttempt: (qId: string, isCorrect: boolean, flagged?: boolean) => void;
  onToggleFlag: (qId: string) => void;
}

type QuestionFilter = 'all' | 'wrong' | 'flagged';

interface SessionAttempt {
  selectedKeys: string[];
  graded: boolean;
}

function getQuestionCellClass(qp: QuestionProgress | undefined, hoverable = false): string {
  const flagged = Boolean(qp?.flagged);
  const mastered = isMastered(qp);
  const lastWrong = qp?.lastResult === 'wrong';
  const lastCorrect = qp?.lastResult === 'correct';

  if (flagged) {
    return 'border-[#C4B5FD] bg-[#EDE9FE] text-[#6D28D9] dark:border-[#A78BFA]/55 dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE]';
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
    ? 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#284E3B] hover:bg-[#E8F0EC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#10B981] dark:hover:bg-[#242925]'
    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]';
}

export const ChapterStudyView: React.FC<ChapterStudyViewProps> = ({
  subject,
  progress,
  onRecordAttempt,
  onToggleFlag,
}) => {
  const chapters = useMemo(() => getChaptersBySubject(subject), [subject]);
  const allSubjectQuestions = useMemo(() => getQuestionsBySubject(subject), [subject]);

  const [selectedChapter, setSelectedChapter] = useState<number>(() => chapters[0]?.chapter ?? 1);
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const [lockedFilterIds, setLockedFilterIds] = useState<string[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionAttempts, setSessionAttempts] = useState<Record<string, SessionAttempt>>({});
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'grid'>('chapters');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);

  const explanationRef = useRef<HTMLDivElement>(null);

  const scrollToExplanationOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      window.setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 90);
    }
  };

  // Reset state cleanly when switching subject
  useEffect(() => {
    const firstChapter = chapters[0]?.chapter ?? 1;
    setSelectedChapter(firstChapter);
    setFilter('all');
    setLockedFilterIds(null);
    setCurrentIndex(0);
    setSessionAttempts({});
    setSidebarTab('chapters');
    setIsMobileSheetOpen(false);
  }, [subject, chapters]);

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

  const handleSelectOption = (question: QuestionItem, optionKey: string) => {
    const existing = sessionAttempts[question.id];
    if (existing?.graded) return;

    if (!question.isMultiSelect) {
      const selectedKeys = [optionKey];
      const correct = isAnswerCorrect(selectedKeys, question.correctAnswers);
      setSessionAttempts((prev) => ({
        ...prev,
        [question.id]: { selectedKeys, graded: true },
      }));
      onRecordAttempt(question.id, correct);
      scrollToExplanationOnMobile();
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

    const correct = isAnswerCorrect(existing.selectedKeys, question.correctAnswers);
    setSessionAttempts((prev) => ({
      ...prev,
      [question.id]: { selectedKeys: existing.selectedKeys, graded: true },
    }));
    onRecordAttempt(question.id, correct);
    scrollToExplanationOnMobile();
  };

  const handleRetryQuestion = (questionId: string) => {
    setSessionAttempts((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
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

      // 1-5 or a-e: select/toggle option
      const numberIndex = ['1', '2', '3', '4', '5'].indexOf(keyLower);
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
        onToggleFlag(currentQuestion.id);
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
  const subjectMeta = SUBJECTS[subject];

  const isCurrentCorrect = currentQuestion && currentAttempt.graded
    ? isAnswerCorrect(currentAttempt.selectedKeys, currentQuestion.correctAnswers)
    : false;

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
                className={`cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  sidebarTab === 'chapters'
                    ? 'bg-[#284E3B] text-white dark:bg-[#2D5A43] dark:text-[#F5F5F4]'
                    : 'text-[#656058] hover:bg-[#E8F0EC] hover:text-[#18181B] dark:text-[#9CA39B] dark:hover:bg-[#242925] dark:hover:text-[#F5F5F4]'
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
                className={`cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  sidebarTab === 'grid'
                    ? 'bg-[#284E3B] text-white dark:bg-[#2D5A43] dark:text-[#F5F5F4]'
                    : 'text-[#656058] hover:bg-[#E8F0EC] hover:text-[#18181B] dark:text-[#9CA39B] dark:hover:bg-[#242925] dark:hover:text-[#F5F5F4]'
                }`}
              >
                Bảng câu hỏi ({filteredQuestions.length})
              </button>
            </div>

            {sidebarTab === 'chapters' ? (
              <>
                <div className="my-3.5 flex items-center justify-between gap-2 border-b border-[#D5CFC2] pb-3 dark:border-[#262925]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#C6BEB0] bg-[#E8F0EC] text-[#284E3B] dark:border-[#52B788]/40 dark:bg-[#2D5A43]/25 dark:text-[#6EE7B7]">
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
                    className="shrink-0 cursor-pointer rounded-lg border border-[#D5CFC2] bg-[#FAF9F5] px-2.5 py-1 text-[11px] font-semibold text-[#284E3B] transition-colors hover:border-[#284E3B] hover:bg-[#E8F0EC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#6EE7B7] dark:hover:border-[#10B981] dark:hover:bg-[#242925]"
                  >
                    Bảng câu ▸
                  </button>
                </div>

                <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-y-auto pr-1">
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
                        className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                          active
                            ? 'border-[#284E3B] bg-[#E8F0EC] text-[#18181B] dark:border-[#10B981] dark:bg-[#2D5A43]/25 dark:text-[#F5F5F4]'
                            : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#284E3B] hover:bg-[#E8F0EC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:hover:border-[#10B981] dark:hover:bg-[#242925]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold uppercase tracking-wide ${
                              active
                                ? 'text-[#284E3B] dark:text-[#6EE7B7]'
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

                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#D5CFC2] dark:bg-[#0F100E]">
                          <div
                            className="h-full rounded-full bg-[#059669] transition-all duration-300 dark:bg-[#10B981]"
                            style={{ width: `${stat.pct}%` }}
                          />
                        </div>
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
                      <h2 className="text-xs font-bold uppercase tracking-wide text-[#284E3B] dark:text-[#6EE7B7]">
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
                      <span className="h-2.5 w-2.5 rounded-[3px] border border-[#284E3B] bg-[#FAF9F5] ring-1 ring-[#284E3B] dark:border-[#10B981] dark:bg-[#1C1F1C] dark:ring-[#10B981]" />
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
                      <span className="h-2.5 w-2.5 rounded-full bg-[#6D28D9] dark:bg-[#A78BFA]" />
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
                          className={`tabular-nums relative flex h-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-all ${cellStyle} ${
                            isActive
                              ? 'ring-2 ring-[#284E3B] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#10B981] dark:ring-offset-[#161816]'
                              : ''
                          }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6D28D9] dark:bg-[#A78BFA]" />
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
          {/* Mobile & Tablet Compact 1-Line Toolbar (< 1024px) */}
          <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D5CFC2] bg-[#EAE6DD] px-3 py-2 text-left text-xs font-semibold text-[#18181B] transition active:scale-[0.99] dark:border-[#262925] dark:bg-[#161816] dark:text-[#F5F5F4]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-[#284E3B] dark:text-[#6EE7B7]" />
                <span className="truncate tabular-nums">
                  Chương {selectedChapter} • Câu {filteredQuestions.length > 0 ? safeIndex + 1 : 0}/
                  {filteredQuestions.length}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#656058] dark:text-[#9CA39B]" />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                filter === 'wrong'
                  ? 'border-[#FDA4AF] bg-[#FFE4E6] text-[#BE123C] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF]'
                  : filter === 'flagged'
                    ? 'border-[#C4B5FD] bg-[#EDE9FE] text-[#6D28D9] dark:border-[#A78BFA]/55 dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE]'
                    : 'border-[#D5CFC2] bg-[#EAE6DD] text-[#18181B] dark:border-[#262925] dark:bg-[#161816] dark:text-[#F5F5F4]'
              }`}
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>
                {filter === 'wrong'
                  ? `Sai (${filterCounts.wrong})`
                  : filter === 'flagged'
                    ? `Phân vân (${filterCounts.flagged})`
                    : 'Lọc'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-75" />
            </button>
          </div>

          {/* Desktop Quick Filter Pills (>= 1024px) */}
          <div className="mb-6 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-5 py-3.5 dark:border-[#262925] dark:bg-[#161816] lg:flex">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#656058] dark:text-[#9CA39B]">
                <Filter className="h-3.5 w-3.5 text-[#284E3B] dark:text-[#6EE7B7]" />
                Lọc nhanh:
              </span>

              <button
                type="button"
                data-native-enter="true"
                onClick={() => handleApplyFilter('all')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === 'all'
                    ? 'border-[#284E3B] bg-[#284E3B] text-white hover:bg-[#1F3F2F] dark:border-[#52B788]/50 dark:bg-[#2D5A43] dark:hover:bg-[#234735]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#284E3B] hover:bg-[#E8F0EC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#10B981] dark:hover:bg-[#242925]'
                }`}
              >
                <span>Tất cả câu</span>
                <span
                  className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                    filter === 'all'
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
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === 'wrong'
                    ? 'border-[#E11D48] bg-[#E11D48] text-white'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#FDA4AF] hover:bg-[#FFE4E6] hover:text-[#BE123C] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#FB7185]/55 dark:hover:bg-[#E11D48]/20 dark:hover:text-[#FDA4AF]'
                }`}
              >
                <span>Câu làm sai</span>
                <span
                  className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                    filter === 'wrong'
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
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === 'flagged'
                    ? 'border-[#6D28D9] bg-[#6D28D9] text-white'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#C4B5FD] hover:bg-[#EDE9FE] hover:text-[#6D28D9] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#A78BFA]/55 dark:hover:bg-[#8B5CF6]/20 dark:hover:text-[#DDD6FE]'
                }`}
              >
                <span>Câu phân vân</span>
                <span
                  className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                    filter === 'flagged'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EDE9FE] text-[#6D28D9] dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE]'
                  }`}
                >
                  {filterCounts.flagged}
                </span>
              </button>
            </div>
          </div>

          {/* Empty Filtered State vs Question Card */}
          {!currentQuestion ? (
            <div className="rounded-3xl border-2 border-[#284E3B] bg-white px-5 py-10 text-center shadow-[0_6px_0_0_#284E3B,0_20px_40px_-12px_rgba(28,25,23,0.16)] dark:border-2 dark:border-[#10B981]/80 dark:bg-[#1E221F] dark:shadow-[0_6px_0_0_#065F46,0_22px_44px_-12px_rgba(0,0,0,0.8)] sm:px-6 sm:py-12">
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
                  className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#284E3B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1F3F2F] dark:border dark:border-[#52B788]/50 dark:bg-[#2D5A43] dark:hover:bg-[#234735]"
                >
                  <span>Xem tất cả câu</span>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-[#284E3B] bg-white p-4 shadow-[0_6px_0_0_#284E3B,0_20px_40px_-12px_rgba(28,25,23,0.16)] dark:border-2 dark:border-[#10B981]/80 dark:bg-[#1E221F] dark:shadow-[0_6px_0_0_#065F46,0_22px_44px_-12px_rgba(0,0,0,0.8)] sm:p-6 md:p-8">
              {/* Top Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] px-3.5 py-2.5 dark:border-[#2C322D] dark:bg-[#141714]">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="tabular-nums rounded-lg bg-[#284E3B] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-white dark:border dark:border-[#52B788]/40 dark:bg-[#2D5A43] dark:text-[#ECFDF5] sm:px-3 sm:py-1">
                    Câu {safeIndex + 1}/{filteredQuestions.length}
                  </span>

                  <span className="hidden rounded-full border border-[#C6BEB0] bg-[#E8F0EC] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#284E3B] dark:border-[#52B788]/40 dark:bg-[#2D5A43]/25 dark:text-[#6EE7B7] sm:inline-flex">
                    Chương {currentQuestion.chapter}
                  </span>

                  {currentQuestion.isMultiSelect && (
                    <span className="rounded-full border border-[#C6BEB0] bg-[#E8F0EC] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#284E3B] dark:border-[#52B788]/40 dark:bg-[#2D5A43]/25 dark:text-[#6EE7B7] sm:py-1">
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
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#C4B5FD] bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#6D28D9] dark:border-[#A78BFA]/55 dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE] md:hidden">
                      <Flag className="h-3 w-3 fill-current" />
                      Phân vân
                    </span>
                  )}
                </div>

                {/* Desktop Flag Toggle */}
                <button
                  type="button"
                  data-native-enter="true"
                  onClick={() => onToggleFlag(currentQuestion.id)}
                  className={`hidden cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors md:inline-flex ${
                    isFlagged
                      ? 'border-[#C4B5FD] bg-[#EDE9FE] text-[#6D28D9] dark:border-[#A78BFA]/55 dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE]'
                      : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] hover:border-[#C4B5FD] hover:bg-[#EDE9FE] hover:text-[#6D28D9] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#A78BFA]/55 dark:hover:bg-[#8B5CF6]/20 dark:hover:text-[#DDD6FE]'
                  }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      isFlagged
                        ? 'fill-[#6D28D9] text-[#6D28D9] dark:fill-[#DDD6FE] dark:text-[#DDD6FE]'
                        : 'text-[#656058] dark:text-[#9CA39B]'
                    }`}
                  />
                  <span>Phân vân</span>
                  <kbd className="hidden rounded border border-current/25 px-1 py-0.5 font-mono text-[10px] opacity-80 md:inline-block">
                    F
                  </kbd>
                </button>
              </div>

              {/* Question Text */}
              <div className="mt-3.5 rounded-2xl border border-[#E2DDD2] border-l-4 border-l-[#284E3B] bg-[#FAF8F3] p-4 dark:border-[#2C322D] dark:border-l-4 dark:border-l-[#10B981] dark:bg-[#161917] sm:mt-5 sm:p-5">
                <h2 className="max-w-[78ch] text-[17px] font-semibold leading-[1.6] text-[#18181B] dark:text-[#F5F5F4] sm:text-[19px] sm:leading-[1.65] md:text-[20px]">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Options */}
              <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3.5">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentAttempt.selectedKeys.includes(opt.key);
                  const isCorrectOption = currentQuestion.correctAnswers.includes(opt.key);
                  const isGraded = currentAttempt.graded;

                  let containerClasses =
                    'border border-[#D5CFC2] bg-[#F8F6F0] text-[#292524] hover:border-[#284E3B] hover:bg-[#EBF3EE] md:hover:translate-x-1 dark:border-[#353B36] dark:bg-[#252A26] dark:text-[#E7E5E4] dark:hover:border-[#10B981] dark:hover:bg-[#2B332E]';
                  let keyBadgeClasses =
                    'border-[#C6BEB0] bg-white text-[#284E3B] group-hover:border-[#284E3B] group-hover:bg-[#284E3B] group-hover:text-white dark:border-[#353B36] dark:bg-[#161816] dark:text-[#6EE7B7] dark:group-hover:border-[#10B981] dark:group-hover:bg-[#10B981] dark:group-hover:text-[#052E16]';

                  if (!isGraded) {
                    if (isSelected) {
                      containerClasses =
                        'border border-[#284E3B] bg-[#E8F0EC] text-[#18181B] ring-1 ring-[#284E3B] dark:border-[#34D399] dark:bg-[#1E352B] dark:text-[#F5F5F4] dark:ring-[#34D399]';
                      keyBadgeClasses =
                        'border-[#284E3B] bg-[#284E3B] text-white dark:border-[#34D399] dark:bg-[#10B981] dark:text-[#052E16]';
                    }
                  } else {
                    if (isCorrectOption) {
                      containerClasses =
                        'border-2 border-[#059669] bg-[#D1FAE5] text-[#064E3B] ring-2 ring-[#10B981]/20 dark:border-2 dark:border-[#10B981] dark:bg-[#064E3B]/55 dark:text-[#ECFDF5] dark:ring-2 dark:ring-[#10B981]/25';
                      keyBadgeClasses =
                        'border-[#059669] bg-[#059669] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E16]';
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

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isGraded}
                      onClick={() => handleSelectOption(currentQuestion, opt.key)}
                      className={`group flex w-full items-start gap-3 rounded-xl p-3 px-3.5 text-left transition-all duration-150 sm:gap-3.5 sm:p-4 sm:px-5 ${containerClasses} ${
                        isGraded ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors sm:h-7 sm:w-7 ${keyBadgeClasses}`}
                      >
                        {opt.key}
                      </span>

                      <span className="flex-1 pt-0.5 text-[15px] font-medium leading-relaxed sm:text-[16px]">
                        {opt.text}
                      </span>

                      {isGraded && isCorrectOption && (
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#059669] dark:text-[#10B981] sm:h-5 sm:w-5" />
                      )}
                      {isGraded && isSelected && !isCorrectOption && (
                        <XCircle className="mt-1 h-4 w-4 shrink-0 text-[#E11D48] dark:text-[#FB7185] sm:h-5 sm:w-5" />
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
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#284E3B] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#1F3F2F] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#52B788]/50 dark:bg-[#2D5A43] dark:hover:bg-[#234735]"
                  >
                    <Check className="h-4 w-4" />
                    <span>Kiểm tra đáp án</span>
                  </button>
                </div>
              )}

              {currentAttempt.graded && (
                <div
                  className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 sm:mt-5 sm:px-4 sm:py-3 ${
                    isCurrentCorrect
                      ? 'border-[#10B981]/60 bg-[#ECFDF5] dark:border-[#10B981]/50 dark:bg-[#064E3B]/40'
                      : 'border-[#FDA4AF] bg-[#FFF1F2] dark:border-[#FB7185]/45 dark:bg-[#E11D48]/15'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">
                    {isCurrentCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669] dark:text-[#10B981]" />
                        <span className="text-[#064E3B] dark:text-[#ECFDF5]">Chính xác!</span>
                        {currentDetailedState === 'mastered' && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#10B981] bg-[#D1FAE5] px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                            ✓ Đã thuộc (2/2) ●●
                          </span>
                        )}
                        {currentDetailedState === 'pass1' && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#F59E0B] bg-[#FEF3C7] px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]">
                            ✓ Đúng 1/2 lần ●○
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 shrink-0 text-[#E11D48] dark:text-[#FB7185]" />
                        <span className="text-[#BE123C] dark:text-[#FDA4AF]">
                          Chưa đúng • Đáp án đúng:{' '}
                          <span className="font-bold">
                            {currentQuestion.correctAnswers.join(', ')}
                          </span>
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    data-native-enter="true"
                    onClick={() => handleRetryQuestion(currentQuestion.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D5CFC2] bg-white px-2.5 py-1 text-xs font-semibold text-[#656058] transition-colors hover:border-[#284E3B] hover:text-[#284E3B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#10B981] dark:hover:text-[#34D399] sm:px-3"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Làm lại</span>
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-4 py-2.5 text-sm font-semibold text-[#292524] transition-colors hover:border-[#284E3B] hover:bg-[#E8F0EC] hover:text-[#18181B] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#10B981] dark:hover:bg-[#242925] dark:hover:text-[#F5F5F4]"
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#284E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1F3F2F] disabled:cursor-not-allowed disabled:opacity-40 dark:border dark:border-[#52B788]/50 dark:bg-[#2D5A43] dark:hover:bg-[#234735]"
                >
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
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2.5 text-xs font-semibold text-[#292524] transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Trước</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFlag(currentQuestion.id)}
              aria-pressed={isFlagged}
              className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                isFlagged
                  ? 'border-[#C4B5FD] bg-[#EDE9FE] text-[#6D28D9] dark:border-[#A78BFA]/55 dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE]'
                  : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]'
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
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#284E3B] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1F3F2F] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#52B788]/50 dark:bg-[#2D5A43] dark:hover:bg-[#234735]"
              >
                <Check className="h-4 w-4" />
                <span>Kiểm tra ({currentAttempt.selectedKeys.length})</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={safeIndex >= filteredQuestions.length - 1}
                onClick={goToNext}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#284E3B] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1F3F2F] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#52B788]/50 dark:bg-[#2D5A43] dark:hover:bg-[#234735]"
              >
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
                      className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${
                        filter === 'all'
                          ? 'border-[#284E3B] bg-[#284E3B] text-white dark:border-[#52B788]/50 dark:bg-[#2D5A43]'
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
                      className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${
                        filter === 'wrong'
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
                      className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition ${
                        filter === 'flagged'
                          ? 'border-[#6D28D9] bg-[#6D28D9] text-white'
                          : 'border-[#C4B5FD] bg-[#EDE9FE] text-[#6D28D9] dark:border-[#A78BFA]/55 dark:bg-[#8B5CF6]/20 dark:text-[#DDD6FE]'
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
                  <div className="space-y-2">
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
                          className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                            active
                              ? 'border-[#284E3B] bg-[#E8F0EC] text-[#18181B] dark:border-[#10B981] dark:bg-[#2D5A43]/25 dark:text-[#F5F5F4]'
                              : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#284E3B] hover:bg-[#E8F0EC] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#10B981] dark:hover:bg-[#242925]'
                          }`}
                        >
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
                        <span className="normal-case text-[#284E3B] dark:text-[#6EE7B7]">
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
                            className={`tabular-nums relative flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition ${cellStyle} ${
                              isActive
                                ? 'ring-2 ring-[#284E3B] ring-offset-1 ring-offset-[#EAE6DD] dark:ring-[#10B981] dark:ring-offset-[#161816]'
                                : ''
                            }`}
                          >
                            {idx + 1}
                            {flagged && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6D28D9] dark:bg-[#A78BFA]" />
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
