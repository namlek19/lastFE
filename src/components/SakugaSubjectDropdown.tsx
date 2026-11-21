import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { SUBJECTS, countSubjectMastered, getSubjectTotalCount } from '../data/index';
import { StudyTier, SubjectId, UserProgressStore } from '../types/quiz';

export interface SakugaSubjectDropdownProps {
  subject: SubjectId;
  tier: StudyTier;
  progress: UserProgressStore;
  onSelectSubject: (subject: SubjectId) => void;
}

export interface SubjectThemeSpec {
  id: SubjectId;
  shortCode: string;
  fullCode: string;
  subtitle: string;
  accentHex: string;
  triggerClass: string;
  badgeClass: string;
  activeRowClass: string;
  reticleClass: string;
  countPillClass: string;
}

export const SUBJECT_DROPDOWN_ITEMS: readonly SubjectThemeSpec[] = [
  {
    id: 'vnr202',
    shortCode: 'VNR',
    fullCode: 'VNR202',
    subtitle: 'Lịch sử Đảng CSVN',
    accentHex: '#EA580C',
    triggerClass:
      'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FDBA74] hover:bg-[#C2410C] dark:border-[#FDBA74] dark:bg-[#EA580C] dark:text-white dark:shadow-[2px_2px_0_0_#9A3412] dark:hover:bg-[#C2410C]',
    badgeClass:
      'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FDBA74] dark:border-[#FDBA74] dark:bg-[#EA580C] dark:text-white dark:shadow-[2px_2px_0_0_#9A3412]',
    activeRowClass:
      'border-[#EA580C] bg-[#FFF7ED] text-[#7C2D12] dark:border-[#FB923C] dark:bg-[#7C2D12]/35 dark:text-[#FED7AA]',
    reticleClass: 'border-[#EA580C] dark:border-[#FB923C]',
    countPillClass:
      'border-[#FDBA74] bg-[#FFEDD5] text-[#9A3412] dark:border-[#FB923C]/50 dark:bg-[#9A3412]/50 dark:text-[#FED7AA]',
  },
  {
    id: 'mln131',
    shortCode: 'MLN',
    fullCode: 'MLN131',
    subtitle: 'CNXH Khoa học',
    accentHex: '#0284C7',
    triggerClass:
      'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] hover:bg-[#0369A1] dark:border-[#7DD3FC] dark:bg-[#0284C7] dark:text-white dark:shadow-[2px_2px_0_0_#075985] dark:hover:bg-[#0369A1]',
    badgeClass:
      'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] dark:border-[#7DD3FC] dark:bg-[#0284C7] dark:text-white dark:shadow-[2px_2px_0_0_#075985]',
    activeRowClass:
      'border-[#0284C7] bg-[#E0F2FE] text-[#0C4A6E] dark:border-[#38BDF8] dark:bg-[#0C4A6E]/40 dark:text-[#BAE6FD]',
    reticleClass: 'border-[#0284C7] dark:border-[#38BDF8]',
    countPillClass:
      'border-[#7DD3FC] bg-[#E0F2FE] text-[#075985] dark:border-[#38BDF8]/50 dark:bg-[#075985]/50 dark:text-[#BAE6FD]',
  },
];

const SUBJECT_SPEC_MAP: Partial<Record<SubjectId, SubjectThemeSpec>> = {
  vnr202: SUBJECT_DROPDOWN_ITEMS[0],
  mln131: SUBJECT_DROPDOWN_ITEMS[1],
};

/** Compact red-and-blue blocky spider icon inside the trigger button */
const MiniTriggerSpider: React.FC = () => (
  <svg viewBox="0 0 16 14" aria-hidden="true" className="h-3.5 w-4 shrink-0">
    {/* Side legs */}
    <rect x="0" y="5" width="2" height="2" fill="#18181B" />
    <rect x="1" y="7" width="2" height="2" fill="#2563EB" />
    <rect x="14" y="5" width="2" height="2" fill="#18181B" />
    <rect x="13" y="7" width="2" height="2" fill="#2563EB" />
    {/* Blocky Spider-Man red head + ink border */}
    <rect x="3" y="1" width="10" height="10" rx="1.5" fill="#18181B" />
    <rect x="4" y="2" width="8" height="6" fill="#EF4444" />
    <rect x="4" y="8" width="8" height="2" fill="#2563EB" />
    {/* Expressive white Spider-Man pixel eyes */}
    <rect x="5" y="4" width="2" height="2" fill="#FFFFFF" />
    <rect x="9" y="4" width="2" height="2" fill="#FFFFFF" />
    {/* Tiny bottom legs */}
    <rect x="4" y="11" width="2" height="2" fill="#EF4444" />
    <rect x="7" y="11" width="2" height="2" fill="#2563EB" />
    <rect x="10" y="11" width="2" height="2" fill="#EF4444" />
  </svg>
);

interface SpideyClawdMascotProps {
  swingControls: ReturnType<typeof useAnimationControls>;
  sparkSeq: number;
}

/**
 * Blocky Clawd-style pixel spider mascot dressed in Spider-Man red & blue,
 * dangling on a silk strand and swinging dynamically between hovered subjects.
 */
const SpideyClawdMascot: React.FC<SpideyClawdMascotProps> = ({
  swingControls,
  sparkSeq,
}) => (
  <div className="relative flex items-center justify-center">
    {/* Silk web thread connecting up to the dropdown top seam */}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-[calc(100%-3px)] left-1/2 h-[240px] w-[1.5px] -translate-x-1/2 bg-[#94A3B8] dark:bg-[#CBD5E1]"
    />
    {/* Tiny silk anchor knot at crown of head */}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-1 left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-[#18181B] bg-[#FFFFFF]"
    />

    {/* Tiny THWIP pixel web sparks on jump */}
    {sparkSeq > 0 && (
      <motion.svg
        key={`spidey-spark-${sparkSeq}`}
        viewBox="0 0 28 24"
        aria-hidden="true"
        initial={{ opacity: 0.95, scale: 0.7 }}
        animate={{ opacity: 0, scale: 1.35 }}
        transition={{ duration: 0.34, ease: 'easeOut' }}
        className="pointer-events-none absolute -inset-1.5 z-0 h-9 w-10 overflow-visible"
      >
        <rect x="2" y="1" width="2.5" height="2.5" fill="#FDE047" />
        <rect x="23" y="2" width="2.5" height="2.5" fill="#FFFFFF" />
        <rect x="0" y="18" width="2.5" height="2.5" fill="#FFFFFF" />
        <rect x="25" y="17" width="2.5" height="2.5" fill="#38BDF8" />
      </motion.svg>
    )}

    {/* Pendulum swing impulse wrapper */}
    <motion.div
      animate={swingControls}
      style={{ transformOrigin: '50% -10px' }}
      className="relative z-10"
    >
      {/* Gentle continuous idle rock while hanging from web (GPU CSS loop) */}
      <div
        style={{ transformOrigin: '50% -8px' }}
        className="spidey-pendulum-rock"
      >
        <svg
          viewBox="0 0 28 24"
          aria-hidden="true"
          className="h-6 w-7 overflow-visible"
        >
          {/* Left & right side Clawd-spider arms waving alternately */}
          <g className="spidey-arm-idle">
            <rect x="0" y="9" width="3" height="2" fill="#18181B" />
            <rect x="1" y="11" width="3" height="3" fill="#2563EB" />
            <rect x="25" y="9" width="3" height="2" fill="#18181B" />
            <rect x="24" y="11" width="3" height="3" fill="#2563EB" />
          </g>

          {/* Outer manga ink pixel shell */}
          <rect x="4" y="2" width="20" height="15" rx="2" fill="#18181B" />

          {/* Spider-Man Crimson Red top head & cel-shaded rim */}
          <rect x="6" y="4" width="16" height="8" fill="#EF4444" />
          <rect x="20" y="4" width="2" height="8" fill="#DC2626" />
          {/* Tiny pixel mask web pattern */}
          <rect x="13" y="4" width="2" height="2" fill="#991B1B" />
          <rect x="9" y="4" width="1.5" height="1.5" fill="#B91C1C" />
          <rect x="17.5" y="4" width="1.5" height="1.5" fill="#B91C1C" />

          {/* Cobalt Blue lower torso suit + pixel belt */}
          <rect x="6" y="12" width="16" height="3" fill="#2563EB" />
          <rect x="20" y="12" width="2" height="3" fill="#1D4ED8" />
          <rect x="12" y="11" width="4" height="2" fill="#18181B" />
          <rect x="13" y="11.5" width="2" height="1.2" fill="#EF4444" />

          {/* Blinking expressive white Spider-Man pixel eyes */}
          <g className="spidey-eye-blink">
            {/* Left eye */}
            <rect x="7" y="6" width="5" height="4" fill="#18181B" />
            <rect x="7.8" y="6.8" width="3.4" height="2.4" fill="#FFFFFF" />
            <rect x="10" y="7" width="1.2" height="2.2" fill="#FFFFFF" />
            {/* Right eye */}
            <rect x="16" y="6" width="5" height="4" fill="#18181B" />
            <rect x="16.8" y="6.8" width="3.4" height="2.4" fill="#FFFFFF" />
            <rect x="16.8" y="7" width="1.2" height="2.2" fill="#FFFFFF" />
          </g>

          {/* 4 stubby Clawd pixel spider legs kicking in pairs */}
          <g className="spidey-leg-a-idle">
            <rect x="5" y="17" width="3" height="4" fill="#18181B" />
            <rect x="5.5" y="17" width="2" height="3.2" fill="#EF4444" />
            <rect x="15" y="17" width="3" height="4" fill="#18181B" />
            <rect x="15.5" y="17" width="2" height="3.2" fill="#2563EB" />
          </g>
          <g className="spidey-leg-b-idle">
            <rect x="10" y="17" width="3" height="4" fill="#18181B" />
            <rect x="10.5" y="17" width="2" height="3.2" fill="#2563EB" />
            <rect x="20" y="17" width="3" height="4" fill="#18181B" />
            <rect x="20.5" y="17" width="2" height="3.2" fill="#EF4444" />
          </g>
        </svg>
      </div>
    </motion.div>
  </div>
);

const SakugaSubjectDropdownComponent: React.FC<SakugaSubjectDropdownProps> = ({
  subject,
  tier,
  progress,
  onSelectSubject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedSubject, setFocusedSubject] = useState<SubjectId>(subject);
  const [glintState, setGlintState] = useState<{ seq: number; active: boolean }>({
    seq: 0,
    active: false,
  });
  const [sparkSeq, setSparkSeq] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Partial<Record<SubjectId, HTMLButtonElement | null>>>({});
  const prevFocusedRef = useRef<SubjectId>(subject);
  const swingControls = useAnimationControls();

  const activeSpec = SUBJECT_SPEC_MAP[subject] ?? SUBJECT_DROPDOWN_ITEMS[0];

  const statsBySubject = useMemo(() => {
    if (!isOpen) return null;
    const map = {} as Record<SubjectId, { mastered: number; total: number }>;
    for (const item of SUBJECT_DROPDOWN_ITEMS) {
      map[item.id] = {
        mastered: countSubjectMastered(item.id, tier, progress.questions),
        total: getSubjectTotalCount(item.id, tier),
      };
    }
    return map;
  }, [isOpen, progress.questions, tier]);

  useEffect(() => {
    setFocusedSubject(subject);
  }, [subject]);

  useEffect(() => {
    if (!glintState.active) return;
    const timer = window.setTimeout(() => {
      setGlintState((prev) => ({ ...prev, active: false }));
    }, 460);
    return () => window.clearTimeout(timer);
  }, [glintState.active, glintState.seq]);

  // Pendulum swing impulse on Spidey-Clawd whenever pointer or keyboard shifts rows
  useEffect(() => {
    if (!isOpen) {
      prevFocusedRef.current = focusedSubject;
      return;
    }
    if (prevFocusedRef.current === focusedSubject) return;

    const prevIdx = SUBJECT_DROPDOWN_ITEMS.findIndex((x) => x.id === prevFocusedRef.current);
    const nextIdx = SUBJECT_DROPDOWN_ITEMS.findIndex((x) => x.id === focusedSubject);
    prevFocusedRef.current = focusedSubject;

    const dir = nextIdx >= prevIdx ? 1 : -1;
    setSparkSeq((s) => s + 1);
    void swingControls.start({
      rotate: dir > 0 ? [0, -22, 13, -5, 0] : [0, 22, -13, 5, 0],
      scaleY: [1, 1.12, 0.91, 1.03, 1],
      scaleX: [1, 0.9, 1.09, 0.98, 1],
      transition: { duration: 0.46, times: [0, 0.25, 0.56, 0.82, 1], ease: [0.22, 1, 0.36, 1] },
    });
  }, [focusedSubject, isOpen, swingControls]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const curIdx = SUBJECT_DROPDOWN_ITEMS.findIndex((x) => x.id === focusedSubject);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const nextIdx =
          (curIdx + delta + SUBJECT_DROPDOWN_ITEMS.length) % SUBJECT_DROPDOWN_ITEMS.length;
        const nextId = SUBJECT_DROPDOWN_ITEMS[nextIdx].id;
        setFocusedSubject(nextId);
        optionRefs.current[nextId]?.focus();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedSubject, isOpen]);

  const handleChoose = (nextId: SubjectId) => {
    setIsOpen(false);
    setGlintState((prev) => ({ seq: prev.seq + 1, active: true }));
    onSelectSubject(nextId);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className="relative inline-flex shrink-0">
      {/* Friendly Cel-Shaded Subject Cartridge Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setFocusedSubject(subject);
          prevFocusedRef.current = subject;
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Chọn môn học (đang chọn ${SUBJECTS[subject].code})`}
        title={`${SUBJECTS[subject].code} • ${SUBJECTS[subject].name}`}
        className={`sakuga-btn group relative inline-flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-xl border-2 px-2 py-1 text-[11px] font-black tracking-wide whitespace-nowrap transition-colors duration-150 focus-visible:outline-none sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-xs ${activeSpec.triggerClass}`}
      >
        {/* Soft Anime Glint Sheen Sweep BEHIND text (`z-[1]`) and cleanly unmounted after 460ms */}
        {glintState.active && (
          <motion.span
            key={`subject-glint-${glintState.seq}`}
            aria-hidden="true"
            initial={{ x: '-115%', opacity: 0.95 }}
            animate={{ x: '115%', opacity: 0 }}
            transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-[1] flex items-stretch overflow-hidden"
          >
            <span className="h-full w-6 -skew-x-[24deg] bg-white/30" />
            <span className="ml-1 h-full w-1.5 -skew-x-[24deg] bg-[#FEF08A]/45" />
          </motion.span>
        )}

        {/* Cute mini Spider-Man spider pip */}
        <motion.span
          aria-hidden="true"
          animate={{ rotate: isOpen ? -12 : 0, scale: isOpen ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          className="relative z-10 hidden shrink-0 min-[390px]:inline-flex"
        >
          <MiniTriggerSpider />
        </motion.span>

        {/* Slot-drum vertical code reel */}
        <span className="relative z-10 inline-flex h-[18px] items-center overflow-hidden sm:h-[20px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={subject}
              initial={{ y: -15, opacity: 0, skewX: -12 }}
              animate={{ y: 0, opacity: 1, skewX: 0 }}
              exit={{ y: 15, opacity: 0, skewX: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="inline-flex items-center gap-1 italic"
            >
              <span className="sm:hidden">{activeSpec.shortCode}</span>
              <span className="hidden sm:inline">{activeSpec.fullCode}</span>
            </motion.span>
          </AnimatePresence>
        </span>

        {/* Mechanical rotating shutter chevron */}
        <motion.span
          aria-hidden="true"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 440, damping: 22 }}
          className="relative z-10 inline-flex shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5 stroke-[2.75]" />
        </motion.span>
      </button>

      {/* Manga Shutter Unfurl Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="subject-shutter-menu"
            role="listbox"
            aria-label="Danh sách môn học"
            aria-activedescendant={`subject-opt-${focusedSubject}`}
            initial={{
              opacity: 0,
              y: -8,
              clipPath: 'inset(0% 0% 100% 0% round 14px)',
            }}
            animate={{
              opacity: 1,
              y: 0,
              clipPath: 'inset(0% 0% 0% 0% round 14px)',
            }}
            exit={{
              opacity: 0,
              y: -6,
              clipPath: 'inset(0% 0% 100% 0% round 14px)',
            }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -left-[104px] top-[calc(100%+8px)] z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border-2 border-[#27272A] bg-[#FAF9F5] shadow-[5px_5px_0_0_#27272A] dark:border-[#52525B] dark:bg-[#161816] dark:shadow-[5px_5px_0_0_#000000] sm:left-0"
          >
            {/* Clean Header Bar (z-20 so Spidey-Clawd's vertical web strand tucks neatly under this seam) */}
            <div className="relative z-20 flex items-center justify-between border-b-2 border-[#27272A]/85 bg-[#EAE6DD] px-3.5 py-2 dark:border-[#323833] dark:bg-[#1E221F]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#EF4444] dark:text-[#FCA5A5]" />
                <span className="text-xs font-extrabold tracking-tight text-[#18181B] dark:text-[#F5F5F4]">
                  Chọn môn học
                </span>
              </div>

              {/* Flat 2-color Anime Speed-Hash Accent (ZERO gradient) */}
              <svg
                viewBox="0 0 24 10"
                aria-hidden="true"
                className="h-2.5 w-6 shrink-0"
              >
                <polygon points="0,10 6,0 11,0 5,10" fill="#EA580C" />
                <polygon points="12,10 18,0 23,0 17,10" fill="#0284C7" />
              </svg>
            </div>

            {/* Staggered Manga Panel Cards + Swinging Spidey-Clawd Mascot Lane */}
            <div className="relative space-y-1.5 overflow-hidden p-2">
              {SUBJECT_DROPDOWN_ITEMS.map((item, idx) => {
                const isSelected = subject === item.id;
                const isTargeted = focusedSubject === item.id;
                const stats = statsBySubject?.[item.id] ?? { mastered: 0, total: 0 };
                const chapterCount = SUBJECTS[item.id].chapters.length;

                return (
                  <motion.button
                    key={item.id}
                    id={`subject-opt-${item.id}`}
                    ref={(el) => {
                      optionRefs.current[item.id] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setFocusedSubject(item.id)}
                    onFocus={() => setFocusedSubject(item.id)}
                    onClick={() => handleChoose(item.id)}
                    initial={{ opacity: 0, x: -18, skewX: -5 }}
                    animate={{ opacity: 1, x: 0, skewX: 0 }}
                    transition={{
                      delay: 0.04 + idx * 0.045,
                      type: 'spring',
                      stiffness: 420,
                      damping: 26,
                    }}
                    className={`relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 py-2 pl-2.5 pr-11 text-left transition-colors duration-150 focus-visible:outline-none ${
                      isSelected
                        ? item.activeRowClass
                        : 'border-[#D5CFC2] bg-[#FFFFFF] text-[#292524] hover:border-[#27272A]/60 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#71717A]'
                    }`}
                  >
                    {/* Sliding Border Frame Tracking Pointer / Focus (`layoutId`) */}
                    {isTargeted && (
                      <motion.span
                        layoutId="sakuga-subject-reticle"
                        transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                        aria-hidden="true"
                        className={`pointer-events-none absolute -inset-[2px] z-10 rounded-xl border-2 ${item.reticleClass}`}
                      />
                    )}

                    {/* Left: Angled Subject Badge + Clean Name & Chapters */}
                    <div className="relative z-10 flex min-w-0 items-center gap-2.5">
                      <span
                        className={`inline-flex shrink-0 -skew-x-12 items-center justify-center rounded-md border-2 px-2 py-0.5 text-[11px] font-black italic tracking-wider ${item.badgeClass}`}
                      >
                        <span className="skew-x-12">{item.fullCode}</span>
                      </span>

                      <div className="min-w-0">
                        <span className="flex items-center gap-1 text-xs font-extrabold text-[#18181B] dark:text-[#F5F5F4]">
                          <span className="truncate">{item.subtitle}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 stroke-[3]" />
                          )}
                        </span>
                        <span className="block text-[11px] font-semibold text-[#656058] dark:text-[#9CA39B]">
                          {chapterCount} phần
                        </span>
                      </div>
                    </div>

                    {/* Right-Middle: Progress Counter */}
                    <span
                      className={`relative z-10 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-bold tabular-nums ${item.countPillClass}`}
                    >
                      {stats.mastered}/{stats.total}
                    </span>

                    {/* Far-Right Lane: Spidey-Clawd Swinging Along Hover Target */}
                    {isTargeted && (
                      <motion.div
                        layoutId="sakuga-spidey-clawd"
                        layout="position"
                        transition={{
                          type: 'spring',
                          stiffness: 360,
                          damping: 24,
                          mass: 0.85,
                        }}
                        aria-hidden="true"
                        className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2"
                      >
                        <SpideyClawdMascot
                          swingControls={swingControls}
                          sparkSeq={sparkSeq}
                        />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SakugaSubjectDropdown = memo(SakugaSubjectDropdownComponent);
SakugaSubjectDropdown.displayName = 'SakugaSubjectDropdown';
