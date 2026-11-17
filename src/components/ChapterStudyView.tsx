import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Flag,
  Grid3X3,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import {
  getChaptersBySubject,
  getQuestionsBySubject,
  isAnswerCorrect,
  SUBJECTS,
} from '../data';
import { QuestionItem, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered } from '../utils/storage';
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
  const [isGridOpen, setIsGridOpen] = useState<boolean>(true);

  // Reset state cleanly when switching subject
  useEffect(() => {
    const firstChapter = chapters[0]?.chapter ?? 1;
    setSelectedChapter(firstChapter);
    setFilter('all');
    setLockedFilterIds(null);
    setCurrentIndex(0);
    setSessionAttempts({});
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
  const isCurrentMastered = isMastered(currentProgress);

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
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[310px_1fr]">
      {/* Mobile Chapter Selector: compact horizontal scrollable pills */}
      <div className="lg:hidden">
        <div className="rounded-2xl border border-[#D5E3EC] bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#0284C7] dark:text-[#38BDF8]">
              <BookOpen className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
              <span>{subjectMeta.code} • Chọn chương</span>
            </div>
            <span className="tabular-nums rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-0.5 text-xs font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
              {subjectMasteredCount}/{allSubjectQuestions.length} đã thuộc
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1.5">
            {chapters.map((ch) => {
              const stat = chapterStats.get(ch.chapter);
              const active = ch.chapter === selectedChapter;
              return (
                <button
                  key={ch.chapter}
                  type="button"
                  data-native-enter="true"
                  onClick={() => handleSelectChapter(ch.chapter)}
                  className={`shrink-0 cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#F8FAFC]'
                      : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE]/50 dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/15'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Chương {ch.chapter}</span>
                    <span className="tabular-nums rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-1.5 py-0.5 text-[11px] font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                      {stat?.pct ?? 0}%
                    </span>
                  </div>
                  <div className="mt-0.5 max-w-[160px] truncate text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    {ch.title}
                  </div>
                </button>
              );
            })}
          </div>

          {activeChapterMeta && (
            <div className="mt-2.5 border-t border-[#D5E3EC] pt-2.5 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
              <span className="font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                Chương {activeChapterMeta.chapter}:
              </span>{' '}
              {activeChapterMeta.title}{' '}
              <span className="tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                ({activeChapterMeta.count} câu)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Chapter Sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-28 rounded-2xl border border-[#D5E3EC] bg-white p-5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-center justify-between border-b border-[#D5E3EC] pb-3.5 dark:border-[#1E293B]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Danh sách chương
                </h2>
                <p className="tabular-nums text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
                  {subjectMasteredCount}/{allSubjectQuestions.length} câu đã thuộc
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-220px)] space-y-3.5 overflow-y-auto pr-1">
            {chapters.map((ch) => {
              const stat = chapterStats.get(ch.chapter) ?? { mastered: 0, total: ch.count, pct: 0 };
              const active = ch.chapter === selectedChapter;

              return (
                <button
                  key={ch.chapter}
                  type="button"
                  data-native-enter="true"
                  onClick={() => handleSelectChapter(ch.chapter)}
                  className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-[#0284C7] bg-[#E0F2FE]/70 shadow-xs dark:border-[#38BDF8] dark:bg-[#0284C7]/20'
                      : 'border-[#D5E3EC] bg-white hover:border-[#0284C7] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#1E293B]/45 dark:hover:border-[#38BDF8] dark:hover:bg-[#1E293B]/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${
                        active
                          ? 'text-[#0284C7] dark:text-[#38BDF8]'
                          : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      Chương {ch.chapter}
                    </span>
                    <span className="tabular-nums rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2 py-0.5 text-[11px] font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                      {stat.pct}% Đã thuộc
                    </span>
                  </div>

                  <p
                    className={`mt-1.5 line-clamp-2 text-sm font-semibold leading-snug ${
                      active
                        ? 'text-[#0284C7] dark:text-[#F8FAFC]'
                        : 'text-[#0F172A] dark:text-[#E2E8F0]'
                    }`}
                  >
                    {ch.title}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    <span className="tabular-nums">{ch.count} câu</span>
                    <span className="tabular-nums font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                      {stat.mastered}/{stat.total}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#0B1120]">
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

      {/* Main Content Area */}
      <div className="min-w-0">
        {/* Quick Filter Pills */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D5E3EC] bg-white px-5 py-3.5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mr-1 hidden items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] sm:inline-flex">
              <Filter className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
              Lọc nhanh:
            </span>

            <button
              type="button"
              data-native-enter="true"
              onClick={() => handleApplyFilter('all')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === 'all'
                  ? 'border-[#0284C7] bg-[#0284C7] text-white hover:bg-[#0369A1] dark:border-[#38BDF8]/60'
                  : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20'
              }`}
            >
              <span>Tất cả câu</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                  filter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F1F6F9] text-[#64748B] dark:bg-[#0B1120] dark:text-[#94A3B8]'
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
                  : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#FECDD3] hover:bg-[#FFF1F2] hover:text-[#E11D48] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#FB7185]/50 dark:hover:bg-[#4C0519]/50 dark:hover:text-[#FB7185]'
              }`}
            >
              <span>Câu làm sai</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                  filter === 'wrong'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FFF1F2] text-[#E11D48] dark:bg-[#4C0519]/60 dark:text-[#FB7185]'
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
                  ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                  : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#1E1B4B]/60 dark:hover:text-[#818CF8]'
              }`}
            >
              <span>Câu phân vân</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] ${
                  filter === 'flagged'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#1E1B4B]/70 dark:text-[#818CF8]'
                }`}
              >
                {filterCounts.flagged}
              </span>
            </button>
          </div>

          {filteredQuestions.length > 0 && (
            <button
              type="button"
              data-native-enter="true"
              onClick={() => setIsGridOpen((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] px-3 py-1.5 text-xs font-semibold text-[#0284C7] transition-colors hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#334155] dark:bg-[#1E293B]/70 dark:text-[#38BDF8] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20"
            >
              <Grid3X3 className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
              <span>Bảng câu hỏi</span>
              {isGridOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Empty Filtered State vs Question Card */}
        {!currentQuestion ? (
          <div className="rounded-2xl border border-[#D5E3EC] bg-white px-6 py-12 text-center shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {filter === 'wrong'
                ? 'Không có câu làm sai nào trong chương này'
                : filter === 'flagged'
                  ? 'Chưa có câu phân vân nào trong chương này'
                  : 'Không có câu hỏi nào trong chương này'}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B] dark:text-[#94A3B8]">
              {filter === 'wrong'
                ? 'Bạn đã xử lý hết các câu sai hoặc chưa làm sai câu nào ở chương hiện tại.'
                : filter === 'flagged'
                  ? 'Nhấn nút "Phân vân" hoặc phím F ở bất kỳ câu hỏi nào để đánh dấu xem lại sau.'
                  : 'Hãy chọn một chương khác ở danh sách bên cạnh.'}
            </p>
            {filter !== 'all' && (
              <button
                type="button"
                data-native-enter="true"
                onClick={() => handleApplyFilter('all')}
                className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50"
              >
                <span>Xem tất cả câu</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Question Card */}
            <div className="rounded-2xl border border-[#D5E3EC] bg-white p-7 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)] sm:p-9">
              {/* Top Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#D5E3EC] pb-4 dark:border-[#1E293B]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums rounded-full border border-[#D5E3EC] bg-[#F1F6F9] px-3 py-1 text-xs font-bold text-[#0F172A] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]">
                    Câu {safeIndex + 1} / {filteredQuestions.length}
                  </span>

                  <span className="rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                    Chương {currentQuestion.chapter}
                  </span>

                  {currentQuestion.isMultiSelect && (
                    <span className="rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                      Chọn nhiều đáp án
                    </span>
                  )}

                  {isCurrentMastered ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-2.5 py-1 text-xs font-semibold text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]">
                      <Check className="h-3 w-3" />
                      Đã thuộc
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#D5E3EC] bg-[#F1F6F9] px-2.5 py-1 text-xs font-semibold text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]">
                      Chưa thuộc
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  data-native-enter="true"
                  onClick={() => onToggleFlag(currentQuestion.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isFlagged
                      ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]'
                      : 'border-[#D5E3EC] bg-white text-[#64748B] hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#94A3B8] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#1E1B4B]/60 dark:hover:text-[#818CF8]'
                  }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      isFlagged
                        ? 'fill-[#4F46E5] text-[#4F46E5] dark:fill-[#818CF8] dark:text-[#818CF8]'
                        : 'text-[#64748B] dark:text-[#94A3B8]'
                    }`}
                  />
                  <span>Phân vân</span>
                  <kbd className="hidden rounded border border-current/25 px-1 py-0.5 font-mono text-[10px] opacity-80 sm:inline-block">
                    F
                  </kbd>
                </button>
              </div>

              {/* Question Text */}
              <h2 className="mt-5 text-[19px] font-semibold leading-[1.65] text-[#0F172A] dark:text-[#F8FAFC] sm:text-[20px]">
                {currentQuestion.question}
              </h2>

              {/* Options */}
              <div className="mt-6 space-y-3.5">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentAttempt.selectedKeys.includes(opt.key);
                  const isCorrectOption = currentQuestion.correctAnswers.includes(opt.key);
                  const isGraded = currentAttempt.graded;

                  let containerClasses =
                    'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:translate-x-1 dark:border-[#334155] dark:bg-[#1E293B]/50 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20';
                  let keyBadgeClasses =
                    'border-[#D5E3EC] bg-[#F1F6F9] text-[#1E293B] dark:border-[#475569] dark:bg-[#0B1120] dark:text-[#E2E8F0]';

                  if (!isGraded) {
                    if (isSelected) {
                      containerClasses =
                        'border-[#0284C7] bg-[#E0F2FE] text-[#0F172A] ring-1 ring-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/25 dark:text-[#F8FAFC] dark:ring-[#38BDF8]';
                      keyBadgeClasses =
                        'border-[#0284C7] bg-[#0284C7] text-white dark:border-[#38BDF8]';
                    }
                  } else {
                    if (isCorrectOption) {
                      containerClasses =
                        'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#CCFBF1]';
                      keyBadgeClasses =
                        'border-[#0D9488] bg-[#0D9488] text-white dark:border-[#14B8A6] dark:bg-[#14B8A6] dark:text-[#0B1120]';
                    } else if (isSelected && !isCorrectOption) {
                      containerClasses =
                        'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/60 dark:bg-[#4C0519]/50 dark:text-[#FB7185]';
                      keyBadgeClasses =
                        'border-[#E11D48] bg-[#E11D48] text-white dark:border-[#FB7185] dark:bg-[#FB7185] dark:text-[#0B1120]';
                    } else {
                      containerClasses =
                        'border-[#D5E3EC] bg-[#F8FAFC] text-[#64748B] dark:border-[#1E293B] dark:bg-[#0B1120]/50 dark:text-[#94A3B8]';
                      keyBadgeClasses =
                        'border-[#D5E3EC] bg-[#F1F6F9] text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]';
                    }
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isGraded}
                      onClick={() => handleSelectOption(currentQuestion, opt.key)}
                      className={`group flex w-full items-start gap-3.5 rounded-xl border p-4 px-5 text-left transition-all duration-150 ${containerClasses} ${
                        isGraded ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${keyBadgeClasses}`}
                      >
                        {opt.key}
                      </span>

                      <span className="flex-1 pt-0.5 text-[16px] font-medium leading-relaxed">
                        {opt.text}
                      </span>

                      {isGraded && isCorrectOption && (
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
                      )}
                      {isGraded && isSelected && !isCorrectOption && (
                        <XCircle className="mt-1 h-5 w-5 shrink-0 text-[#E11D48] dark:text-[#FB7185]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Multi-select submit OR graded action bar */}
              {currentQuestion.isMultiSelect && !currentAttempt.graded && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="tabular-nums text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Đã chọn {currentAttempt.selectedKeys.length} đáp án
                  </span>
                  <button
                    type="button"
                    disabled={currentAttempt.selectedKeys.length === 0}
                    onClick={() => handleGradeMultiSelect(currentQuestion)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0369A1] disabled:cursor-not-allowed disabled:opacity-45 dark:border dark:border-[#38BDF8]/50"
                  >
                    <Check className="h-4 w-4" />
                    <span>Kiểm tra đáp án</span>
                  </button>
                </div>
              )}

              {currentAttempt.graded && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D5E3EC] bg-[#F8FAFC] px-4 py-3 dark:border-[#334155] dark:bg-[#0B1120]/70">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {isCurrentCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                        <span className="text-[#115E59] dark:text-[#2DD4BF]">Chính xác!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-[#E11D48] dark:text-[#FB7185]" />
                        <span className="text-[#E11D48] dark:text-[#FB7185]">
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
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D5E3EC] bg-white px-3 py-1 text-xs font-semibold text-[#64748B] transition-colors hover:border-[#0284C7] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:text-[#38BDF8]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Làm lại câu này</span>
                  </button>
                </div>
              )}

              {/* Smooth Rich Explanation */}
              <AnimatePresence mode="wait">
                {currentAttempt.graded && (
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <RichExplanation question={currentQuestion} className="mt-5" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Footer */}
              <div className="mt-7 flex items-center justify-between gap-3 border-t border-[#D5E3EC] pt-5 dark:border-[#1E293B]">
                <button
                  type="button"
                  data-native-enter="true"
                  disabled={safeIndex === 0}
                  onClick={goToPrev}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D5E3EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] transition-colors hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0284C7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Câu trước</span>
                </button>

                <div className="hidden items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] md:flex">
                  <span>
                    <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0]">
                      1-5
                    </kbd>{' '}
                    /{' '}
                    <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0]">
                      A-E
                    </kbd>{' '}
                    Chọn
                  </span>
                  <span>
                    <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0]">
                      Enter
                    </kbd>{' '}
                    /{' '}
                    <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0]">
                      Space
                    </kbd>{' '}
                    {currentQuestion.isMultiSelect && !currentAttempt.graded
                      ? 'Kiểm tra'
                      : 'Câu tiếp'}
                  </span>
                  <span>
                    <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[#1E293B] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#E2E8F0]">
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0284C7] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1] disabled:cursor-not-allowed disabled:opacity-40 dark:border dark:border-[#38BDF8]/50"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Collapsible Question Index Grid */}
            <AnimatePresence initial={false}>
              {isGridOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="mt-8 overflow-hidden"
                >
                  <div className="rounded-2xl border border-[#D5E3EC] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="tabular-nums text-xs font-bold uppercase tracking-wide text-[#0F172A] dark:text-[#F8FAFC]">
                        Mục lục câu hỏi ({filteredQuestions.length})
                      </span>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
                          Đã thuộc
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] dark:bg-[#38BDF8]" />
                          Làm đúng
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#E11D48] dark:bg-[#FB7185]" />
                          Làm sai
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
                          Phân vân
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-10 md:grid-cols-12">
                      {filteredQuestions.map((q, idx) => {
                        const qp = progress.questions[q.id];
                        const isActive = idx === safeIndex;
                        const mastered = isMastered(qp);
                        const flagged = Boolean(qp?.flagged);
                        const lastWrong = qp?.lastResult === 'wrong';
                        const lastCorrect = qp?.lastResult === 'correct';

                        let cellStyle =
                          'border-[#D5E3EC] bg-[#F8FAFC] text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] dark:border-[#334155] dark:bg-[#1E293B]/60 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20';

                        if (flagged) {
                          cellStyle =
                            'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] dark:border-[#818CF8]/50 dark:bg-[#1E1B4B]/60 dark:text-[#818CF8]';
                        } else if (mastered) {
                          cellStyle =
                            'border-[#5EEAD4] bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF]';
                        } else if (lastWrong) {
                          cellStyle =
                            'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] dark:border-[#FB7185]/50 dark:bg-[#4C0519]/50 dark:text-[#FB7185]';
                        } else if (lastCorrect) {
                          cellStyle =
                            'border-[#BAE6FD] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/20 dark:text-[#38BDF8]';
                        }

                        return (
                          <button
                            key={q.id}
                            type="button"
                            data-native-enter="true"
                            onClick={() => setCurrentIndex(idx)}
                            className={`tabular-nums relative flex h-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-all ${cellStyle} ${
                              isActive
                                ? 'ring-2 ring-[#0284C7] ring-offset-1 dark:ring-[#38BDF8] dark:ring-offset-[#111827]'
                                : ''
                            }`}
                          >
                            {idx + 1}
                            {flagged && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
};
