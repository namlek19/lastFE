import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { SUBJECTS, getQuestionsBySubject } from '../data/index';
import { StudyTier, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered } from '../utils/storage';

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
  deckNum: string;
  subtitle: string;
  accentHex: string;
  triggerClass: string;
  spineClass: string;
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
    deckNum: '01',
    subtitle: 'Lịch sử Đảng CSVN',
    accentHex: '#EA580C',
    triggerClass:
      'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FDBA74] hover:bg-[#C2410C] dark:border-[#FDBA74] dark:bg-[#EA580C] dark:text-white dark:shadow-[2px_2px_0_0_#9A3412] dark:hover:bg-[#C2410C]',
    spineClass: 'bg-[#7C2D12] dark:bg-[#FED7AA]',
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
    deckNum: '02',
    subtitle: 'CNXH Khoa học',
    accentHex: '#0284C7',
    triggerClass:
      'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] hover:bg-[#0369A1] dark:border-[#7DD3FC] dark:bg-[#0284C7] dark:text-white dark:shadow-[2px_2px_0_0_#075985] dark:hover:bg-[#0369A1]',
    spineClass: 'bg-[#0C4A6E] dark:bg-[#BAE6FD]',
    badgeClass:
      'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] dark:border-[#7DD3FC] dark:bg-[#0284C7] dark:text-white dark:shadow-[2px_2px_0_0_#075985]',
    activeRowClass:
      'border-[#0284C7] bg-[#E0F2FE] text-[#0C4A6E] dark:border-[#38BDF8] dark:bg-[#0C4A6E]/40 dark:text-[#BAE6FD]',
    reticleClass: 'border-[#0284C7] dark:border-[#38BDF8]',
    countPillClass:
      'border-[#7DD3FC] bg-[#E0F2FE] text-[#075985] dark:border-[#38BDF8]/50 dark:bg-[#075985]/50 dark:text-[#BAE6FD]',
  },
  {
    id: 'wdu203c',
    shortCode: 'WDU',
    fullCode: 'WDU203c',
    deckNum: '03',
    subtitle: 'UI/UX Design & Research',
    accentHex: '#DB2777',
    triggerClass:
      'border-[#831843] bg-[#DB2777] text-white shadow-[2px_2px_0_0_#F9A8D4] hover:bg-[#BE185D] dark:border-[#F9A8D4] dark:bg-[#DB2777] dark:text-white dark:shadow-[2px_2px_0_0_#9D174D] dark:hover:bg-[#BE185D]',
    spineClass: 'bg-[#831843] dark:bg-[#FBCFE8]',
    badgeClass:
      'border-[#831843] bg-[#DB2777] text-white shadow-[2px_2px_0_0_#F9A8D4] dark:border-[#F9A8D4] dark:bg-[#DB2777] dark:text-white dark:shadow-[2px_2px_0_0_#9D174D]',
    activeRowClass:
      'border-[#DB2777] bg-[#FCE7F3] text-[#831843] dark:border-[#F472B6] dark:bg-[#831843]/40 dark:text-[#FBCFE8]',
    reticleClass: 'border-[#DB2777] dark:border-[#F472B6]',
    countPillClass:
      'border-[#F9A8D4] bg-[#FCE7F3] text-[#9D174D] dark:border-[#F472B6]/50 dark:bg-[#9D174D]/50 dark:text-[#FBCFE8]',
  },
];

const SUBJECT_SPEC_MAP: Record<SubjectId, SubjectThemeSpec> = {
  vnr202: SUBJECT_DROPDOWN_ITEMS[0],
  mln131: SUBJECT_DROPDOWN_ITEMS[1],
  wdu203c: SUBJECT_DROPDOWN_ITEMS[2],
};

export const SakugaSubjectDropdown: React.FC<SakugaSubjectDropdownProps> = ({
  subject,
  tier,
  progress,
  onSelectSubject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedSubject, setFocusedSubject] = useState<SubjectId>(subject);
  const [switchSeq, setSwitchSeq] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Partial<Record<SubjectId, HTMLButtonElement | null>>>({});

  const activeSpec = SUBJECT_SPEC_MAP[subject];

  const statsBySubject = useMemo(() => {
    const map = {} as Record<SubjectId, { mastered: number; total: number }>;
    for (const item of SUBJECT_DROPDOWN_ITEMS) {
      const qs = getQuestionsBySubject(item.id, tier);
      let mastered = 0;
      for (const q of qs) {
        if (isMastered(progress.questions[q.id])) {
          mastered += 1;
        }
      }
      map[item.id] = { mastered, total: qs.length };
    }
    return map;
  }, [progress.questions, tier]);

  useEffect(() => {
    setFocusedSubject(subject);
  }, [subject]);

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
    setSwitchSeq((s) => s + 1);
    onSelectSubject(nextId);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className="relative inline-flex shrink-0">
      {/* Mecha Cartridge Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setFocusedSubject(subject);
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Chọn môn học (đang chọn ${SUBJECTS[subject].code})`}
        title={`${SUBJECTS[subject].code} • ${SUBJECTS[subject].name}`}
        className={`sakuga-btn group relative inline-flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-xl border-2 px-2 py-1 text-[11px] font-black tracking-wide whitespace-nowrap transition-colors duration-150 focus-visible:outline-none sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-xs ${activeSpec.triggerClass}`}
      >
        {/* Katana Diagonal Speed-Slash Wipe on subject switch (100% solid ink fill, ZERO gradient) */}
        {switchSeq > 0 && (
          <motion.span
            key={`katana-slash-${switchSeq}`}
            aria-hidden="true"
            initial={{ x: '-145%' }}
            animate={{ x: '230%' }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-y-[-8px] left-0 z-20 flex w-7 -skew-x-[28deg]"
          >
            <span className="h-full w-4 bg-white/90" />
            <span className="ml-1 h-full w-1.5 bg-[#FDE047]" />
          </motion.span>
        )}

        {/* Solid vertical cartridge notch + spinning diamond pip */}
        <span
          aria-hidden="true"
          className={`relative z-10 h-3.5 w-1 shrink-0 rounded-xs ${activeSpec.spineClass}`}
        />

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
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(308px,calc(100vw-24px))] overflow-hidden rounded-2xl border-2 border-[#27272A] bg-[#FAF9F5] shadow-[5px_5px_0_0_#27272A] dark:border-[#52525B] dark:bg-[#161816] dark:shadow-[5px_5px_0_0_#000000]"
          >
            {/* Mecha HUD Header Strip */}
            <div className="flex items-center justify-between border-b-2 border-[#27272A]/85 bg-[#EAE6DD] px-3 py-2 dark:border-[#323833] dark:bg-[#1E221F]">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#4338CA] dark:text-[#A5B4FC]" />
                <span className="font-mono text-[10px] font-extrabold tracking-widest text-[#18181B] uppercase dark:text-[#F5F5F4]">
                  SUBJECT DECK // 03
                </span>
              </div>

              {/* Flat Manga Speed-Hash Ticks (solid SVG fills, ZERO gradient) */}
              <svg
                viewBox="0 0 44 10"
                aria-hidden="true"
                className="h-2.5 w-11 shrink-0"
              >
                <polygon points="0,10 6,0 11,0 5,10" fill="#EA580C" />
                <polygon points="11,10 17,0 22,0 16,10" fill="#0284C7" />
                <polygon points="22,10 28,0 33,0 27,10" fill="#DB2777" />
                <polygon points="33,10 39,0 44,0 38,10" fill="#4338CA" />
              </svg>
            </div>

            {/* Staggered Manga Panel Cards */}
            <div className="space-y-1.5 p-2">
              {SUBJECT_DROPDOWN_ITEMS.map((item, idx) => {
                const isSelected = subject === item.id;
                const isTargeted = focusedSubject === item.id;
                const stats = statsBySubject[item.id];

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
                    className={`relative flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none ${
                      isSelected
                        ? item.activeRowClass
                        : 'border-[#D5CFC2] bg-[#FFFFFF] text-[#292524] hover:border-[#27272A]/60 dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#71717A]'
                    }`}
                  >
                    {/* Sliding Target Reticle Highlight (`layoutId`) */}
                    {isTargeted && (
                      <motion.span
                        layoutId="sakuga-subject-reticle"
                        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                        aria-hidden="true"
                        className={`pointer-events-none absolute -inset-[2px] z-10 rounded-xl border-2 ${item.reticleClass}`}
                      >
                        {/* Corner anime bracket pip */}
                        <span
                          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-xs border-2 border-[#18181B] dark:border-[#F5F5F4]"
                          style={{ backgroundColor: item.accentHex }}
                        />
                      </motion.span>
                    )}

                    <div className="relative z-10 flex min-w-0 items-center gap-2.5">
                      {/* Angled Cel-Shaded Subject Stamp */}
                      <span
                        className={`inline-flex shrink-0 -skew-x-12 items-center justify-center rounded-md border-2 px-2 py-0.5 text-[11px] font-black italic tracking-wider ${item.badgeClass}`}
                      >
                        <span className="skew-x-12">{item.fullCode}</span>
                      </span>

                      <div className="min-w-0">
                        <span className="block truncate text-xs font-extrabold text-[#18181B] dark:text-[#F5F5F4]">
                          {item.subtitle}
                        </span>
                        <span className="block font-mono text-[10px] font-semibold text-[#656058] dark:text-[#9CA39B]">
                          DECK {item.deckNum} • {SUBJECTS[item.id].chapters.length} phần
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-bold tabular-nums ${item.countPillClass}`}
                      >
                        {stats.mastered}/{stats.total}
                      </span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 stroke-[3]" />
                      )}
                    </div>
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
