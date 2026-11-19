import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SakugaMangaTag } from './SakugaVfx';

export type SaiyanTagTone = 'emerald' | 'indigo' | 'amber' | 'rose' | 'fuchsia' | 'pink';

export interface SaiyanTriggerEvent {
  seq: number;
  label: string;
  tone: SaiyanTagTone;
}

export interface SakugaSaiyanLogoProps {
  event: SaiyanTriggerEvent | null;
  onLogoClick: () => void;
}

const SAIYAN_ACTIVE_MS = 1150;

export const SakugaSaiyanLogo: React.FC<SakugaSaiyanLogoProps> = ({ event, onLogoClick }) => {
  const [activeEvent, setActiveEvent] = useState<SaiyanTriggerEvent | null>(null);

  useEffect(() => {
    if (!event) return;
    setActiveEvent(event);
    const timer = window.setTimeout(() => {
      setActiveEvent((prev) => (prev?.seq === event.seq ? null : prev));
    }, SAIYAN_ACTIVE_MS);
    return () => window.clearTimeout(timer);
  }, [event]);

  const isPowered = activeEvent !== null;
  const seqKey = activeEvent?.seq ?? 0;

  return (
    <div className="relative inline-flex shrink-0 items-center overflow-visible">
      <button
        type="button"
        onClick={onLogoClick}
        aria-label="Ôn FE — Bật chế độ Super Saiyan"
        title="Bấm để bật Super Saiyan!"
        className={`sakuga-btn group relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-xl border-2 focus-visible:outline-none sm:h-9 sm:w-9 ${
          isPowered
            ? 'border-[#78350F] bg-[#FEF08A] shadow-[0_0_0_2px_#FACC15,3px_3px_0_0_#EA580C] dark:border-[#FEF9C3] dark:bg-[#CA8A04] dark:shadow-[0_0_0_2px_#FEF08A,3px_3px_0_0_#EA580C]'
            : 'border-[#1E1B4B] bg-[#4338CA] shadow-[2px_2px_0_0_#A5B4FC] hover:bg-[#3730A3] dark:border-[#A5B4FC] dark:bg-[#4338CA] dark:shadow-[2px_2px_0_0_#312E81] dark:hover:bg-[#3730A3]'
        }`}
      >
        {/* One-shot shockwave ring + flat cel-shaded Super Saiyan ki aura & lightning */}
        {isPowered && (
          <>
            <motion.span
              key={`saiyan-ring-${seqKey}`}
              aria-hidden="true"
              initial={{ scale: 0.85, opacity: 0.95 }}
              animate={{ scale: 1.55, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 z-0 rounded-xl border-2 border-[#FACC15]"
            />

            <motion.svg
              key={`saiyan-aura-${seqKey}`}
              viewBox="0 0 72 72"
              aria-hidden="true"
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: [0.88, 1.1, 1.02, 1.06, 0.95], opacity: [0.95, 1, 0.92, 0.85, 0] }}
              transition={{ duration: 0.95, times: [0, 0.2, 0.5, 0.75, 1], ease: 'easeOut' }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-14 w-14 -translate-x-1/2 -translate-y-1/2 overflow-visible sm:h-16 sm:w-16"
            >
              {/* Outer flame aura spikes (flat cel orange & gold) */}
              <path
                d="M36 3 L43 16 L57 8 L53 23 L68 25 L57 36 L67 49 L52 52 L53 66 L39 59 L36 69 L31 59 L18 66 L20 52 L5 49 L15 36 L4 25 L19 23 L15 8 L29 16 Z"
                fill="#EA580C"
                stroke="#7C2D12"
                strokeWidth="1.4"
                strokeLinejoin="round"
                opacity="0.82"
              />
              <path
                d="M36 9 L41 20 L52 14 L49 26 L61 28 L52 37 L59 47 L48 49 L49 60 L38 55 L36 63 L33 55 L23 60 L24 49 L13 47 L20 37 L11 28 L23 26 L20 14 L31 20 Z"
                fill="#FACC15"
                opacity="0.92"
              />
              <path
                d="M36 14 L40 23 L48 19 L46 28 L55 30 L48 37 L53 45 L45 47 L36 56 L27 47 L19 45 L24 37 L17 30 L26 28 L24 19 L32 23 Z"
                fill="#FEF9C3"
                opacity="0.9"
              />

              {/* Diagonal Super Saiyan lightning arcs */}
              <motion.path
                d="M11 21 L20 15 L17 24 L25 20"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="30"
                initial={{ strokeDashoffset: 30, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: [0, 1, 0.3, 1, 0] }}
                transition={{ duration: 0.72, repeat: 1, ease: 'easeOut' }}
              />
              <motion.path
                d="M61 17 L52 24 L57 28 L49 34"
                fill="none"
                stroke="#FEF08A"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="32"
                initial={{ strokeDashoffset: 32, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: [0, 1, 0.4, 1, 0] }}
                transition={{ duration: 0.68, delay: 0.08, repeat: 1, ease: 'easeOut' }}
              />
              <motion.path
                d="M14 53 L22 46 L19 41 L27 37"
                fill="none"
                stroke="#FEF08A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.25, 0.9, 0] }}
                transition={{ duration: 0.65, delay: 0.14, ease: 'easeOut' }}
              />
            </motion.svg>
          </>
        )}

        {/* Chibi Saiyan Character Bust (Base Form <-> Super Saiyan) */}
        <motion.div
          key={isPowered ? `saiyan-body-${seqKey}` : 'saiyan-base'}
          initial={isPowered ? { scaleX: 1.18, scaleY: 0.82, y: 0 } : false}
          animate={
            isPowered
              ? {
                  scaleX: [1.18, 0.92, 1.05, 1],
                  scaleY: [0.82, 1.14, 0.96, 1],
                  y: [0, -4, 1, 0],
                }
              : { scaleX: 1, scaleY: 1, y: 0 }
          }
          transition={{ duration: 0.46, times: [0, 0.35, 0.72, 1], ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[10px]"
        >
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            className="h-7 w-7 sm:h-8 sm:w-8 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:-rotate-3"
          >
            {/* Shonen Gi / Collar */}
            <path
              d="M9 47 C10 38 15 35 24 35 C33 35 38 38 39 47 Z"
              fill="#EA580C"
              stroke="#18181B"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M18 35 L24 44 L30 35"
              fill="#1E3A8A"
              stroke="#18181B"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M21 36 L24 41 L27 36"
              fill="#F5C794"
              stroke="#18181B"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Ears */}
            <circle cx="12.5" cy="27" r="2.7" fill="#FDE6C4" stroke="#18181B" strokeWidth="1.8" />
            <circle cx="35.5" cy="27" r="2.7" fill="#FDE6C4" stroke="#18181B" strokeWidth="1.8" />

            {/* Chibi Face */}
            <path
              d="M13 24 C13 17.5 17.5 14 24 14 C30.5 14 35 17.5 35 24 C35 31 30.2 36.2 24 36.2 C17.8 36.2 13 31 13 24 Z"
              fill="#FDE6C4"
              stroke="#18181B"
              strokeWidth="2"
            />
            {/* Chin cel shadow */}
            <path
              d="M18.5 33.8 C20.4 35.1 22.1 35.5 24 35.5 C25.9 35.5 27.6 35.1 29.5 33.8 C27.6 34.4 25.9 34.6 24 34.6 C22.1 34.6 20.4 34.4 18.5 33.8 Z"
              fill="#F5C794"
            />

            {isPowered ? (
              <>
                {/* Super Saiyan Golden Crown Spikes */}
                <motion.g
                  initial={{ scaleY: 0.78, y: 3 }}
                  animate={{ scaleY: [1.14, 1.02, 1.08, 1], y: [-2, 0, -1, 0] }}
                  transition={{ duration: 0.42, times: [0, 0.4, 0.72, 1] }}
                  style={{ originX: '24px', originY: '20px' }}
                >
                  <path
                    d="M12 24 L6 16 L13 15 L9 6 L19 11 L24 2 L29 11 L39 6 L35 15 L42 16 L36 24 L32 19 L28 24 L24 18 L20 24 L16 19 Z"
                    fill="#FACC15"
                    stroke="#78350F"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {/* Cel highlight facets */}
                  <polygon points="24,4 21,13 25,15 28,11" fill="#FEF9C3" />
                  <polygon points="11,8 14,15 18,13" fill="#FEF9C3" />
                  <polygon points="37,8 31,13 34,15" fill="#FEF9C3" />
                </motion.g>

                {/* Golden slanted warrior brows */}
                <path
                  d="M16 23 L21.5 25"
                  stroke="#B45309"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
                <path
                  d="M32 23 L26.5 25"
                  stroke="#B45309"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />

                {/* Emerald Super Saiyan Eyes */}
                <rect
                  x="16.5"
                  y="25.2"
                  width="4.4"
                  height="4.4"
                  rx="1.5"
                  fill="#059669"
                  stroke="#18181B"
                  strokeWidth="1.3"
                />
                <rect
                  x="27.1"
                  y="25.2"
                  width="4.4"
                  height="4.4"
                  rx="1.5"
                  fill="#059669"
                  stroke="#18181B"
                  strokeWidth="1.3"
                />
                <circle cx="19.5" cy="26.5" r="1.1" fill="#A7F3D0" />
                <circle cx="30.1" cy="26.5" r="1.1" fill="#A7F3D0" />

                {/* Power-up Shout Mouth */}
                <path
                  d="M20.5 31.3 Q24 30.2 27.5 31.3 Q26.6 34.4 24 34.4 Q21.4 34.4 20.5 31.3 Z"
                  fill="#E11D48"
                  stroke="#18181B"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path d="M21.8 31.5 L26.2 31.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* Base Form Spiky Black Hair */}
                <path
                  d="M12.5 24.5 L8 19 L13.5 17.5 L11 10.5 L19 13.5 L24 6 L29 13.5 L37 10.5 L34.5 17.5 L40 19 L35.5 24.5 L31.5 19.8 L28 22.8 L24 18.2 L20 22.8 L16.5 19.8 Z"
                  fill="#18181B"
                  stroke="#09090B"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                {/* Crisp slate cel sheen */}
                <polygon points="24,8 21.5,14 24.5,15.5 26.8,13" fill="#475569" />
                <polygon points="13,12 15.5,16.5 18,14.8" fill="#475569" />

                {/* Base Form Focused Brows */}
                <path
                  d="M16.2 24 L21.5 25"
                  stroke="#18181B"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M31.8 24 L26.5 25"
                  stroke="#18181B"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                {/* Determined Dark Eyes with Specular Dot */}
                <circle cx="18.8" cy="27.5" r="2.2" fill="#18181B" />
                <circle cx="29.2" cy="27.5" r="2.2" fill="#18181B" />
                <circle cx="19.5" cy="26.7" r="0.85" fill="#FFFFFF" />
                <circle cx="29.9" cy="26.7" r="0.85" fill="#FFFFFF" />

                {/* Confident Shonen Smirk */}
                <path
                  d="M21 32 Q24 33.8 27.2 31.6"
                  fill="none"
                  stroke="#18181B"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </motion.div>

        {/* Subtle resting cel glint */}
        {!isPowered && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-1 top-1 z-20 h-1.5 w-1.5 rounded-full bg-[#FEF08A] transition-transform duration-150 group-hover:scale-125"
          />
        )}
      </button>

      {/* Sakuga Manga Callout Text floating below logo */}
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 overflow-visible">
        <AnimatePresence mode="wait">
          {activeEvent && (
            <motion.div
              key={activeEvent.seq}
              initial={{ opacity: 0, y: -6, scale: 0.78 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 460, damping: 22 }}
              className="overflow-visible"
            >
              <SakugaMangaTag
                label={activeEvent.label}
                tone={activeEvent.tone}
                animateBurst={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
