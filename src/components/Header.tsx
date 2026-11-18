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
    <header className="z-40 mb-3.5 border-b border-[#D2DACB] bg-[#E8ECE4] shadow-[0_6px_20px_-4px_rgba(30,58,42,0.06)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55)] md:sticky md:top-0 md:mb-8">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-12">
        {/* Top Row: Compact Brand, Subject Switcher & Utility Actions */}
        <div className="flex w-full items-center justify-between gap-2 py-2.5 md:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
            {/* Brand Title */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2E6F4E] text-white shadow-sm dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] sm:h-9 sm:w-9">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="hidden leading-tight sm:block">
                <span className="block text-sm font-bold tracking-tight text-[#142018] dark:text-[#F3F6F4] sm:text-base">
                  Ôn thi Trắc nghiệm
                </span>
                <span className="hidden text-[11px] text-[#5C6E60] dark:text-[#8B9E91] sm:block">
                  MLN131 &amp; VNR202 •{' '}
                  <span className="font-medium text-[#2E6F4E] dark:text-[#74C69D]">from Namblee</span>
                </span>
              </div>
            </div>

            {/* Subject Switcher Pills */}
            <div
              role="group"
              aria-label="Chọn môn học"
              className="inline-flex items-center gap-0.5 rounded-xl border border-[#D2DACB] bg-[#F2F4EF] p-0.5 dark:border-[#222E27] dark:bg-[#0D120F] sm:gap-1 sm:p-1"
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
                        ? 'border-transparent bg-[#2E6F4E] text-white shadow-sm hover:bg-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]'
                        : 'border-transparent text-[#243329] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:text-[#DDE5DF] dark:hover:bg-[#1E2B24] dark:hover:text-[#74C69D]'
                    }`}
                  >
                    <span>{meta.code}</span>
                    <span
                      className={`hidden tabular-nums text-[11px] font-medium sm:inline ${
                        isActive ? 'text-[#E3EFE8]' : 'text-[#5C6E60] dark:text-[#8B9E91]'
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
                className="inline-flex items-center gap-1 rounded-full border border-[#68B99A] bg-[#E1F3EC] px-2.5 py-1 text-[11px] font-semibold text-[#0F5C41] tabular-nums dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7] sm:gap-1.5 sm:px-3 sm:text-xs"
                title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${SUBJECTS[subject].code}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#1F8A65] dark:text-[#6EE7B7]" />
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
                    ? 'border-[#2E6F4E] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                    : 'border-[#D2DACB] bg-[#F7F8F5] text-[#5C6E60] hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#8B9E91] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24] dark:hover:text-[#74C69D]'
                }`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>

              {isRuleInfoOpen && (
                <div
                  role="dialog"
                  aria-label="Quy tắc tính tiến độ"
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#BCC9B4] bg-[#FFFFFF] p-4 shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] dark:border-[#31453A] dark:bg-[#1B2620] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] sm:w-80"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D2DACB] pb-2 dark:border-[#222E27]">
                    <span className="text-xs font-bold text-[#142018] dark:text-[#F3F6F4]">
                      Quy tắc tính tiến độ học tập
                    </span>
                    <span className="rounded-md border border-[#9BC4AE] bg-[#E3EFE8] px-1.5 py-0.5 text-[10px] font-semibold text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                      Đồng bộ 2 chiều
                    </span>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed text-[#243329] dark:text-[#DDE5DF]">
                    <div className="rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-2.5 dark:border-[#25332B] dark:bg-[#17201B]">
                      <div className="mb-1 font-bold text-[#2E6F4E] dark:text-[#74C69D]">
                        1. Học theo chương &amp; Học cuốn chiếu
                      </div>
                      <ul className="space-y-1 text-[11px]">
                        <li>
                          • Trả lời đúng lần 1 →{' '}
                          <span className="font-semibold text-[#B45309] dark:text-[#FCD34D]">
                            ✓ Đúng 1/2 lần (● ○)
                          </span>
                        </li>
                        <li>
                          • Trả lời đúng <strong>2 lần liên tiếp</strong> (không bấm phân vân) →{' '}
                          <span className="font-semibold text-[#0F5C41] dark:text-[#6EE7B7]">
                            ✓ Đã thuộc (● ●)
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-2.5 dark:border-[#25332B] dark:bg-[#17201B]">
                      <div className="mb-1 font-bold text-[#0F5C41] dark:text-[#6EE7B7]">
                        2. Flashcard (Lật thẻ nhanh)
                      </div>
                      <ul className="space-y-1 text-[11px]">
                        <li>
                          • Lật xem đáp án mặt sau →{' '}
                          <span className="font-semibold text-[#B45309] dark:text-[#FCD34D]">
                            Đã học
                          </span>
                        </li>
                        <li>
                          • Bấm nút <strong>Cờ xanh lá</strong> →{' '}
                          <span className="font-semibold text-[#0F5C41] dark:text-[#6EE7B7]">
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
                    ? 'border-[#2E6F4E] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]'
                    : 'border-[#D2DACB] bg-[#F7F8F5] text-[#243329] hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24] dark:hover:text-[#74C69D]'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5 shrink-0" />
                <span>Phím tắt</span>
              </button>

              {isShortcutOpen && (
                <div
                  role="dialog"
                  aria-label="Hướng dẫn phím tắt"
                  className="absolute right-0 top-full z-50 mt-2 w-76 rounded-2xl border border-[#BCC9B4] bg-[#FFFFFF] p-4 shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] dark:border-[#31453A] dark:bg-[#1B2620] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)]"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D2DACB] pb-2 dark:border-[#222E27]">
                    <span className="text-xs font-bold text-[#142018] dark:text-[#F3F6F4]">
                      Phím tắt trên máy tính
                    </span>
                    <span className="text-[11px] text-[#5C6E60] dark:text-[#8B9E91]">PC</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#243329] dark:text-[#DDE5DF]">
                    <li className="flex items-center justify-between gap-2">
                      <span>Chọn đáp án</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                          1–4
                        </kbd>
                        <span className="text-[#5C6E60] dark:text-[#8B9E91]">/</span>
                        <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                          A–D
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Kiểm tra / Lật thẻ / Tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                          Enter
                        </kbd>
                        <span className="text-[#5C6E60] dark:text-[#8B9E91]">/</span>
                        <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                          Space
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Chuyển câu / Thẻ trước-tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                          ←
                        </kbd>
                        <span className="text-[#5C6E60] dark:text-[#8B9E91]">/</span>
                        <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                          →
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Cờ xanh lá Đã thuộc (Flashcard)</span>
                      <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
                        G
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Đánh dấu Phân vân</span>
                      <kbd className="rounded border border-[#D2DACB] bg-[#F7F8F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#142018] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#F3F6F4]">
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#9BC4AE] bg-[#E3EFE8] p-1.5 text-xs font-semibold text-[#23583D] transition hover:border-[#2E6F4E] hover:bg-[#9BC4AE]/40 dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D] dark:hover:border-[#52B788] dark:hover:bg-[#357A58]/35 sm:px-3 sm:py-1.5"
            >
              <Cloud className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Đồng bộ tiến độ</span>
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#D2DACB] bg-[#F7F8F5] p-1.5 text-xs font-medium text-[#243329] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24] dark:hover:text-[#74C69D]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#FCD34D]" />
              ) : (
                <Moon className="h-4 w-4 text-[#2E6F4E]" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom Row: 4 Study Mode Tabs (grid-cols-4 full width on Mobile, flex tabs + subject summary on Desktop) */}
        <nav
          aria-label="Chế độ học tập"
          className="border-t border-[#D2DACB] py-2 dark:border-[#222E27] md:flex md:w-full md:items-center md:justify-between md:py-2.5"
        >
          <div className="grid grid-cols-4 gap-1 md:flex md:items-center md:gap-2">
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
                      ? 'border-[#2E6F4E] bg-[#2E6F4E] text-white shadow-sm hover:border-[#23583D] hover:bg-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]'
                      : 'border-transparent bg-[#F7F8F5] text-[#5C6E60] hover:border-[#2E6F4E] hover:bg-[#E3EFE8] hover:text-[#23583D] dark:bg-[#17201B] dark:text-[#8B9E91] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24] dark:hover:text-[#74C69D] md:bg-transparent md:hover:bg-[#E3EFE8] dark:md:bg-transparent dark:md:hover:bg-[#1E2B24]'
                  }`}
                >
                  <Icon className="hidden h-4 w-4 shrink-0 md:block" />
                  <span className="truncate md:hidden">{mobileLabel}</span>
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-xs text-[#5C6E60] dark:text-[#8B9E91] md:flex">
            <span className="rounded-md border border-[#D2DACB] bg-[#F7F8F5] px-2 py-0.5 font-semibold text-[#243329] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF]">
              {SUBJECTS[subject].code}
            </span>
            <span className="lg:hidden">{SUBJECTS[subject].chapters.length} chương</span>
            <span className="hidden lg:inline 2xl:hidden">
              {SUBJECTS[subject].shortName} • {SUBJECTS[subject].chapters.length} chương
            </span>
            <span className="hidden 2xl:inline">
              {SUBJECTS[subject].name} • {SUBJECTS[subject].chapters.length} chương
            </span>
            <span className="hidden xl:inline text-[#BCC9B4] dark:text-[#31453A]">•</span>
            <span className="hidden xl:inline">
              Đúng 2 lần liên tiếp →{' '}
              <span className="font-semibold text-[#0F5C41] dark:text-[#6EE7B7]">Đã thuộc</span>
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
};
