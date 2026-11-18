import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  CreditCard,
  GraduationCap,
  Info,
  Keyboard,
  Layers,
  Moon,
  Sun,
} from 'lucide-react';
import { SUBJECTS, getQuestionsBySubject } from '../data/index';
import { StudyMode, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered, ThemeMode } from '../utils/storage';

export interface HeaderProps {
  subject: SubjectId;
  mode: StudyMode;
  theme: ThemeMode;
  progress: UserProgressStore;
  onSelectSubject: (subject: SubjectId) => void;
  onSelectMode: (mode: StudyMode) => void;
  onToggleTheme: () => void;
  onOpenSyncModal: () => void;
}

const MODE_TABS: {
  id: StudyMode;
  label: string;
  mobileLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'chapter', label: 'Học theo chương', mobileLabel: 'Theo chương', Icon: BookOpen },
  { id: 'rolling', label: 'Học cuốn chiếu', mobileLabel: 'Cuốn chiếu', Icon: Layers },
  { id: 'flashcard', label: 'Flashcard', mobileLabel: 'Flashcard', Icon: CreditCard },
  { id: 'exam', label: 'Thi thử trộn đề', mobileLabel: 'Thi thử', Icon: ClipboardCheck },
];

const SUBJECT_ORDER: SubjectId[] = ['mln131', 'vnr202'];

export const Header: React.FC<HeaderProps> = ({
  subject,
  mode,
  theme,
  progress,
  onSelectSubject,
  onSelectMode,
  onToggleTheme,
  onOpenSyncModal,
}) => {
  const [isShortcutOpen, setIsShortcutOpen] = useState(false);
  const [isRuleInfoOpen, setIsRuleInfoOpen] = useState(false);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);
  const ruleInfoContainerRef = useRef<HTMLDivElement>(null);

  const activeQuestions = useMemo(() => getQuestionsBySubject(subject), [subject]);

  const masteredCount = useMemo(() => {
    let count = 0;
    for (const q of activeQuestions) {
      if (isMastered(progress.questions[q.id])) {
        count += 1;
      }
    }
    return count;
  }, [activeQuestions, progress.questions]);

  useEffect(() => {
    if (!isShortcutOpen && !isRuleInfoOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        shortcutContainerRef.current &&
        !shortcutContainerRef.current.contains(event.target as Node)
      ) {
        setIsShortcutOpen(false);
      }
      if (
        ruleInfoContainerRef.current &&
        !ruleInfoContainerRef.current.contains(event.target as Node)
      ) {
        setIsRuleInfoOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsShortcutOpen(false);
        setIsRuleInfoOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShortcutOpen, isRuleInfoOpen]);

  return (
    <header className="z-40 mb-3.5 border-b border-[#D4E1EE] bg-[#F8FAFC] shadow-[0_6px_20px_-4px_rgba(11,19,36,0.06)] dark:border-[#18243C] dark:bg-[#0C1322] dark:shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55)] md:sticky md:top-0 md:mb-8">
      <div className="mx-auto max-w-[1380px] px-3.5 sm:px-6 lg:px-10">
        {/* Top Row: Compact Brand, Subject Switcher & Utility Actions */}
        <div className="flex items-center justify-between gap-2 py-2.5 md:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
            {/* Brand Title */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0369A1] text-white shadow-sm dark:border dark:border-[#38BDF8]/50 dark:bg-[#0284C7] sm:h-9 sm:w-9">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="hidden leading-tight sm:block">
                <span className="block text-sm font-bold tracking-tight text-[#0B1324] dark:text-[#F8FAFC] sm:text-base">
                  Ôn thi Trắc nghiệm
                </span>
                <span className="hidden text-[11px] text-[#5B6E88] dark:text-[#7E91B0] sm:block">
                  MLN131 &amp; VNR202 •{' '}
                  <span className="font-medium text-[#0369A1] dark:text-[#38BDF8]">from Namblee</span>
                </span>
              </div>
            </div>

            {/* Subject Switcher Pills */}
            <div
              role="group"
              aria-label="Chọn môn học"
              className="inline-flex items-center gap-0.5 rounded-xl border border-[#D4E1EE] bg-[#EAF1F8] p-0.5 dark:border-[#18243C] dark:bg-[#070B14] sm:gap-1 sm:p-1"
            >
              {SUBJECT_ORDER.map((subjId) => {
                const meta = SUBJECTS[subjId];
                const isActive = subject === subjId;
                return (
                  <button
                    key={subjId}
                    type="button"
                    onClick={() => onSelectSubject(subjId)}
                    aria-pressed={isActive}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition sm:gap-1.5 sm:px-3 sm:py-1.5 ${
                      isActive
                        ? 'border-transparent bg-[#0369A1] text-white shadow-sm hover:bg-[#0284C7] dark:border-[#38BDF8]/60 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]'
                        : 'border-transparent text-[#1E293B] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:text-[#E2E8F0] dark:hover:bg-[#0284C7]/15 dark:hover:text-[#38BDF8]'
                    }`}
                  >
                    <span>{meta.code}</span>
                    <span
                      className={`hidden tabular-nums text-[11px] font-medium sm:inline ${
                        isActive ? 'text-[#E0F2FE]' : 'text-[#5B6E88] dark:text-[#7E91B0]'
                      }`}
                    >
                      ({meta.totalQuestions} câu)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Cluster: Mastery Badge + Rule Info, Shortcuts Popover (Desktop only), Sync Modal Button, Theme Toggle */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Overall Mastery Badge + Info Popover */}
            <div ref={ruleInfoContainerRef} className="relative flex items-center gap-1">
              <div
                className="inline-flex items-center gap-1 rounded-full border border-[#5EEAD4] bg-[#E6F7F5] px-2.5 py-1 text-[11px] font-semibold text-[#0F766E] tabular-nums dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF] sm:gap-1.5 sm:px-3 sm:text-xs"
                title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${SUBJECTS[subject].code}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0D9488] dark:text-[#2DD4BF]" />
                <span>
                  {masteredCount}/{activeQuestions.length}
                  <span className="hidden sm:inline"> Đã thuộc</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsRuleInfoOpen((prev) => !prev)}
                aria-expanded={isRuleInfoOpen}
                aria-haspopup="true"
                aria-label="Quy tắc tính tiến độ Đã thuộc"
                title="Xem quy tắc đạt Đã thuộc"
                className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border text-xs transition sm:h-7 sm:w-7 ${
                  isRuleInfoOpen
                    ? 'border-[#0369A1] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                    : 'border-[#D4E1EE] bg-white text-[#5B6E88] hover:border-[#7DD3FC] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:border-[#253759] dark:bg-[#111B2E] dark:text-[#7E91B0] dark:hover:border-[#38BDF8]/50 dark:hover:bg-[#0284C7]/15 dark:hover:text-[#38BDF8]'
                }`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>

              {isRuleInfoOpen && (
                <div
                  role="dialog"
                  aria-label="Quy tắc tính tiến độ"
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#BBD0E6] bg-white p-4 shadow-[0_14px_34px_-6px_rgba(11,19,36,0.16)] dark:border-[#253759] dark:bg-[#111B2E] dark:shadow-[0_18px_42px_-6px_rgba(0,0,0,0.75)] sm:w-80"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D4E1EE] pb-2 dark:border-[#18243C]">
                    <span className="text-xs font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                      Quy tắc tính tiến độ học tập
                    </span>
                    <span className="rounded-md border border-[#7DD3FC] bg-[#E0F2FE] px-1.5 py-0.5 text-[10px] font-semibold text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]">
                      Đồng bộ 2 chiều
                    </span>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed text-[#1E293B] dark:text-[#E2E8F0]">
                    <div className="rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] p-2.5 dark:border-[#18243C] dark:bg-[#0C1322]">
                      <div className="mb-1 font-bold text-[#0369A1] dark:text-[#38BDF8]">
                        1. Học theo chương &amp; Học cuốn chiếu
                      </div>
                      <ul className="space-y-1 text-[11px]">
                        <li>
                          • Trả lời đúng lần 1 →{' '}
                          <span className="font-semibold text-[#0369A1] dark:text-[#38BDF8]">
                            ✓ Đúng 1/2 lần (● ○)
                          </span>
                        </li>
                        <li>
                          • Trả lời đúng <strong>2 lần liên tiếp</strong> (không bấm phân vân) →{' '}
                          <span className="font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                            ✓ Đã thuộc (● ●)
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] p-2.5 dark:border-[#18243C] dark:bg-[#0C1322]">
                      <div className="mb-1 font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                        2. Flashcard (Lật thẻ nhanh)
                      </div>
                      <ul className="space-y-1 text-[11px]">
                        <li>
                          • Lật xem đáp án mặt sau →{' '}
                          <span className="font-semibold text-[#0369A1] dark:text-[#38BDF8]">
                            Đã học
                          </span>
                        </li>
                        <li>
                          • Bấm nút <strong>Cờ xanh lá</strong> →{' '}
                          <span className="font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                            ✓ Đã thuộc
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Popover — Desktop Only */}
            <div ref={shortcutContainerRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setIsShortcutOpen((prev) => !prev)}
                aria-expanded={isShortcutOpen}
                aria-haspopup="true"
                title="Phím tắt bàn phím"
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                  isShortcutOpen
                    ? 'border-[#0369A1] bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8]'
                    : 'border-[#D4E1EE] bg-white text-[#1E293B] hover:border-[#7DD3FC] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:border-[#253759] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8]/50 dark:hover:bg-[#0284C7]/15 dark:hover:text-[#38BDF8]'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5 shrink-0" />
                <span>Phím tắt</span>
              </button>

              {isShortcutOpen && (
                <div
                  role="dialog"
                  aria-label="Hướng dẫn phím tắt"
                  className="absolute right-0 top-full z-50 mt-2 w-76 rounded-2xl border border-[#BBD0E6] bg-white p-4 shadow-[0_14px_34px_-6px_rgba(11,19,36,0.16)] dark:border-[#253759] dark:bg-[#111B2E] dark:shadow-[0_18px_42px_-6px_rgba(0,0,0,0.75)]"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D4E1EE] pb-2 dark:border-[#18243C]">
                    <span className="text-xs font-bold text-[#0B1324] dark:text-[#F8FAFC]">
                      Phím tắt trên máy tính
                    </span>
                    <span className="text-[11px] text-[#5B6E88] dark:text-[#7E91B0]">PC</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#1E293B] dark:text-[#E2E8F0]">
                    <li className="flex items-center justify-between gap-2">
                      <span>Chọn đáp án</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                          1–4
                        </kbd>
                        <span className="text-[#5B6E88] dark:text-[#7E91B0]">/</span>
                        <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                          A–D
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Kiểm tra / Lật thẻ / Tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                          Enter
                        </kbd>
                        <span className="text-[#5B6E88] dark:text-[#7E91B0]">/</span>
                        <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                          Space
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Chuyển câu / Thẻ trước-tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                          ←
                        </kbd>
                        <span className="text-[#5B6E88] dark:text-[#7E91B0]">/</span>
                        <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                          →
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Cờ xanh lá Đã thuộc (Flashcard)</span>
                      <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                        G
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Đánh dấu Phân vân</span>
                      <kbd className="rounded border border-[#D4E1EE] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0B1324] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#F8FAFC]">
                        F
                      </kbd>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Progress Sync Button */}
            <button
              type="button"
              onClick={onOpenSyncModal}
              aria-label="Đồng bộ tiến độ"
              title="Đồng bộ tiến độ"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#7DD3FC] bg-[#E0F2FE] p-1.5 text-xs font-semibold text-[#0369A1] transition hover:border-[#0369A1] hover:bg-[#7DD3FC]/35 dark:border-[#38BDF8]/50 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/25 sm:px-3 sm:py-1.5"
            >
              <Cloud className="h-4 w-4 shrink-0 text-[#0369A1] dark:text-[#38BDF8] sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Đồng bộ tiến độ</span>
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#D4E1EE] bg-white p-1.5 text-xs font-medium text-[#1E293B] transition hover:border-[#7DD3FC] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:border-[#253759] dark:bg-[#111B2E] dark:text-[#E2E8F0] dark:hover:border-[#38BDF8]/50 dark:hover:bg-[#0284C7]/15 dark:hover:text-[#38BDF8]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#38BDF8]" />
              ) : (
                <Moon className="h-4 w-4 text-[#0369A1]" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom Row: 4 Study Mode Tabs (grid-cols-4 full width on Mobile, flex tabs on Desktop) */}
        <nav
          aria-label="Chế độ học tập"
          className="grid grid-cols-4 gap-1 border-t border-[#D4E1EE] py-2 dark:border-[#18243C] md:flex md:items-center md:gap-2 md:py-2.5"
        >
          {MODE_TABS.map(({ id, label, mobileLabel, Icon }) => {
            const isActive = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectMode(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap transition md:shrink-0 md:gap-2 md:px-4 md:text-sm ${
                  isActive
                    ? 'border-[#0369A1] bg-[#0369A1] text-white shadow-sm hover:border-[#0284C7] hover:bg-[#0284C7] dark:border-[#38BDF8]/60 dark:bg-[#0284C7] dark:hover:bg-[#0369A1]'
                    : 'border-transparent bg-[#EAF1F8] text-[#5B6E88] hover:border-[#7DD3FC] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:bg-[#162238]/60 dark:text-[#7E91B0] dark:hover:border-[#38BDF8]/50 dark:hover:bg-[#0284C7]/15 dark:hover:text-[#38BDF8] md:bg-transparent dark:md:bg-transparent'
                }`}
              >
                <Icon className="hidden h-4 w-4 shrink-0 md:block" />
                <span className="truncate md:hidden">{mobileLabel}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
