import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StudyTier } from '../types/quiz';

export type SakugaVariant = 'nice' | 'clear' | 'complete' | 'miss' | 'ok';

export interface SakugaEvent {
  id: number;
  variant: SakugaVariant;
  label?: string;
}

interface SakugaBurstProps {
  event: SakugaEvent | null;
  className?: string;
}

interface SakugaThemeTokens {
  defaultLabel: string;
  plateClass: string;
  accentFill: string;
  smokeTint: string;
  sparkleFill: string;
  durationMs: number;
}

const VARIANT_CONFIG: Record<SakugaVariant, SakugaThemeTokens> = {
  nice: {
    defaultLabel: 'NICE!',
    plateClass:
      'border-[#1E1B4B] bg-[#FEF3C7] text-[#92400E] shadow-[3px_3px_0_0_#F59E0B] dark:border-[#FDE68A] dark:bg-[#92400E] dark:text-[#FEF3C7] dark:shadow-[3px_3px_0_0_#F59E0B]',
    accentFill: '#F59E0B',
    smokeTint: '#FDE68A',
    sparkleFill: '#F59E0B',
    durationMs: 880,
  },
  clear: {
    defaultLabel: 'CLEAR! ✓',
    plateClass:
      'border-[#064E3B] bg-[#D1FAE5] text-[#065F46] shadow-[3px_3px_0_0_#34D399] dark:border-[#6EE7B7] dark:bg-[#065F46] dark:text-[#ECFDF5] dark:shadow-[3px_3px_0_0_#10B981]',
    accentFill: '#10B981',
    smokeTint: '#A7F3D0',
    sparkleFill: '#059669',
    durationMs: 960,
  },
  complete: {
    defaultLabel: 'COMPLETE! ✓',
    plateClass:
      'border-[#064E3B] bg-[#10B981] text-white shadow-[4px_4px_0_0_#A7F3D0] dark:border-[#A7F3D0] dark:bg-[#059669] dark:text-[#ECFDF5] dark:shadow-[4px_4px_0_0_#064E3B]',
    accentFill: '#10B981',
    smokeTint: '#A7F3D0',
    sparkleFill: '#34D399',
    durationMs: 1200,
  },
  miss: {
    defaultLabel: 'MISS!',
    plateClass:
      'border-[#881337] bg-[#FFE4E6] text-[#BE123C] shadow-[3px_3px_0_0_#FB7185] dark:border-[#FDA4AF] dark:bg-[#881337] dark:text-[#FFE4E6] dark:shadow-[3px_3px_0_0_#E11D48]',
    accentFill: '#E11D48',
    smokeTint: '#FECDD3',
    sparkleFill: '#FB7185',
    durationMs: 860,
  },
  ok: {
    defaultLabel: 'OK!',
    plateClass:
      'border-[#1E1B4B] bg-[#EEF2FF] text-[#4338CA] shadow-[3px_3px_0_0_#A5B4FC] dark:border-[#A5B4FC] dark:bg-[#312E81] dark:text-[#EEF2FF] dark:shadow-[3px_3px_0_0_#6366F1]',
    accentFill: '#4338CA',
    smokeTint: '#C7D2FE',
    sparkleFill: '#6366F1',
    durationMs: 760,
  },
};

interface SakugaParticlesProps {
  isMiss: boolean;
  showShards: boolean;
  accentFill: string;
  smokeTint: string;
  sparkleFill: string;
  className: string;
}

const SakugaParticles: React.FC<SakugaParticlesProps> = ({
  isMiss,
  showShards,
  accentFill,
  smokeTint,
  sparkleFill,
  className,
}) => (
  <svg viewBox="0 0 140 72" aria-hidden="true" className={className}>
    {isMiss ? (
      <>
        <motion.path
          d="M22 54 L118 14"
          stroke={accentFill}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="110"
          initial={{ strokeDashoffset: 110, opacity: 0.95 }}
          animate={{ strokeDashoffset: 0, opacity: 0 }}
          transition={{ duration: 0.58, ease: 'easeOut' }}
        />
        <motion.path
          d="M32 60 L108 26"
          stroke="#1E1B4B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="90"
          initial={{ strokeDashoffset: 90, opacity: 0.85 }}
          animate={{ strokeDashoffset: 0, opacity: 0 }}
          transition={{ duration: 0.64, delay: 0.06, ease: 'easeOut' }}
        />
      </>
    ) : (
      <>
        <motion.g
          initial={{ scale: 0.5, opacity: 0.95, x: 0, y: 0 }}
          animate={{ scale: 1.15, opacity: 0, x: -13, y: -6 }}
          transition={{ duration: 0.78, ease: 'easeOut' }}
          style={{ originX: '28px', originY: '36px' }}
        >
          <circle cx="24" cy="38" r="8" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="2" />
          <circle cx="32" cy="33" r="6" fill={smokeTint} stroke="#1E1B4B" strokeWidth="2" />
        </motion.g>

        <motion.g
          initial={{ scale: 0.5, opacity: 0.95, x: 0, y: 0 }}
          animate={{ scale: 1.18, opacity: 0, x: 13, y: -5 }}
          transition={{ duration: 0.82, ease: 'easeOut' }}
          style={{ originX: '112px', originY: '36px' }}
        >
          <circle cx="114" cy="36" r="7.5" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="2" />
          <circle cx="106" cy="41" r="5.5" fill={smokeTint} stroke="#1E1B4B" strokeWidth="2" />
        </motion.g>

        <motion.path
          d="M16 14 L19 21 L26 24 L19 27 L16 34 L13 27 L6 24 L13 21 Z"
          fill="#FFFFFF"
          stroke="#1E1B4B"
          strokeWidth="1.8"
          initial={{ scale: 0, rotate: -15, opacity: 1 }}
          animate={{ scale: 1, rotate: 12, opacity: 0 }}
          transition={{ duration: 0.72, ease: 'easeOut' }}
        />
        <motion.path
          d="M122 10 L124.5 16 L130.5 18.5 L124.5 21 L122 27 L119.5 21 L113.5 18.5 L119.5 16 Z"
          fill={sparkleFill}
          stroke="#1E1B4B"
          strokeWidth="1.6"
          initial={{ scale: 0, rotate: 15, opacity: 1 }}
          animate={{ scale: 1.08, rotate: -10, opacity: 0 }}
          transition={{ duration: 0.78, delay: 0.06, ease: 'easeOut' }}
        />
      </>
    )}

    {showShards && (
      <>
        <motion.polygon
          points="48,6 54,12 48,18 42,12"
          fill={smokeTint}
          stroke="#1E1B4B"
          strokeWidth="1.6"
          initial={{ y: 12, opacity: 1, scale: 0.6 }}
          animate={{ y: -15, opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.84, ease: 'easeOut' }}
        />
        <motion.polygon
          points="92,4 97,10 92,16 87,10"
          fill="#FFFFFF"
          stroke="#1E1B4B"
          strokeWidth="1.6"
          initial={{ y: 14, opacity: 1, scale: 0.6 }}
          animate={{ y: -17, opacity: 0, scale: 1.08 }}
          transition={{ duration: 0.88, delay: 0.06, ease: 'easeOut' }}
        />
      </>
    )}
  </svg>
);

export const SakugaBurst: React.FC<SakugaBurstProps> = ({ event, className = '' }) => {
  const [activeEvent, setActiveEvent] = useState<SakugaEvent | null>(null);

  useEffect(() => {
    if (!event) {
      setActiveEvent(null);
      return;
    }

    setActiveEvent(event);
    const cfg = VARIANT_CONFIG[event.variant];
    const timer = window.setTimeout(() => {
      setActiveEvent(prev => (prev?.id === event.id ? null : prev));
    }, cfg.durationMs);

    return () => window.clearTimeout(timer);
  }, [event]);

  const cfg = activeEvent ? VARIANT_CONFIG[activeEvent.variant] : null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-visible ${className}`}
    >
      <AnimatePresence mode="wait">
        {activeEvent && cfg && (
          <motion.div
            key={activeEvent.id}
            initial={{ opacity: 0, scale: 0.7, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 460, damping: 22 }}
            className="relative inline-flex items-center justify-center"
          >
            <SakugaParticles
              isMiss={activeEvent.variant === 'miss'}
              showShards={
                activeEvent.variant === 'clear' || activeEvent.variant === 'complete'
              }
              accentFill={cfg.accentFill}
              smokeTint={cfg.smokeTint}
              sparkleFill={cfg.sparkleFill}
              className="absolute -inset-x-7 -inset-y-4 h-[72px] w-[140px] overflow-visible"
            />

            <motion.span
              initial={{ scaleX: 1.18, scaleY: 0.84 }}
              animate={{ scaleX: 1, scaleY: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 17 }}
              className={`relative z-10 inline-block -skew-x-12 rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider whitespace-nowrap sm:text-xs ${cfg.plateClass}`}
            >
              {activeEvent.label ?? cfg.defaultLabel}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface SakugaMangaTagProps {
  label: string;
  tone?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'fuchsia';
  className?: string;
  animateBurst?: boolean;
}

const TONE_MAP: Record<
  NonNullable<SakugaMangaTagProps['tone']>,
  {
    plateClass: string;
    accentFill: string;
    smokeTint: string;
    sparkleFill: string;
  }
> = {
  emerald: {
    plateClass:
      'border-[#064E3B] bg-[#D1FAE5] text-[#065F46] shadow-[2px_2px_0_0_#6EE7B7] dark:border-[#6EE7B7] dark:bg-[#065F46] dark:text-[#ECFDF5] dark:shadow-[2px_2px_0_0_#059669]',
    accentFill: '#10B981',
    smokeTint: '#A7F3D0',
    sparkleFill: '#34D399',
  },
  indigo: {
    plateClass:
      'border-[#1E1B4B] bg-[#EEF2FF] text-[#3730A3] shadow-[2px_2px_0_0_#C7D2FE] dark:border-[#A5B4FC] dark:bg-[#312E81] dark:text-[#EEF2FF] dark:shadow-[2px_2px_0_0_#4338CA]',
    accentFill: '#4338CA',
    smokeTint: '#C7D2FE',
    sparkleFill: '#6366F1',
  },
  amber: {
    plateClass:
      'border-[#78350F] bg-[#FEF3C7] text-[#92400E] shadow-[2px_2px_0_0_#FCD34D] dark:border-[#FDE68A] dark:bg-[#92400E] dark:text-[#FEF3C7] dark:shadow-[2px_2px_0_0_#D97706]',
    accentFill: '#F59E0B',
    smokeTint: '#FDE68A',
    sparkleFill: '#F59E0B',
  },
  rose: {
    plateClass:
      'border-[#881337] bg-[#FFE4E6] text-[#BE123C] shadow-[2px_2px_0_0_#FDA4AF] dark:border-[#FDA4AF] dark:bg-[#881337] dark:text-[#FFE4E6] dark:shadow-[2px_2px_0_0_#E11D48]',
    accentFill: '#E11D48',
    smokeTint: '#FECDD3',
    sparkleFill: '#FB7185',
  },
  fuchsia: {
    plateClass:
      'border-[#701A75] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#F5D0FE] dark:bg-[#701A75] dark:text-[#FAE8FF] dark:shadow-[2px_2px_0_0_#C026D3]',
    accentFill: '#D946EF',
    smokeTint: '#F5D0FE',
    sparkleFill: '#E879F9',
  },
};

export const SakugaMangaTag: React.FC<SakugaMangaTagProps> = ({
  label,
  tone = 'emerald',
  className = '',
  animateBurst = true,
}) => {
  const toneCfg = TONE_MAP[tone];

  return (
    <span className={`relative inline-flex items-center justify-center overflow-visible ${className}`}>
      {animateBurst && (
        <SakugaParticles
          isMiss={tone === 'rose'}
          showShards={tone === 'emerald'}
          accentFill={toneCfg.accentFill}
          smokeTint={toneCfg.smokeTint}
          sparkleFill={toneCfg.sparkleFill}
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[72px] w-[140px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
        />
      )}
      <motion.span
        initial={
          animateBurst
            ? { y: -15, scaleX: 1.24, scaleY: 0.82, rotate: -6 }
            : false
        }
        animate={{ y: 0, scaleX: 1, scaleY: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 16, mass: 1.05 }}
        className="relative z-10 inline-flex"
      >
        <span
          className={`inline-flex -skew-x-12 items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider whitespace-nowrap ${toneCfg.plateClass}`}
        >
          <span className="skew-x-12">{label}</span>
        </span>
      </motion.span>
    </span>
  );
};

interface ColorStop {
  pct: number;
  rgb: readonly [number, number, number];
}

const YELLOW_PROGRESS_STOPS: readonly ColorStop[] = [
  { pct: 0, rgb: [253, 230, 138] }, // #FDE68A
  { pct: 16, rgb: [253, 224, 71] }, // #FDE047
  { pct: 33, rgb: [250, 204, 21] }, // #FACC15
  { pct: 49, rgb: [234, 179, 8] },  // #EAB308
];

const GREEN_PROGRESS_STOPS: readonly ColorStop[] = [
  { pct: 50, rgb: [134, 239, 172] }, // #86EFAC
  { pct: 67, rgb: [74, 222, 128] },  // #4ADE80
  { pct: 84, rgb: [16, 185, 129] },  // #10B981
  { pct: 100, rgb: [5, 150, 105] },  // #059669
];

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

function interpolateStops(stops: readonly ColorStop[], value: number): string {
  if (value <= stops[0].pct) {
    const [r, g, b] = stops[0].rgb;
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  }
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    if (value <= next.pct) {
      const span = Math.max(1, next.pct - prev.pct);
      const t = (value - prev.pct) / span;
      const r = prev.rgb[0] + (next.rgb[0] - prev.rgb[0]) * t;
      const g = prev.rgb[1] + (next.rgb[1] - prev.rgb[1]) * t;
      const b = prev.rgb[2] + (next.rgb[2] - prev.rgb[2]) * t;
      return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    }
  }
  const [r, g, b] = stops[stops.length - 1].rgb;
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/**
 * Returns a flat solid hex color shifted incrementally with each 1% change:
 * Yellow range (#FDE68A -> #EAB308) below 50%, switching to Green (#86EFAC -> #059669) at >= 50%.
 */
export function getSakugaProgressColor(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  if (clamped < 50) {
    return interpolateStops(YELLOW_PROGRESS_STOPS, clamped);
  }
  return interpolateStops(GREEN_PROGRESS_STOPS, clamped);
}

export { SakugaBorderFire } from './SakugaBorderFire';
export type { SakugaBorderFireProps } from './SakugaBorderFire';

export interface SakugaProgressBarProps {
  percent: number;
  className?: string;
}

export const SakugaProgressBar: React.FC<SakugaProgressBarProps> = ({
  percent,
  className = 'h-2 w-full',
}) => {
  const clampedPct = Math.max(0, Math.min(100, percent));
  const fillColor = getSakugaProgressColor(clampedPct);
  const isMax = clampedPct >= 100;

  return (
    <div className={`relative overflow-visible ${className}`}>
      <div
        className={`sakuga-progress-track relative h-full w-full overflow-hidden rounded-full bg-[#D5CFC2] transition-shadow duration-300 dark:bg-[#0F100E] ${
          isMax
            ? 'ring-2 ring-[#34D399] shadow-[0_0_14px_rgba(16,185,129,0.65),0_0_5px_rgba(250,204,21,0.55)] dark:ring-[#6EE7B7] dark:shadow-[0_0_16px_rgba(52,211,153,0.75),0_0_6px_rgba(250,204,21,0.55)]'
            : ''
        }`}
      >
        <div
          className="sakuga-progress-fill relative h-full overflow-hidden rounded-full transition-all duration-300"
          style={{ width: `${clampedPct}%`, backgroundColor: fillColor }}
        >
          {isMax && (
            <span
              aria-hidden="true"
              className="sakuga-bar-radiant-sweep pointer-events-none absolute inset-y-0 left-0 flex w-7 items-stretch gap-1"
            >
              <span className="h-full w-3 bg-[#FEF9C3]/75" />
              <span className="h-full w-1.5 bg-white/85" />
            </span>
          )}
        </div>
      </div>

      {/* Radiant 100% 4-point anime star sparkles along the bar */}
      {isMax && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-visible">
          <svg
            viewBox="0 0 16 16"
            className="sakuga-flame-star absolute -top-2 left-[18%] h-3 w-3 -translate-x-1/2"
          >
            <path
              d="M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3 Z"
              fill="#FEF08A"
              stroke="#18181B"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          <svg
            viewBox="0 0 16 16"
            style={{ animationDelay: '220ms' }}
            className="sakuga-flame-star absolute -bottom-2 left-[54%] h-3.5 w-3.5 -translate-x-1/2"
          >
            <path
              d="M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3 Z"
              fill="#A7F3D0"
              stroke="#064E3B"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          <svg
            viewBox="0 0 16 16"
            style={{ animationDelay: '440ms' }}
            className="sakuga-flame-star absolute -top-2 right-0 h-3.5 w-3.5 translate-x-1/3"
          >
            <path
              d="M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3 Z"
              fill="#FEF08A"
              stroke="#18181B"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

interface TierStampConfig {
  id: StudyTier;
  label: string;
  hint: string;
  activeClass: string;
  inactiveClass: string;
  accentFill: string;
  smokeTint: string;
  sparkleFill: string;
  showShards: boolean;
}

const STUDY_TIER_ITEMS: readonly TierStampConfig[] = [
  {
    id: 'lazymax',
    label: 'LAZY MAX',
    hint: 'Siêu lười • Rút gọn >60% câu cốt lõi',
    activeClass:
      'border-[#064E3B] bg-[#D1FAE5] text-[#065F46] shadow-[2px_2px_0_0_#10B981] dark:border-[#6EE7B7] dark:bg-[#065F46] dark:text-[#ECFDF5] dark:shadow-[2px_2px_0_0_#10B981]',
    inactiveClass:
      'border-[#C6BEB0] bg-[#FAF9F5] text-[#656058] hover:border-[#059669] hover:bg-[#ECFDF5] hover:text-[#065F46] dark:border-[#323833] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#34D399] dark:hover:bg-[#064E3B]/50 dark:hover:text-[#ECFDF5]',
    accentFill: '#10B981',
    smokeTint: '#A7F3D0',
    sparkleFill: '#34D399',
    showShards: true,
  },
  {
    id: 'lazy',
    label: 'LAZY',
    hint: 'Khá lười • Nắm chắc kiến thức trọng tâm',
    activeClass:
      'border-[#78350F] bg-[#FEF3C7] text-[#92400E] shadow-[2px_2px_0_0_#F59E0B] dark:border-[#FDE68A] dark:bg-[#92400E] dark:text-[#FEF3C7] dark:shadow-[2px_2px_0_0_#D97706]',
    inactiveClass:
      'border-[#C6BEB0] bg-[#FAF9F5] text-[#656058] hover:border-[#D97706] hover:bg-[#FEF3C7]/70 hover:text-[#92400E] dark:border-[#323833] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#FBBF24] dark:hover:bg-[#78350F]/45 dark:hover:text-[#FEF3C7]',
    accentFill: '#F59E0B',
    smokeTint: '#FDE68A',
    sparkleFill: '#F59E0B',
    showShards: false,
  },
  {
    id: 'hardcore',
    label: 'HARDCORE',
    hint: 'Cày full 100% toàn bộ câu hỏi',
    activeClass:
      'border-[#881337] bg-[#FFE4E6] text-[#BE123C] shadow-[2px_2px_0_0_#E11D48] dark:border-[#FDA4AF] dark:bg-[#881337] dark:text-[#FFE4E6] dark:shadow-[2px_2px_0_0_#E11D48]',
    inactiveClass:
      'border-[#C6BEB0] bg-[#FAF9F5] text-[#656058] hover:border-[#E11D48] hover:bg-[#FFE4E6]/70 hover:text-[#BE123C] dark:border-[#323833] dark:bg-[#1C1F1C] dark:text-[#9CA39B] dark:hover:border-[#FB7185] dark:hover:bg-[#881337]/45 dark:hover:text-[#FFE4E6]',
    accentFill: '#E11D48',
    smokeTint: '#FECDD3',
    sparkleFill: '#FB7185',
    showShards: true,
  },
];

export interface SakugaTierPickerProps {
  tier: StudyTier;
  onSelectTier: (tier: StudyTier) => void;
  compact?: boolean;
}

export const SakugaTierPicker: React.FC<SakugaTierPickerProps> = ({
  tier,
  onSelectTier,
  compact = false,
}) => {
  const [burst, setBurst] = useState<{ tier: StudyTier; seq: number } | null>(null);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 680);
    return () => window.clearTimeout(timer);
  }, [burst]);

  return (
    <div
      role="group"
      aria-label="Chọn mức độ ôn tập"
      className={
        compact
          ? 'grid w-full grid-cols-3 gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#F4F2EC] p-1 dark:border-[#262925] dark:bg-[#0F100E]'
          : 'inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#F4F2EC] p-1 dark:border-[#262925] dark:bg-[#0F100E] xl:gap-1.5'
      }
    >
      {STUDY_TIER_ITEMS.map((item) => {
        const isActive = tier === item.id;
        const isBursting = burst?.tier === item.id;

        return (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            aria-pressed={isActive}
            onClick={() => {
              onSelectTier(item.id);
              setBurst((prev) => ({ tier: item.id, seq: (prev?.seq ?? 0) + 1 }));
            }}
            className={`relative inline-flex cursor-pointer items-center justify-center overflow-visible focus-visible:outline-none ${
              compact ? 'w-full' : ''
            }`}
          >
            {isBursting && burst && (
              <SakugaParticles
                key={`tier-particles-${item.id}-${burst.seq}`}
                isMiss={false}
                showShards={item.showShards}
                accentFill={item.accentFill}
                smokeTint={item.smokeTint}
                sparkleFill={item.sparkleFill}
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[66px] w-[126px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
              />
            )}

            <motion.span
              key={isBursting && burst ? `stamp-${item.id}-${burst.seq}` : `stamp-${item.id}`}
              initial={
                isBursting
                  ? { y: -7, scaleX: 1.2, scaleY: 0.82, rotate: -4 }
                  : false
              }
              animate={{ y: 0, scaleX: 1, scaleY: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              className={`relative z-10 inline-flex ${compact ? 'w-full' : ''}`}
            >
              <span
                className={`inline-flex -skew-x-12 items-center justify-center rounded-md border-2 font-black italic tracking-wider whitespace-nowrap transition-colors duration-150 ${
                  compact
                    ? 'w-full px-1.5 py-1 text-[10.5px]'
                    : 'px-2 py-0.5 text-[10px] xl:px-2.5 xl:text-[11px]'
                } ${isActive ? item.activeClass : item.inactiveClass}`}
              >
                <span className="skew-x-12">{item.label}</span>
              </span>
            </motion.span>
          </button>
        );
      })}
    </div>
  );
};
