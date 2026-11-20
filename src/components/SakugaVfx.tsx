import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { StudyTier, SubjectId } from '../types/quiz';

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

export interface SakugaParticlesProps {
  isMiss: boolean;
  showShards: boolean;
  accentFill: string;
  smokeTint: string;
  sparkleFill: string;
  className: string;
}

export const SakugaParticles: React.FC<SakugaParticlesProps> = ({
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
  tone?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'fuchsia' | 'pink';
  className?: string;
  animateBurst?: boolean;
}

export const TONE_MAP: Record<
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
  pink: {
    plateClass:
      'border-[#831843] bg-[#FCE7F3] text-[#BE185D] shadow-[2px_2px_0_0_#F472B6] dark:border-[#F9A8D4] dark:bg-[#831843] dark:text-[#FCE7F3] dark:shadow-[2px_2px_0_0_#EC4899]',
    accentFill: '#EC4899',
    smokeTint: '#FBCFE8',
    sparkleFill: '#F472B6',
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

interface PredictionRow {
  method: string;
  avg: string;
  range: string;
  p5: string;
  p7: string;
  p8: string;
  p9: string;
  featured?: boolean;
}

interface TierPredictionSpec {
  tier: 'lazymax' | 'lazy';
  label: string;
  tone: 'emerald' | 'amber';
  countText: string;
  rows: readonly PredictionRow[];
}

interface SubjectPredictionSpec {
  code: string;
  examRule: string;
  totalQuestions: number;
  tiers: readonly TierPredictionSpec[];
}

const TIER_SCORE_PREDICTIONS: Partial<Record<SubjectId, SubjectPredictionSpec>> = {
  vnr202: {
    code: 'VNR202',
    examRule: '20-20-20',
    totalQuestions: 404,
    tiers: [
      {
        tier: 'lazymax',
        label: 'LAZY MAX',
        tone: 'emerald',
        countText: '142 / 404 câu',
        rows: [
          { method: 'Học vẹt', avg: '6.23', range: '5.50–7.00', p5: '98.3%', p7: '13.1%', p8: '0.2%', p9: '0%' },
          { method: 'Kỹ giải thích', avg: '8.51', range: '7.83–9.00', p5: '100%', p7: '99.9%', p8: '89.9%', p9: '18.5%', featured: true },
          { method: 'Hiểu sâu', avg: '9.09', range: '8.67–9.50', p5: '100%', p7: '100%', p8: '99.8%', p9: '69.7%' },
        ],
      },
      {
        tier: 'lazy',
        label: 'LAZY',
        tone: 'amber',
        countText: '282 / 404 câu',
        rows: [
          { method: 'Học vẹt', avg: '7.93', range: '7.33–8.50', p5: '100%', p7: '97.2%', p8: '51.7%', p9: '2.1%' },
          { method: 'Kỹ giải thích', avg: '9.48', range: '9.17–9.83', p5: '100%', p7: '100%', p8: '100%', p9: '96.4%', featured: true },
          { method: 'Hiểu sâu', avg: '9.74', range: '9.50–10.0', p5: '100%', p7: '100%', p8: '100%', p9: '99.9%' },
        ],
      },
    ],
  },
  mln131: {
    code: 'MLN131',
    examRule: '5-5-10×5',
    totalQuestions: 432,
    tiers: [
      {
        tier: 'lazymax',
        label: 'LAZY MAX',
        tone: 'emerald',
        countText: '155 / 432 câu',
        rows: [
          { method: 'Học vẹt', avg: '6.25', range: '5.50–7.00', p5: '98.3%', p7: '14.0%', p8: '0.3%', p9: '0%' },
          { method: 'Kỹ giải thích', avg: '8.62', range: '8.00–9.17', p5: '100%', p7: '100%', p8: '93.8%', p9: '25.6%', featured: true },
          { method: 'Hiểu sâu', avg: '9.27', range: '8.83–9.67', p5: '100%', p7: '100%', p8: '100%', p9: '85.7%' },
        ],
      },
      {
        tier: 'lazy',
        label: 'LAZY',
        tone: 'amber',
        countText: '333 / 432 câu',
        rows: [
          { method: 'Học vẹt', avg: '8.20', range: '7.50–8.83', p5: '100%', p7: '99.3%', p8: '72.4%', p9: '6.3%' },
          { method: 'Kỹ giải thích', avg: '9.51', range: '9.17–9.83', p5: '100%', p7: '100%', p8: '100%', p9: '97.2%', featured: true },
          { method: 'Hiểu sâu', avg: '9.75', range: '9.50–10.0', p5: '100%', p7: '100%', p8: '100%', p9: '99.9%' },
        ],
      },
    ],
  },
};

const QUICK_PICK_GUIDE: readonly {
  tier: StudyTier;
  label: string;
  tone: 'emerald' | 'amber' | 'rose';
  shortNote: string;
}[] = [
  {
    tier: 'lazymax',
    label: 'LAZY MAX',
    tone: 'emerald',
    shortNote: 'Gấp thời gian · Đọc giải thích ~8.5–9.3',
  },
  {
    tier: 'lazy',
    label: 'LAZY',
    tone: 'amber',
    shortNote: 'Muốn chắc 8–9+ · Ít rủi ro',
  },
  {
    tier: 'hardcore',
    label: 'HARDCORE',
    tone: 'rose',
    shortNote: 'Full đề · Chắc ăn 100%',
  },
];

function getPctToneClass(value: string): string {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return 'text-[#656058] dark:text-[#9CA39B]';
  if (num >= 90) return 'font-bold text-[#047857] dark:text-[#34D399]';
  if (num >= 50) return 'font-semibold text-[#B45309] dark:text-[#FBBF24]';
  if (num < 20) return 'font-medium text-[#BE123C] dark:text-[#FDA4AF]';
  return 'font-medium text-[#292524] dark:text-[#E7E5E4]';
}

export interface SakugaTierPickerProps {
  tier: StudyTier;
  subject?: SubjectId;
  onSelectTier: (tier: StudyTier) => void;
  compact?: boolean;
}

export const SakugaTierPicker: React.FC<SakugaTierPickerProps> = ({
  tier,
  subject = 'vnr202',
  onSelectTier,
  compact = false,
}) => {
  const [burst, setBurst] = useState<{ tier: StudyTier; seq: number } | null>(null);
  const [isTierInfoOpen, setIsTierInfoOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState<SubjectId>(subject);

  useEffect(() => {
    if (isTierInfoOpen) {
      setPreviewSubject(subject);
    }
  }, [isTierInfoOpen, subject]);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 680);
    return () => window.clearTimeout(timer);
  }, [burst]);

  useEffect(() => {
    if (!isTierInfoOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTierInfoOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTierInfoOpen]);

  const lazyItems = STUDY_TIER_ITEMS.slice(0, 2); // LAZY MAX, LAZY
  const hardcoreItem = STUDY_TIER_ITEMS[2]; // HARDCORE

  const renderTierButton = (item: TierStampConfig) => {
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
          compact ? 'min-w-0 flex-1' : ''
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
  };

  return (
    <>
      <div
        role="group"
        aria-label="Chọn mức độ ôn tập"
        className={
          compact
            ? 'flex w-full items-center gap-1.5 rounded-xl border border-[#D5CFC2] bg-[#F4F2EC] p-1 dark:border-[#262925] dark:bg-[#0F100E]'
            : 'inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#D5CFC2] bg-[#F4F2EC] p-1 dark:border-[#262925] dark:bg-[#0F100E] xl:gap-1.5'
        }
      >
        {lazyItems.map(renderTierButton)}

        {/* Circled info icon next to LAZY MAX & LAZY */}
        <button
          type="button"
          onClick={() => setIsTierInfoOpen(true)}
          aria-expanded={isTierInfoOpen}
          aria-haspopup="dialog"
          aria-label="Giới thiệu về các mức LAZY MAX và LAZY"
          title="Xem lưu ý của Nam về LAZY MAX & LAZY"
          className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] transition hover:border-[#4338CA] hover:bg-[#4338CA] hover:text-white dark:border-[#818CF8]/55 dark:bg-[#312E81]/45 dark:text-[#A5B4FC] dark:hover:border-[#818CF8] dark:hover:bg-[#4338CA] dark:hover:text-white ${
            compact ? 'h-6 w-6' : 'h-5 w-5 xl:h-[22px] xl:w-[22px]'
          }`}
        >
          <Info className="h-3 w-3 shrink-0" />
        </button>

        <span
          aria-hidden="true"
          className="h-4 w-px shrink-0 bg-[#D5CFC2] dark:bg-[#2C302B]"
        />

        {renderTierButton(hardcoreItem)}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isTierInfoOpen && (
              <motion.div
                key="tier-info-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setIsTierInfoOpen(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/50 p-3 backdrop-blur-xs dark:bg-[#0F100E]/80 sm:p-6"
              >
                <motion.div
                  key="tier-info-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Lời nhắn từ Nam về 3 mức học"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-[#27272A] bg-[#EAE6DD] shadow-[5px_5px_0_0_#C7D2FE,0_16px_38px_-8px_rgba(24,24,27,0.18)] dark:border-[#52525B] dark:bg-[#161816] dark:shadow-[5px_5px_0_0_#312E81,0_18px_42px_-8px_rgba(0,0,0,0.85)]"
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-[#D5CFC2] px-4 py-3 dark:border-[#262925] sm:px-5 sm:py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/40 dark:text-[#A5B4FC]">
                        <Info className="h-4 w-4" />
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-bold text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/35 dark:text-[#A5B4FC]">
                        from Namblee
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTierInfoOpen(false)}
                      aria-label="Đóng hộp thoại"
                      className="cursor-pointer rounded-xl p-1.5 text-[#656058] transition hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-3.5 text-[13px] leading-relaxed text-[#292524] dark:text-[#E7E5E4] sm:p-5 sm:text-sm">
                    {/* Top Row: Nam's Message + Roadmap & Quick Picker */}
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
                      {/* Left Column: Nam's Original Note */}
                      <div className="space-y-2.5 rounded-xl border border-[#C6BEB0] bg-[#FFFFFF] p-3.5 dark:border-[#323833] dark:bg-[#1E221F] md:col-span-7">
                        <p className="font-medium text-[#18181B] dark:text-[#F5F5F4]">
                          Hi, Nam đây, t dựa vào 1 vài sách về tư duy và trí nhớ não bộ để rút gọn lại số câu phải học.
                        </p>

                        <p className="leading-[2.05]">
                          Thì giờ có 3 mức:{' '}
                          <SakugaMangaTag
                            label="HARDCORE"
                            tone="rose"
                            animateBurst={false}
                            className="mx-0.5 align-middle"
                          />{' '}
                          là full source,{' '}
                          <SakugaMangaTag
                            label="LAZY"
                            tone="amber"
                            animateBurst={false}
                            className="mx-0.5 align-middle"
                          />{' '}
                          là giảm bớt đi chút,{' '}
                          <SakugaMangaTag
                            label="LAZY MAX"
                            tone="emerald"
                            animateBurst={false}
                            className="mx-0.5 align-middle"
                          />{' '}
                          là giảm vãi nồi.
                        </p>

                        <p className="leading-[2]">
                          Nếu ít thời gian thì có thể học theo kiểu{' '}
                          <strong className="font-bold text-[#047857] dark:text-[#34D399]">
                            HỌC HIỂU
                          </strong>{' '}
                          <SakugaMangaTag
                            label="LAZY MAX"
                            tone="emerald"
                            animateBurst={false}
                            className="mx-0.5 align-middle"
                          />{' '}
                          vì nó đã bao gồm các ý chính rồi chỉ cần suy luận là có thể ra đáp án của tất cả các câu còn lại, vẫn khuyến khích nên học full.
                        </p>
                      </div>

                      {/* Right Column: Roadmap + Compact Quick Pick */}
                      <div className="flex flex-col gap-3 md:col-span-5">
                        <div className="rounded-xl border border-[#C6BEB0] bg-[#FFFFFF] p-3 dark:border-[#323833] dark:bg-[#1E221F]">
                          <p className="mb-2 text-center text-xs font-semibold text-[#18181B] dark:text-[#F5F5F4] sm:text-[13px]">
                            Nói chung học theo kiểu này:
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                            <SakugaMangaTag label="LAZY MAX" tone="emerald" animateBurst={false} />
                            <span className="text-xs font-black text-[#656058] dark:text-[#9CA39B]">
                              -&gt;
                            </span>
                            <SakugaMangaTag label="LAZY" tone="amber" animateBurst={false} />
                            <span className="text-xs font-black text-[#656058] dark:text-[#9CA39B]">
                              -&gt;
                            </span>
                            <SakugaMangaTag label="HARDCORE" tone="rose" animateBurst={false} />
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col justify-between rounded-xl border border-[#C6BEB0] bg-[#FFFFFF] p-3 dark:border-[#323833] dark:bg-[#1E221F]">
                          <p className="mb-2 text-[11px] font-bold tracking-wide text-[#656058] uppercase dark:text-[#9CA39B]">
                            Chọn nhanh theo mục tiêu
                          </p>
                          <div className="space-y-1.5">
                            {QUICK_PICK_GUIDE.map((item) => {
                              const isCurrent = tier === item.tier;
                              return (
                                <button
                                  key={item.tier}
                                  type="button"
                                  onClick={() => {
                                    onSelectTier(item.tier);
                                    setIsTierInfoOpen(false);
                                  }}
                                  className={`sakuga-btn flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                                    isCurrent
                                      ? 'border-[#4338CA] bg-[#EEF2FF] dark:border-[#818CF8] dark:bg-[#312E81]/35'
                                      : 'border-[#D5CFC2] bg-[#FAF9F5] hover:border-[#4338CA] hover:bg-[#EEF2FF] dark:border-[#2C302B] dark:bg-[#161816] dark:hover:border-[#818CF8]'
                                  }`}
                                >
                                  <SakugaMangaTag
                                    label={item.label}
                                    tone={item.tone}
                                    animateBurst={false}
                                    className="shrink-0"
                                  />
                                  <span className="text-right text-[11.5px] font-semibold text-[#292524] dark:text-[#E7E5E4]">
                                    {item.shortNote}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Compact Score Prediction Breakdown (VNR202, MLN131, WDU203c) */}
                    {(() => {
                      const activePred = TIER_SCORE_PREDICTIONS[previewSubject];
                      return (
                        <div className="space-y-3 rounded-xl border border-[#C6BEB0] bg-[#FAF9F5] p-3 dark:border-[#323833] dark:bg-[#1A1D1A] sm:p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-xs font-extrabold tracking-tight text-[#18181B] dark:text-[#F5F5F4] sm:text-sm">
                                {activePred
                                  ? `Dự đoán điểm thi (đề 60 câu · ${activePred.examRule})`
                                  : 'Môn WDU203c (274 câu · 6 Course Coursera)'}
                              </h3>
                              <p className="text-[11px] text-[#656058] dark:text-[#9CA39B]">
                                {activePred ? (
                                  <>
                                    Đọc{' '}
                                    <span className="font-bold text-[#047857] dark:text-[#34D399]">
                                      kỹ giải thích
                                    </span>{' '}
                                    (mức 2) kéo điểm từ ~6.2 lên ~8.5–9.5
                                  </>
                                ) : (
                                  'Hiện cả 3 mức đều dùng trọn bộ 274 câu; bảng rút gọn LAZY / LAZY MAX sẽ sớm cập nhật.'
                                )}
                              </p>
                            </div>

                            {/* Subject Switcher Pills */}
                            <div
                              role="tablist"
                              aria-label="Chọn môn xem dự đoán điểm"
                              className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-[#C6BEB0] bg-[#EAE6DD] p-0.5 dark:border-[#2C302B] dark:bg-[#0F100E]"
                            >
                              <button
                                type="button"
                                role="tab"
                                aria-selected={previewSubject === 'vnr202'}
                                onClick={() => setPreviewSubject('vnr202')}
                                className={`inline-flex -skew-x-12 cursor-pointer items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider transition ${
                                  previewSubject === 'vnr202'
                                    ? 'border-[#7C2D12] bg-[#EA580C] text-white shadow-[2px_2px_0_0_#FDBA74] dark:border-[#FDBA74]'
                                    : 'border-transparent text-[#9A3412] hover:bg-[#FFF7ED] dark:text-[#FDBA74]/85 dark:hover:bg-[#7C2D12]/40'
                                }`}
                              >
                                <span className="skew-x-12">VNR</span>
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={previewSubject === 'mln131'}
                                onClick={() => setPreviewSubject('mln131')}
                                className={`inline-flex -skew-x-12 cursor-pointer items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider transition ${
                                  previewSubject === 'mln131'
                                    ? 'border-[#0C4A6E] bg-[#0284C7] text-white shadow-[2px_2px_0_0_#7DD3FC] dark:border-[#7DD3FC]'
                                    : 'border-transparent text-[#075985] hover:bg-[#E0F2FE] dark:text-[#7DD3FC]/85 dark:hover:bg-[#0C4A6E]/40'
                                }`}
                              >
                                <span className="skew-x-12">MLN</span>
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={previewSubject === 'wdu203c'}
                                onClick={() => setPreviewSubject('wdu203c')}
                                className={`inline-flex -skew-x-12 cursor-pointer items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider transition ${
                                  previewSubject === 'wdu203c'
                                    ? 'border-[#831843] bg-[#DB2777] text-white shadow-[2px_2px_0_0_#F9A8D4] dark:border-[#F9A8D4]'
                                    : 'border-transparent text-[#9D174D] hover:bg-[#FCE7F3] dark:text-[#F9A8D4]/85 dark:hover:bg-[#831843]/40'
                                }`}
                              >
                                <span className="skew-x-12">WDU</span>
                              </button>
                            </div>
                          </div>

                          {!activePred ? (
                            <div className="rounded-xl border-2 border-[#F9A8D4] bg-[#FCE7F3]/70 p-3.5 text-xs text-[#831843] dark:border-[#F472B6]/50 dark:bg-[#831843]/25 dark:text-[#FBCFE8]">
                              <p className="font-bold">
                                WDU203c — UI/UX Design &amp; User Research (274 câu Full đề)
                              </p>
                              <p className="mt-1 leading-relaxed text-[#292524] dark:text-[#E7E5E4]">
                                Dữ liệu 274 câu của 6 Course đã được sắp xếp kèm giải thích tiếng Việt để bạn rà soát và phân loại mức <span className="font-bold">LAZY</span> / <span className="font-bold">LAZY MAX</span> ở bước tiếp theo.
                              </p>
                            </div>
                          ) : (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {activePred.tiers.map((tierSpec) => {
                              const isLazyMax = tierSpec.tier === 'lazymax';
                              return (
                                <div
                                  key={tierSpec.tier}
                                  className={`overflow-hidden rounded-xl border-2 bg-[#FFFFFF] dark:bg-[#1E221F] ${
                                    isLazyMax
                                      ? 'border-[#10B981]/70 dark:border-[#10B981]/60'
                                      : 'border-[#F59E0B]/70 dark:border-[#F59E0B]/60'
                                  }`}
                                >
                                  {/* Card Header */}
                                  <div
                                    className={`flex items-center justify-between gap-2 border-b px-2.5 py-2 sm:px-3 ${
                                      isLazyMax
                                        ? 'border-[#A7F3D0] bg-[#ECFDF5] dark:border-[#059669]/45 dark:bg-[#064E3B]/35'
                                        : 'border-[#FDE68A] bg-[#FFFBEB] dark:border-[#D97706]/45 dark:bg-[#78350F]/35'
                                    }`}
                                  >
                                    <SakugaMangaTag
                                      label={tierSpec.label}
                                      tone={tierSpec.tone}
                                      animateBurst={false}
                                    />
                                    <span className="tabular-nums text-[11px] font-bold text-[#292524] dark:text-[#E7E5E4]">
                                      {tierSpec.countText}
                                    </span>
                                  </div>

                                  {/* 6-Col Compact Grid (fits cleanly at 360px mobile without horizontal scroll) */}
                                  <div className="divide-y divide-[#EAE6DD] dark:divide-[#2C302B]">
                                    <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.08fr)_repeat(4,minmax(0,0.86fr))] items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-[#656058] uppercase dark:text-[#9CA39B] sm:gap-1.5 sm:px-3">
                                      <span>Cách học</span>
                                      <span className="text-center">TB</span>
                                      <span className="text-right">≥5</span>
                                      <span className="text-right">≥7</span>
                                      <span className="text-right">≥8</span>
                                      <span className="text-right">≥9</span>
                                    </div>

                                    {tierSpec.rows.map((row) => {
                                      const isFeat = Boolean(row.featured);
                                      return (
                                        <div
                                          key={row.method}
                                          className={`grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.08fr)_repeat(4,minmax(0,0.86fr))] items-center gap-1 px-2.5 py-2 sm:gap-1.5 sm:px-3 ${
                                            isFeat
                                              ? isLazyMax
                                                ? 'border-l-[3px] border-l-[#059669] bg-[#ECFDF5]/85 dark:border-l-[#34D399] dark:bg-[#064E3B]/30'
                                                : 'border-l-[3px] border-l-[#D97706] bg-[#FFFBEB]/90 dark:border-l-[#FBBF24] dark:bg-[#78350F]/25'
                                              : ''
                                          }`}
                                        >
                                          <div className="min-w-0">
                                            <span
                                              className={`block truncate text-[11px] sm:text-xs ${
                                                isFeat
                                                  ? 'font-extrabold text-[#18181B] dark:text-[#F5F5F4]'
                                                  : 'font-semibold text-[#292524] dark:text-[#E7E5E4]'
                                              }`}
                                            >
                                              {row.method}
                                            </span>
                                            {isFeat && (
                                              <span
                                                className={`block text-[9.5px] font-bold leading-tight ${
                                                  isLazyMax
                                                    ? 'text-[#047857] dark:text-[#34D399]'
                                                    : 'text-[#B45309] dark:text-[#FBBF24]'
                                                }`}
                                              >
                                                ★ Khuyên dùng
                                              </span>
                                            )}
                                          </div>

                                          <div className="text-center tabular-nums">
                                            <span className="block text-[11.5px] font-extrabold text-[#18181B] dark:text-[#F5F5F4] sm:text-xs">
                                              {row.avg}
                                            </span>
                                            <span className="block text-[9px] leading-tight text-[#656058] dark:text-[#9CA39B]">
                                              {row.range}
                                            </span>
                                          </div>

                                          <span
                                            className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(
                                              row.p5
                                            )}`}
                                          >
                                            {row.p5}
                                          </span>
                                          <span
                                            className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(
                                              row.p7
                                            )}`}
                                          >
                                            {row.p7}
                                          </span>
                                          <span
                                            className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(
                                              row.p8
                                            )}`}
                                          >
                                            {row.p8}
                                          </span>
                                          <span
                                            className={`text-right tabular-nums text-[10.5px] sm:text-[11px] ${getPctToneClass(
                                              row.p9
                                            )}`}
                                          >
                                            {row.p9}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
