import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
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
import { SakugaParticles, SakugaTierPicker } from './SakugaVfx';

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

const SUBJECT_ITEMS: {
  id: SubjectId;
  shortCode: string;
  activeClass: string;
  inactiveClass: string;
  accentFill: string;
  smokeTint: string;
  sparkleFill: string;
}[] = [
  {
    id: 'vnr202',
    shortCode: 'VNR',
    activeClass:
      'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FDBA74] hover:bg-[#C2410C] dark:border-[#FDBA74] dark:bg-[#EA580C] dark:text-white dark:shadow-[2px_2px_0_0_#9A3412] dark:hover:bg-[#C2410C]',
    inactiveClass:
      'border-transparent bg-transparent text-[#9A3412] hover:border-[#FB923C] hover:bg-[#FFF7ED] hover:text-[#C2410C] dark:text-[#FDBA74]/85 dark:hover:border-[#FB923C]/70 dark:hover:bg-[#7C2D12]/40 dark:hover:text-[#FED7AA]',
    accentFill: '#EA580C',
    smokeTint: '#FED7AA',
    sparkleFill: '#F97316',
  },
  {
    id: 'mln131',
    shortCode: 'MLN',
    activeClass:
      'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] hover:bg-[#0369A1] dark:border-[#7DD3FC] dark:bg-[#0284C7] dark:text-white dark:shadow-[2px_2px_0_0_#075985] dark:hover:bg-[#0369A1]',
    inactiveClass:
      'border-transparent bg-transparent text-[#075985] hover:border-[#38BDF8] hover:bg-[#E0F2FE] hover:text-[#0369A1] dark:text-[#7DD3FC]/85 dark:hover:border-[#38BDF8]/70 dark:hover:bg-[#0C4A6E]/45 dark:hover:text-[#BAE6FD]',
    accentFill: '#0284C7',
    smokeTint: '#BAE6FD',
    sparkleFill: '#38BDF8',
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
  const [badgeBounceSeq, setBadgeBounceSeq] = useState(0);
  const [subjectBurst, setSubjectBurst] = useState<{ id: SubjectId; seq: number } | null>(null);
  const [modeBurst, setModeBurst] = useState<{ id: StudyMode; seq: number } | null>(null);
  const [examBurstSeq, setExamBurstSeq] = useState(0);
  const [isExamBursting, setIsExamBursting] = useState(false);
  const [hasToggledTheme, setHasToggledTheme] = useState(false);

  const prevTierRef = useRef<StudyTier>(tier);
  const prevSubjectRef = useRef<SubjectId>(subject);

  useEffect(() => {
    if (prevTierRef.current !== tier || prevSubjectRef.current !== subject) {
      prevTierRef.current = tier;
      prevSubjectRef.current = subject;
      setBadgeBounceSeq((seq) => seq + 1);
    }
  }, [tier, subject]);

  useEffect(() => {
    if (!subjectBurst) return;
    const timer = window.setTimeout(() => setSubjectBurst(null), 640);
    return () => window.clearTimeout(timer);
  }, [subjectBurst]);

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

  const activeQuestions = useMemo(() => getQuestionsBySubject(subject, tier), [subject, tier]);

  const masteredCount = useMemo(() => {
    let count = 0;
    for (const q of activeQuestions) {
      if (isMastered(progress.questions[q.id])) {
        count += 1;
      }
    }
    return count;
  }, [activeQuestions, progress.questions]);

  const activeSubjectMeta = SUBJECTS[subject];

  const handleSubjectClick = (subjId: SubjectId) => {
    onSelectSubject(subjId);
    setSubjectBurst((prev) => ({ id: subjId, seq: (prev?.seq ?? 0) + 1 }));
  };

  const handleModeClick = (modeId: StudyMode) => {
    onSelectMode(modeId);
    setModeBurst((prev) => ({ id: modeId, seq: (prev?.seq ?? 0) + 1 }));
  };

  const handleExamClick = () => {
    onSelectMode('exam');
    setExamBurstSeq((seq) => seq + 1);
    setIsExamBursting(true);
  };

  const handleThemeClick = () => {
    setHasToggledTheme(true);
    onToggleTheme();
  };

  return (
    <header className="z-40 mb-3.5 border-b-2 border-[#27272A]/85 bg-[#EAE6DD] shadow-[0_3px_0_0_rgba(39,39,42,0.12)] dark:border-[#323833] dark:bg-[#161816] dark:shadow-[0_3px_0_0_rgba(0,0,0,0.45)] md:sticky md:top-0 md:mb-6 lg:mb-7">
      <div className="mx-auto w-full max-w-[1720px] px-3 sm:px-6 lg:px-8 xl:px-12">
        {/* Main Row: Single-Row Desktop Anime HUD (>= 1024px) & Top Row on Mobile/Tablet */}
        <div className="flex w-full items-center justify-between gap-1.5 py-2 sm:gap-2.5 sm:py-2.5 lg:py-3">
          {/* Left Cluster: Cel-Shaded Brand Emblem + Direct VNR / MLN Anime Switcher */}
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
            <div className="group flex items-center gap-2">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-[#1E1B4B] bg-[#4338CA] text-white shadow-[2px_2px_0_0_#A5B4FC] transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:-rotate-6 dark:border-[#A5B4FC] dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81] sm:h-9 sm:w-9">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#FEF08A] transition-transform duration-150 group-hover:scale-125"
                />
              </div>
              <div className="hidden leading-tight min-[440px]:block">
                <span className="block text-xs font-black tracking-tight text-[#18181B] dark:text-[#F5F5F4] sm:text-sm xl:text-[15px]">
                  Ôn FE
                </span>
                <span className="hidden text-[10px] font-bold tracking-wide text-[#4338CA] dark:text-[#A5B4FC] sm:block sm:text-[11px]">
                  from Namblee
                </span>
              </div>
            </div>

            <span
              aria-hidden="true"
              className="hidden h-5 w-[2px] -skew-x-12 bg-[#C6BEB0] dark:bg-[#2C302B] sm:block"
            />

            {/* Direct VNR / MLN Anime Stamp Switcher (Both visible, 3-letter codes) */}
            <div
              role="group"
              aria-label="Chọn môn học"
              className="inline-flex shrink-0 items-center gap-1 overflow-visible rounded-xl border-2 border-[#C6BEB0] bg-[#F4F2EC] p-0.5 dark:border-[#2C302B] dark:bg-[#0F100E] sm:p-1"
            >
              {SUBJECT_ITEMS.map(({ id, shortCode, activeClass, inactiveClass, accentFill, smokeTint, sparkleFill }) => {
                const meta = SUBJECTS[id];
                const isActive = subject === id;
                const isBursting = subjectBurst?.id === id;
                const questionTotal = getQuestionsBySubject(id, tier).length;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSubjectClick(id)}
                    aria-pressed={isActive}
                    title={`${meta.code} • ${meta.name} (${questionTotal} câu)`}
                    className="sakuga-btn relative inline-flex cursor-pointer items-center justify-center overflow-visible focus-visible:outline-none"
                  >
                    {isBursting && subjectBurst && (
                      <SakugaParticles
                        key={`subj-particles-${id}-${subjectBurst.seq}`}
                        isMiss={false}
                        showShards={true}
                        accentFill={accentFill}
                        smokeTint={smokeTint}
                        sparkleFill={sparkleFill}
                        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[58px] w-[112px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
                      />
                    )}
                    <motion.span
                      key={
                        isBursting && subjectBurst
                          ? `subj-stamp-${id}-${subjectBurst.seq}`
                          : `subj-stamp-${id}`
                      }
                      initial={
                        isBursting
                          ? { y: -6, scaleX: 1.18, scaleY: 0.82, rotate: -4 }
                          : false
                      }
                      animate={{ y: 0, scaleX: 1, scaleY: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 340, damping: 16 }}
                      className="relative z-10 inline-flex"
                    >
                      <span
                        className={`inline-flex -skew-x-12 items-center justify-center rounded-md border-2 px-2 py-0.5 text-[11px] font-black italic tracking-wider whitespace-nowrap transition-colors duration-150 sm:px-2.5 sm:py-1 sm:text-xs ${
                          isActive ? activeClass : inactiveClass
                        }`}
                      >
                        <span className="skew-x-12">{shortCode}</span>
                      </span>
                    </motion.span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Cluster: 3 Study Mode Tabs — Anime HUD Dock with Spring Highlight (Desktop >= 1024px) */}
          <nav
            aria-label="Chế độ học tập"
            className="hidden shrink-0 items-center gap-1 overflow-visible rounded-xl border-2 border-[#C6BEB0] bg-[#F4F2EC] p-1 dark:border-[#2C302B] dark:bg-[#0F100E] lg:flex"
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
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop 3-Tier Sakuga Anime Stamp Picker (>= 1024px) — Preserved */}
          <div className="hidden lg:inline-flex">
            <SakugaTierPicker tier={tier} onSelectTier={onSelectTier} />
          </div>

          {/* Right Cluster: Mastery HUD Counter, Standalone "Thi thử" Stamp, Sync, Theme */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 xl:gap-2">
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
              className={`inline-flex items-center gap-1 rounded-lg border-2 px-2 py-1 text-[11px] font-extrabold tabular-nums whitespace-nowrap transition-colors duration-200 sm:gap-1.5 sm:px-2.5 sm:text-xs ${TIER_BADGE_STYLES[tier].pill}`}
              title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${activeSubjectMeta.code}`}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${TIER_BADGE_STYLES[tier].icon}`} />
              <span>
                {masteredCount}/{activeQuestions.length}
                <span className="hidden sm:inline lg:hidden xl:inline"> Đã thuộc</span>
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
                className={`relative z-10 inline-flex items-center gap-1.5 rounded-lg border-2 px-2 py-1 text-[11px] font-extrabold tracking-tight whitespace-nowrap transition-colors duration-150 sm:px-2.5 sm:text-xs xl:px-3 ${
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
              onClick={onOpenSyncModal}
              aria-label="Đồng bộ tiến độ"
              title="Đồng bộ tiến độ"
              className="sakuga-btn group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-[#A5B4FC] bg-[#EEF2FF] p-1 text-xs font-extrabold text-[#3730A3] shadow-[2px_2px_0_0_#C7D2FE] whitespace-nowrap hover:-translate-y-0.5 hover:border-[#4338CA] hover:bg-[#E0E7FF] dark:border-[#818CF8]/60 dark:bg-[#312E81]/35 dark:text-[#A5B4FC] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:border-[#A5B4FC] dark:hover:bg-[#312E81]/55 sm:px-2.5 sm:py-1 lg:p-1.5 2xl:px-2.5 2xl:py-1"
            >
              <Cloud className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:scale-110 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 2xl:h-3.5 2xl:w-3.5" />
              <span className="hidden sm:inline lg:hidden 2xl:inline">Đồng bộ</span>
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
                  <Sun className="h-4 w-4 text-[#FCD34D]" />
                ) : (
                  <Moon className="h-4 w-4 text-[#4338CA]" />
                )}
              </motion.span>
            </button>
          </div>
        </div>

        {/* Row 2 (Mobile & Tablet only, < 1024px): 3 Study Tier Anime Stamps — Preserved */}
        <div className="border-t border-[#D5CFC2] py-2 dark:border-[#262925] lg:hidden">
          <SakugaTierPicker tier={tier} onSelectTier={onSelectTier} compact />
        </div>

        {/* Row 3 (Mobile & Tablet only, < 1024px): 3 Mode Tabs Cel-Shaded Grid with Spring Highlight */}
        <nav
          aria-label="Chế độ học tập"
          className="grid grid-cols-3 gap-1.5 overflow-visible border-t border-[#D5CFC2]/80 py-2 dark:border-[#262925] lg:hidden"
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
                <span className="relative z-10 truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
