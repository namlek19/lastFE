import React, { memo, useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  CreditCard,
  Layers,
  Moon,
  Sun,
} from 'lucide-react';
import {
  SUBJECTS,
  countSubjectMastered,
  getEffectiveTier,
  getSubjectTotalCount,
  subjectSupportsLazyTiers,
} from '../data/index';
import { StudyMode, StudyTier, SubjectId, UserProgressStore } from '../types/quiz';
import { ThemeMode } from '../utils/storage';
import { useIsDesktopLg } from '../utils/useIsDesktopLg';
import {
  SaiyanTagTone,
  SaiyanTriggerEvent,
  SakugaSaiyanLogo,
} from './SakugaSaiyanLogo';
import { LastFeOrigamiLogo } from './LastFeOrigamiLogo';
import { SakugaSubjectDropdown } from './SakugaSubjectDropdown';
import { SakugaParticles, SakugaTierPicker } from './SakugaVfx';

const LOGO_SAIYAN_LINES = ['SPIDEY SAIYAN!', 'THWIP! ⚡', 'POWER UP!', 'OVER 9000!'] as const;

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
  logoRef?: React.RefObject<HTMLSpanElement>;
  hideLogoMark?: boolean;
  isRevealed?: boolean;
}

const MODE_TABS: {
  id: StudyMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  activePlateClass: string;
  inactiveClass: string;
  mobileInactiveClass: string;
  inactiveIconClass: string;
  accentFill: string;
  smokeTint: string;
  sparkleFill: string;
}[] = [
  {
    id: 'chapter',
    label: 'Theo chương',
    Icon: BookOpen,
    activePlateClass:
      'border-[#1E1B4B] bg-[#4338CA] shadow-[2px_2px_0_0_#A5B4FC] dark:border-[#A5B4FC] dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81]',
    inactiveClass:
      'border-transparent text-[#57534E] hover:border-[#A5B4FC] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:border-[#818CF8]/60 dark:hover:bg-[#312E81]/35 dark:hover:text-[#A5B4FC]',
    mobileInactiveClass:
      'border-[#C6BEB0] bg-[#FAF9F5] text-[#57534E] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#A5B4FC] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#0A0B0A] dark:hover:border-[#818CF8]/60 dark:hover:bg-[#312E81]/35 dark:hover:text-[#A5B4FC]',
    inactiveIconClass: 'text-[#4338CA] dark:text-[#818CF8]',
    accentFill: '#4338CA',
    smokeTint: '#C7D2FE',
    sparkleFill: '#6366F1',
  },
  {
    id: 'rolling',
    label: 'Cuốn chiếu',
    Icon: Layers,
    activePlateClass:
      'border-[#134E4A] bg-[#0D9488] shadow-[2px_2px_0_0_#5EEAD4] dark:border-[#5EEAD4] dark:bg-[#0D9488] dark:shadow-[2px_2px_0_0_#115E59]',
    inactiveClass:
      'border-transparent text-[#57534E] hover:border-[#5EEAD4] hover:bg-[#CCFBF1] hover:text-[#0F766E] dark:text-[#9CA39B] dark:hover:border-[#2DD4BF]/60 dark:hover:bg-[#134E4A]/45 dark:hover:text-[#5EEAD4]',
    mobileInactiveClass:
      'border-[#C6BEB0] bg-[#FAF9F5] text-[#57534E] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#5EEAD4] hover:bg-[#CCFBF1] hover:text-[#0F766E] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#0A0B0A] dark:hover:border-[#2DD4BF]/60 dark:hover:bg-[#134E4A]/45 dark:hover:text-[#5EEAD4]',
    inactiveIconClass: 'text-[#0D9488] dark:text-[#2DD4BF]',
    accentFill: '#0D9488',
    smokeTint: '#99F6E4',
    sparkleFill: '#14B8A6',
  },
  {
    id: 'flashcard',
    label: 'Flashcard',
    Icon: CreditCard,
    activePlateClass:
      'border-[#4C1D95] bg-[#9333EA] shadow-[2px_2px_0_0_#D8B4FE] dark:border-[#D8B4FE] dark:bg-[#9333EA] dark:shadow-[2px_2px_0_0_#581C87]',
    inactiveClass:
      'border-transparent text-[#57534E] hover:border-[#D8B4FE] hover:bg-[#F3E8FF] hover:text-[#7E22CE] dark:text-[#9CA39B] dark:hover:border-[#C084FC]/60 dark:hover:bg-[#581C87]/45 dark:hover:text-[#E9D5FF]',
    mobileInactiveClass:
      'border-[#C6BEB0] bg-[#FAF9F5] text-[#57534E] shadow-[2px_2px_0_0_#D5CFC2] hover:border-[#D8B4FE] hover:bg-[#F3E8FF] hover:text-[#7E22CE] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:shadow-[2px_2px_0_0_#0A0B0A] dark:hover:border-[#C084FC]/60 dark:hover:bg-[#581C87]/45 dark:hover:text-[#E9D5FF]',
    inactiveIconClass: 'text-[#9333EA] dark:text-[#C084FC]',
    accentFill: '#9333EA',
    smokeTint: '#E9D5FF',
    sparkleFill: '#C084FC',
  },
];

const TIER_BADGE_STYLES: Record<StudyTier, { pill: string; icon: string }> = {
  lazymax: {
    pill: 'border-[#064E3B] bg-[#D1FAE5] text-[#065F46] shadow-[2px_2px_0_0_#10B981] dark:border-[#6EE7B7] dark:bg-[#065F46]/60 dark:text-[#ECFDF5] dark:shadow-[2px_2px_0_0_#059669]',
    icon: 'text-[#059669] dark:text-[#34D399]',
  },
  lazy: {
    pill: 'border-[#78350F] bg-[#FEF3C7] text-[#92400E] shadow-[2px_2px_0_0_#F59E0B] dark:border-[#FDE68A] dark:bg-[#92400E]/55 dark:text-[#FEF3C7] dark:shadow-[2px_2px_0_0_#D97706]',
    icon: 'text-[#D97706] dark:text-[#FBBF24]',
  },
  hardcore: {
    pill: 'border-[#881337] bg-[#FFE4E6] text-[#BE123C] shadow-[2px_2px_0_0_#E11D48] dark:border-[#FDA4AF] dark:bg-[#881337]/60 dark:text-[#FFE4E6] dark:shadow-[2px_2px_0_0_#E11D48]',
    icon: 'text-[#E11D48] dark:text-[#FB7185]',
  },
};

const HeaderComponent: React.FC<HeaderProps> = ({
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
  logoRef,
  hideLogoMark = false,
  isRevealed = true,
}) => {
  const isDesktopLg = useIsDesktopLg();
  const [badgeBounceSeq, setBadgeBounceSeq] = useState(0);
  const [modeBurst, setModeBurst] = useState<{ id: StudyMode; seq: number } | null>(null);
  const [examBurstSeq, setExamBurstSeq] = useState(0);
  const [isExamBursting, setIsExamBursting] = useState(false);
  const [hasToggledTheme, setHasToggledTheme] = useState(false);
  const [saiyanEvent, setSaiyanEvent] = useState<SaiyanTriggerEvent | null>(null);

  const prevTierRef = useRef<StudyTier>(tier);
  const prevSubjectRef = useRef<SubjectId>(subject);
  const saiyanSeqRef = useRef(0);
  const logoLineIdxRef = useRef(0);

  const triggerSaiyan = (label: string, tone: SaiyanTagTone) => {
    saiyanSeqRef.current += 1;
    setSaiyanEvent({ seq: saiyanSeqRef.current, label, tone });
  };

  useEffect(() => {
    if (prevTierRef.current !== tier || prevSubjectRef.current !== subject) {
      prevTierRef.current = tier;
      prevSubjectRef.current = subject;
      setBadgeBounceSeq((seq) => seq + 1);
    }
  }, [tier, subject]);

  useEffect(() => {
    if (!modeBurst) return;
    const timer = window.setTimeout(() => setModeBurst(null), 620);
    return () => window.clearTimeout(timer);
  }, [modeBurst]);

  useEffect(() => {
    if (!isExamBursting) return;
    const timer = window.setTimeout(() => setIsExamBursting(false), 640);
    return () => window.clearTimeout(timer);
  }, [isExamBursting, examBurstSeq]);

  const effectiveTier = getEffectiveTier(subject, tier);
  const supportsLazy = subjectSupportsLazyTiers(subject);
  const hasExamPapers = Boolean(SUBJECTS[subject].examPapers?.length);
  const totalQuestionCount = getSubjectTotalCount(subject, effectiveTier);

  const masteredCount = useMemo(
    () => countSubjectMastered(subject, effectiveTier, progress.questions),
    [subject, effectiveTier, progress.questions]
  );

  const activeSubjectMeta = SUBJECTS[subject];

  const handleLogoClick = () => {
    const label = LOGO_SAIYAN_LINES[logoLineIdxRef.current % LOGO_SAIYAN_LINES.length];
    logoLineIdxRef.current += 1;
    triggerSaiyan(label, 'amber');
  };

  const handleSubjectClick = (subjId: SubjectId) => {
    onSelectSubject(subjId);
    if (subjId === 'vnr202') {
      triggerSaiyan('VNR202!', 'amber');
    } else if (subjId === 'mln131') {
      triggerSaiyan('MLN131!', 'indigo');
    } else if (subjId === 'mln122') {
      triggerSaiyan('MLN122!', 'emerald');
    } else if (subjId === 'wdu202c') {
      triggerSaiyan('WDU202c!', 'rose');
    } else {
      triggerSaiyan('WDU203c!', 'pink');
    }
  };

  const handleModeClick = (modeId: StudyMode) => {
    onSelectMode(modeId);
    setModeBurst((prev) => ({ id: modeId, seq: (prev?.seq ?? 0) + 1 }));
    if (modeId === 'chapter') {
      triggerSaiyan('CHAPTER!', 'indigo');
    } else if (modeId === 'rolling') {
      triggerSaiyan('ROLLING!', 'emerald');
    } else if (modeId === 'flashcard') {
      triggerSaiyan('FLASHCARD!', 'fuchsia');
    }
  };

  const handleTierClick = (nextTier: StudyTier) => {
    onSelectTier(nextTier);
    if (nextTier === 'lazymax') {
      triggerSaiyan('LAZY MAX!', 'emerald');
    } else if (nextTier === 'lazy') {
      triggerSaiyan('LAZY!', 'amber');
    } else {
      triggerSaiyan('HARDCORE!', 'rose');
    }
  };

  const handleExamClick = () => {
    onSelectMode('exam');
    setExamBurstSeq((seq) => seq + 1);
    setIsExamBursting(true);
    triggerSaiyan('BOSS FIGHT!', 'amber');
  };

  const handleSyncClick = () => {
    triggerSaiyan('SYNC!', 'indigo');
    onOpenSyncModal();
  };

  const handleThemeClick = () => {
    setHasToggledTheme(true);
    if (theme === 'dark') {
      triggerSaiyan('LIGHT MODE!', 'amber');
    } else {
      triggerSaiyan('DARK MODE!', 'indigo');
    }
    onToggleTheme();
  };

  return (
    <header
      className={`z-40 mb-3.5 border-b-2 border-[#27272A]/85 bg-[#EAE6DD] shadow-[0_3px_0_0_rgba(39,39,42,0.12)] transition-opacity duration-500 ease-out dark:border-[#323833] dark:bg-[#161816] dark:shadow-[0_3px_0_0_rgba(0,0,0,0.45)] md:sticky md:top-0 md:mb-6 lg:mb-7 ${
        isRevealed ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="mx-auto w-full max-w-[1720px] px-2.5 sm:px-6 lg:px-8 xl:px-12">
        {/* Main Row: Single-Row Desktop Anime HUD (>= 1024px) & Compact Single-Row on Mobile */}
        <div className="flex w-full items-center justify-between gap-1 py-2 min-[420px]:gap-1.5 sm:gap-3 sm:py-2.5 lg:gap-4 lg:py-3">
          {/* Left Cluster: Super Saiyan Icon + Origami LastFE Logo + Subject Switcher */}
          <div className="flex min-w-0 shrink-0 items-center gap-1 min-[420px]:gap-1.5 sm:gap-3 lg:gap-3.5">
            <div className="flex items-center gap-1 min-[420px]:gap-1.5 sm:gap-2">
              <SakugaSaiyanLogo event={saiyanEvent} onLogoClick={handleLogoClick} />
              <span
                ref={logoRef}
                className={`inline-flex shrink-0 items-center ${
                  hideLogoMark ? 'opacity-0' : 'opacity-100'
                }`}
              >
                <LastFeOrigamiLogo className="h-[14px] w-auto min-[390px]:h-[16px] min-[420px]:h-[18px] sm:h-[24px] lg:h-[25px]" />
              </span>
            </div>

            {/* 3-Subject Anime Deck Dropdown */}
            <SakugaSubjectDropdown
              subject={subject}
              tier={tier}
              progress={progress}
              onSelectSubject={handleSubjectClick}
            />
          </div>

          {/* Center Cluster: 3 Study Mode Tabs — Anime HUD Dock with Spring Highlight (Desktop >= 1024px) */}
          {isDesktopLg && (
            <nav
              aria-label="Chế độ học tập"
              className="flex shrink-0 items-center gap-1 overflow-visible rounded-xl border-2 border-[#C6BEB0] bg-[#F4F2EC] p-1 dark:border-[#2C302B] dark:bg-[#0F100E]"
            >
              {MODE_TABS.map(({
                id,
                label,
                Icon,
                activePlateClass,
                inactiveClass,
                inactiveIconClass,
                accentFill,
                smokeTint,
                sparkleFill,
              }) => {
                const isActive = mode === id;
                const isBursting = modeBurst?.id === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleModeClick(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`sakuga-btn group relative inline-flex cursor-pointer items-center justify-center gap-1.5 overflow-visible rounded-lg border-2 py-1 text-xs font-extrabold tracking-tight whitespace-nowrap lg:px-2.5 xl:px-3 2xl:px-3.5 2xl:text-[13px] ${
                      isActive ? 'border-transparent text-white' : inactiveClass
                    }`}
                  >
                    {isBursting && modeBurst && (
                      <SakugaParticles
                        key={`mode-desktop-particles-${id}-${modeBurst.seq}`}
                        isMiss={false}
                        showShards={false}
                        accentFill={accentFill}
                        smokeTint={smokeTint}
                        sparkleFill={sparkleFill}
                        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[62px] w-[128px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
                      />
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="header-mode-active-desktop"
                        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                        className={`pointer-events-none absolute -inset-[2px] z-[1] rounded-lg border-2 ${activePlateClass}`}
                      />
                    )}
                    <Icon
                      className={`relative z-10 hidden h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:-rotate-6 xl:block ${
                        isActive ? 'text-white' : inactiveIconClass
                      }`}
                    />
                    <span className="relative z-10">
                      {id === 'chapter' && hasExamPapers ? 'Theo đề' : label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Desktop 3-Tier Sakuga Anime Stamp Picker (>= 1024px) */}
          {isDesktopLg && supportsLazy && (
            <div className="inline-flex">
              <SakugaTierPicker tier={effectiveTier} subject={subject} onSelectTier={handleTierClick} />
            </div>
          )}

          {/* Right Cluster: Mastery HUD Counter, Standalone "Thi thử" Stamp, Sync, Theme */}
          <div className="flex shrink-0 items-center gap-1 min-[420px]:gap-1.5 sm:gap-2 xl:gap-2.5">
            {/* Overall Mastery HUD Counter (Color & Anime Jump keyed to Study Tier & Subject) */}
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
              className={`inline-flex items-center gap-1 rounded-lg border-2 px-1.5 py-1 text-[10.5px] font-extrabold tabular-nums whitespace-nowrap transition-colors duration-200 min-[420px]:px-2 min-[420px]:text-[11px] sm:gap-1.5 sm:px-2.5 sm:text-xs ${TIER_BADGE_STYLES[effectiveTier].pill}`}
              title={`Đã thuộc ${masteredCount} trên ${totalQuestionCount} câu môn ${activeSubjectMeta.code}`}
            >
              <CheckCircle2 className={`hidden h-3 w-3 shrink-0 min-[375px]:block sm:h-3.5 sm:w-3.5 ${TIER_BADGE_STYLES[effectiveTier].icon}`} />
              <span>
                {masteredCount}/{totalQuestionCount}
              </span>
            </motion.div>

            {/* Standalone Mock Exam ("Thi thử") Cel-Shaded Action Button */}
            <button
              type="button"
              onClick={handleExamClick}
              aria-current={mode === 'exam' ? 'page' : undefined}
              title="Thi thử trộn đề (Full Hardcore)"
              className="sakuga-btn group relative inline-flex cursor-pointer items-center justify-center overflow-visible focus-visible:outline-none"
            >
              {isExamBursting && (
                <SakugaParticles
                  key={`exam-particles-${examBurstSeq}`}
                  isMiss={false}
                  showShards={true}
                  accentFill="#EA580C"
                  smokeTint="#FEF08A"
                  sparkleFill="#FACC15"
                  className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[60px] w-[118px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
                />
              )}
              <motion.span
                key={isExamBursting ? `exam-pop-${examBurstSeq}` : 'exam-static'}
                initial={isExamBursting ? { y: -5, scaleX: 1.16, scaleY: 0.85 } : false}
                animate={{ y: 0, scaleX: 1, scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 16 }}
                className={`relative z-10 inline-flex items-center gap-1.5 rounded-lg border-2 px-1.5 py-1 text-[10.5px] font-extrabold tracking-tight whitespace-nowrap transition-colors duration-150 min-[420px]:px-2 min-[420px]:text-[11px] sm:px-2.5 sm:text-xs xl:px-3 ${
                  mode === 'exam'
                    ? 'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FACC15] hover:bg-[#C2410C] dark:border-[#FEF08A] dark:bg-[#EA580C] dark:text-white dark:shadow-[2px_2px_0_0_#CA8A04] dark:hover:bg-[#C2410C]'
                    : 'border-[#92400E] bg-[#FDE68A] text-[#78350F] shadow-[2px_2px_0_0_#D97706] hover:border-[#78350F] hover:bg-[#FCD34D] hover:text-[#451A03] dark:border-[#FBBF24] dark:bg-[#78350F]/75 dark:text-[#FEF3C7] dark:shadow-[2px_2px_0_0_#D97706] dark:hover:bg-[#92400E] dark:hover:text-white'
                }`}
              >
                <ClipboardCheck className="hidden h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:-rotate-6 group-hover:scale-110 sm:block lg:hidden xl:block" />
                <span>Thi thử</span>
              </motion.span>
            </button>

            {/* Progress Sync Button */}
            <button
              type="button"
              onClick={handleSyncClick}
              aria-label="Đồng bộ tiến độ"
              title="Đồng bộ tiến độ"
              className="sakuga-btn group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-[#A5B4FC] bg-[#EEF2FF] p-1 text-xs font-extrabold text-[#3730A3] shadow-[2px_2px_0_0_#C7D2FE] whitespace-nowrap hover:-translate-y-0.5 hover:border-[#4338CA] hover:bg-[#E0E7FF] dark:border-[#818CF8]/60 dark:bg-[#312E81]/35 dark:text-[#A5B4FC] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:border-[#A5B4FC] dark:hover:bg-[#312E81]/55 sm:p-1.5 md:px-2.5 md:py-1 lg:p-1.5 2xl:px-2.5 2xl:py-1"
            >
              <Cloud className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:scale-110 min-[420px]:h-4 min-[420px]:w-4 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 2xl:h-3.5 2xl:w-3.5" />
              <span className="hidden md:inline lg:hidden 2xl:inline">Đồng bộ</span>
            </button>

            {/* Light / Dark Mode Toggle with Anime Spin-Pop */}
            <button
              type="button"
              onClick={handleThemeClick}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
              className="sakuga-btn inline-flex cursor-pointer items-center justify-center rounded-lg border-2 border-[#C6BEB0] bg-[#FAF9F5] p-1 text-xs font-medium text-[#292524] shadow-[2px_2px_0_0_#D5CFC2] hover:-translate-y-0.5 hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#323833] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:shadow-[2px_2px_0_0_#0A0B0A] dark:hover:border-[#A5B4FC] dark:hover:bg-[#312E81]/35 dark:hover:text-[#A5B4FC] sm:p-1.5"
            >
              <motion.span
                key={theme}
                initial={hasToggledTheme ? { rotate: -85, scale: 0.55, opacity: 0 } : false}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                className="inline-flex"
              >
                {theme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5 text-[#FCD34D] min-[420px]:h-4 min-[420px]:w-4" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-[#4338CA] min-[420px]:h-4 min-[420px]:w-4" />
                )}
              </motion.span>
            </button>
          </div>
        </div>

        {/* Rows 2 & 3 (Mobile & Tablet only, < 1024px): mounted strictly when below lg */}
        {!isDesktopLg && (
          <>
            {supportsLazy && (
              <div className="border-t border-[#D5CFC2] py-2 dark:border-[#262925]">
                <SakugaTierPicker tier={effectiveTier} subject={subject} onSelectTier={handleTierClick} compact />
              </div>
            )}

            <nav
              aria-label="Chế độ học tập"
              className="grid grid-cols-3 gap-1.5 overflow-visible border-t border-[#D5CFC2]/80 py-2 dark:border-[#262925]"
            >
              {MODE_TABS.map(({
                id,
                label,
                Icon,
                activePlateClass,
                mobileInactiveClass,
                inactiveIconClass,
                accentFill,
                smokeTint,
                sparkleFill,
              }) => {
                const isActive = mode === id;
                const isBursting = modeBurst?.id === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleModeClick(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`sakuga-btn group relative inline-flex cursor-pointer items-center justify-center gap-1.5 overflow-visible rounded-lg border-2 px-1.5 py-1.5 text-xs font-extrabold tracking-tight whitespace-nowrap sm:px-2.5 sm:text-[13px] ${
                      isActive ? 'border-transparent text-white' : mobileInactiveClass
                    }`}
                  >
                    {isBursting && modeBurst && (
                      <SakugaParticles
                        key={`mode-mobile-particles-${id}-${modeBurst.seq}`}
                        isMiss={false}
                        showShards={false}
                        accentFill={accentFill}
                        smokeTint={smokeTint}
                        sparkleFill={sparkleFill}
                        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[62px] w-[124px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
                      />
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="header-mode-active-mobile"
                        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                        className={`pointer-events-none absolute -inset-[2px] z-[1] rounded-lg border-2 ${activePlateClass}`}
                      />
                    )}
                    <Icon
                      className={`relative z-10 hidden h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:-rotate-6 sm:block ${
                        isActive ? 'text-white' : inactiveIconClass
                      }`}
                    />
                    <span className="relative z-10 truncate">
                      {id === 'chapter' && hasExamPapers ? 'Theo đề' : label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </header>
  );
};

export const Header = memo(HeaderComponent);
Header.displayName = 'Header';
