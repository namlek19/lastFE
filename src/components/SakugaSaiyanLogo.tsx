import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { SakugaParticles, TONE_MAP } from './SakugaVfx';

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

const SAIYAN_ACTIVE_MS = 1250;
const PULSE_LIFETIME_MS = 860;

export const SakugaSaiyanLogo: React.FC<SakugaSaiyanLogoProps> = ({ event, onLogoClick }) => {
  const [isPowered, setIsPowered] = useState(false);
  const [displayTag, setDisplayTag] = useState<{ label: string; tone: SaiyanTagTone }>({
    label: 'SPIDEY SAIYAN!',
    tone: 'amber',
  });
  const [pulses, setPulses] = useState<number[]>([]);

  const isPoweredRef = useRef(false);
  const powerOffTimerRef = useRef<number | null>(null);
  const pulseTimersRef = useRef<Map<number, number>>(new Map());

  const bodyControls = useAnimationControls();
  const hairControls = useAnimationControls();
  const auraControls = useAnimationControls();
  const tagControls = useAnimationControls();

  useEffect(() => {
    const timersMap = pulseTimersRef.current;
    return () => {
      if (powerOffTimerRef.current !== null) {
        window.clearTimeout(powerOffTimerRef.current);
      }
      for (const timerId of timersMap.values()) {
        window.clearTimeout(timerId);
      }
      timersMap.clear();
    };
  }, []);

  useEffect(() => {
    if (!event) return;

    const wasPowered = isPoweredRef.current;
    isPoweredRef.current = true;
    setIsPowered(true);
    setDisplayTag({ label: event.label, tone: event.tone });

    // Append at most 2 concurrent shockwave/particle pulses so spamming never causes lag or clutter
    const pulseId = event.seq;
    setPulses((prev) => [...prev.slice(-1), pulseId]);
    const pulseTimer = window.setTimeout(() => {
      pulseTimersRef.current.delete(pulseId);
      setPulses((prev) => prev.filter((id) => id !== pulseId));
    }, PULSE_LIFETIME_MS);
    pulseTimersRef.current.set(pulseId, pulseTimer);

    // Interruptible continuous body bounce on every click
    void bodyControls.start({
      scaleX: [1.16, 0.92, 1.05, 1],
      scaleY: [0.84, 1.13, 0.96, 1],
      y: [0, -3.5, 1, 0],
      transition: { duration: 0.42, times: [0, 0.34, 0.72, 1], ease: [0.22, 1, 0.36, 1] },
    });

    // When already powered (spamming), pulse existing hair, aura, and callout tag in-place cleanly
    if (wasPowered) {
      void hairControls.start({
        scaleY: [1, 1.18, 0.96, 1],
        scaleX: [1, 0.94, 1.04, 1],
        y: [0, -2, 0],
        transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
      });
      void auraControls.start({
        scale: [1, 1.14, 0.97, 1],
        rotate: [0, -4, 3, 0],
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
      });
      void tagControls.start({
        scale: [1, 1.14, 0.96, 1],
        y: [0, -5, 1, 0],
        rotate: [0, -3, 1, 0],
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      });
    }

    if (powerOffTimerRef.current !== null) {
      window.clearTimeout(powerOffTimerRef.current);
    }

    powerOffTimerRef.current = window.setTimeout(() => {
      powerOffTimerRef.current = null;
      isPoweredRef.current = false;
      setIsPowered(false);
      // Soft landing settle as Super Saiyan powers down cleanly
      void bodyControls.start({
        scaleX: [1, 1.06, 1],
        scaleY: [1, 0.94, 1],
        y: [0, 1.5, 0],
        transition: { duration: 0.28, ease: 'easeOut' },
      });
    }, SAIYAN_ACTIVE_MS);
  }, [event, bodyControls, hairControls, auraControls, tagControls]);

  const webStroke = isPowered ? '#FDE047' : '#18181B';
  const webOpacity = isPowered ? 0.92 : 0.72;
  const toneCfg = TONE_MAP[displayTag.tone];

  return (
    <div className="relative inline-flex shrink-0 items-center overflow-visible">
      <button
        type="button"
        onClick={onLogoClick}
        aria-label="Ôn FE — Người Nhện bật Super Saiyan"
        title="Bấm để Người Nhện hóa Super Saiyan!"
        className={`sakuga-btn group relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-xl border-2 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out focus-visible:outline-none sm:h-9 sm:w-9 ${
          isPowered
            ? 'border-[#78350F] bg-[#FEF08A] shadow-[0_0_0_2px_#FACC15,3px_3px_0_0_#EA580C] dark:border-[#FEF9C3] dark:bg-[#CA8A04] dark:shadow-[0_0_0_2px_#FEF08A,3px_3px_0_0_#EA580C]'
            : 'border-[#1E1B4B] bg-[#1D4ED8] shadow-[2px_2px_0_0_#93C5FD] hover:bg-[#1E40AF] dark:border-[#93C5FD] dark:bg-[#1E3A8A] dark:shadow-[2px_2px_0_0_#172554] dark:hover:bg-[#1D4ED8]'
        }`}
      >
        {/* Expanding Shockwave Rings per Click/Spam (self-cleaning, max 2 concurrent) */}
        {pulses.map((pulseId) => (
          <motion.span
            key={`saiyan-ring-${pulseId}`}
            aria-hidden="true"
            initial={{ scale: 0.85, opacity: 0.95 }}
            animate={{ scale: 1.62, opacity: 0 }}
            transition={{ duration: 0.48, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 z-0 rounded-xl border-2 border-[#FACC15]"
          />
        ))}

        {/* Flat Cel-Shaded Super Saiyan Ki Aura & Lightning with smooth power-down exit */}
        <AnimatePresence>
          {isPowered && (
            <motion.div
              key="saiyan-aura-presence"
              aria-hidden="true"
              initial={{ scale: 0.65, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                transition: { duration: 0.22, ease: 'easeOut' },
              }}
              exit={{
                scale: 0.58,
                opacity: 0,
                transition: { duration: 0.34, ease: [0.4, 0, 0.2, 1] },
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-14 w-14 -translate-x-1/2 -translate-y-1/2 overflow-visible sm:h-16 sm:w-16"
            >
              <motion.svg
                viewBox="0 0 72 72"
                animate={auraControls}
                className="h-full w-full overflow-visible"
              >
                {/* Outer flame aura spikes (flat cel orange & gold) */}
                <path
                  d="M36 2 L43 15 L57 7 L53 22 L68 24 L57 36 L67 49 L52 52 L53 66 L39 59 L36 69 L31 59 L18 66 L20 52 L5 49 L15 36 L4 24 L19 22 L15 7 L29 15 Z"
                  fill="#EA580C"
                  stroke="#7C2D12"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  opacity="0.82"
                />
                <path
                  d="M36 8 L41 19 L52 13 L49 25 L61 27 L52 37 L59 47 L48 49 L49 60 L38 55 L36 63 L33 55 L23 60 L24 49 L13 47 L20 37 L11 27 L23 25 L20 13 L31 19 Z"
                  fill="#FACC15"
                  opacity="0.92"
                />
                <path
                  d="M36 14 L40 23 L48 19 L46 28 L55 30 L48 37 L53 45 L45 47 L36 56 L27 47 L19 45 L24 37 L17 30 L26 28 L24 19 L32 23 Z"
                  fill="#FEF9C3"
                  opacity="0.9"
                />

                {/* Crisp diagonal ki lightning bolts */}
                <path
                  d="M11 21 L20 15 L17 24 L25 20"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M61 17 L52 24 L57 28 L49 34"
                  fill="none"
                  stroke="#FEF08A"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 53 L22 46 L19 41 L27 37"
                  fill="none"
                  stroke="#FEF08A"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chibi Spider-Man <-> Super Saiyan Spider-Man Bust (Persistent, zero remount on spam) */}
        <motion.div
          animate={bodyControls}
          className="relative z-10 flex h-full w-full items-center justify-center overflow-visible"
        >
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            className="h-7 w-7 overflow-visible transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:-rotate-3 sm:h-8 sm:w-8"
          >
            {/* Spider-Man Blue Shoulders & Red Chest Panel */}
            <path
              d="M9 45 C10 36.8 15.2 34 24 34 C32.8 34 38 36.8 39 45 Q24 46.5 9 45 Z"
              fill={isPowered ? '#2563EB' : '#1D4ED8'}
              stroke="#18181B"
              strokeWidth="1.9"
              strokeLinejoin="round"
              className="transition-[fill] duration-300 ease-out"
            />
            <path
              d="M16.5 34.4 L24 44.8 L31.5 34.4 Z"
              fill={isPowered ? '#EF4444' : '#DC2626'}
              stroke="#18181B"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="transition-[fill] duration-300 ease-out"
            />
            {/* Tiny Chest Spider Emblem (glows gold in Super Saiyan, smoothly returns to ink black) */}
            <ellipse
              cx="24"
              cy="39.4"
              rx="1.5"
              ry="2"
              fill={isPowered ? '#FACC15' : '#18181B'}
              className="transition-[fill] duration-300 ease-out"
            />
            <path
              d="M21 38 L24 39.2 L27 38 M20.8 40.5 L24 39.6 L27.2 40.5"
              fill="none"
              stroke={isPowered ? '#FACC15' : '#18181B'}
              strokeWidth="1.15"
              strokeLinecap="round"
              className="transition-[stroke] duration-300 ease-out"
            />

            {/* Chibi Spider-Man Red Mask Head */}
            <path
              d="M12.5 22.8 C12.5 14.5 17.5 10.2 24 10.2 C30.5 10.2 35.5 14.5 35.5 22.8 C35.5 30.6 30.2 35.8 24 35.8 C17.8 35.8 12.5 30.6 12.5 22.8 Z"
              fill={isPowered ? '#EF4444' : '#DC2626'}
              stroke="#18181B"
              strokeWidth="2"
              className="transition-[fill] duration-300 ease-out"
            />
            {/* Mask Forehead Highlight & Chin Shadow (flat cel shading) */}
            <path
              d="M16.8 14.4 C19 12 21.5 11.4 24 11.4 C26.5 11.4 29 12 31.2 14.4 C28.8 13.4 26.5 13 24 13 C21.5 13 19.2 13.4 16.8 14.4 Z"
              fill={isPowered ? '#FCA5A5' : '#F87171'}
              className="transition-[fill] duration-300 ease-out"
            />
            <path
              d="M16.5 31.6 C18.8 34.1 21.3 35 24 35 C26.7 35 29.2 34.1 31.5 31.6 C29 33 26.5 33.4 24 33.4 C21.5 33.4 19 33 16.5 31.6 Z"
              fill="#B91C1C"
            />

            {/* Iconic Spider-Man Mask Webbing (smoothly shifts between electric gold & ink black) */}
            <g
              fill="none"
              stroke={webStroke}
              strokeWidth="1.05"
              strokeLinecap="round"
              opacity={webOpacity}
              className="transition-[stroke,opacity] duration-300 ease-out"
            >
              <line x1="24" y1="10.8" x2="24" y2="35" />
              <line x1="24" y1="24.5" x2="17" y2="12.5" />
              <line x1="24" y1="24.5" x2="31" y2="12.5" />
              <line x1="24" y1="24.5" x2="15.5" y2="31.5" />
              <line x1="24" y1="24.5" x2="32.5" y2="31.5" />
              <path d="M14.2 17.5 Q24 14.8 33.8 17.5" />
              <path d="M14.8 29.6 Q24 27.6 33.2 29.6" />
            </g>

            {/* Golden Super Saiyan Spiky Hair — springs up cleanly and retracts smoothly on power-down */}
            <AnimatePresence>
              {isPowered && (
                <motion.g
                  key="saiyan-hair-presence"
                  initial={{ scaleY: 0.15, y: 7, opacity: 0 }}
                  animate={{ scaleY: 1, y: 0, opacity: 1 }}
                  exit={{
                    scaleY: 0.12,
                    y: 8,
                    opacity: 0,
                    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 18,
                  }}
                  style={{ originX: '24px', originY: '15px' }}
                >
                  <motion.g
                    animate={hairControls}
                    style={{ originX: '24px', originY: '15px' }}
                  >
                    <path
                      d="M12 16 L5 8 L13 7 L9 -2 L19 3 L24 -7 L29 3 L39 -2 L35 7 L43 8 L36 16 L31 12 L27 15 L24 10 L21 15 L17 12 Z"
                      fill="#FACC15"
                      stroke="#78350F"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <polygon points="24,-5 21,5 25,7 28,4" fill="#FEF9C3" />
                    <polygon points="10.5,0 14,7.5 18,5.5" fill="#FEF9C3" />
                    <polygon points="37.5,0 31,5.5 34,7.5" fill="#FEF9C3" />
                  </motion.g>
                </motion.g>
              )}
            </AnimatePresence>

            {/* Base White Spider-Man Lenses (always mounted) */}
            <path
              d="M15 20.5 Q18.8 18.2 22.3 23.2 Q19.2 26.8 15.8 25.2 Q14.2 23.2 15 20.5 Z"
              fill="#FFFFFF"
              stroke="#18181B"
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path
              d="M33 20.5 Q29.2 18.2 25.7 23.2 Q28.8 26.8 32.2 25.2 Q33.8 23.2 33 20.5 Z"
              fill="#FFFFFF"
              stroke="#18181B"
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <circle cx="17" cy="22" r="0.9" fill="#DBEAFE" />
            <circle cx="31" cy="22" r="0.9" fill="#DBEAFE" />

            {/* Super Saiyan Emerald Lens Glow Overlay (crossfades smoothly on/off) */}
            <g
              className={`transition-opacity duration-300 ease-out ${
                isPowered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <path
                d="M14.8 20.6 Q18.8 19 22.4 23.6 Q19.2 26.8 15.8 25.1 Q14.2 23.1 14.8 20.6 Z"
                fill="#34D399"
                stroke="#064E3B"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M33.2 20.6 Q29.2 19 25.6 23.6 Q28.8 26.8 32.2 25.1 Q33.8 23.1 33.2 20.6 Z"
                fill="#34D399"
                stroke="#064E3B"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="17.2" cy="22.4" r="1.05" fill="#ECFDF5" />
              <circle cx="30.8" cy="22.4" r="1.05" fill="#ECFDF5" />
            </g>
          </svg>
        </motion.div>

        {/* Subtle resting cel glint (fades smoothly) */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-1 top-1 z-20 h-1.5 w-1.5 rounded-full bg-[#FEF08A] transition-[opacity,transform] duration-200 group-hover:scale-125 ${
            isPowered ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </button>

      {/* Sakuga Manga Callout Text: persistent container during spam, smooth enter & gentle exit */}
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 overflow-visible">
        <AnimatePresence>
          {isPowered && (
            <motion.div
              key="saiyan-tag-presence"
              initial={{ opacity: 0, y: -12, scale: 0.72, rotate: -5 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{
                opacity: 0,
                y: 6,
                scale: 0.84,
                rotate: 2,
                transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] },
              }}
              transition={{ type: 'spring', stiffness: 380, damping: 20 }}
              className="relative inline-flex items-center justify-center overflow-visible"
            >
              {pulses.map((pulseId) => (
                <SakugaParticles
                  key={`tag-particles-${pulseId}`}
                  isMiss={displayTag.tone === 'rose'}
                  showShards={displayTag.tone === 'emerald' || displayTag.tone === 'amber'}
                  accentFill={toneCfg.accentFill}
                  smokeTint={toneCfg.smokeTint}
                  sparkleFill={toneCfg.sparkleFill}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[72px] w-[140px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
                />
              ))}

              <motion.span animate={tagControls} className="relative z-10 inline-flex">
                <span
                  className={`inline-flex -skew-x-12 items-center rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black italic tracking-wider whitespace-nowrap transition-colors duration-200 ${toneCfg.plateClass}`}
                >
                  <span className="skew-x-12">{displayTag.label}</span>
                </span>
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
