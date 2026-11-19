import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
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
import { StudyMode, StudyTier, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered, ThemeMode } from '../utils/storage';
import { SakugaTierPicker } from './SakugaVfx';

export interface HeaderProps {
  subject: SubjectId;
  mode: StudyMode;
  tier: StudyTier;
  theme: ThemeMode;
  progress: UserProgressStore;
  onSelectSubject: (subject: SubjectId) => void;
  onSelectMode: (mode: StudyMode) => void;
  onSelectTier: (tier: StudyTier) => void;
  onToggleTheme: () => void;
  onOpenSyncModal: () => void;
}

const MODE_TABS: {
  id: StudyMode;
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'chapter', label: 'Học theo chương', shortLabel: 'Theo chương', Icon: BookOpen },
  { id: 'rolling', label: 'Học cuốn chiếu', shortLabel: 'Cuốn chiếu', Icon: Layers },
  { id: 'flashcard', label: 'Flashcard', shortLabel: 'Flashcard', Icon: CreditCard },
  { id: 'exam', label: 'Thi thử trộn đề', shortLabel: 'Thi thử', Icon: ClipboardCheck },
];

const SUBJECT_ORDER: SubjectId[] = ['vnr202', 'mln131'];

export const Header: React.FC<HeaderProps> = ({
  subject,
  mode,
  tier,
  theme,
  progress,
  onSelectSubject,
  onSelectMode,
  onSelectTier,
  onToggleTheme,
  onOpenSyncModal,
}) => {
  const [isShortcutOpen, setIsShortcutOpen] = useState(false);
  const [isRuleInfoOpen, setIsRuleInfoOpen] = useState(false);
  const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);
  const ruleInfoContainerRef = useRef<HTMLDivElement>(null);
  const subjectContainerRef = useRef<HTMLDivElement>(null);

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
    if (!isShortcutOpen && !isRuleInfoOpen && !isSubjectMenuOpen) return;

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
      if (
        subjectContainerRef.current &&
        !subjectContainerRef.current.contains(event.target as Node)
      ) {
        setIsSubjectMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsShortcutOpen(false);
        setIsRuleInfoOpen(false);
        setIsSubjectMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShortcutOpen, isRuleInfoOpen, isSubjectMenuOpen]);

  const activeSubjectMeta = SUBJECTS[subject];

  return (
    <header className="z-40 mb-3.5 border-b border-[#D5CFC2] bg-[#EAE6DD] shadow-[0_6px_20px_-4px_rgba(28,25,23,0.06)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55)] md:sticky md:top-0 md:mb-6 lg:mb-7">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Main Row: Single-Row Desktop Header (>= 1024px) & Top Row on Mobile/Tablet */}
        <div className="flex w-full items-center justify-between gap-2 py-2.5 lg:gap-2.5 lg:py-3">
          {/* Left Cluster: Compact Brand + Subject Dropdown */}
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#4338CA] text-white shadow-sm dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] sm:h-9 sm:w-9">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="hidden leading-tight min-[370px]:block">
                <span className="block text-xs font-extrabold tracking-tight text-[#18181B] dark:text-[#F5F5F4] sm:text-sm xl:text-[15px]">
                  Ôn FE
                </span>
                <span className="hidden text-[10px] font-medium text-[#4338CA] dark:text-[#818CF8] sm:block sm:text-[11px]">
                  from Namblee
                </span>
              </div>
            </div>

            {/* Subject Dropdown (Default: VNR202, quick switch to MLN131) */}
            <div ref={subjectContainerRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsSubjectMenuOpen((prev) => !prev)}
                aria-expanded={isSubjectMenuOpen}
                aria-haspopup="listbox"
                aria-label={`Chọn môn học (đang chọn ${activeSubjectMeta.code})`}
                title={`${activeSubjectMeta.code} • ${activeSubjectMeta.name} (${activeQuestions.length} câu)`}
                className="sakuga-btn inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#4338CA] bg-[#4338CA] px-2.5 py-1 text-xs font-bold text-white shadow-[2px_2px_0_0_#C7D2FE] whitespace-nowrap hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:bg-[#3730A3] sm:gap-1.5 sm:px-3 sm:py-1.5"
              >
                <span>{activeSubjectMeta.code}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                    isSubjectMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isSubjectMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Danh sách môn học"
                  className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#C6BEB0] bg-[#FFFFFF] p-1.5 shadow-[0_14px_34px_-8px_rgba(28,25,23,0.12)] dark:border-[#323833] dark:bg-[#1E221F] dark:shadow-[0_16px_38px_-8px_rgba(0,0,0,0.75)] sm:w-64"
                >
                  {SUBJECT_ORDER.map((subjId) => {
                    const meta = SUBJECTS[subjId];
                    const isActive = subject === subjId;
                    return (
                      <button
                        key={subjId}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          onSelectSubject(subjId);
                          setIsSubjectMenuOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition ${
                          isActive
                            ? 'bg-[#EEF2FF] text-[#3730A3] dark:bg-[#312E81]/45 dark:text-[#A5B4FC]'
                            : 'text-[#292524] hover:bg-[#FAF9F5] dark:text-[#E7E5E4] dark:hover:bg-[#252A26]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <span>{meta.code}</span>
                            <span className="font-medium text-[#656058] tabular-nums dark:text-[#9CA39B]">
                              • {meta.totalQuestions} câu
                            </span>
                          </div>
                          <div className="truncate text-[11px] opacity-80">{meta.name}</div>
                        </div>
                        {isActive && (
                          <Check className="h-4 w-4 shrink-0 text-[#4338CA] dark:text-[#818CF8]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Desktop 3-Tier Sakuga Anime Stamp Picker (>= 1024px) */}
          <div className="hidden lg:inline-flex">
            <SakugaTierPicker tier={tier} onSelectTier={onSelectTier} />
          </div>

          {/* Center Cluster: 4 Study Mode Tabs (Desktop >= 1024px) */}
          <nav
            aria-label="Chế độ học tập"
            className="hidden shrink-0 items-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#F4F2EC] p-1 dark:border-[#262925] dark:bg-[#0F100E] lg:flex"
          >
            {MODE_TABS.map(({ id, label, shortLabel, Icon }) => {
              const isActive = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectMode(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`sakuga-btn inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold whitespace-nowrap lg:px-2.5 xl:px-3 2xl:px-3.5 2xl:text-[13px] ${
                    isActive
                      ? 'border-[#4338CA] bg-[#4338CA] text-white shadow-[3px_3px_0_0_#C7D2FE] hover:border-[#3730A3] hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[3px_3px_0_0_#312E81] dark:hover:bg-[#3730A3]'
                      : 'border-transparent text-[#656058] hover:border-[#A5B4FC] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                  }`}
                >
                  <Icon className="hidden h-3.5 w-3.5 shrink-0 2xl:block" />
                  <span className="2xl:hidden">{shortLabel}</span>
                  <span className="hidden 2xl:inline">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Cluster: Mastery Badge + Rule Info, Shortcuts Popover, Sync Modal Button, Theme Toggle */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Overall Mastery Badge (Dopamine Emerald) + Info Popover */}
            <div ref={ruleInfoContainerRef} className="relative flex items-center gap-1">
              <div
                className="inline-flex items-center gap-1 rounded-full border-2 border-[#059669] bg-[#D1FAE5] px-2.5 py-1 text-[11px] font-semibold text-[#047857] shadow-[3px_3px_0_0_#6EE7B7] tabular-nums whitespace-nowrap dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399] dark:shadow-[3px_3px_0_0_#065F46] sm:gap-1.5 sm:px-3 sm:text-xs"
                title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${activeSubjectMeta.code}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#059669] dark:text-[#34D399]" />
                <span>
                  {masteredCount}/{activeQuestions.length}
                  <span className="hidden sm:inline lg:hidden xl:inline"> Đã thuộc</span>
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
                    ? 'border-[#4338CA] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                }`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>

              {isRuleInfoOpen && (
                <div
                  role="dialog"
                  aria-label="Quy tắc tính tiến độ"
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#C6BEB0] bg-[#FFFFFF] p-4 shadow-[0_14px_34px_-8px_rgba(28,25,23,0.09)] dark:border-[#323833] dark:bg-[#1E221F] dark:shadow-[0_16px_38px_-8px_rgba(0,0,0,0.7)] sm:w-80"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D5CFC2] pb-2 dark:border-[#262925]">
                    <span className="text-xs font-bold text-[#18181B] dark:text-[#F5F5F4]">
                      Quy tắc tính tiến độ học tập
                    </span>
                    <span className="rounded-md border border-[#A5B4FC] bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                      Đồng bộ 2 chiều
                    </span>
                  </div>

                  <p className="mb-2.5 text-[11px] text-[#656058] dark:text-[#9CA39B]">
                    <span className="font-semibold text-[#18181B] dark:text-[#F5F5F4]">
                      {activeSubjectMeta.code}
                    </span>{' '}
                    • {activeSubjectMeta.name} ({activeSubjectMeta.chapters.length} chương,{' '}
                    {activeQuestions.length} câu)
                  </p>

                  <div className="space-y-3 text-xs leading-relaxed text-[#292524] dark:text-[#E7E5E4]">
                    <div className="rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-2.5 dark:border-[#2C302B] dark:bg-[#1C1F1C]">
                      <div className="mb-1 font-bold text-[#4338CA] dark:text-[#818CF8]">
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
                          <span className="font-semibold text-[#047857] dark:text-[#34D399]">
                            ✓ Đã thuộc (● ●)
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-2.5 dark:border-[#2C302B] dark:bg-[#1C1F1C]">
                      <div className="mb-1 font-bold text-[#0369A1] dark:text-[#38BDF8]">
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
                          <span className="font-semibold text-[#047857] dark:text-[#34D399]">
                            ✓ Đã thuộc
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Popover — Desktop / Tablet */}
            <div ref={shortcutContainerRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setIsShortcutOpen((prev) => !prev)}
                aria-expanded={isShortcutOpen}
                aria-haspopup="true"
                aria-label="Phím tắt bàn phím"
                title="Phím tắt bàn phím"
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-medium whitespace-nowrap transition xl:px-2.5 ${
                  isShortcutOpen
                    ? 'border-[#4338CA] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline lg:hidden xl:inline">Phím tắt</span>
              </button>

              {isShortcutOpen && (
                <div
                  role="dialog"
                  aria-label="Hướng dẫn phím tắt"
                  className="absolute right-0 top-full z-50 mt-2 w-76 rounded-2xl border border-[#C6BEB0] bg-[#FFFFFF] p-4 shadow-[0_14px_34px_-8px_rgba(28,25,23,0.09)] dark:border-[#323833] dark:bg-[#1E221F] dark:shadow-[0_16px_38px_-8px_rgba(0,0,0,0.7)]"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D5CFC2] pb-2 dark:border-[#262925]">
                    <span className="text-xs font-bold text-[#18181B] dark:text-[#F5F5F4]">
                      Phím tắt trên máy tính
                    </span>
                    <span className="text-[11px] text-[#656058] dark:text-[#9CA39B]">PC</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#292524] dark:text-[#E7E5E4]">
                    <li className="flex items-center justify-between gap-2">
                      <span>Chọn đáp án</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                          1–4
                        </kbd>
                        <span className="text-[#656058] dark:text-[#9CA39B]">/</span>
                        <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                          A–D
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Kiểm tra / Lật thẻ / Tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                          Enter
                        </kbd>
                        <span className="text-[#656058] dark:text-[#9CA39B]">/</span>
                        <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                          Space
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Chuyển câu / Thẻ trước-tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                          ←
                        </kbd>
                        <span className="text-[#656058] dark:text-[#9CA39B]">/</span>
                        <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                          →
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Cờ xanh lá Đã thuộc (Flashcard)</span>
                      <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
                        G
                      </kbd>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Đánh dấu Phân vân</span>
                      <kbd className="rounded border border-[#D5CFC2] bg-[#FAF9F5] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#18181B] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#F5F5F4]">
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
              className="sakuga-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] p-1.5 text-xs font-semibold text-[#3730A3] whitespace-nowrap hover:border-[#4338CA] hover:bg-[#E0E7FF] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/50 sm:px-2.5 sm:py-1.5 lg:p-1.5 2xl:px-3 2xl:py-1.5"
            >
              <Cloud className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 2xl:h-3.5 2xl:w-3.5" />
              <span className="hidden sm:inline lg:hidden 2xl:inline">Đồng bộ tiến độ</span>
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
              className="sakuga-btn inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-1.5 text-xs font-medium text-[#292524] hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#FCD34D]" />
              ) : (
                <Moon className="h-4 w-4 text-[#4338CA]" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2 (Mobile & Tablet only, < 1024px): 4 Mode Tabs grid */}
        <nav
          aria-label="Chế độ học tập"
          className="grid grid-cols-4 gap-1 border-t border-[#D5CFC2] py-2 dark:border-[#262925] lg:hidden"
        >
          {MODE_TABS.map(({ id, shortLabel, Icon }) => {
            const isActive = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectMode(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`sakuga-btn inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-2.5 sm:text-[13px] ${
                  isActive
                    ? 'border-[#4338CA] bg-[#4338CA] text-white shadow-[2px_2px_0_0_#C7D2FE] hover:border-[#3730A3] hover:bg-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:bg-[#3730A3]'
                    : 'border-[#D5CFC2] bg-[#FAF9F5] text-[#656058] hover:border-[#A5B4FC] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#818CF8]/50 dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]'
                }`}
              >
                <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
                <span className="truncate">{shortLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Row 3 (Mobile & Tablet only, < 1024px): 3 Study Tier Anime Stamps */}
        <div className="border-t border-[#D5CFC2]/80 py-2 dark:border-[#262925] lg:hidden">
          <SakugaTierPicker tier={tier} onSelectTier={onSelectTier} compact />
        </div>
      </div>
    </header>
  );
};
