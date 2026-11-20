import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, Easing, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { StudyMode } from '../types/quiz';

export interface SakugaSpideyRoamerProps {
  mode: StudyMode;
}

type SpideyPose = 'idle' | 'crawl' | 'swing' | 'rappel' | 'peek' | 'nap' | 'cheer';
type ZoneTag = 'bottom' | 'left-wall' | 'right-wall' | 'top-left' | 'top-right';

interface RoamStep {
  zone: ZoneTag;
  pose: SpideyPose;
  x: number | number[];
  y: number | number[];
  rotate: number | number[];
  facing: 1 | -1;
  durationSec: number;
  times?: number[];
  ease?: Easing | Easing[];
  showWebStrand?: 'vertical' | 'swing' | 'none';
  swingDir?: 1 | -1;
  anchorX: number;
  anchorY: number;
}

const SLEEP_STORAGE_KEY = 'fpt_exam_spidey_sleep_v1';
const SPIDER_W = 32;
const SPIDER_H = 28;

const CHEER_LINES = [
  'THWIP!',
  'Cố lên!',
  'Auto 9+!',
  'Chắc kèo!',
  'Học hiểu thôi!',
] as const;

function randBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function loadSleepPreference(): boolean {
  try {
    return localStorage.getItem(SLEEP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveSleepPreference(sleeping: boolean): void {
  try {
    if (sleeping) {
      localStorage.setItem(SLEEP_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(SLEEP_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

interface SpideyClawdSpriteProps {
  pose: SpideyPose;
  facing: 1 | -1;
  durationSec: number;
  showWebStrand: 'vertical' | 'swing' | 'none';
  swingDir: 1 | -1;
  swingKey: number;
  sparkSeq: number;
}

/**
 * Pixel art Claude-Clawd-style spider dressed in Spider-Man red & blue.
 * 100% solid fills (Zero-Gradient).
 */
const SpideyClawdSprite: React.FC<SpideyClawdSpriteProps> = ({
  pose,
  facing,
  durationSec,
  showWebStrand,
  swingDir,
  swingKey,
  sparkSeq,
}) => {
  const isCrawling = pose === 'crawl';
  const isSwinging = pose === 'swing';
  const isRappel = pose === 'rappel';
  const isSleeping = pose === 'nap';
  const isCheer = pose === 'cheer';

  return (
    <div className="relative flex h-7 w-8 items-center justify-center">
      {/* Vertical silk web strand when rappelling upside-down from header area */}
      {showWebStrand === 'vertical' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[calc(100%-3px)] left-1/2 h-[300px] w-[1.5px] -translate-x-1/2 bg-[#94A3B8]/85 dark:bg-[#CBD5E1]/75"
        />
      )}

      {/* Angled sweeping silk line during web-swing arc */}
      {showWebStrand === 'swing' && (
        <motion.svg
          key={`web-swing-${swingKey}`}
          viewBox="0 0 80 120"
          aria-hidden="true"
          initial={{ rotate: swingDir > 0 ? 34 : -34, opacity: 0 }}
          animate={{
            rotate: swingDir > 0 ? [34, 0, -34] : [-34, 0, 34],
            opacity: [0, 0.85, 0.85, 0],
          }}
          transition={{
            duration: durationSec,
            times: [0, 0.5, 1],
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: '40px 116px' }}
          className="pointer-events-none absolute bottom-[calc(100%-6px)] left-1/2 h-[112px] w-[72px] -translate-x-1/2 overflow-visible"
        >
          <line
            x1="40"
            y1="118"
            x2="40"
            y2="2"
            stroke="#94A3B8"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="40" cy="4" r="2" fill="#FFFFFF" stroke="#18181B" strokeWidth="1" />
        </motion.svg>
      )}

      {/* Cozy drifting Zzz pixels while napping */}
      {isSleeping && (
        <div aria-hidden="true" className="pointer-events-none absolute -top-4 right-0">
          <motion.span
            animate={{ y: [0, -8], x: [0, 3], opacity: [0.8, 0] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut' }}
            className="block font-mono text-[9px] font-black text-[#4338CA] dark:text-[#A5B4FC]"
          >
            z
          </motion.span>
          <motion.span
            animate={{ y: [0, -10], x: [2, 6], opacity: [0, 0.75, 0] }}
            transition={{ duration: 2.1, delay: 0.9, repeat: Infinity, ease: 'easeOut' }}
            className="block font-mono text-[10px] font-black text-[#0284C7] dark:text-[#7DD3FC]"
          >
            Z
          </motion.span>
        </div>
      )}

      {/* Click cheer celebration sparks */}
      {sparkSeq > 0 && (
        <motion.svg
          key={`roam-sparks-${sparkSeq}`}
          viewBox="0 0 32 28"
          aria-hidden="true"
          initial={{ opacity: 1, scale: 0.7 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="pointer-events-none absolute -inset-2 h-11 w-12 overflow-visible"
        >
          <rect x="2" y="2" width="3" height="3" fill="#FDE047" />
          <rect x="27" y="3" width="3" height="3" fill="#FFFFFF" />
          <rect x="1" y="21" width="3" height="3" fill="#38BDF8" />
          <rect x="28" y="20" width="3" height="3" fill="#FDE047" />
        </motion.svg>
      )}

      {/* Main animated body wrapper */}
      <motion.div
        key={isCheer ? `cheer-flip-${sparkSeq}` : 'roam-body'}
        animate={
          isCheer
            ? { y: [0, -12, 0], rotate: [0, -360], scale: [1, 1.16, 1] }
            : isCrawling
              ? { y: [0, -1.5, 0], rotate: [-3, 3, -3] }
              : isSwinging
                ? { y: [0, -1, 0], scaleX: facing }
                : isRappel
                  ? { y: [0, 2, 0] }
                  : isSleeping
                    ? { scaleY: [1, 0.94, 1], scaleX: [1, 1.04, 1] }
                    : { y: [0, -1.5, 0] }
        }
        transition={
          isCheer
            ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
            : {
                duration: isCrawling ? 0.28 : isSleeping ? 2.6 : 1.9,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
        style={{ scaleX: isCheer || isSwinging ? undefined : facing }}
      >
        <svg
          viewBox="0 0 28 24"
          aria-hidden="true"
          className="h-7 w-8 overflow-visible drop-shadow-[1px_2px_0_rgba(24,24,27,0.38)]"
        >
          {/* Side Clawd-spider arms */}
          <motion.g
            animate={
              isCrawling
                ? { y: [0, -2, 0] }
                : isSwinging
                  ? { y: -2, rotate: -14 }
                  : { y: [0, -1, 0] }
            }
            transition={{
              duration: isCrawling ? 0.22 : 1.4,
              repeat: isSwinging ? 0 : Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '14px 10px' }}
          >
            <rect x="0" y="9" width="3" height="2" fill="#18181B" />
            <rect x="1" y="11" width="3" height="3" fill="#2563EB" />
            <rect x="25" y="9" width="3" height="2" fill="#18181B" />
            <rect x="24" y="11" width="3" height="3" fill="#2563EB" />
          </motion.g>

          {/* Chunky pixel shell border */}
          <rect x="4" y="2" width="20" height="15" rx="2" fill="#18181B" />

          {/* Spider-Man Crimson Red head */}
          <rect x="6" y="4" width="16" height="8" fill="#EF4444" />
          <rect x="20" y="4" width="2" height="8" fill="#DC2626" />
          {/* Forehead web ticks */}
          <rect x="13" y="4" width="2" height="2" fill="#991B1B" />
          <rect x="9" y="4" width="1.5" height="1.5" fill="#B91C1C" />
          <rect x="17.5" y="4" width="1.5" height="1.5" fill="#B91C1C" />

          {/* Cobalt Blue lower suit + pixel chest spider badge */}
          <rect x="6" y="12" width="16" height="3" fill="#2563EB" />
          <rect x="20" y="12" width="2" height="3" fill="#1D4ED8" />
          <rect x="12" y="11" width="4" height="2" fill="#18181B" />
          <rect x="13" y="11.5" width="2" height="1.2" fill="#EF4444" />

          {/* Eyes: sleepy squinted vs blinking expressive Spider-Man lenses */}
          {isSleeping ? (
            <>
              <rect x="7.5" y="8" width="4.5" height="1.5" fill="#18181B" />
              <rect x="16" y="8" width="4.5" height="1.5" fill="#18181B" />
            </>
          ) : (
            <motion.g
              animate={{ scaleY: [1, 1, 0.14, 1] }}
              transition={{
                duration: 0.22,
                repeat: Infinity,
                repeatDelay: 3.4,
                times: [0, 0.4, 0.7, 1],
              }}
              style={{ transformOrigin: '14px 8.5px' }}
            >
              <rect x="7" y="6" width="5" height="4" fill="#18181B" />
              <rect x="7.8" y="6.8" width="3.4" height="2.4" fill="#FFFFFF" />
              <rect x="10" y="7" width="1.2" height="2.2" fill="#FFFFFF" />
              <rect x="16" y="6" width="5" height="4" fill="#18181B" />
              <rect x="16.8" y="6.8" width="3.4" height="2.4" fill="#FFFFFF" />
              <rect x="16.8" y="7" width="1.2" height="2.2" fill="#FFFFFF" />
            </motion.g>
          )}

          {/* 4 stubby Clawd bottom legs scuttling in alternating pairs */}
          <motion.g
            animate={
              isCrawling
                ? { y: [0, -2, 0] }
                : isSleeping
                  ? { y: 0 }
                  : { y: [0, 1.1, 0] }
            }
            transition={{
              duration: isCrawling ? 0.22 : 0.7,
              repeat: isSleeping ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          >
            <rect x="5" y="17" width="3" height="4" fill="#18181B" />
            <rect x="5.5" y="17" width="2" height="3.2" fill="#EF4444" />
            <rect x="15" y="17" width="3" height="4" fill="#18181B" />
            <rect x="15.5" y="17" width="2" height="3.2" fill="#2563EB" />
          </motion.g>
          <motion.g
            animate={
              isCrawling
                ? { y: [-2, 0, -2] }
                : isSleeping
                  ? { y: 0 }
                  : { y: [1.1, 0, 1.1] }
            }
            transition={{
              duration: isCrawling ? 0.22 : 0.7,
              repeat: isSleeping ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          >
            <rect x="10" y="17" width="3" height="4" fill="#18181B" />
            <rect x="10.5" y="17" width="2" height="3.2" fill="#2563EB" />
            <rect x="20" y="17" width="3" height="4" fill="#18181B" />
            <rect x="20.5" y="17" width="2" height="3.2" fill="#EF4444" />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
};

export const SakugaSpideyRoamer: React.FC<SakugaSpideyRoamerProps> = ({ mode }) => {
  const prefersReducedMotion = useReducedMotion();
  const [isSleepingPref, setIsSleepingPref] = useState<boolean>(() => loadSleepPreference());
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  const [stepSeq, setStepSeq] = useState(0);
  const [currentStep, setCurrentStep] = useState<RoamStep>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    const initX = Math.max(12, w - 58);
    const initY = Math.max(120, h - 34);
    return {
      zone: 'bottom',
      pose: 'idle',
      x: initX,
      y: initY,
      rotate: 0,
      facing: -1,
      durationSec: 0.6,
      showWebStrand: 'none',
      anchorX: initX,
      anchorY: initY,
    };
  });

  const [isHovered, setIsHovered] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [sparkSeq, setSparkSeq] = useState(0);

  const stepRef = useRef(currentStep);
  stepRef.current = currentStep;

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const timerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const cheerLineIdxRef = useRef(0);

  // Sync window resize gracefully without jarring jumps
  useEffect(() => {
    let rafId = 0;
    const onResize = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setViewport({ w, h });
        setCurrentStep((prev) => ({
          ...prev,
          pose: 'idle',
          showWebStrand: 'none',
          x: clamp(prev.anchorX, 6, Math.max(12, w - SPIDER_W - 6)),
          y: clamp(prev.anchorY, 72, Math.max(100, h - SPIDER_H - 6)),
          anchorX: clamp(prev.anchorX, 6, Math.max(12, w - SPIDER_W - 6)),
          anchorY: clamp(prev.anchorY, 72, Math.max(100, h - SPIDER_H - 6)),
          rotate: 0,
          durationSec: 0.4,
        }));
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const clearScheduledTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isPausedQuietly = isSleepingPref || mode === 'exam' || Boolean(prefersReducedMotion);

  // Settle Spidey calmly into bottom-right corner when sleeping, reduced motion, or during mock exam
  useEffect(() => {
    clearScheduledTimer();
    const { w, h } = viewportRef.current;
    const cornerX = Math.max(8, w - 48);
    const cornerY = h >= 768 ? Math.max(120, h - 34) : Math.max(160, h - 102);

    if (isPausedQuietly) {
      setCurrentStep({
        zone: 'bottom',
        pose: isSleepingPref || mode === 'exam' ? 'nap' : 'idle',
        x: cornerX,
        y: cornerY,
        rotate: 0,
        facing: -1,
        durationSec: 0.85,
        showWebStrand: 'none',
        anchorX: cornerX,
        anchorY: cornerY,
      });
      setStepSeq((s) => s + 1);
      return;
    }

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      clearScheduledTimer();
      if (cancelled || document.visibilityState === 'hidden') return;
      timerRef.current = window.setTimeout(runNextStep, delayMs);
    };

    const runNextStep = () => {
      if (cancelled) return;
      const { w: vw, h: vh } = viewportRef.current;
      const prev = stepRef.current;
      const isDesktop = vw >= 768;

      const leftEdgeX = 4;
      const rightEdgeX = Math.max(12, vw - SPIDER_W - 4);
      const bottomY = isDesktop ? Math.max(140, vh - 34) : Math.max(170, vh - 110);
      const minWallY = isDesktop ? 90 : 156;
      const maxWallY = Math.max(minWallY + 40, bottomY - 46);
      const topRappelY = isDesktop ? 74 : 148;

      let nextStep: RoamStep;
      let restAfterMs = Math.round(randBetween(5500, 10500));

      if (!isDesktop) {
        // Mobile: keep strictly to left/right outer walls & gentle upper peeks (avoid footer bar & cards)
        const targetSide =
          prev.zone === 'left-wall'
            ? Math.random() < 0.72
              ? 'left-wall'
              : 'right-wall'
            : Math.random() < 0.72
              ? 'right-wall'
              : 'left-wall';
        const isLeft = targetSide === 'left-wall';
        const targetX = isLeft ? leftEdgeX : rightEdgeX;
        const targetY = Math.round(randBetween(minWallY, maxWallY));

        if (prev.zone !== targetSide && Math.abs(prev.anchorX - targetX) > 40) {
          // Cross cleanly along high silk swing
          const arcY = Math.max(148, Math.min(prev.anchorY, targetY) - 24);
          nextStep = {
            zone: targetSide,
            pose: 'swing',
            x: [prev.anchorX, (prev.anchorX + targetX) / 2, targetX],
            y: [prev.anchorY, arcY, targetY],
            rotate: isLeft ? [0, 18, -90] : [0, -18, 90],
            facing: isLeft ? -1 : 1,
            durationSec: 1.15,
            times: [0, 0.5, 1],
            showWebStrand: 'swing',
            swingDir: isLeft ? -1 : 1,
            anchorX: targetX,
            anchorY: targetY,
          };
        } else {
          // Crawl/peek along the outer edge
          nextStep = {
            zone: targetSide,
            pose: Math.random() < 0.5 ? 'crawl' : 'peek',
            x: isLeft ? (Math.random() < 0.4 ? -6 : leftEdgeX) : Math.random() < 0.4 ? rightEdgeX + 10 : rightEdgeX,
            y: targetY,
            rotate: isLeft ? 90 : -90,
            facing: targetY >= prev.anchorY ? 1 : -1,
            durationSec: clamp(Math.abs(targetY - prev.anchorY) / 70, 1.0, 2.4),
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: targetY,
          };
        }
      } else if (prev.zone === 'top-left' || prev.zone === 'top-right') {
        // Reel back down smoothly along the nearby wall
        const isLeft = prev.zone === 'top-left';
        const wallX = isLeft ? leftEdgeX : rightEdgeX;
        const dropY = Math.round(randBetween(minWallY + 20, maxWallY));
        nextStep = {
          zone: isLeft ? 'left-wall' : 'right-wall',
          pose: 'crawl',
          x: wallX,
          y: dropY,
          rotate: isLeft ? 90 : -90,
          facing: 1,
          durationSec: 1.8,
          showWebStrand: 'none',
          anchorX: wallX,
          anchorY: dropY,
        };
        restAfterMs = Math.round(randBetween(4500, 7500));
      } else if (prev.zone === 'left-wall' || prev.zone === 'right-wall') {
        const isLeft = prev.zone === 'left-wall';
        const wallX = isLeft ? leftEdgeX : rightEdgeX;
        const roll = Math.random();

        if (roll < 0.34) {
          // Drop upside-down on a silk web from the top corner below Header
          const cornerX = isLeft ? 18 : Math.max(24, vw - SPIDER_W - 18);
          const rappelEndY = Math.round(randBetween(topRappelY + 42, topRappelY + 95));
          nextStep = {
            zone: isLeft ? 'top-left' : 'top-right',
            pose: 'rappel',
            x: [prev.anchorX, cornerX, cornerX],
            y: [prev.anchorY, topRappelY, rappelEndY],
            rotate: [isLeft ? 90 : -90, 180, 180],
            facing: isLeft ? 1 : -1,
            durationSec: 1.9,
            times: [0, 0.42, 1],
            showWebStrand: 'vertical',
            anchorX: cornerX,
            anchorY: rappelEndY,
          };
          restAfterMs = Math.round(randBetween(5000, 8000));
        } else if (roll < 0.68) {
          // Side edge peek or quiet wall crawl
          const targetY = Math.round(randBetween(minWallY, maxWallY));
          const doPeek = Math.random() < 0.45;
          nextStep = {
            zone: prev.zone,
            pose: doPeek ? 'peek' : 'crawl',
            x: doPeek ? (isLeft ? -7 : rightEdgeX + 9) : wallX,
            y: targetY,
            rotate: isLeft ? 90 : -90,
            facing: targetY >= prev.anchorY ? 1 : -1,
            durationSec: clamp(Math.abs(targetY - prev.anchorY) / 75, 1.1, 2.5),
            showWebStrand: 'none',
            anchorX: wallX,
            anchorY: targetY,
          };
        } else {
          // Descend cleanly onto the bottom ledge
          const targetX = isLeft
            ? Math.round(randBetween(28, Math.min(vw * 0.42, vw - 80)))
            : Math.round(randBetween(Math.max(40, vw * 0.58), vw - 64));
          nextStep = {
            zone: 'bottom',
            pose: 'crawl',
            x: [prev.anchorX, wallX, targetX],
            y: [prev.anchorY, bottomY, bottomY],
            rotate: [isLeft ? 90 : -90, 0, 0],
            facing: targetX >= wallX ? 1 : -1,
            durationSec: 1.9,
            times: [0, 0.45, 1],
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: bottomY,
          };
        }
      } else {
        // Bottom ledge zone: crawl horizontally, low-arc web-swing, climb wall, or take a cozy nap
        const roll = Math.random();
        if (roll < 0.36) {
          // Calm horizontal crawl along bottom ledge
          const targetX = Math.round(randBetween(24, vw - SPIDER_W - 24));
          const dist = Math.abs(targetX - prev.anchorX);
          nextStep = {
            zone: 'bottom',
            pose: 'crawl',
            x: targetX,
            y: bottomY,
            rotate: 0,
            facing: targetX >= prev.anchorX ? 1 : -1,
            durationSec: clamp(dist / 95, 1.1, 3.6),
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: bottomY,
          };
        } else if (roll < 0.66) {
          // Graceful low-altitude web-swing across the bottom margin (never covers main quiz cards!)
          const minTarget = 28;
          const maxTarget = vw - SPIDER_W - 28;
          const goRight = prev.anchorX < vw * 0.5 ? Math.random() < 0.78 : Math.random() < 0.22;
          const span = randBetween(180, Math.min(460, vw * 0.52));
          const targetX = Math.round(
            clamp(prev.anchorX + (goRight ? span : -span), minTarget, maxTarget)
          );
          const dir: 1 | -1 = targetX >= prev.anchorX ? 1 : -1;
          const midX = Math.round((prev.anchorX + targetX) / 2);
          const arcY = Math.round(bottomY - randBetween(48, 82));

          nextStep = {
            zone: 'bottom',
            pose: 'swing',
            x: [prev.anchorX, midX, targetX],
            y: [bottomY, arcY, bottomY],
            rotate: [0, dir * -14, dir * 10, 0],
            facing: dir,
            durationSec: clamp(Math.abs(targetX - prev.anchorX) / 210, 1.05, 1.75),
            times: [0, 0.5, 1],
            showWebStrand: 'swing',
            swingDir: dir,
            anchorX: targetX,
            anchorY: bottomY,
          };
          restAfterMs = Math.round(randBetween(4500, 8500));
        } else if (roll < 0.86) {
          // Climb up left or right peripheral wall
          const useLeft = prev.anchorX < vw * 0.5;
          const wallX = useLeft ? leftEdgeX : rightEdgeX;
          const climbY = Math.round(randBetween(minWallY + 10, maxWallY - 10));
          nextStep = {
            zone: useLeft ? 'left-wall' : 'right-wall',
            pose: 'crawl',
            x: [prev.anchorX, wallX, wallX],
            y: [bottomY, bottomY, climbY],
            rotate: [0, useLeft ? 90 : -90, useLeft ? 90 : -90],
            facing: -1,
            durationSec: 2.1,
            times: [0, 0.45, 1],
            showWebStrand: 'none',
            anchorX: wallX,
            anchorY: climbY,
          };
        } else {
          // Cozy brief nap in current spot
          nextStep = {
            zone: 'bottom',
            pose: 'nap',
            x: prev.anchorX,
            y: bottomY,
            rotate: 0,
            facing: prev.facing,
            durationSec: 0.45,
            showWebStrand: 'none',
            anchorX: prev.anchorX,
            anchorY: bottomY,
          };
          restAfterMs = Math.round(randBetween(7000, 12000));
        }
      }

      setCurrentStep(nextStep);
      setStepSeq((s) => s + 1);

      const moveMs = Math.round(nextStep.durationSec * 1000);
      // Settle to calm idle pose smoothly once travel animation finishes (keep nap/rappel/peek poses)
      const isTravelPose = nextStep.pose === 'crawl' || nextStep.pose === 'swing';
      if (isTravelPose) {
        timerRef.current = window.setTimeout(() => {
          if (cancelled) return;
          setCurrentStep((cur) => ({
            ...cur,
            pose: 'idle',
            showWebStrand: 'none',
            x: cur.anchorX,
            y: cur.anchorY,
            rotate: cur.zone === 'left-wall' ? 90 : cur.zone === 'right-wall' ? -90 : 0,
            durationSec: 0.2,
          }));
          scheduleNext(restAfterMs);
        }, moveMs + 40);
      } else {
        scheduleNext(moveMs + restAfterMs);
      }
    };

    // Start playfully 2.2s after mounting/waking so initial page load stays calm
    scheduleNext(2200);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduledTimer();
      } else if (!cancelled) {
        scheduleNext(2400);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearScheduledTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [clearScheduledTimer, isPausedQuietly, isSleepingPref, mode]);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
    };
  }, []);

  const handleSpiderClick = () => {
    if (isSleepingPref) {
      setIsSleepingPref(false);
      saveSleepPreference(false);
      setBubbleText('Dậy rồi nè!');
    } else {
      const nextLine = CHEER_LINES[cheerLineIdxRef.current % CHEER_LINES.length];
      cheerLineIdxRef.current += 1;
      setBubbleText(nextLine);
    }

    setSparkSeq((s) => s + 1);
    setCurrentStep((prev) => ({ ...prev, pose: 'cheer' }));

    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubbleText(null);
      setCurrentStep((prev) => ({
        ...prev,
        pose: isPausedQuietly ? 'nap' : prev.zone.startsWith('top') ? 'rappel' : 'idle',
      }));
    }, 1450);
  };

  const handleToggleSleep = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isSleepingPref;
    setIsSleepingPref(next);
    saveSleepPreference(next);
    if (next) {
      setBubbleText(null);
    } else {
      setBubbleText('THWIP!');
      setSparkSeq((s) => s + 1);
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      bubbleTimerRef.current = window.setTimeout(() => setBubbleText(null), 1100);
    }
  };

  // Clamp speech bubble placement inside viewport so edges never clip text
  const bubbleHorizontalClass =
    currentStep.anchorX < 105
      ? 'left-0'
      : currentStep.anchorX > viewport.w - 115
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';
  const bubbleVerticalClass = currentStep.anchorY < 130 ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]';
  const sleepBtnHorizontalClass = currentStep.anchorX > viewport.w - 80 ? '-left-5' : '-right-5';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      <motion.div
        style={{ left: 0, top: 0 }}
        initial={false}
        animate={{
          x: currentStep.x,
          y: currentStep.y,
          rotate: currentStep.rotate,
          scale: viewport.w < 768 ? 0.84 : 1,
        }}
        transition={{
          duration: currentStep.durationSec,
          times: currentStep.times,
          ease: currentStep.ease ?? 'easeInOut',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="pointer-events-auto absolute h-7 w-8 select-none"
      >
        {/* Flat cel-shaded speech callout on tap/wake */}
        <AnimatePresence>
          {bubbleText && (() => {
            const bubbleRotate = Array.isArray(currentStep.rotate) ? 0 : -currentStep.rotate;
            return (
              <motion.div
                key={`bubble-${sparkSeq}-${bubbleText}`}
                initial={{ opacity: 0, scale: 0.72, y: 4, rotate: bubbleRotate }}
                animate={{ opacity: 1, scale: 1, y: 0, rotate: bubbleRotate }}
                exit={{ opacity: 0, scale: 0.78, y: -3, rotate: bubbleRotate }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-lg border-2 border-[#18181B] bg-[#FAF9F5] px-2 py-0.5 text-[10px] font-black tracking-tight text-[#18181B] shadow-[2px_2px_0_0_#FDE047] dark:border-[#E7E5E4] dark:bg-[#1E221F] dark:text-[#F5F5F4] dark:shadow-[2px_2px_0_0_#EF4444] ${bubbleVerticalClass} ${bubbleHorizontalClass}`}
              >
                {bubbleText}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Discreet hover Sleep/Wake button */}
        <AnimatePresence>
          {(isHovered || isSleepingPref) && (
            <motion.button
              type="button"
              onClick={handleToggleSleep}
              aria-label={isSleepingPref ? 'Đánh thức Spidey-Clawd' : 'Cho Spidey-Clawd đi ngủ'}
              title={isSleepingPref ? 'Đánh thức nhện Spidey' : 'Cho nhện nghỉ yên (không bay)'}
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 0.9, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ duration: 0.15 }}
              className={`absolute -top-2.5 z-30 flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border border-[#27272A] bg-[#FAF9F5] text-[#292524] shadow-[1px_1px_0_0_#27272A] transition hover:bg-[#EEF2FF] hover:text-[#4338CA] dark:border-[#71717A] dark:bg-[#1E221F] dark:text-[#E7E5E4] dark:hover:bg-[#312E81]/60 ${sleepBtnHorizontalClass}`}
            >
              {isSleepingPref ? (
                <Sun className="h-2.5 w-2.5 text-[#F59E0B]" />
              ) : (
                <Moon className="h-2.5 w-2.5" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Interactive Spidey-Clawd Tap Target */}
        <button
          type="button"
          onClick={handleSpiderClick}
          tabIndex={-1}
          title={
            isSleepingPref
              ? 'Spidey-Clawd đang ngủ • Bấm để đánh thức'
              : 'Spidey-Clawd • Bấm để tung tơ cổ vũ!'
          }
          className="flex h-full w-full cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
        >
          <SpideyClawdSprite
            pose={currentStep.pose}
            facing={currentStep.facing}
            durationSec={currentStep.durationSec}
            showWebStrand={currentStep.showWebStrand ?? 'none'}
            swingDir={currentStep.swingDir ?? 1}
            swingKey={stepSeq}
            sparkSeq={sparkSeq}
          />
        </button>
      </motion.div>
    </div>
  );
};
