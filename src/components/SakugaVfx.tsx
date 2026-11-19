import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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

const VARIANT_CONFIG: Record<
  SakugaVariant,
  {
    defaultLabel: string;
    plateClass: string;
    accentFill: string;
    smokeTint: string;
    sparkleFill: string;
    durationMs: number;
  }
> = {
  nice: {
    defaultLabel: 'NICE!',
    plateClass:
      'border-[#1E1B4B] bg-[#FEF3C7] text-[#92400E] shadow-[3px_3px_0_0_#F59E0B] dark:border-[#FDE68A] dark:bg-[#92400E] dark:text-[#FEF3C7] dark:shadow-[3px_3px_0_0_#F59E0B]',
    accentFill: '#F59E0B',
    smokeTint: '#FDE68A',
    sparkleFill: '#F59E0B',
    durationMs: 620,
  },
  clear: {
    defaultLabel: 'CLEAR! ✓',
    plateClass:
      'border-[#064E3B] bg-[#D1FAE5] text-[#065F46] shadow-[3px_3px_0_0_#34D399] dark:border-[#6EE7B7] dark:bg-[#065F46] dark:text-[#ECFDF5] dark:shadow-[3px_3px_0_0_#10B981]',
    accentFill: '#10B981',
    smokeTint: '#A7F3D0',
    sparkleFill: '#059669',
    durationMs: 680,
  },
  complete: {
    defaultLabel: 'COMPLETE! ✓',
    plateClass:
      'border-[#064E3B] bg-[#10B981] text-white shadow-[4px_4px_0_0_#A7F3D0] dark:border-[#A7F3D0] dark:bg-[#059669] dark:text-[#ECFDF5] dark:shadow-[4px_4px_0_0_#064E3B]',
    accentFill: '#10B981',
    smokeTint: '#A7F3D0',
    sparkleFill: '#34D399',
    durationMs: 1050,
  },
  miss: {
    defaultLabel: 'MISS!',
    plateClass:
      'border-[#881337] bg-[#FFE4E6] text-[#BE123C] shadow-[3px_3px_0_0_#FB7185] dark:border-[#FDA4AF] dark:bg-[#881337] dark:text-[#FFE4E6] dark:shadow-[3px_3px_0_0_#E11D48]',
    accentFill: '#E11D48',
    smokeTint: '#FECDD3',
    sparkleFill: '#FB7185',
    durationMs: 620,
  },
  ok: {
    defaultLabel: 'OK!',
    plateClass:
      'border-[#1E1B4B] bg-[#EEF2FF] text-[#4338CA] shadow-[3px_3px_0_0_#A5B4FC] dark:border-[#A5B4FC] dark:bg-[#312E81] dark:text-[#EEF2FF] dark:shadow-[3px_3px_0_0_#6366F1]',
    accentFill: '#4338CA',
    smokeTint: '#C7D2FE',
    sparkleFill: '#6366F1',
    durationMs: 520,
  },
};

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
            {/* Hand-drawn Anime Smoke Puffs / Slash / Shards SVG */}
            <svg
              viewBox="0 0 140 72"
              className="absolute -inset-x-7 -inset-y-4 h-[72px] w-[140px] overflow-visible"
            >
              {activeEvent.variant === 'miss' ? (
                <>
                  {/* Diagonal Manga Slash Lines */}
                  <motion.path
                    d="M22 54 L118 14"
                    stroke={cfg.accentFill}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="110"
                    initial={{ strokeDashoffset: 110, opacity: 0.95 }}
                    animate={{ strokeDashoffset: 0, opacity: 0 }}
                    transition={{ duration: 0.42, ease: 'easeOut' }}
                  />
                  <motion.path
                    d="M32 60 L108 26"
                    stroke="#1E1B4B"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="90"
                    initial={{ strokeDashoffset: 90, opacity: 0.85 }}
                    animate={{ strokeDashoffset: 0, opacity: 0 }}
                    transition={{ duration: 0.36, delay: 0.05, ease: 'easeOut' }}
                  />
                </>
              ) : (
                <>
                  {/* Left & Right Cel-Shaded Smoke Puffs */}
                  <motion.g
                    initial={{ scale: 0.5, opacity: 0.95, x: 0, y: 0 }}
                    animate={{ scale: 1.12, opacity: 0, x: -12, y: -6 }}
                    transition={{ duration: 0.52, ease: 'easeOut' }}
                    style={{ originX: '28px', originY: '36px' }}
                  >
                    <circle
                      cx="24"
                      cy="38"
                      r="8"
                      fill="#FFFFFF"
                      stroke="#1E1B4B"
                      strokeWidth="2"
                    />
                    <circle
                      cx="32"
                      cy="33"
                      r="6"
                      fill={cfg.smokeTint}
                      stroke="#1E1B4B"
                      strokeWidth="2"
                    />
                  </motion.g>

                  <motion.g
                    initial={{ scale: 0.5, opacity: 0.95, x: 0, y: 0 }}
                    animate={{ scale: 1.15, opacity: 0, x: 12, y: -5 }}
                    transition={{ duration: 0.54, ease: 'easeOut' }}
                    style={{ originX: '112px', originY: '36px' }}
                  >
                    <circle
                      cx="114"
                      cy="36"
                      r="7.5"
                      fill="#FFFFFF"
                      stroke="#1E1B4B"
                      strokeWidth="2"
                    />
                    <circle
                      cx="106"
                      cy="41"
                      r="5.5"
                      fill={cfg.smokeTint}
                      stroke="#1E1B4B"
                      strokeWidth="2"
                    />
                  </motion.g>

                  {/* 4-Point Anime Sparkle Stars */}
                  <motion.path
                    d="M16 14 L19 21 L26 24 L19 27 L16 34 L13 27 L6 24 L13 21 Z"
                    fill="#FFFFFF"
                    stroke="#1E1B4B"
                    strokeWidth="1.8"
                    initial={{ scale: 0, rotate: -15, opacity: 1 }}
                    animate={{ scale: 0.95, rotate: 12, opacity: 0 }}
                    transition={{ duration: 0.48, ease: 'easeOut' }}
                  />
                  <motion.path
                    d="M122 10 L124.5 16 L130.5 18.5 L124.5 21 L122 27 L119.5 21 L113.5 18.5 L119.5 16 Z"
                    fill={cfg.sparkleFill}
                    stroke="#1E1B4B"
                    strokeWidth="1.6"
                    initial={{ scale: 0, rotate: 15, opacity: 1 }}
                    animate={{ scale: 1.05, rotate: -10, opacity: 0 }}
                    transition={{ duration: 0.52, delay: 0.04, ease: 'easeOut' }}
                  />
                </>
              )}

              {/* Diamond Shards on Clear / Complete */}
              {(activeEvent.variant === 'clear' || activeEvent.variant === 'complete') && (
                <>
                  <motion.polygon
                    points="48,6 54,12 48,18 42,12"
                    fill={cfg.smokeTint}
                    stroke="#1E1B4B"
                    strokeWidth="1.6"
                    initial={{ y: 12, opacity: 1, scale: 0.6 }}
                    animate={{ y: -14, opacity: 0, scale: 1 }}
                    transition={{ duration: 0.58, ease: 'easeOut' }}
                  />
                  <motion.polygon
                    points="92,4 97,10 92,16 87,10"
                    fill="#FFFFFF"
                    stroke="#1E1B4B"
                    strokeWidth="1.6"
                    initial={{ y: 14, opacity: 1, scale: 0.6 }}
                    animate={{ y: -16, opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.62, delay: 0.04, ease: 'easeOut' }}
                  />
                </>
              )}
            </svg>

            {/* Slanted Comic / Manga Callout Badge */}
            <motion.span
              initial={{ scaleX: 1.18, scaleY: 0.84 }}
              animate={{ scaleX: 1, scaleY: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
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
}

const TONE_MAP: Record<NonNullable<SakugaMangaTagProps['tone']>, string> = {
  emerald:
    'border-[#064E3B] bg-[#D1FAE5] text-[#065F46] shadow-[2px_2px_0_0_#6EE7B7] dark:border-[#6EE7B7] dark:bg-[#065F46] dark:text-[#ECFDF5] dark:shadow-[2px_2px_0_0_#059669]',
  indigo:
    'border-[#1E1B4B] bg-[#EEF2FF] text-[#3730A3] shadow-[2px_2px_0_0_#C7D2FE] dark:border-[#A5B4FC] dark:bg-[#312E81] dark:text-[#EEF2FF] dark:shadow-[2px_2px_0_0_#4338CA]',
  amber:
    'border-[#78350F] bg-[#FEF3C7] text-[#92400E] shadow-[2px_2px_0_0_#FCD34D] dark:border-[#FDE68A] dark:bg-[#92400E] dark:text-[#FEF3C7] dark:shadow-[2px_2px_0_0_#D97706]',
  rose:
    'border-[#881337] bg-[#FFE4E6] text-[#BE123C] shadow-[2px_2px_0_0_#FDA4AF] dark:border-[#FDA4AF] dark:bg-[#881337] dark:text-[#FFE4E6] dark:shadow-[2px_2px_0_0_#E11D48]',
  fuchsia:
    'border-[#701A75] bg-[#FAE8FF] text-[#A21CAF] shadow-[2px_2px_0_0_#F0ABFC] dark:border-[#F5D0FE] dark:bg-[#701A75] dark:text-[#FAE8FF] dark:shadow-[2px_2px_0_0_#C026D3]',
};

export const SakugaMangaTag: React.FC<SakugaMangaTagProps> = ({
  label,
  tone = 'emerald',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex -skew-x-12 items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider whitespace-nowrap ${TONE_MAP[tone]} ${className}`}
    >
      <span className="skew-x-12">{label}</span>
    </span>
  );
};
