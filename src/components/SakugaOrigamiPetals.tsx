import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { StudyMode } from '../types/quiz';

export interface SakugaOrigamiPetalsProps {
  mode: StudyMode;
}

type PetalVariant = 0 | 1 | 2;

interface PetalSpec {
  id: number;
  kind: 'petal' | 'spark';
  variant: PetalVariant;
  startX: number;
  startY: number;
  endY: number;
  driftX: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  rotXSpeed: number;
  rotYSpeed: number;
  rotZSpeed: number;
  startRotZ: number;
  scale: number;
  delayMs: number;
  durationMs: number;
}

interface PetalShowerState {
  id: number;
  petals: PetalSpec[];
  headerSafeTop: number;
  maxEndMs: number;
}

// Strictly rarer than SakugaLuminousButterfly (25–45s first visit, 3–6 min cooldown)
const FIRST_VISIT_MIN_MS = 75000;
const FIRST_VISIT_MAX_MS = 120000;
const COOLDOWN_MIN_MS = 420000;
const COOLDOWN_MAX_MS = 660000;

function randBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function getViewportSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  return {
    w: Math.round(window.visualViewport?.width ?? window.innerWidth),
    h: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
}

function getHeaderSafeTop(vw: number, vh: number): number {
  if (typeof document !== 'undefined') {
    const headerRect = document.querySelector('header')?.getBoundingClientRect();
    if (headerRect && headerRect.height > 0) {
      if (headerRect.bottom <= 0) {
        return 18;
      }
      return Math.min(Math.round(headerRect.bottom + 12), Math.round(vh * 0.45));
    }
  }
  return vw >= 768 ? 80 : 176;
}

function buildPetalShower(showerId: number): PetalShowerState {
  const { w: vw, h: vh } = getViewportSize();
  const isMobile = vw < 768;
  const petalCount = isMobile ? 9 : 13;
  const sparkCount = isMobile ? 4 : 6;
  const totalCount = petalCount + sparkCount;
  const windDir = Math.random() < 0.5 ? 1 : -1;
  const headerSafeTop = getHeaderSafeTop(vw, vh);

  const petals: PetalSpec[] = [];
  let maxEndMs = 0;

  for (let i = 0; i < totalCount; i++) {
    const isSpark = i >= petalCount;
    const stepIdx = isSpark ? i - petalCount : i;
    const groupSize = isSpark ? sparkCount : petalCount;
    const stepFrac = (stepIdx + randBetween(0.15, 0.85)) / groupSize;
    const biasOffset = windDir > 0 ? -vw * 0.08 : vw * 0.08;
    const startX = clamp(
      Math.round(stepFrac * vw + biasOffset + randBetween(-36, 36)),
      12,
      Math.max(24, vw - 12)
    );
    const delayMs = Math.round((stepIdx / Math.max(1, groupSize - 1)) * 3200 + randBetween(0, 550));
    const durationMs = Math.round(
      isSpark ? randBetween(4800, 7400) : randBetween(6000, 8800)
    );
    maxEndMs = Math.max(maxEndMs, delayMs + durationMs);

    petals.push({
      id: i,
      kind: isSpark ? 'spark' : 'petal',
      variant: (i % 3) as PetalVariant,
      startX,
      startY: -28,
      endY: vh + 36,
      driftX: windDir * (isMobile ? randBetween(35, 85) : randBetween(55, 145)),
      swayAmp: isMobile ? randBetween(12, 26) : randBetween(16, 42),
      swayFreq: randBetween(0.85, 1.55),
      phase: randBetween(0, Math.PI * 2),
      rotXSpeed: isSpark ? 0 : randBetween(1.2, 2.3) * (Math.random() < 0.5 ? 1 : -1),
      rotYSpeed: isSpark ? 0 : randBetween(28, 72) * (Math.random() < 0.5 ? 1 : -1),
      rotZSpeed: isSpark ? randBetween(24, 52) * windDir : randBetween(16, 40) * windDir,
      startRotZ: randBetween(-32, 32),
      scale: isSpark ? randBetween(0.65, 1.05) : randBetween(0.66, 0.98),
      delayMs,
      durationMs,
    });
  }

  return { id: showerId, petals, headerSafeTop, maxEndMs };
}

/**
 * Multi-faceted crystal sakura origami petals sharing the exact color DNA & sleek bevels
 * of OrigamiButterflySvg (100% Zero-Gradient, 3 sculpted silhouettes).
 */
const OrigamiPetalSvg: React.FC<{ variant: PetalVariant; sizeClass?: string }> = memo(
  ({ variant, sizeClass = 'h-6 w-[22px]' }) => {
    const strokeClass = 'stroke-[#E0E7FF]/55 dark:[stroke:none]';
    const glowClass =
      'h-full w-full overflow-visible drop-shadow-[0_0_4px_rgba(79,70,229,0.5)] drop-shadow-[0_0_9px_rgba(219,39,119,0.28)] dark:drop-shadow-[0_0_4px_rgba(255,255,255,0.95)] dark:drop-shadow-[0_0_10px_rgba(196,181,253,0.85)] dark:drop-shadow-[0_0_16px_rgba(244,114,182,0.48)]';

    return (
      <div className={`relative flex ${sizeClass} items-center justify-center`}>
        {/* Subtle pinpoint core aura */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-[#6366F1]/25 blur-[3px] dark:bg-[#F5D0FE]/45"
        />

        <svg viewBox="0 0 28 32" aria-hidden="true" className={glowClass}>
          {variant === 0 && (
            <>
              {/* Swept Crystal Swallow-Sakura Petal */}
              <polygon
                points="14,7.5 4.5,2.5 5.5,16.5"
                className={`fill-[#312E81] dark:fill-[#FFFFFF] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="14,7.5 5.5,16.5 13.5,19"
                className={`fill-[#4F46E5] dark:fill-[#DDD6FE] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="14,7.5 23.5,3 22,15.5"
                className={`fill-[#7C3AED] dark:fill-[#F5F3FF] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="14,7.5 22,15.5 14.5,19"
                className={`fill-[#6D28D9] dark:fill-[#C4B5FD] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="13.5,19 5.5,16.5 13.5,30"
                className={`fill-[#1E1B4B] dark:fill-[#EDE9FE] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="14.5,19 22,15.5 13.5,30"
                className={`fill-[#DB2777] dark:fill-[#F472B6] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
            </>
          )}

          {variant === 1 && (
            <>
              {/* Folded Prism Blossom Blade */}
              <polygon
                points="15,4 6,7 7.5,17"
                className={`fill-[#4F46E5] dark:fill-[#FFFFFF] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="15,4 23,6.5 19.5,16"
                className={`fill-[#312E81] dark:fill-[#E0F2FE] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="15,4 7.5,17 19.5,16"
                className={`fill-[#6D28D9] dark:fill-[#DDD6FE] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="7.5,17 13,20.5 12,29"
                className={`fill-[#DB2777] dark:fill-[#FBCFE8] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="19.5,16 13,20.5 12,29"
                className={`fill-[#1E1B4B] dark:fill-[#C4B5FD] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="15,9 13,20.5 17,15"
                className={`fill-[#0284C7] dark:fill-[#FFFFFF] ${strokeClass}`}
                strokeWidth="0.35"
                strokeLinejoin="round"
              />
            </>
          )}

          {variant === 2 && (
            <>
              {/* Slender Origami Crescent Petal */}
              <polygon
                points="13,3 5,9 9.5,16"
                className={`fill-[#BE185D] dark:fill-[#FCE7F3] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="13,3 22,8 15.5,17"
                className={`fill-[#312E81] dark:fill-[#FFFFFF] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="13,3 9.5,16 15.5,17"
                className={`fill-[#7C3AED] dark:fill-[#DDD6FE] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="9.5,16 15.5,17 16.5,29.5"
                className={`fill-[#4F46E5] dark:fill-[#F9A8D4] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <polygon
                points="15.5,17 21.5,18 16.5,29.5"
                className={`fill-[#DB2777] dark:fill-[#F472B6] ${strokeClass}`}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
      </div>
    );
  }
);

OrigamiPetalSvg.displayName = 'OrigamiPetalSvg';

const OrigamiStarGlintSvg: React.FC<{ variant: PetalVariant }> = memo(({ variant }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    className="h-3 w-3 overflow-visible drop-shadow-[0_0_4px_rgba(124,58,237,0.75)] dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
  >
    <polygon
      points="8,1 9.6,6.4 15,8 9.6,9.6 8,15 6.4,9.6 1,8 6.4,6.4"
      className={
        variant === 0
          ? 'fill-[#4338CA] dark:fill-[#FFFFFF]'
          : variant === 1
            ? 'fill-[#DB2777] dark:fill-[#F9A8D4]'
            : 'fill-[#0284C7] dark:fill-[#DDD6FE]'
      }
    />
  </svg>
));

OrigamiStarGlintSvg.displayName = 'OrigamiStarGlintSvg';

export const SakugaOrigamiPetals: React.FC<SakugaOrigamiPetalsProps> = ({ mode }) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const isDisabled = mode === 'exam' || prefersReducedMotion;

  const [shower, setShower] = useState<PetalShowerState | null>(null);
  const [showBlessing, setShowBlessing] = useState(false);

  const isActiveRef = useRef(false);
  const hasVisitedOnceRef = useRef(false);
  const showerIdRef = useRef(1);

  const spawnTimerRef = useRef<number | null>(null);
  const blessingTimersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const petalElRefs = useRef<Array<HTMLDivElement | null>>([]);
  const blessingWrapRef = useRef<HTMLDivElement>(null);
  const startShowerRef = useRef<(() => void) | null>(null);

  const clearSpawnTimer = useCallback(() => {
    if (spawnTimerRef.current !== null) {
      window.clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
  }, []);

  const clearBlessingTimers = useCallback(() => {
    for (const id of blessingTimersRef.current) {
      window.clearTimeout(id);
    }
    blessingTimersRef.current = [];
  }, []);

  const cancelShowerLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const scheduleVisit = useCallback(
    (isInitial: boolean) => {
      clearSpawnTimer();
      if (isDisabled || document.visibilityState === 'hidden' || isActiveRef.current) return;
      const delay = isInitial
        ? Math.round(randBetween(FIRST_VISIT_MIN_MS, FIRST_VISIT_MAX_MS))
        : Math.round(randBetween(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS));

      spawnTimerRef.current = window.setTimeout(() => {
        spawnTimerRef.current = null;
        startShowerRef.current?.();
      }, delay);
    },
    [clearSpawnTimer, isDisabled]
  );

  useEffect(() => {
    if (isDisabled) {
      clearSpawnTimer();
      clearBlessingTimers();
      cancelShowerLoop();
      isActiveRef.current = false;
      setShower(null);
      setShowBlessing(false);
      return;
    }

    let unmounted = false;

    const startShower = () => {
      if (unmounted || isDisabled || document.visibilityState === 'hidden') return;
      cancelShowerLoop();
      clearBlessingTimers();

      showerIdRef.current += 1;
      const nextShower = buildPetalShower(showerIdRef.current);
      petalElRefs.current = new Array(nextShower.petals.length).fill(null);

      isActiveRef.current = true;
      hasVisitedOnceRef.current = true;
      setShower(nextShower);

      const showTimer = window.setTimeout(() => {
        if (!unmounted && isActiveRef.current) {
          setShowBlessing(true);
        }
      }, 250);
      const hideTimer = window.setTimeout(() => {
        if (!unmounted) {
          setShowBlessing(false);
        }
      }, 5850);
      blessingTimersRef.current.push(showTimer, hideTimer);

      const startTime = performance.now();

      const step = (now: number) => {
        if (unmounted || !isActiveRef.current) return;

        const elapsed = now - startTime;

        for (let i = 0; i < nextShower.petals.length; i++) {
          const el = petalElRefs.current[i];
          if (!el) continue;

          const petal = nextShower.petals[i];
          const petalElapsed = elapsed - petal.delayMs;
          if (petalElapsed <= 0 || petalElapsed >= petal.durationMs) {
            el.style.opacity = '0';
            continue;
          }

          const p = petalElapsed / petal.durationMs;
          const y = petal.startY + p * (petal.endY - petal.startY);
          const sway = Math.sin(petalElapsed * 0.001 * petal.swayFreq + petal.phase) * petal.swayAmp;
          const x = petal.startX + p * petal.driftX + sway;

          const fadeIn = Math.min(1, p / 0.12);
          const fadeOut = Math.min(1, (1 - p) / 0.16);
          const twinkle =
            petal.kind === 'spark' ? 0.65 + 0.35 * Math.sin(petalElapsed * 0.008 + petal.phase) : 1;
          const opacity = Math.min(fadeIn, fadeOut) * 0.95 * twinkle;

          const tSec = petalElapsed * 0.001;
          const rx = Math.sin(tSec * petal.rotXSpeed + petal.phase) * 44;
          const ry = tSec * petal.rotYSpeed;
          const rz = petal.startRotZ + tSec * petal.rotZSpeed;

          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) perspective(95px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg) scale(${petal.scale.toFixed(2)})`;
          el.style.opacity = opacity.toFixed(3);
        }

        if (elapsed >= nextShower.maxEndMs) {
          rafRef.current = null;
          isActiveRef.current = false;
          setShowBlessing(false);
          setShower(null);
          scheduleVisit(false);
          return;
        }

        rafRef.current = window.requestAnimationFrame(step);
      };

      rafRef.current = window.requestAnimationFrame(step);
    };

    startShowerRef.current = startShower;
    scheduleVisit(true);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearSpawnTimer();
        clearBlessingTimers();
        cancelShowerLoop();
        if (isActiveRef.current) {
          isActiveRef.current = false;
          setShowBlessing(false);
          setShower(null);
        }
      } else if (!unmounted && !isDisabled) {
        scheduleVisit(!hasVisitedOnceRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unmounted = true;
      isActiveRef.current = false;
      startShowerRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearSpawnTimer();
      clearBlessingTimers();
      cancelShowerLoop();
    };
  }, [cancelShowerLoop, clearBlessingTimers, clearSpawnTimer, isDisabled, scheduleVisit]);

  useEffect(() => {
    if (!shower) return;

    const syncBlessingTop = () => {
      const el = blessingWrapRef.current;
      if (!el) return;
      const { w: vw, h: vh } = getViewportSize();
      el.style.top = `${getHeaderSafeTop(vw, vh) + 4}px`;
    };

    window.addEventListener('scroll', syncBlessingTop, { passive: true });
    return () => {
      window.removeEventListener('scroll', syncBlessingTop);
    };
  }, [shower]);

  if (isDisabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Falling folded crystal origami blossom petals & accompanying starlight glints */}
      {shower?.petals.map((petal, idx) => (
        <div
          key={`sakura-petal-${shower.id}-${petal.id}`}
          ref={(el) => {
            petalElRefs.current[idx] = el;
          }}
          style={{ opacity: 0, left: 0, top: 0 }}
          className="pointer-events-none fixed left-0 top-0 will-change-transform"
        >
          {petal.kind === 'spark' ? (
            <OrigamiStarGlintSvg variant={petal.variant} />
          ) : (
            <OrigamiPetalSvg variant={petal.variant} />
          )}
        </div>
      ))}

      {/* Delicate floating "học tốt nha" blessing pill matching the crystal origami prism theme */}
      <AnimatePresence>
        {showBlessing && shower && (
          <motion.div
            ref={blessingWrapRef}
            key={`sakura-blessing-${shower.id}`}
            style={{ top: shower.headerSafeTop + 4 }}
            initial={{ opacity: 0, y: -8, scale: 0.94 }}
            animate={{ opacity: 1, y: [0, 3, 0], scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{
              opacity: { duration: 0.42, ease: 'easeOut' },
              scale: { duration: 0.42, ease: 'easeOut' },
              y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[#7C3AED]/45 bg-[#FFFFFF]/95 px-4 py-1.5 text-xs font-bold tracking-wide text-[#4C1D95] shadow-[3px_3px_0_0_#DDD6FE,0_10px_24px_-8px_rgba(124,58,237,0.22)] dark:border-[#C4B5FD]/50 dark:bg-[#1E221F]/92 dark:text-[#F5F3FF] dark:shadow-[0_0_20px_rgba(167,139,250,0.42),3px_3px_0_0_#4C1D95] sm:text-sm"
          >
            <OrigamiPetalSvg variant={0} sizeClass="h-5 w-[18px] shrink-0" />
            <span>học tốt nha</span>
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 shrink-0">
              <polygon
                points="8,1 9.8,6.2 15,8 9.8,9.8 8,15 6.2,9.8 1,8 6.2,6.2"
                className="fill-[#DB2777] dark:fill-[#F472B6]"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
