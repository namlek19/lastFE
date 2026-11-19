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
