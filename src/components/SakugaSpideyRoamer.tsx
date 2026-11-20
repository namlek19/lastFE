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
  | 'hop'
  | 'swing'
  | 'rappel'
  | 'nap'
  | 'cheer'
  | 'fall'
  | 'pop'
  | 'confused'
  | 'pout';

type ZoneTag = 'bottom' | 'perch' | 'web';

interface ComponentLedge {
  el: Element;
  minX: number;
  maxX: number;
  ledgeY: number;
  width: number;
}

interface PerchedTarget {
  el: Element;
  offsetX: number;
}

interface RoamStep {
  zone: ZoneTag;
  pose: SpideyPose;
  x: number | number[];
  y: number | number[];
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

/**
 * Finds visible top edges of study cards, sidebars, toolbars, and footer
 * so Spidey-Clawd can hop onto them without obstructing central card text.
 */
function scanComponentLedges(vw: number, _vh: number, bottomY: number): ComponentLedge[] {
  if (typeof document === 'undefined') return [];
  const headerSafeTop = vw >= 768 ? 78 : 146;
  const maxLedgeY = bottomY - 16;
  if (maxLedgeY <= headerSafeTop + 12) return [];

  const nodes = document.querySelectorAll(
    'main .rounded-3xl, main .rounded-2xl, aside .rounded-2xl, footer'
  );
  const raw: ComponentLedge[] = [];

  for (const el of nodes) {
    if (el.closest('header, [role="dialog"], [role="listbox"]')) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 130 || rect.height < 42) continue;

    const ledgeY = Math.round(rect.top - SPIDER_H + 4);
    if (ledgeY < headerSafeTop || ledgeY > maxLedgeY) continue;

    const minX = Math.round(clamp(rect.left + 16, 8, vw - SPIDER_W - 8));
    const maxX = Math.round(clamp(rect.right - SPIDER_W - 16, 8, vw - SPIDER_W - 8));
    if (maxX - minX < 48) continue;

    raw.push({
      el,
      minX,
      maxX,
      ledgeY,
      width: maxX - minX,
    });
  }

  // Deduplicate nested surfaces within 20px vertically and overlapping horizontally (prefer outer/wider surface)
  raw.sort((a, b) => a.ledgeY - b.ledgeY || b.width - a.width);
  const deduped: ComponentLedge[] = [];
  for (const cand of raw) {
    const overlapsExisting = deduped.some(
      (kept) =>
        Math.abs(kept.ledgeY - cand.ledgeY) < 20 &&
        cand.minX < kept.maxX &&
        cand.maxX > kept.minX
    );
    if (!overlapsExisting) {
      deduped.push(cand);
    }
  }
  return deduped;
}

/** Prefer outer shoulders of cards so Spidey feels cozy at card edges rather than center titles */
function pickPerchX(ledge: ComponentLedge): number {
  const roll = Math.random();
  if (roll < 0.36) {
    return Math.round(randBetween(ledge.minX, ledge.minX + Math.min(84, ledge.width * 0.3)));
  }
  if (roll < 0.72) {
    return Math.round(randBetween(ledge.maxX - Math.min(84, ledge.width * 0.3), ledge.maxX));
  }
  return Math.round(randBetween(ledge.minX, ledge.maxX));
}

function computeLivePerchCoords(
  perch: PerchedTarget,
  vw: number,
  bottomY: number
): { x: number; y: number } | null {
  if (!perch.el.isConnected) return null;
  const headerSafeTop = vw >= 768 ? 72 : 142;
  const rect = perch.el.getBoundingClientRect();
  if (rect.width < 110 || rect.height < 32) return null;

  const y = Math.round(rect.top - SPIDER_H + 4);
  if (y < headerSafeTop || y > bottomY - 4) return null;

  const minX = Math.round(clamp(rect.left + 14, 8, vw - SPIDER_W - 8));
  const maxX = Math.round(clamp(rect.right - SPIDER_W - 14, 8, vw - SPIDER_W - 8));
  if (maxX < minX) return null;

  const x = Math.round(clamp(rect.left + perch.offsetX, minX, maxX));
  return { x, y };
}

interface SpideyClawdSpriteProps {
  pose: SpideyPose;
  facing: 1 | -1;
  sparkSeq: number;
}

/**
 * Pixel art Claude-Clawd-style spider dressed in Spider-Man red & blue.
 * Stays cleanly upright (no 2D spin rotations), using lively bouncing, hopping,
 * squash-and-stretch, and expressive pixel animation.
 */
const SpideyClawdSprite: React.FC<SpideyClawdSpriteProps> = ({
  pose,
  facing,
  sparkSeq,
}) => {
  const isCrawling = pose === 'crawl';
  const isHopping = pose === 'hop' || pose === 'swing';
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

      {/* Main upright animated body (no spin rotations — lively platformer hops & squash/stretch!) */}
      <div style={{ transform: facing < 0 ? 'scaleX(-1)' : undefined }}>
        <motion.div
          key={isCheer ? `cheer-hop-${sparkSeq}` : isPopping ? `pop-hop-${sparkSeq}` : 'roam-body'}
          animate={
            isCheer
              ? {
                  y: [0, -14, 0, -9, 0],
                  scaleX: [1.14, 0.9, 1.18, 0.94, 1],
                  scaleY: [0.86, 1.14, 0.82, 1.08, 1],
                }
              : isPopping
                ? {
                    scaleX: [1.28, 0.88, 1.08, 1],
                    scaleY: [0.74, 1.18, 0.92, 1],
                    y: [2, -6, 0],
                  }
                : isFalling
                  ? { scaleX: 0.9, scaleY: 1.14, y: [0, -1, 0] }
                  : isConfused
                    ? { y: [0, -5, 0], scaleY: [1, 1.08, 1] }
                    : isPouting
                      ? { y: [0, -3, 0, -2, 0], scaleX: [1, 1.06, 1] }
                      : isHopping
                        ? { scaleX: [0.94, 1.06, 1], scaleY: [1.08, 0.94, 1] }
                        : isCrawling
                          ? { y: [0, -2.5, 0], scaleY: [0.96, 1.04, 0.96] }
                          : isRappel
                            ? { y: [0, 3, 0] }
                            : isSleeping
                              ? { scaleY: [1, 0.94, 1], scaleX: [1, 1.04, 1] }
                              : { y: [0, -2, 0] }
          }
          transition={
            isCheer
              ? { duration: 0.56, times: [0, 0.28, 0.52, 0.78, 1], ease: [0.22, 1, 0.36, 1] }
              : isPopping
                ? { duration: 0.36, times: [0, 0.38, 0.72, 1], ease: [0.22, 1, 0.36, 1] }
                : isConfused
                  ? { duration: 0.42, repeat: 1, ease: 'easeOut' }
                  : isPouting
                    ? { duration: 0.48, repeat: 1, ease: 'easeInOut' }
                    : isFalling
                      ? { duration: 0.2, repeat: Infinity }
                      : isHopping
                        ? { duration: 0.48, repeat: Infinity, ease: 'easeInOut' }
                        : {
                            duration: isCrawling ? 0.24 : isSleeping ? 2.6 : 1.75,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }
          }
        >
        <svg
          viewBox="0 0 28 24"
          aria-hidden="true"
          className="h-7 w-8 overflow-visible drop-shadow-[1px_2px_0_rgba(24,24,27,0.38)]"
        >
          {/* Side Clawd-spider arms */}
          <motion.g
            animate={
              isCrawling || isHopping
                ? { y: [0, -2.2, 0] }
                : isFalling
                  ? { y: -3.5 }
                  : isCheer
                    ? { y: [0, -3, 0] }
                    : isPouting
                      ? { y: 1.5 }
                      : { y: [0, -1, 0] }
            }
            transition={{
              duration: isCrawling || isHopping ? 0.2 : isCheer ? 0.26 : 1.35,
              repeat: isFalling || isPouting ? 0 : Infinity,
              ease: 'easeInOut',
            }}
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

          {/* Eyes driven by current mood / action */}
          {isSleeping ? (
            <>
              <rect x="7.5" y="8" width="4.5" height="1.5" fill="#18181B" />
              <rect x="16" y="8" width="4.5" height="1.5" fill="#18181B" />
            </>
          ) : isFalling ? (
            <>
              <rect x="7" y="5.5" width="5" height="5" fill="#18181B" />
              <rect x="8" y="6.5" width="3" height="3" fill="#FFFFFF" />
              <rect x="16" y="5.5" width="5" height="5" fill="#18181B" />
              <rect x="17" y="6.5" width="3" height="3" fill="#FFFFFF" />
            </>
          ) : isConfused ? (
            <>
              <rect x="7" y="7" width="5" height="3" fill="#18181B" />
              <rect x="8" y="7.8" width="3" height="1.4" fill="#FFFFFF" />
              <rect x="16" y="5.5" width="5" height="4.8" fill="#18181B" />
              <rect x="16.8" y="6.3" width="3.4" height="3.2" fill="#FFFFFF" />
            </>
          ) : isPouting ? (
            <>
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

          {/* 4 stubby Clawd bottom legs scuttling/kicking cleanly */}
          <motion.g
            animate={
              isCrawling || isHopping || isRappel
                ? { y: [0, -2, 0] }
                : isSleeping || isPouting
                  ? { y: 0 }
                  : { y: [0, 1.2, 0] }
            }
            transition={{
              duration: isCrawling || isHopping ? 0.2 : 0.65,
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
              isCrawling || isHopping || isRappel
                ? { y: [-2, 0, -2] }
                : isSleeping || isPouting
                  ? { y: 0 }
                  : { y: [1.2, 0, 1.2] }
            }
            transition={{
              duration: isCrawling || isHopping ? 0.2 : 0.65,
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

  const roamerRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(currentStep);
  stepRef.current = currentStep;

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const perchedRef = useRef<PerchedTarget | null>(null);
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

  const isPausedQuietly =
    isSleepingPref || isDoiSleeping || mode === 'exam' || Boolean(prefersReducedMotion);

  // Release component perch cleanly whenever study mode switches
  useEffect(() => {
    perchedRef.current = null;
  }, [mode]);

  // Keep Spidey attached smoothly to the top edge of its perched card while scrolling
  useEffect(() => {
    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        const perch = perchedRef.current;
        if (!perch || isFallingRef.current || isPausedQuietly) return;

        const { w: vw, h: vh } = viewportRef.current;
        const bottomY = vw >= 768 ? Math.max(140, vh - 34) : Math.max(170, vh - 110);
        const liveCoords = computeLivePerchCoords(perch, vw, bottomY);

        if (!liveCoords) {
          perchedRef.current = null;
          setCurrentStep((prev) => ({
            ...prev,
            zone: 'bottom',
            pose: 'hop',
            showWebStrand: 'none',
            x: prev.anchorX,
            y: bottomY,
            anchorX: prev.anchorX,
            anchorY: bottomY,
            durationSec: 0.45,
          }));
          return;
        }

        const cur = stepRef.current;
        if (cur.pose === 'idle' || cur.pose === 'crawl' || cur.pose === 'cheer') {
          setCurrentStep((prev) => ({
            ...prev,
            x: liveCoords.x,
            y: liveCoords.y,
            anchorX: liveCoords.x,
            anchorY: liveCoords.y,
            durationSec: 0.08,
          }));
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(scrollRaf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isPausedQuietly]);

  // Sync viewport resize cleanly
  useEffect(() => {
    let rafId = 0;
    const onResize = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setViewport({ w, h });
        if (isFallingRef.current) return;

        const bottomY = w >= 768 ? Math.max(140, h - 34) : Math.max(170, h - 110);
        const perch = perchedRef.current;
        const liveCoords = perch ? computeLivePerchCoords(perch, w, bottomY) : null;
        if (!liveCoords) perchedRef.current = null;

        setCurrentStep((prev) => ({
          ...prev,
          zone: liveCoords ? 'perch' : 'bottom',
          pose: prev.pose === 'nap' ? 'nap' : 'idle',
          showWebStrand: 'none',
          x: liveCoords ? liveCoords.x : clamp(prev.anchorX, 6, Math.max(12, w - SPIDER_W - 6)),
          y: liveCoords ? liveCoords.y : bottomY,
          anchorX: liveCoords
            ? liveCoords.x
            : clamp(prev.anchorX, 6, Math.max(12, w - SPIDER_W - 6)),
          anchorY: liveCoords ? liveCoords.y : bottomY,
          durationSec: 0.35,
        }));
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Main calm free-roaming state machine across UI cards + bottom ground + upright web hangs
  useEffect(() => {
    clearScheduledTimer();
    const { w, h } = viewportRef.current;
    const isDesktop = w >= 768;
    const bottomY = isDesktop ? Math.max(140, h - 34) : Math.max(170, h - 106);

    if (isPausedQuietly) {
      perchedRef.current = null;
      if (isSleepingPref || mode === 'exam' || prefersReducedMotion) {
        clearFallSequence();
      }

      const keepLandingSpot =
        isDoiSleeping && !isSleepingPref && mode !== 'exam' && !prefersReducedMotion;
      const settleX = keepLandingSpot
        ? clamp(stepRef.current.anchorX, 8, Math.max(12, w - SPIDER_W - 8))
        : Math.max(8, w - 48);
      const settleY = keepLandingSpot
        ? bottomY
        : h >= 768
          ? Math.max(120, h - 34)
          : Math.max(160, h - 102);

      setCurrentStep({
        zone: 'bottom',
        pose: isSleepingPref || isDoiSleeping || mode === 'exam' ? 'nap' : 'idle',
        x: settleX,
        y: settleY,
        facing: -1,
        durationSec: keepLandingSpot ? 0.28 : 0.8,
        showWebStrand: 'none',
        anchorX: settleX,
        anchorY: settleY,
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

    const makeJumpStep = (
      zone: ZoneTag,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      useWebSwing: boolean
    ): RoamStep => {
      const dir: 1 | -1 = toX >= fromX ? 1 : -1;
      const midX = Math.round((fromX + toX) / 2);
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const lift = clamp(Math.round(dist * 0.22), 34, 88);
      const peakY = Math.max(70, Math.round(Math.min(fromY, toY) - lift));
      const dur = clamp(dist / 260, 0.72, 1.55);

      return {
        zone,
        pose: useWebSwing ? 'swing' : 'hop',
        x: [fromX, midX, toX],
        y: [fromY, peakY, toY],
        facing: dir,
        durationSec: dur,
        times: [0, 0.48, 1],
        showWebStrand: useWebSwing ? 'swing' : 'none',
        swingDir: dir,
        anchorX: toX,
        anchorY: toY,
      };
    };

    const runNextStep = () => {
      if (cancelled || isFallingRef.current) return;
      const { w: vw, h: vh } = viewportRef.current;
      const desktop = vw >= 768;
      const prev = stepRef.current;
      const ledgeYBottom = desktop ? Math.max(140, vh - 34) : Math.max(170, vh - 110);
      const ledges = scanComponentLedges(vw, vh, ledgeYBottom);

      // Re-sync anchor coordinates if currently perched on a scrolled card
      let startX = prev.anchorX;
      let startY = prev.anchorY;
      if (prev.zone === 'perch' && perchedRef.current) {
        const synced = computeLivePerchCoords(perchedRef.current, vw, ledgeYBottom);
        if (synced) {
          startX = synced.x;
          startY = synced.y;
        } else {
          perchedRef.current = null;
        }
      }

      let nextStep: RoamStep;
      let restAfterMs = Math.round(randBetween(5000, 9500));

      const roll = Math.random();

      // 1. Stroll left/right along the top border of the currently perched UI component
      if (
        prev.zone === 'perch' &&
        perchedRef.current &&
        roll < 0.34
      ) {
        const matchingLedge = ledges.find((l) => l.el === perchedRef.current?.el);
        if (matchingLedge) {
          const targetX = pickPerchX(matchingLedge);
          const rect = matchingLedge.el.getBoundingClientRect();
          perchedRef.current = {
            el: matchingLedge.el,
            offsetX: targetX - rect.left,
          };
          nextStep = {
            zone: 'perch',
            pose: 'crawl',
            x: targetX,
            y: matchingLedge.ledgeY,
            facing: targetX >= startX ? 1 : -1,
            durationSec: clamp(Math.abs(targetX - startX) / 88, 0.75, 2.6),
            showWebStrand: 'none',
            anchorX: targetX,
            anchorY: matchingLedge.ledgeY,
          };
        } else {
          perchedRef.current = null;
          nextStep = makeJumpStep(
            'bottom',
            startX,
            startY,
            clamp(startX, 24, vw - SPIDER_W - 24),
            ledgeYBottom,
            false
          );
        }
      }
      // 2. Hop or web-swing onto a visible card / sidebar / toolbar / footer component
      else if (ledges.length > 0 && roll < 0.74) {
        const otherLedges =
          perchedRef.current && ledges.length > 1
            ? ledges.filter((l) => l.el !== perchedRef.current?.el)
            : ledges;
        const targetLedge = otherLedges[Math.floor(Math.random() * otherLedges.length)];
        const targetX = pickPerchX(targetLedge);
        const rect = targetLedge.el.getBoundingClientRect();
        perchedRef.current = {
          el: targetLedge.el,
          offsetX: targetX - rect.left,
        };
        const useSwing = Math.hypot(targetX - startX, targetLedge.ledgeY - startY) > 170 && Math.random() < 0.55;
        nextStep = makeJumpStep('perch', startX, startY, targetX, targetLedge.ledgeY, useSwing);
        restAfterMs = Math.round(randBetween(5500, 10500));
      }
      // 3. Hang upright gently on a top-corner silk web (below Header, never blocking center text)
      else if (roll < 0.85 && prev.zone !== 'web') {
        perchedRef.current = null;
        const useLeft = startX < vw * 0.5;
        const webX = useLeft ? 18 : Math.max(24, vw - SPIDER_W - 18);
        const topStartY = desktop ? 74 : 146;
        const dropEndY = Math.round(randBetween(topStartY + 42, topStartY + 98));
        nextStep = {
          zone: 'web',
          pose: 'rappel',
          x: [startX, webX, webX],
          y: [startY, topStartY, dropEndY],
          facing: useLeft ? 1 : -1,
          durationSec: 1.55,
          times: [0, 0.48, 1],
          showWebStrand: 'vertical',
          anchorX: webX,
          anchorY: dropEndY,
        };
        restAfterMs = Math.round(randBetween(4500, 7500));
      }
      // 4. Bottom ledge: jump down, crawl across bottom edge, or take a cozy nap
      else {
        perchedRef.current = null;
        const targetX = Math.round(randBetween(24, vw - SPIDER_W - 24));
        if (prev.zone === 'bottom' && Math.random() < 0.35) {
          nextStep = {
            zone: 'bottom',
            pose: 'nap',
            x: startX,
            y: ledgeYBottom,
            facing: prev.facing,
            durationSec: 0.35,
            showWebStrand: 'none',
            anchorX: startX,
            anchorY: ledgeYBottom,
          };
          restAfterMs = Math.round(randBetween(6500, 11000));
        } else if (prev.zone === 'bottom') {
          const useSwing = Math.abs(targetX - startX) > 200 && Math.random() < 0.45;
          if (useSwing) {
            nextStep = makeJumpStep('bottom', startX, startY, targetX, ledgeYBottom, true);
          } else {
            nextStep = {
              zone: 'bottom',
              pose: 'crawl',
              x: targetX,
              y: ledgeYBottom,
              facing: targetX >= startX ? 1 : -1,
              durationSec: clamp(Math.abs(targetX - startX) / 96, 1.0, 3.4),
              showWebStrand: 'none',
              anchorX: targetX,
              anchorY: ledgeYBottom,
            };
          }
        } else {
          nextStep = makeJumpStep(
            'bottom',
            startX,
            startY,
            targetX,
            ledgeYBottom,
            Math.random() < 0.4
          );
        }
      }

      setCurrentStep(nextStep);
      setStepSeq((s) => s + 1);

      const moveMs = Math.round(nextStep.durationSec * 1000);
      const isTravelPose =
        nextStep.pose === 'crawl' || nextStep.pose === 'hop' || nextStep.pose === 'swing';
      if (isTravelPose) {
        timerRef.current = window.setTimeout(() => {
          if (cancelled || isFallingRef.current) return;
          // Finalize landing coordinates against live DOM element in case user scrolled mid-hop
          let finalX = nextStep.anchorX;
          let finalY = nextStep.anchorY;
          let finalZone = nextStep.zone;
          if (nextStep.zone === 'perch' && perchedRef.current) {
            const liveAfterHop = computeLivePerchCoords(
              perchedRef.current,
              viewportRef.current.w,
              desktop ? Math.max(140, viewportRef.current.h - 34) : Math.max(170, viewportRef.current.h - 110)
            );
            if (liveAfterHop) {
              finalX = liveAfterHop.x;
              finalY = liveAfterHop.y;
            } else {
              perchedRef.current = null;
              finalZone = 'bottom';
              finalY = desktop
                ? Math.max(140, viewportRef.current.h - 34)
                : Math.max(170, viewportRef.current.h - 110);
            }
          }

          setCurrentStep((cur) => ({
            ...cur,
            zone: finalZone,
            pose: 'idle',
            showWebStrand: 'none',
            x: finalX,
            y: finalY,
            anchorX: finalX,
            anchorY: finalY,
            durationSec: 0.16,
          }));
          scheduleNext(restAfterMs);
        }, moveMs + 35);
      } else {
        scheduleNext(moveMs + restAfterMs);
      }
    };

    scheduleNext(1800);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduledTimer();
      } else if (!cancelled && !isFallingRef.current) {
        scheduleNext(2200);
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
    // 1. Sleeping -> wake up happily!
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

    // 2. Ignore taps while mid-fall / "Huh?" / "Dỗi" sequence
    if (isFallingRef.current) return;

    const { w: vw, h: vh } = viewportRef.current;
    const isDesktop = vw >= 768;
    const bottomY = isDesktop ? Math.max(140, vh - 34) : Math.max(170, vh - 110);
    const rect = roamerRef.current?.getBoundingClientRect();
    const liveX = rect
      ? clamp(rect.left, 8, Math.max(12, vw - SPIDER_W - 8))
      : stepRef.current.anchorX;
    const liveY = rect ? clamp(rect.top, 64, bottomY) : stepRef.current.anchorY;

    const isOffGround =
      stepRef.current.zone !== 'bottom' ||
      stepRef.current.pose === 'hop' ||
      stepRef.current.pose === 'swing' ||
      stepRef.current.pose === 'rappel' ||
      liveY < bottomY - 12;

    // 3. Off Bottom Ground Click: Fall upright -> Pop bounce -> "Huh?" -> "Dỗi" -> Auto-Sleep
    if (isOffGround) {
      perchedRef.current = null;
      clearScheduledTimer();
      clearFallSequence();
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = null;
      }

      isFallingRef.current = true;
      const landX = clamp(liveX, 16, Math.max(20, vw - SPIDER_W - 16));

      setBubbleText(null);
      setSparkSeq((s) => s + 1);

      // Phase 1 (0 -> 540ms): Upright startled fall straight to bottom ground
      setCurrentStep({
        zone: 'bottom',
        pose: 'fall',
        x: landX,
        y: [liveY, bottomY],
        facing: stepRef.current.facing,
        durationSec: 0.54,
        ease: [0.55, 0.06, 0.88, 0.28],
        showWebStrand: 'none',
        anchorX: landX,
        anchorY: bottomY,
      });

      // Phase 2 (540ms): Cartoon squash & bounce pop upright
      const tPop = window.setTimeout(() => {
        setSparkSeq((s) => s + 1);
        setCurrentStep({
          zone: 'bottom',
          pose: 'pop',
          x: landX,
          y: [bottomY, bottomY - 14, bottomY],
          facing: stepRef.current.facing,
          durationSec: 0.36,
          times: [0, 0.45, 1],
          ease: [0.22, 1, 0.36, 1],
          showWebStrand: 'none',
          anchorX: landX,
          anchorY: bottomY,
        });
      }, 540);

      // Phase 3 (900ms): Puzzled bounce + "Huh?"
      const tHuh = window.setTimeout(() => {
        setBubbleText('Huh?');
        setCurrentStep((prev) => ({
          ...prev,
          pose: 'confused',
          x: landX,
          y: bottomY,
          durationSec: 0.2,
          anchorX: landX,
          anchorY: bottomY,
        }));
      }, 900);

      // Phase 4 (2250ms): Switches to "Dỗi" pout!
      const tDoi = window.setTimeout(() => {
        setBubbleText('Dỗi');
        setCurrentStep((prev) => ({
          ...prev,
          pose: 'pout',
          x: landX,
          y: bottomY,
          durationSec: 0.2,
          anchorX: landX,
          anchorY: bottomY,
        }));
      }, 2250);

      // Phase 5 (3800ms): Hides text & sleeps peacefully where he landed
      const tSleep = window.setTimeout(() => {
        setBubbleText(null);
        isFallingRef.current = false;
        setIsDoiSleeping(true);
      }, 3800);

      fallTimersRef.current = [tPop, tHuh, tDoi, tSleep];
      return;
    }

    // 4. On bottom ground: joyful upright double-hop + encouraging bubble
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
    perchedRef.current = null;
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
        {/* Vertical silk web strand rising straight UP to Header seam */}
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

        {/* Angled sweeping silk line during web-swing jump */}
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

        {/* Cozy floating Zzz pixels while napping */}
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

        {/* Flat cel-shaded speech callout ("Huh?", "Dỗi", "THWIP!", ...) */}
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

        {/* Upright Spidey-Clawd Tap Target */}
        <button
          type="button"
          onClick={handleSpiderClick}
          tabIndex={-1}
          title={
            isAnySleep
              ? 'Spidey-Clawd đang ngủ • Bấm để đánh thức'
              : 'Spidey-Clawd • Thử chọc khi đang đậu trên khung xem!'
          }
          className="flex h-full w-full cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
        >
          <SpideyClawdSprite
            pose={currentStep.pose}
            facing={currentStep.facing}
            sparkSeq={sparkSeq}
          />
        </button>
      </motion.div>
    </div>
  );
};
