import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  CreditCard,
  GraduationCap,
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

const TIER_BADGE_STYLES: Record<StudyTier, { pill: string; icon: string }> = {
  lazymax: {
    pill: 'border-[#059669] bg-[#D1FAE5] text-[#047857] shadow-[3px_3px_0_0_#6EE7B7] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399] dark:shadow-[3px_3px_0_0_#065F46]',
    icon: 'text-[#059669] dark:text-[#34D399]',
  },
  lazy: {
    pill: 'border-[#D97706] bg-[#FEF3C7] text-[#92400E] shadow-[3px_3px_0_0_#FCD34D] dark:border-[#F59E0B] dark:bg-[#92400E]/45 dark:text-[#FDE68A] dark:shadow-[3px_3px_0_0_#92400E]',
    icon: 'text-[#D97706] dark:text-[#FBBF24]',
  },
  hardcore: {
    pill: 'border-[#E11D48] bg-[#FFE4E6] text-[#BE123C] shadow-[3px_3px_0_0_#FDA4AF] dark:border-[#FB7185] dark:bg-[#881337]/45 dark:text-[#FFE4E6] dark:shadow-[3px_3px_0_0_#881337]',
    icon: 'text-[#E11D48] dark:text-[#FB7185]',
  },
};

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
  const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
  const [badgeBounceSeq, setBadgeBounceSeq] = useState(0);
  const subjectContainerRef = useRef<HTMLDivElement>(null);
  const prevTierRef = useRef<StudyTier>(tier);

  useEffect(() => {
    if (prevTierRef.current !== tier) {
      prevTierRef.current = tier;
      setBadgeBounceSeq((seq) => seq + 1);
    }
  }, [tier]);

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
    if (!isSubjectMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        subjectContainerRef.current &&
        !subjectContainerRef.current.contains(event.target as Node)
      ) {
        setIsSubjectMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSubjectMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubjectMenuOpen]);

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
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isSubjectMenuOpen ? 'rotate-180' : ''
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
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition ${isActive
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
                  className={`sakuga-btn inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold whitespace-nowrap lg:px-2.5 xl:px-3 2xl:px-3.5 2xl:text-[13px] ${isActive
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

          {/* Desktop 3-Tier Sakuga Anime Stamp Picker (>= 1024px) */}
          <div className="hidden lg:inline-flex">
            <SakugaTierPicker tier={tier} onSelectTier={onSelectTier} />
          </div>

          {/* Right Cluster: Mastery Badge, Sync Modal Button, Theme Toggle */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Overall Mastery Badge (Color & Anime Jump keyed to Study Tier) */}
            <motion.div
              key={badgeBounceSeq > 0 ? `mastery-bounce-${badgeBounceSeq}` : 'mastery-static'}
              initial={
                badgeBounceSeq > 0
                  ? { y: 0, scaleX: 1.18, scaleY: 0.84 }
                  : false
              }
              animate={
                badgeBounceSeq > 0
                  ? {
                      y: [0, -11, 2, 0],
                      scaleX: [1.18, 0.9, 1.06, 1],
                      scaleY: [0.84, 1.14, 0.94, 1],
                    }
                  : { y: 0, scaleX: 1, scaleY: 1 }
              }
              transition={{ duration: 0.44, times: [0, 0.36, 0.72, 1], ease: [0.22, 1, 0.36, 1] }}
              className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap transition-colors duration-200 sm:gap-1.5 sm:px-3 sm:text-xs ${TIER_BADGE_STYLES[tier].pill}`}
              title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${activeSubjectMeta.code}`}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${TIER_BADGE_STYLES[tier].icon}`} />
              <span>
                {masteredCount}/{activeQuestions.length}
                <span className="hidden sm:inline lg:hidden xl:inline"> Đã thuộc</span>
              </span>
            </motion.div>

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

  {/* Row 2 (Mobile & Tablet only, < 1024px): 3 Study Tier Anime Stamps */ }
  <div className="border-t border-[#D5CFC2] py-2 dark:border-[#262925] lg:hidden">
    <SakugaTierPicker tier={tier} onSelectTier={onSelectTier} compact />
  </div>

  {/* Row 3 (Mobile & Tablet only, < 1024px): 4 Mode Tabs grid */ }
  <nav
    aria-label="Chế độ học tập"
    className="grid grid-cols-4 gap-1 border-t border-[#D5CFC2]/80 py-2 dark:border-[#262925] lg:hidden"
  >
    {MODE_TABS.map(({ id, shortLabel, Icon }) => {
      const isActive = mode === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onSelectMode(id)}
          aria-current={isActive ? 'page' : undefined}
          className={`sakuga-btn inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-2.5 sm:text-[13px] ${isActive
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
      </div >
    </header >
  );
};
