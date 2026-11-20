import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, Easing, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { StudyMode } from '../types/quiz';

export interface SakugaSpideyRoamerProps {
  mode: StudyMode;
}

type SpideyPose =
  | 'idle'
  | 'crawl'
  | 'swing'
  | 'rappel'
  | 'peek'
  | 'nap'
  | 'cheer'
  | 'fall'
  | 'pop'
  | 'confused'
  | 'pout';

type ZoneTag = 'bottom' | 'left-wall' | 'right-wall' | 'top-left' | 'top-right';

interface RoamStep {
  zone: ZoneTag;
  pose: SpideyPose;
  x: number | number[];
  y: number | number[];
  rotate: number | number[];
  facing: 1 | -1;
  durationSec: number;
  rotateDurationSec?: number;
  times?: number[];
  ease?: Easing | Easing[];
  showWebStrand?: 'vertical' | 'swing' | 'none';
  swingDir?: 1 | -1;
  anchorX: number;
  anchorY: number;
  targetRotate: number;
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
  sparkSeq: number;
}

/**
 * Pixel art Claude-Clawd-style spider dressed in Spider-Man red & blue.
 * Rotation and silk web strands are handled by outer wrappers so webs & UI always orient cleanly.
 */
const SpideyClawdSprite: React.FC<SpideyClawdSpriteProps> = ({
  pose,
  facing,
  sparkSeq,
}) => {
  const isCrawling = pose === 'crawl';
  const isSwinging = pose === 'swing';
  const isRappel = pose === 'rappel';
  const isSleeping = pose === 'nap';
  const isCheer = pose === 'cheer';
  const isFalling = pose === 'fall';
  const isPopping = pose === 'pop';
  const isConfused = pose === 'confused';
  const isPouting = pose === 'pout';

  return (
    <div className="relative flex h-7 w-8 items-center justify-center">
      {/* Click / landing / web-cut pixel sparks */}
      {sparkSeq > 0 && (
        <motion.svg
          key={`roam-sparks-${sparkSeq}`}
          viewBox="0 0 32 28"
          aria-hidden="true"
          initial={{ opacity: 1, scale: 0.7 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
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
        key={isCheer ? `cheer-flip-${sparkSeq}` : isPopping ? `pop-bounce-${sparkSeq}` : 'roam-body'}
        animate={
          isCheer
            ? { y: [0, -12, 0], rotate: [0, -360], scale: [1, 1.16, 1] }
            : isPopping
              ? { scaleX: [1.24, 0.88, 1.06, 1], scaleY: [0.78, 1.18, 0.94, 1], y: [2, -6, 0] }
              : isFalling
                ? { scaleX: 0.94, scaleY: 1.08 }
                : isConfused
                  ? { rotate: -9, y: [0, -1.2, 0] }
                  : isPouting
                    ? { rotate: 6, y: [0, 1, 0], scale: [1, 0.97, 1] }
                    : isCrawling
                      ? { y: [0, -1.5, 0], rotate: [-3, 3, -3] }
                      : isSwinging
                        ? { y: [0, -1, 0], scaleX: facing }
                        : isRappel
                          ? { y: [0, 2, 0], rotate: [-3.5, 3.5, -3.5] }
                          : isSleeping
                            ? { scaleY: [1, 0.94, 1], scaleX: [1, 1.04, 1] }
                            : { y: [0, -1.5, 0] }
        }
        transition={
          isCheer
            ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
            : isPopping
              ? { duration: 0.36, times: [0, 0.38, 0.72, 1], ease: [0.22, 1, 0.36, 1] }
              : isFalling
                ? { duration: 0.12 }
                : {
                    duration: isCrawling ? 0.28 : isSleeping ? 2.6 : 1.9,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
        }
        style={{ scaleX: isCheer || isSwinging || isConfused || isPouting ? undefined : facing }}
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
                : isSwinging || isFalling
                  ? { y: -2.5, rotate: -14 }
                  : isPouting
                    ? { y: 1 }
                    : { y: [0, -1, 0] }
            }
            transition={{
              duration: isCrawling ? 0.22 : 1.4,
              repeat: isSwinging || isFalling || isPouting ? 0 : Infinity,
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

          {/* Eyes driven by current comedy / mood state */}
          {isSleeping ? (
            <>
              <rect x="7.5" y="8" width="4.5" height="1.5" fill="#18181B" />
              <rect x="16" y="8" width="4.5" height="1.5" fill="#18181B" />
            </>
          ) : isFalling ? (
            <>
              {/* Surprised O_O eyes while tumbling */}
              <rect x="7" y="5.5" width="5" height="5" fill="#18181B" />
              <rect x="8" y="6.5" width="3" height="3" fill="#FFFFFF" />
              <rect x="16" y="5.5" width="5" height="5" fill="#18181B" />
              <rect x="17" y="6.5" width="3" height="3" fill="#FFFFFF" />
            </>
          ) : isConfused ? (
            <>
              {/* Asymmetrical o_O puzzled eyes ("Huh?") */}
              <rect x="7" y="7" width="5" height="3" fill="#18181B" />
              <rect x="8" y="7.8" width="3" height="1.4" fill="#FFFFFF" />
              <rect x="16" y="5.5" width="5" height="4.8" fill="#18181B" />
              <rect x="16.8" y="6.3" width="3.4" height="3.2" fill="#FFFFFF" />
            </>
          ) : isPouting ? (
            <>
              {/* Narrowed sulky eyes + cute anime cross mark ("Dỗi") */}
              <rect x="7" y="7.5" width="5" height="2.6" fill="#18181B" />
              <rect x="8" y="8.2" width="3.2" height="1.2" fill="#FFFFFF" />
              <rect x="16" y="7.5" width="5" height="2.6" fill="#18181B" />
              <rect x="16.8" y="8.2" width="3.2" height="1.2" fill="#FFFFFF" />
              <rect x="21" y="1" width="1.5" height="4" fill="#FDE047" />
              <rect x="19.8" y="2.2" width="4" height="1.5" fill="#FDE047" />
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
                : isSleeping || isPouting
                  ? { y: 0 }
                  : { y: [0, 1.1, 0] }
            }
            transition={{
              duration: isCrawling ? 0.22 : 0.7,
              repeat: isSleeping || isPouting ? 0 : Infinity,
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
                : isSleeping || isPouting
                  ? { y: 0 }
                  : { y: [1.1, 0, 1.1] }
            }
            transition={{
              duration: isCrawling ? 0.22 : 0.7,
              repeat: isSleeping || isPouting ? 0 : Infinity,
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
  const [isDoiSleeping, setIsDoiSleeping] = useState<boolean>(false);
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
      targetRotate: 0,
    };
  });

  const [isHovered, setIsHovered] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [sparkSeq, setSparkSeq] = useState(0);

  const roamerRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(currentStep);
  stepRef.current = currentStep;

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const timerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const fallTimersRef = useRef<number[]>([]);
  const isFallingRef = useRef(false);
  const cheerLineIdxRef = useRef(0);

  const clearScheduledTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearFallSequence = useCallback(() => {
    for (const id of fallTimersRef.current) {
      window.clearTimeout(id);
    }
    fallTimersRef.current = [];
    isFallingRef.current = false;
  }, []);

  // Sync window resize gracefully without jarring jumps
  useEffect(() => {
    let rafId = 0;
    const onResize = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setViewport({ w, h });
        if (isFallingRef.current) return;
        setCurrentStep((prev) => ({
          ...prev,
          pose: prev.pose === 'nap' ? 'nap' : 'idle',
          showWebStrand: 'none',
          x: clamp(prev.anchorX, 6, Math.max(12, w - SPIDER_W - 6)),
          y: clamp(prev.anchorY, 72, Math.max(100, h - SPIDER_H - 6)),
          anchorX: clamp(prev.anchorX, 6, Math.max(12, w - SPIDER_W - 6)),
          anchorY: clamp(prev.anchorY, 72, Math.max(100, h - SPIDER_H - 6)),
          rotate: 0,
          targetRotate: 0,
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

  const isPausedQuietly =
    isSleepingPref || isDoiSleeping || mode === 'exam' || Boolean(prefersReducedMotion);

  // Settle Spidey calmly when sleeping, sulking ("Dỗi"), reduced motion, or during mock exam
  useEffect(() => {
    clearScheduledTimer();
    const { w, h } = viewportRef.current;
    const isDesktop = w >= 768;
    const bottomY = isDesktop ? Math.max(140, h - 34) : Math.max(170, h - 106);

    if (isPausedQuietly) {
      // Cancel in-progress fall only if mode became exam or permanent sleep was toggled
      if (isSleepingPref || mode === 'exam' || prefersReducedMotion) {
        clearFallSequence();
      }

      const keepLandingSpot = isDoiSleeping && !isSleepingPref && mode !== 'exam' && !prefersReducedMotion;
      const settleX = keepLandingSpot
        ? clamp(stepRef.current.anchorX, 8, Math.max(12, w - SPIDER_W - 8))
        : Math.max(8, w - 48);
      const settleY = keepLandingSpot ? bottomY : h >= 768 ? Math.max(120, h - 34) : Math.max(160, h - 102);

      setCurrentStep({
        zone: 'bottom',
        pose: isSleepingPref || isDoiSleeping || mode === 'exam' ? 'nap' : 'idle',
        x: settleX,
        y: settleY,
        rotate: 0,
        facing: -1,
        durationSec: keepLandingSpot ? 0.28 : 0.85,
        showWebStrand: 'none',
        anchorX: settleX,
        anchorY: settleY,
        targetRotate: 0,
      });
      setStepSeq((s) => s + 1);
      return;
    }

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      clearScheduledTimer();
      if (cancelled || isFallingRef.current || document.visibilityState === 'hidden') return;
      timerRef.current = window.setTimeout(runNextStep, delayMs);
    };

    const runNextStep = () => {
      if (cancelled || isFallingRef.current) return;
      const { w: vw, h: vh } = viewportRef.current;
      const prev = stepRef.current;
      const desktop = vw >= 768;

      const leftEdgeX = 4;
      const rightEdgeX = Math.max(12, vw - SPIDER_W - 4);
      const ledgeY = desktop ? Math.max(140, vh - 34) : Math.max(170, vh - 110);
      const minWallY = desktop ? 90 : 156;
      const maxWallY = Math.max(minWallY + 40, ledgeY - 46);
      const topRappelY = desktop ? 74 : 148;

      let nextStep: RoamStep;
      let restAfterMs = Math.round(randBetween(5500, 10500));

      const makeWebDropStep = (isLeft: boolean, startX: number, startY: number, startRot: number): RoamStep => {
        const cornerX = isLeft ? 18 : Math.max(24, vw - SPIDER_W - 18);
        const dropEndY = Math.round(randBetween(topRappelY + 46, topRappelY + 108));
        // ~60% hang upright (0deg, gentle hang), ~40% hang upside-down (180deg, Spider-Man pose)
        const hangRot = Math.random() < 0.6 ? 0 : 180;
        return {
          zone: isLeft ? 'top-left' : 'top-right',
          pose: 'rappel',
          x: [startX, cornerX, cornerX],
          y: [startY, topRappelY, dropEndY],
          rotate: [startRot, hangRot, hangRot],
          facing: isLeft ? 1 : -1,
          durationSec: 1.9,
          times: [0, 0.42, 1],
          showWebStrand: 'vertical',
          anchorX: cornerX,
          anchorY: dropEndY,
          targetRotate: hangRot,
        };
      };

      if (!desktop) {
        // Mobile: keep strictly to left/right outer walls & gentle upper peeks
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
        const endRot = isLeft ? 90 : -90;

        if (prev.zone !== targetSide && Math.abs(prev.anchorX - targetX) > 40) {
          const arcY = Math.max(148, Math.min(prev.anchorY, targetY) - 24);
          nextStep = {
            zone: targetSide,
            pose: 'swing',
            x: [prev.anchorX, (prev.anchorX + targetX) / 2, targetX],
            y: [prev.anchorY, arcY, targetY],
            rotate: isLeft ? [prev.targetRotate, 18, endRot] : [prev.targetRotate, -18, endRot],
            facing: isLeft ? -1 : 1,
            durationSec: 1.15,
            times: [0, 0.5, 1],
            showWebStrand: 'swing',
            swingDir: isLeft ? -1 : 1,
            anchorX: targetX,
            anchorY: targetY,
            targetRotate: endRot,
          };
        } else {
          nextStep = {
            zone: targetSide,
            pose: Math.random() < 0.5 ? 'crawl' : 'peek',
            x: isLeft ? (Math.random() < 0.4 ? -6 : leftEdgeX) : Math.random() < 0.4 ? rightEdgeX + 10 : rightEdgeX,
            y: targetY,
            rotate: endRot,
            facing: targetY >= prev.anchorY ? 1 : -1,
            durationSec: clamp(Math.abs(targetY - prev.anchorY) / 70, 1.0, 2.4),
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: targetY,
            targetRotate: endRot,
          };
        }
      } else if (prev.zone === 'top-left' || prev.zone === 'top-right') {
        // Reel back onto nearby wall gracefully
        const isLeft = prev.zone === 'top-left';
        const wallX = isLeft ? leftEdgeX : rightEdgeX;
        const dropY = Math.round(randBetween(minWallY + 20, maxWallY));
        const endRot = isLeft ? 90 : -90;
        nextStep = {
          zone: isLeft ? 'left-wall' : 'right-wall',
          pose: 'crawl',
          x: wallX,
          y: dropY,
          rotate: endRot,
          facing: 1,
          durationSec: 1.8,
          showWebStrand: 'none',
          anchorX: wallX,
          anchorY: dropY,
          targetRotate: endRot,
        };
        restAfterMs = Math.round(randBetween(4500, 7500));
      } else if (prev.zone === 'left-wall' || prev.zone === 'right-wall') {
        const isLeft = prev.zone === 'left-wall';
        const wallX = isLeft ? leftEdgeX : rightEdgeX;
        const wallRot = isLeft ? 90 : -90;
        const roll = Math.random();

        if (roll < 0.36) {
          // Hang on a silk web from the top corner below Header (mix of upright & upside-down)
          nextStep = makeWebDropStep(isLeft, prev.anchorX, prev.anchorY, wallRot);
          restAfterMs = Math.round(randBetween(5000, 8000));
        } else if (roll < 0.68) {
          const targetY = Math.round(randBetween(minWallY, maxWallY));
          const doPeek = Math.random() < 0.45;
          nextStep = {
            zone: prev.zone,
            pose: doPeek ? 'peek' : 'crawl',
            x: doPeek ? (isLeft ? -7 : rightEdgeX + 9) : wallX,
            y: targetY,
            rotate: wallRot,
            facing: targetY >= prev.anchorY ? 1 : -1,
            durationSec: clamp(Math.abs(targetY - prev.anchorY) / 75, 1.1, 2.5),
            showWebStrand: 'none',
            anchorX: wallX,
            anchorY: targetY,
            targetRotate: wallRot,
          };
        } else {
          // Descend cleanly onto bottom ledge
          const targetX = isLeft
            ? Math.round(randBetween(28, Math.min(vw * 0.42, vw - 80)))
            : Math.round(randBetween(Math.max(40, vw * 0.58), vw - 64));
          nextStep = {
            zone: 'bottom',
            pose: 'crawl',
            x: [prev.anchorX, wallX, targetX],
            y: [prev.anchorY, ledgeY, ledgeY],
            rotate: [wallRot, 0, 0],
            facing: targetX >= wallX ? 1 : -1,
            durationSec: 1.9,
            times: [0, 0.45, 1],
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: ledgeY,
            targetRotate: 0,
          };
        }
      } else {
        // Bottom ledge zone: crawl, low-arc web-swing, wall climb, direct corner web hang, or cozy nap
        const roll = Math.random();
        if (roll < 0.32) {
          const targetX = Math.round(randBetween(24, vw - SPIDER_W - 24));
          const dist = Math.abs(targetX - prev.anchorX);
          nextStep = {
            zone: 'bottom',
            pose: 'crawl',
            x: targetX,
            y: ledgeY,
            rotate: 0,
            facing: targetX >= prev.anchorX ? 1 : -1,
            durationSec: clamp(dist / 95, 1.1, 3.6),
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: ledgeY,
            targetRotate: 0,
          };
        } else if (roll < 0.62) {
          const minTarget = 28;
          const maxTarget = vw - SPIDER_W - 28;
          const goRight = prev.anchorX < vw * 0.5 ? Math.random() < 0.78 : Math.random() < 0.22;
          const span = randBetween(180, Math.min(460, vw * 0.52));
          const targetX = Math.round(
            clamp(prev.anchorX + (goRight ? span : -span), minTarget, maxTarget)
          );
          const dir: 1 | -1 = targetX >= prev.anchorX ? 1 : -1;
          const midX = Math.round((prev.anchorX + targetX) / 2);
          const arcY = Math.round(ledgeY - randBetween(48, 82));

          nextStep = {
            zone: 'bottom',
            pose: 'swing',
            x: [prev.anchorX, midX, targetX],
            y: [ledgeY, arcY, ledgeY],
            rotate: [0, dir * -14, dir * 10, 0],
            facing: dir,
            durationSec: clamp(Math.abs(targetX - prev.anchorX) / 210, 1.05, 1.75),
            times: [0, 0.5, 1],
            showWebStrand: 'swing',
            swingDir: dir,
            anchorX: targetX,
            anchorY: ledgeY,
            targetRotate: 0,
          };
          restAfterMs = Math.round(randBetween(4500, 8500));
        } else if (roll < 0.76) {
          // Zip up straight to a corner silk web hang (mix upright / upside-down)
          const useLeft = prev.anchorX < vw * 0.5;
          nextStep = makeWebDropStep(useLeft, prev.anchorX, prev.anchorY, 0);
          restAfterMs = Math.round(randBetween(5000, 8000));
        } else if (roll < 0.88) {
          const useLeft = prev.anchorX < vw * 0.5;
          const wallX = useLeft ? leftEdgeX : rightEdgeX;
          const climbY = Math.round(randBetween(minWallY + 10, maxWallY - 10));
          const wallRot = useLeft ? 90 : -90;
          nextStep = {
            zone: useLeft ? 'left-wall' : 'right-wall',
            pose: 'crawl',
            x: [prev.anchorX, wallX, wallX],
            y: [ledgeY, ledgeY, climbY],
            rotate: [0, wallRot, wallRot],
            facing: -1,
            durationSec: 2.1,
            times: [0, 0.45, 1],
            showWebStrand: 'none',
            anchorX: wallX,
            anchorY: climbY,
            targetRotate: wallRot,
          };
        } else {
          nextStep = {
            zone: 'bottom',
            pose: 'nap',
            x: prev.anchorX,
            y: ledgeY,
            rotate: 0,
            facing: prev.facing,
            durationSec: 0.45,
            showWebStrand: 'none',
            anchorX: prev.anchorX,
            anchorY: ledgeY,
            targetRotate: 0,
          };
          restAfterMs = Math.round(randBetween(7000, 12000));
        }
      }

      setCurrentStep(nextStep);
      setStepSeq((s) => s + 1);

      const moveMs = Math.round(nextStep.durationSec * 1000);
      const isTravelPose = nextStep.pose === 'crawl' || nextStep.pose === 'swing';
      if (isTravelPose) {
        timerRef.current = window.setTimeout(() => {
          if (cancelled || isFallingRef.current) return;
          const restRot =
            nextStep.zone === 'left-wall' ? 90 : nextStep.zone === 'right-wall' ? -90 : 0;
          setCurrentStep((cur) => ({
            ...cur,
            pose: 'idle',
            showWebStrand: 'none',
            x: cur.anchorX,
            y: cur.anchorY,
            rotate: restRot,
            targetRotate: restRot,
            durationSec: 0.2,
          }));
          scheduleNext(restAfterMs);
        }, moveMs + 40);
      } else {
        scheduleNext(moveMs + restAfterMs);
      }
    };

    scheduleNext(2200);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduledTimer();
      } else if (!cancelled && !isFallingRef.current) {
        scheduleNext(2400);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearScheduledTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [clearFallSequence, clearScheduledTimer, isDoiSleeping, isPausedQuietly, isSleepingPref, mode, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      clearFallSequence();
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
    };
  }, [clearFallSequence]);

  const handleSpiderClick = () => {
    // 1. If currently sleeping (either manual Moon or "Dỗi" nap), wake up happily!
    if (isSleepingPref || isDoiSleeping) {
      const wasDoi = isDoiSleeping;
      if (isSleepingPref) {
        setIsSleepingPref(false);
        saveSleepPreference(false);
      }
      if (wasDoi) {
        setIsDoiSleeping(false);
      }
      setSparkSeq((s) => s + 1);
      setBubbleText(wasDoi ? 'Hết dỗi rồi!' : 'Dậy rồi nè!');
      setCurrentStep((prev) => ({ ...prev, pose: 'cheer' }));

      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      bubbleTimerRef.current = window.setTimeout(() => {
        setBubbleText(null);
        setCurrentStep((prev) => ({ ...prev, pose: 'idle' }));
      }, 1450);
      return;
    }

    // 2. Guard against clicks mid-fall/sulking comedy sequence
    if (isFallingRef.current) return;

    const { w: vw, h: vh } = viewportRef.current;
    const isDesktop = vw >= 768;
    const bottomY = isDesktop ? Math.max(140, vh - 34) : Math.max(170, vh - 110);
    const rect = roamerRef.current?.getBoundingClientRect();
    const liveX = rect ? clamp(rect.left, 6, Math.max(12, vw - SPIDER_W - 6)) : stepRef.current.anchorX;
    const liveY = rect ? clamp(rect.top, 64, bottomY) : stepRef.current.anchorY;

    const isOffGround =
      stepRef.current.zone !== 'bottom' ||
      stepRef.current.pose === 'swing' ||
      stepRef.current.pose === 'rappel' ||
      stepRef.current.pose === 'peek' ||
      liveY < bottomY - 12;

    // 3. Off-Ground Comedy Choreography: Drop -> Bounce Pop -> "Huh?" -> "Dỗi" -> Nap!
    if (isOffGround) {
      clearScheduledTimer();
      clearFallSequence();
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = null;
      }

      isFallingRef.current = true;
      const landX = clamp(liveX, 16, Math.max(20, vw - SPIDER_W - 16));
      const curRot = stepRef.current.targetRotate;

      setBubbleText(null);
      setSparkSeq((s) => s + 1);

      // Phase 1 (0ms -> 560ms): Web snaps, drops straight to bottom ground tumbling
      setCurrentStep({
        zone: 'bottom',
        pose: 'fall',
        x: landX,
        y: [liveY, bottomY],
        rotate: [curRot, curRot + 190, 180],
        rotateDurationSec: 0.54,
        facing: 1,
        durationSec: 0.56,
        ease: [0.55, 0.06, 0.88, 0.28],
        showWebStrand: 'none',
        anchorX: landX,
        anchorY: bottomY,
        targetRotate: 180,
      });

      // Phase 2 (560ms): Hits bottom & pops right side up!
      const tPop = window.setTimeout(() => {
        setSparkSeq((s) => s + 1);
        setCurrentStep({
          zone: 'bottom',
          pose: 'pop',
          x: landX,
          y: [bottomY, bottomY - 14, bottomY],
          rotate: 0,
          rotateDurationSec: 0.24,
          facing: 1,
          durationSec: 0.36,
          times: [0, 0.45, 1],
          ease: [0.22, 1, 0.36, 1],
          showWebStrand: 'none',
          anchorX: landX,
          anchorY: bottomY,
          targetRotate: 0,
        });
      }, 560);

      // Phase 3 (920ms): Blinks confused & says "Huh?"
      const tHuh = window.setTimeout(() => {
        setBubbleText('Huh?');
        setCurrentStep((prev) => ({
          ...prev,
          pose: 'confused',
          x: landX,
          y: bottomY,
          rotate: 0,
          durationSec: 0.2,
          anchorX: landX,
          anchorY: bottomY,
          targetRotate: 0,
        }));
      }, 920);

      // Phase 4 (2300ms): Switches to "Dỗi" pout!
      const tDoi = window.setTimeout(() => {
        setBubbleText('Dỗi');
        setCurrentStep((prev) => ({
          ...prev,
          pose: 'pout',
          x: landX,
          y: bottomY,
          rotate: 0,
          durationSec: 0.2,
          anchorX: landX,
          anchorY: bottomY,
          targetRotate: 0,
        }));
      }, 2300);

      // Phase 5 (3850ms): Fades text out & curls into sleep ("nap") right where he landed
      const tSleep = window.setTimeout(() => {
        setBubbleText(null);
        isFallingRef.current = false;
        setIsDoiSleeping(true);
      }, 3850);

      fallTimersRef.current = [tPop, tHuh, tDoi, tSleep];
      return;
    }

    // 4. Already on ground: playful 360° backflip + cheerful encouragement
    const nextLine = CHEER_LINES[cheerLineIdxRef.current % CHEER_LINES.length];
    cheerLineIdxRef.current += 1;
    setBubbleText(nextLine);
    setSparkSeq((s) => s + 1);
    setCurrentStep((prev) => ({ ...prev, pose: 'cheer' }));

    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubbleText(null);
      setCurrentStep((prev) => ({
        ...prev,
        pose: isPausedQuietly ? 'nap' : 'idle',
      }));
    }, 1450);
  };

  const handleToggleSleep = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearFallSequence();
    if (isSleepingPref || isDoiSleeping) {
      setIsSleepingPref(false);
      saveSleepPreference(false);
      setIsDoiSleeping(false);
      setBubbleText('THWIP!');
      setSparkSeq((s) => s + 1);
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      bubbleTimerRef.current = window.setTimeout(() => setBubbleText(null), 1100);
    } else {
      setIsSleepingPref(true);
      saveSleepPreference(true);
      setBubbleText(null);
    }
  };

  // Clamp speech bubble placement cleanly inside viewport
  const bubbleHorizontalClass =
    currentStep.anchorX < 105
      ? 'left-0'
      : currentStep.anchorX > viewport.w - 115
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';
  const bubbleVerticalClass =
    currentStep.anchorY < 130 ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]';
  const sleepBtnHorizontalClass = currentStep.anchorX > viewport.w - 80 ? '-left-5' : '-right-5';

  const isAnySleep = isSleepingPref || isDoiSleeping;
  const isSleepingVisual = currentStep.pose === 'nap';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Unrotated outer container: holds position, silk web strands UPWARD, speech bubble, Zzz & Sleep button */}
      <motion.div
        ref={roamerRef}
        style={{ left: 0, top: 0 }}
        initial={false}
        animate={{
          x: currentStep.x,
          y: currentStep.y,
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
        {/* Vertical silk web strand rising straight UP to Header seam (works for both 0° upright & 180° upside-down!) */}
        {currentStep.showWebStrand === 'vertical' && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[calc(100%-4px)] left-1/2 h-[380px] w-[1.5px] -translate-x-1/2 bg-[#94A3B8]/85 dark:bg-[#CBD5E1]/75"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-[#18181B] bg-[#FFFFFF]"
            />
          </>
        )}

        {/* Angled sweeping silk line during bottom web-swing arc */}
        {currentStep.showWebStrand === 'swing' && (
          <motion.svg
            key={`web-swing-${stepSeq}`}
            viewBox="0 0 80 120"
            aria-hidden="true"
            initial={{ rotate: (currentStep.swingDir ?? 1) > 0 ? 34 : -34, opacity: 0 }}
            animate={{
              rotate:
                (currentStep.swingDir ?? 1) > 0 ? [34, 0, -34] : [-34, 0, 34],
              opacity: [0, 0.85, 0.85, 0],
            }}
            transition={{
              duration: currentStep.durationSec,
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

        {/* Cozy floating Zzz pixels while sleeping (always float upright upward) */}
        {isSleepingVisual && (
          <div aria-hidden="true" className="pointer-events-none absolute -top-4 right-0 z-20">
            <motion.span
              animate={{ y: [0, -8], x: [0, 3], opacity: [0.85, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut' }}
              className="block font-mono text-[9px] font-black text-[#4338CA] dark:text-[#A5B4FC]"
            >
              z
            </motion.span>
            <motion.span
              animate={{ y: [0, -10], x: [2, 6], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.1, delay: 0.9, repeat: Infinity, ease: 'easeOut' }}
              className="block font-mono text-[10px] font-black text-[#0284C7] dark:text-[#7DD3FC]"
            >
              Z
            </motion.span>
          </div>
        )}

        {/* Upright flat cel-shaded speech callout ("Huh?", "Dỗi", "THWIP!", ...) */}
        <AnimatePresence>
          {bubbleText && (
            <motion.div
              key={`bubble-${bubbleText}`}
              initial={{ opacity: 0, scale: 0.72, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.78, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-lg border-2 border-[#18181B] px-2 py-0.5 text-[10.5px] font-black tracking-tight shadow-[2px_2px_0_0_#FDE047] dark:border-[#E7E5E4] dark:shadow-[2px_2px_0_0_#EF4444] ${
                bubbleText === 'Dỗi'
                  ? 'bg-[#FFE4E6] text-[#9F1239] dark:bg-[#881337] dark:text-[#FFE4E6]'
                  : 'bg-[#FAF9F5] text-[#18181B] dark:bg-[#1E221F] dark:text-[#F5F5F4]'
              } ${bubbleVerticalClass} ${bubbleHorizontalClass}`}
            >
              {bubbleText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Discreet hover Sleep/Wake toggle */}
        <AnimatePresence>
          {(isHovered || isAnySleep) && (
            <motion.button
              type="button"
              onClick={handleToggleSleep}
              aria-label={isAnySleep ? 'Đánh thức Spidey-Clawd' : 'Cho Spidey-Clawd đi ngủ'}
              title={isAnySleep ? 'Đánh thức nhện Spidey' : 'Cho nhện nghỉ yên (không bay)'}
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 0.9, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ duration: 0.15 }}
              className={`absolute -top-2.5 z-30 flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border border-[#27272A] bg-[#FAF9F5] text-[#292524] shadow-[1px_1px_0_0_#27272A] transition hover:bg-[#EEF2FF] hover:text-[#4338CA] dark:border-[#71717A] dark:bg-[#1E221F] dark:text-[#E7E5E4] dark:hover:bg-[#312E81]/60 ${sleepBtnHorizontalClass}`}
            >
              {isAnySleep ? (
                <Sun className="h-2.5 w-2.5 text-[#F59E0B]" />
              ) : (
                <Moon className="h-2.5 w-2.5" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Interactive Tap Target + Inner Rotating Sprite Wrapper */}
        <button
          type="button"
          onClick={handleSpiderClick}
          tabIndex={-1}
          title={
            isAnySleep
              ? 'Spidey-Clawd đang ngủ • Bấm để đánh thức'
              : 'Spidey-Clawd • Thử chọc khi đang đu tơ xem!'
          }
          className="flex h-full w-full cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
        >
          <motion.div
            animate={{ rotate: currentStep.rotate }}
            transition={{
              duration: currentStep.rotateDurationSec ?? currentStep.durationSec,
              times: currentStep.times,
              ease: currentStep.ease ?? 'easeInOut',
            }}
            className="flex items-center justify-center"
          >
            <SpideyClawdSprite
              pose={currentStep.pose}
              facing={currentStep.facing}
              sparkSeq={sparkSeq}
            />
          </motion.div>
        </button>
      </motion.div>
    </div>
  );
};
