import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  animate,
  AnimatePresence,
  AnimationPlaybackControls,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
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

type ZoneTag = 'bottom' | 'perch' | 'web' | 'side';

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

interface VisualUiState {
  pose: SpideyPose;
  facing: 1 | -1;
  showWebStrand: 'vertical' | 'swing' | 'none';
  wallCling: 'none' | 'left' | 'right';
  swingDir: 1 | -1;
  swingDuration: number;
  swingSeq: number;
}

interface PlayBounds {
  isMobile: boolean;
  headerSafeTop: number;
  minY: number;
  maxY: number;
  bottomY: number;
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

function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
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
      return Math.min(Math.round(headerRect.bottom + 14), Math.round(vh * 0.48));
    }
  }
  return vw >= 768 ? 78 : 176;
}

/**
 * Shared playfield bounds:
 * - Desktop (>= 768px): allows full bottom floor + component perches + top corner webs
 * - Mobile (< 768px): NO bottom floor (avoids bottom bars/toolbars); uses left/right edges + components + upper webs
 */
function getPlayBounds(vw: number, vh: number): PlayBounds {
  const isMobile = vw < 768;
  const headerSafeTop = getHeaderSafeTop(vw, vh);

  if (isMobile) {
    const minY = headerSafeTop;
    const maxY = Math.max(minY + 72, Math.round(vh * 0.72));
    return { isMobile: true, headerSafeTop, minY, maxY, bottomY: maxY };
  }

  const bottomY = Math.max(140, vh - 34);
  const minY = headerSafeTop;
  const maxY = Math.max(minY + 40, bottomY - 16);
  return { isMobile: false, headerSafeTop, minY, maxY, bottomY };
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
 * within safe vertical bounds so Spidey-Clawd can perch without obscuring card text.
 */
function scanComponentLedges(vw: number, bounds: PlayBounds): ComponentLedge[] {
  if (typeof document === 'undefined') return [];
  if (bounds.maxY <= bounds.minY + 12) return [];

  const nodes = document.querySelectorAll(
    'main .rounded-3xl, main .rounded-2xl, aside > .rounded-2xl, footer'
  );
  const raw: Array<ComponentLedge & { rect: DOMRect }> = [];

  for (const el of nodes) {
    if (el.closest('header, [role="dialog"], [role="listbox"], [aria-hidden="true"]')) continue;
    // Skip nested inner boxes inside another card/container so Spidey only perches on outer rims
    if (el.parentElement?.closest('.rounded-3xl, .rounded-2xl, .rounded-xl, footer')) continue;

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.pointerEvents === 'none'
    ) {
      continue;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 130 || rect.height < 42) continue;

    const ledgeY = Math.round(rect.top - SPIDER_H + 3);
    if (ledgeY < bounds.minY || ledgeY > bounds.maxY) continue;

    const minX = Math.round(clamp(rect.left + 20, 8, vw - SPIDER_W - 8));
    const maxX = Math.round(clamp(rect.right - SPIDER_W - 20, 8, vw - SPIDER_W - 8));
    if (maxX - minX < 48) continue;

    raw.push({
      el,
      minX,
      maxX,
      ledgeY,
      width: maxX - minX,
      rect,
    });
  }

  // Geometric guard: never perch on any container whose top rim sits inside another outer container
  const outerOnly = raw.filter(
    (cand) =>
      !raw.some(
        (other) =>
          other !== cand &&
          other.rect.top + 8 < cand.rect.top &&
          cand.rect.top < other.rect.bottom - 8 &&
          cand.rect.left >= other.rect.left - 8 &&
          cand.rect.right <= other.rect.right + 8
      )
  );

  outerOnly.sort((a, b) => a.ledgeY - b.ledgeY || b.width - a.width);
  const deduped: ComponentLedge[] = [];
  for (const cand of outerOnly) {
    const overlapsExisting = deduped.some(
      (kept) =>
        Math.abs(kept.ledgeY - cand.ledgeY) < 20 &&
        cand.minX < kept.maxX &&
        cand.maxX > kept.minX
    );
    if (!overlapsExisting) {
      deduped.push({
        el: cand.el,
        minX: cand.minX,
        maxX: cand.maxX,
        ledgeY: cand.ledgeY,
        width: cand.width,
      });
    }
  }
  return deduped;
}

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
  bounds: PlayBounds
): { x: number; y: number } | null {
  if (!perch.el.isConnected) return null;
  const style = window.getComputedStyle(perch.el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    style.pointerEvents === 'none'
  ) {
    return null;
  }

  const rect = perch.el.getBoundingClientRect();
  if (rect.width < 110 || rect.height < 32) return null;

  const y = Math.round(rect.top - SPIDER_H + 3);
  if (y < bounds.headerSafeTop + 2 || y > bounds.maxY + 8) return null;

  const minX = Math.round(clamp(rect.left + 20, 8, vw - SPIDER_W - 8));
  const maxX = Math.round(clamp(rect.right - SPIDER_W - 20, 8, vw - SPIDER_W - 8));
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
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => getViewportSize());

  const initBounds = getPlayBounds(viewport.w, viewport.h);
  const initX = initBounds.isMobile
    ? Math.max(8, viewport.w - SPIDER_W + 2)
    : Math.max(12, viewport.w - 58);
  const initY = initBounds.isMobile
    ? clamp(Math.round(viewport.h * 0.34), initBounds.minY + 12, initBounds.maxY)
    : initBounds.bottomY;

  const mvX = useMotionValue(initX);
  const mvY = useMotionValue(initY);

  const [visual, setVisual] = useState<VisualUiState>({
    pose: 'idle',
    facing: -1,
    showWebStrand: 'none',
    wallCling: initBounds.isMobile ? 'right' : 'none',
    swingDir: 1,
    swingDuration: 1,
    swingSeq: 0,
  });

  const [isHovered, setIsHovered] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleAnchor, setBubbleAnchor] = useState<{ x: number; y: number }>({
    x: initX,
    y: initY,
  });
  const [sparkSeq, setSparkSeq] = useState(0);

  const zoneRef = useRef<ZoneTag>(initBounds.isMobile ? 'side' : 'bottom');
  const visualRef = useRef(visual);
  visualRef.current = visual;

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const perchedRef = useRef<PerchedTarget | null>(null);
  const animXRef = useRef<AnimationPlaybackControls | null>(null);
  const animYRef = useRef<AnimationPlaybackControls | null>(null);
  const timerRef = useRef<number | null>(null);
  const moveEndTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const fallTimersRef = useRef<number[]>([]);
  const isFallingRef = useRef(false);
  const cheerLineIdxRef = useRef(0);
  const scheduleNextFnRef = useRef<((delayMs: number) => void) | null>(null);

  const stopMotion = useCallback(() => {
    animXRef.current?.stop();
    animYRef.current?.stop();
    animXRef.current = null;
    animYRef.current = null;
  }, []);

  const clearScheduledTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (moveEndTimerRef.current !== null) {
      window.clearTimeout(moveEndTimerRef.current);
      moveEndTimerRef.current = null;
    }
  }, []);

  const clearFallSequence = useCallback(() => {
    for (const id of fallTimersRef.current) {
      window.clearTimeout(id);
    }
    fallTimersRef.current = [];
    isFallingRef.current = false;
  }, []);

  const setPoseVisual = useCallback((patch: Partial<VisualUiState>) => {
    setVisual((prev) => ({ ...prev, ...patch }));
  }, []);

  const isPausedQuietly =
    isSleepingPref || isDoiSleeping || mode === 'exam' || Boolean(prefersReducedMotion);
  const isPausedQuietlyRef = useRef(isPausedQuietly);
  isPausedQuietlyRef.current = isPausedQuietly;

  useEffect(() => {
    perchedRef.current = null;
  }, [mode]);

  // Helper returning nearest safe fallback spot when leaving a perched card
  const getSafeFallbackSpot = useCallback((curX: number, curY: number, vw: number, bounds: PlayBounds) => {
    if (bounds.isMobile) {
      const goLeft = curX < vw * 0.5;
      return {
        zone: 'side' as const,
        x: goLeft ? -2 : Math.max(8, vw - SPIDER_W + 2),
        y: clamp(curY, bounds.minY + 14, bounds.maxY),
        facing: (goLeft ? 1 : -1) as 1 | -1,
        wallCling: (goLeft ? 'left' : 'right') as 'left' | 'right',
      };
    }
    return {
      zone: 'bottom' as const,
      x: clamp(curX, 16, Math.max(20, vw - SPIDER_W - 16)),
      y: bounds.bottomY,
      facing: (curX < vw * 0.5 ? 1 : -1) as 1 | -1,
      wallCling: 'none' as const,
    };
  }, []);

  // Synchronous zero-lag scroll lockstep using MotionValues
  useEffect(() => {
    const onScroll = () => {
      if (isFallingRef.current) return;

      const { w: vw, h: vh } = getViewportSize();
      const bounds = getPlayBounds(vw, vh);
      const perch = perchedRef.current;

      if (!perch) {
        if (bounds.isMobile && zoneRef.current !== 'perch') {
          const minSafeY = bounds.minY + 6;
          if (mvY.get() < minSafeY) {
            stopMotion();
            mvY.set(Math.min(bounds.maxY, minSafeY));
          }
        }
        return;
      }
      if (isPausedQuietly) return;

      const live = computeLivePerchCoords(perch, vw, bounds);

      if (live) {
        const curPose = visualRef.current.pose;
        if (curPose === 'idle' || curPose === 'cheer') {
          mvX.set(live.x);
          mvY.set(live.y);
        } else if (curPose === 'crawl') {
          mvY.set(live.y);
        }
        return;
      }

      // Card scrolled out of visible zone -> release perch and glide to side edge (mobile) or bottom (desktop)
      perchedRef.current = null;
      clearScheduledTimer();
      stopMotion();

      const fallback = getSafeFallbackSpot(mvX.get(), mvY.get(), vw, bounds);
      const dist = Math.hypot(fallback.x - mvX.get(), fallback.y - mvY.get());
      const glideDur = clamp(dist / 260, 0.42, 0.85);

      zoneRef.current = fallback.zone;
      setPoseVisual({
        pose: 'hop',
        facing: fallback.facing,
        showWebStrand: 'none',
        wallCling: 'none',
      });
      animXRef.current = animate(mvX, fallback.x, { duration: glideDur, ease: 'easeOut' });
      animYRef.current = animate(mvY, fallback.y, {
        duration: glideDur,
        ease: [0.22, 1, 0.36, 1],
      });

      moveEndTimerRef.current = window.setTimeout(() => {
        if (isFallingRef.current) return;
        setPoseVisual({
          pose: 'idle',
          showWebStrand: 'none',
          wallCling: fallback.wallCling,
        });
        scheduleNextFnRef.current?.(Math.round(randBetween(3500, 6500)));
      }, Math.round(glideDur * 1000) + 30);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [clearScheduledTimer, getSafeFallbackSpot, isPausedQuietly, mvX, mvY, setPoseVisual, stopMotion]);

  // Keep viewport resize & initial post-paint header height aligned smoothly
  useEffect(() => {
    let rafId = 0;

    // One-time post-paint clamp so measured 3-row mobile Header never hides initial Spidey
    rafId = window.requestAnimationFrame(() => {
      if (isFallingRef.current || perchedRef.current) return;
      const vp = getViewportSize();
      const bounds = getPlayBounds(vp.w, vp.h);
      if (bounds.isMobile && zoneRef.current !== 'perch') {
        const minSafeY = bounds.minY + 12;
        if (mvY.get() < minSafeY) {
          mvY.set(Math.min(bounds.maxY, minSafeY));
        }
      }
    });

    const onResize = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const nextVp = getViewportSize();
        setViewport(nextVp);
        if (isFallingRef.current) return;

        const bounds = getPlayBounds(nextVp.w, nextVp.h);
        const perch = perchedRef.current;
        const live = perch ? computeLivePerchCoords(perch, nextVp.w, bounds) : null;

        if (live) {
          stopMotion();
          mvX.set(live.x);
          mvY.set(live.y);
          setPoseVisual({ wallCling: 'none' });
        } else {
          perchedRef.current = null;
          stopMotion();
          if (bounds.isMobile) {
            const curZone = zoneRef.current;
            if (curZone === 'web') {
              mvY.set(clamp(mvY.get(), bounds.minY + 4, bounds.maxY));
              setPoseVisual({ wallCling: 'none' });
            } else {
              zoneRef.current = 'side';
              const goLeft = mvX.get() < nextVp.w * 0.5;
              mvX.set(goLeft ? -2 : Math.max(8, nextVp.w - SPIDER_W + 2));
              mvY.set(clamp(mvY.get(), bounds.minY + 12, bounds.maxY));
              setPoseVisual({
                facing: goLeft ? 1 : -1,
                wallCling: goLeft ? 'left' : 'right',
              });
            }
          } else {
            const curX = clamp(mvX.get(), 8, Math.max(12, nextVp.w - SPIDER_W - 8));
            const curY =
              zoneRef.current === 'web'
                ? clamp(mvY.get(), bounds.minY, bounds.bottomY)
                : bounds.bottomY;
            mvX.set(curX);
            mvY.set(curY);
            setPoseVisual({ wallCling: 'none' });
          }
        }
      });
    };

    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [mvX, mvY, setPoseVisual, stopMotion]);

  // Main calm roaming controller
  useEffect(() => {
    clearScheduledTimer();
    stopMotion();

    const { w, h } = getViewportSize();
    const bounds = getPlayBounds(w, h);

    if (isPausedQuietly) {
      scheduleNextFnRef.current = null;
      perchedRef.current = null;
      if (isSleepingPref || mode === 'exam' || prefersReducedMotion) {
        clearFallSequence();
      }

      const keepLandingSpot =
        isDoiSleeping && !isSleepingPref && mode !== 'exam' && !prefersReducedMotion;

      let settleX: number;
      let settleY: number;
      let settleZone: ZoneTag;
      let settleFacing: 1 | -1 = -1;
      let settleWallCling: 'none' | 'left' | 'right' = 'none';

      if (keepLandingSpot) {
        const leftSide = bounds.isMobile && mvX.get() < w * 0.5;
        settleX = bounds.isMobile
          ? leftSide
            ? -2
            : Math.max(8, w - SPIDER_W + 2)
          : clamp(mvX.get(), 6, Math.max(12, w - SPIDER_W - 6));
        settleY = bounds.isMobile
          ? clamp(mvY.get(), bounds.minY + 14, bounds.maxY)
          : bounds.bottomY;
        settleZone = bounds.isMobile ? 'side' : 'bottom';
        if (bounds.isMobile) {
          settleFacing = leftSide ? 1 : -1;
          settleWallCling = leftSide ? 'left' : 'right';
        }
      } else if (bounds.isMobile) {
        settleX = Math.max(8, w - SPIDER_W + 2);
        settleY = clamp(Math.round(h * 0.34), bounds.minY + 16, bounds.maxY);
        settleZone = 'side';
        settleFacing = -1;
        settleWallCling = 'right';
      } else {
        settleX = Math.max(8, w - 48);
        settleY = bounds.bottomY;
        settleZone = 'bottom';
      }

      zoneRef.current = settleZone;
      setPoseVisual({
        pose: isSleepingPref || isDoiSleeping || mode === 'exam' ? 'nap' : 'idle',
        facing: settleFacing,
        showWebStrand: 'none',
        wallCling: settleWallCling,
      });
      animXRef.current = animate(mvX, settleX, {
        duration: keepLandingSpot ? 0.24 : 0.72,
        ease: [0.22, 1, 0.36, 1],
      });
      animYRef.current = animate(mvY, settleY, {
        duration: keepLandingSpot ? 0.24 : 0.72,
        ease: [0.22, 1, 0.36, 1],
      });
      return;
    }

    // Ensure exiting exam/sleep clears any leftover nap pose immediately
    if (visualRef.current.pose === 'nap') {
      setPoseVisual({ pose: 'idle', showWebStrand: 'none' });
    }

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      if (cancelled || isFallingRef.current || document.visibilityState === 'hidden') return;
      timerRef.current = window.setTimeout(runNextStep, delayMs);
    };
    scheduleNextFnRef.current = scheduleNext;

    const runParabolicJump = (
      targetZone: ZoneTag,
      toX: number,
      toY: number,
      useWebSwing: boolean,
      restAfterMs: number
    ) => {
      stopMotion();
      const fromX = mvX.get();
      const fromY = mvY.get();
      const dir: 1 | -1 = toX >= fromX ? 1 : -1;
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const dur = clamp(dist / 215, 0.78, 1.48);
      const lift = clamp(Math.round(dist * 0.23), 30, 82);
      const curBounds = getPlayBounds(viewportRef.current.w, viewportRef.current.h);
      const peakY = Math.max(curBounds.minY + 4, Math.round(Math.min(fromY, toY) - lift));

      zoneRef.current = targetZone;
      setVisual((prev) => ({
        pose: useWebSwing ? 'swing' : 'hop',
        facing: dir,
        showWebStrand: useWebSwing ? 'swing' : 'none',
        wallCling: 'none',
        swingDir: dir,
        swingDuration: dur,
        swingSeq: prev.swingSeq + (useWebSwing ? 1 : 0),
      }));

      animXRef.current = animate(mvX, toX, {
        duration: dur,
        ease: 'easeInOut',
      });
      animYRef.current = animate(mvY, [fromY, peakY, toY], {
        duration: dur,
        times: [0, 0.46, 1],
        ease: ['easeOut', 'easeIn'],
      });

      moveEndTimerRef.current = window.setTimeout(() => {
        if (cancelled || isFallingRef.current) return;
        const vp = getViewportSize();
        const latestBounds = getPlayBounds(vp.w, vp.h);

        if (targetZone === 'perch' && perchedRef.current) {
          const live = computeLivePerchCoords(perchedRef.current, vp.w, latestBounds);
          if (live) {
            const diffX = Math.abs(live.x - mvX.get());
            const diffY = Math.abs(live.y - mvY.get());
            if (diffX > 6 || diffY > 6) {
              const settleDur = clamp(Math.hypot(diffX, diffY) / 220, 0.25, 0.55);
              animXRef.current = animate(mvX, live.x, { duration: settleDur, ease: 'easeOut' });
              animYRef.current = animate(mvY, live.y, { duration: settleDur, ease: 'easeOut' });
              moveEndTimerRef.current = window.setTimeout(() => {
                if (cancelled || isFallingRef.current) return;
                setPoseVisual({ pose: 'idle', showWebStrand: 'none', wallCling: 'none' });
                scheduleNext(restAfterMs);
              }, Math.round(settleDur * 1000) + 20);
              return;
            }
            mvX.set(live.x);
            mvY.set(live.y);
          } else {
            // Card left viewport mid-jump -> glide to side edge (mobile) or bottom (desktop)
            perchedRef.current = null;
            const fb = getSafeFallbackSpot(mvX.get(), mvY.get(), vp.w, latestBounds);
            zoneRef.current = fb.zone;
            const glideDur = clamp(
              Math.hypot(fb.x - mvX.get(), fb.y - mvY.get()) / 240,
              0.42,
              0.82
            );
            animXRef.current = animate(mvX, fb.x, { duration: glideDur, ease: 'easeOut' });
            animYRef.current = animate(mvY, fb.y, {
              duration: glideDur,
              ease: [0.22, 1, 0.36, 1],
            });
            moveEndTimerRef.current = window.setTimeout(() => {
              if (cancelled || isFallingRef.current) return;
              setPoseVisual({
                pose: 'idle',
                facing: fb.facing,
                showWebStrand: 'none',
                wallCling: fb.wallCling,
              });
              scheduleNext(restAfterMs);
            }, Math.round(glideDur * 1000) + 20);
            return;
          }
        }

        // After jumping to a mobile outer edge, plant feet cleanly sideways onto the wall
        if (targetZone === 'side') {
          const isLeftSide = toX < vp.w * 0.5;
          setPoseVisual({
            pose: 'idle',
            facing: isLeftSide ? 1 : -1,
            showWebStrand: 'none',
            wallCling: vp.w < 768 ? (isLeftSide ? 'left' : 'right') : 'none',
          });
        } else {
          setPoseVisual({ pose: 'idle', showWebStrand: 'none', wallCling: 'none' });
        }
        scheduleNext(restAfterMs);
      }, Math.round(dur * 1000) + 20);
    };

    const runCrawl = (
      targetZone: ZoneTag,
      toX: number,
      toY: number,
      facingOverride: 1 | -1 | null,
      restAfterMs: number
    ) => {
      stopMotion();
      const fromX = mvX.get();
      const fromY = mvY.get();
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const dur = clamp(dist / 78, 0.85, 3.2);
      const dir: 1 | -1 = facingOverride ?? (toX >= fromX ? 1 : -1);
      const vpW = getViewportSize().w;
      const wallCling: 'none' | 'left' | 'right' =
        targetZone === 'side' && vpW < 768 ? (toX < vpW * 0.5 ? 'left' : 'right') : 'none';

      zoneRef.current = targetZone;
      setPoseVisual({ pose: 'crawl', facing: dir, showWebStrand: 'none', wallCling });

      animXRef.current = animate(mvX, toX, { duration: dur, ease: 'easeInOut' });
      animYRef.current = animate(mvY, toY, { duration: dur, ease: 'easeInOut' });

      moveEndTimerRef.current = window.setTimeout(() => {
        if (cancelled || isFallingRef.current) return;
        setPoseVisual({ pose: 'idle', showWebStrand: 'none', wallCling });
        scheduleNext(restAfterMs);
      }, Math.round(dur * 1000) + 20);
    };

    const runNextStep = () => {
      if (cancelled || isFallingRef.current) return;
      const vp = getViewportSize();
      const vw = vp.w;
      const curBounds = getPlayBounds(vw, vp.h);
      const ledges = scanComponentLedges(vw, curBounds);

      const fromX = mvX.get();
      const fromY = mvY.get();
      const curZone = zoneRef.current;

      const restAfterMs = Math.round(randBetween(5000, 9500));
      const roll = Math.random();

      // 1. Stroll left/right along top border of currently perched component
      if (curZone === 'perch' && perchedRef.current && roll < 0.34) {
        const matching = ledges.find((l) => l.el === perchedRef.current?.el);
        if (matching) {
          const targetX = pickPerchX(matching);
          const rect = matching.el.getBoundingClientRect();
          perchedRef.current = { el: matching.el, offsetX: targetX - rect.left };
          runCrawl('perch', targetX, matching.ledgeY, null, restAfterMs);
          return;
        }
        perchedRef.current = null;
      }

      // 2. Parabolic hop / web-swing onto a visible UI component (works on BOTH Desktop & Mobile!)
      if (ledges.length > 0 && roll < 0.72) {
        const otherLedges =
          perchedRef.current && ledges.length > 1
            ? ledges.filter((l) => l.el !== perchedRef.current?.el)
            : ledges;
        const target = otherLedges[Math.floor(Math.random() * otherLedges.length)];
        const targetX = pickPerchX(target);
        const rect = target.el.getBoundingClientRect();
        perchedRef.current = { el: target.el, offsetX: targetX - rect.left };

        const useSwing =
          Math.hypot(targetX - fromX, target.ledgeY - fromY) > 150 && Math.random() < 0.5;
        runParabolicJump('perch', targetX, target.ledgeY, useSwing, restAfterMs);
        return;
      }

      // 3. Hang upright gently from a corner silk web below Header / top edge
      if (roll < 0.85 && curZone !== 'web') {
        perchedRef.current = null;
        stopMotion();
        const useLeft = fromX < vw * 0.5;
        const webX = useLeft ? 16 : Math.max(24, vw - SPIDER_W - 16);
        const topStartY = Math.max(16, curBounds.minY + 4);
        const dropEndY = clamp(
          Math.round(topStartY + randBetween(38, 86)),
          topStartY + 24,
          curBounds.maxY
        );
        const dur = 1.45;

        zoneRef.current = 'web';
        setPoseVisual({
          pose: 'rappel',
          facing: useLeft ? 1 : -1,
          showWebStrand: 'vertical',
          wallCling: 'none',
        });

        animXRef.current = animate(mvX, [fromX, webX, webX], {
          duration: dur,
          times: [0, 0.48, 1],
          ease: [0.22, 1, 0.36, 1],
        });
        animYRef.current = animate(mvY, [fromY, topStartY, dropEndY], {
          duration: dur,
          times: [0, 0.48, 1],
          ease: [0.22, 1, 0.36, 1],
        });

        moveEndTimerRef.current = window.setTimeout(() => {
          if (cancelled || isFallingRef.current) return;
          scheduleNext(Math.round(randBetween(4500, 7500)));
        }, Math.round(dur * 1000));
        return;
      }

      // 4A. MOBILE FALLBACK ZONE: Left/right outer walls clinging sideways (NO mobile bottom ground!)
      if (curBounds.isMobile) {
        perchedRef.current = null;
        const leftEdgeX = -2;
        const rightEdgeX = Math.max(8, vw - SPIDER_W + 2);
        const targetY = Math.round(randBetween(curBounds.minY + 14, curBounds.maxY));

        if (curZone === 'side' && isNightTime() && Math.random() < 0.28) {
          stopMotion();
          const onLeftWall = fromX < vw * 0.5;
          setPoseVisual({
            pose: 'nap',
            showWebStrand: 'none',
            wallCling: onLeftWall ? 'left' : 'right',
          });
          scheduleNext(Math.round(randBetween(6000, 10000)));
          return;
        }

        const currentlyLeft = fromX < vw * 0.5;
        const switchSides = curZone !== 'side' || Math.random() < 0.55;
        const destLeft = switchSides ? (curZone === 'side' ? !currentlyLeft : currentlyLeft) : currentlyLeft;
        const sideX = destLeft ? leftEdgeX : rightEdgeX;

        if (curZone === 'side' && !switchSides) {
          // Scuttle smoothly up or down along the same outer side wall, feet planted on edge
          runCrawl('side', sideX, targetY, destLeft ? 1 : -1, restAfterMs);
        } else {
          // Hop / web-swing onto left or right outer side wall
          runParabolicJump(
            'side',
            sideX,
            targetY,
            Math.abs(sideX - fromX) > 120 && Math.random() < 0.55,
            restAfterMs
          );
        }
        return;
      }

      // 4B. DESKTOP ONLY: Bottom ledge stroll, jump down, or cozy nap
      perchedRef.current = null;
      const targetX = Math.round(randBetween(24, vw - SPIDER_W - 24));

      if (curZone === 'bottom' && isNightTime() && Math.random() < 0.3) {
        stopMotion();
        zoneRef.current = 'bottom';
        setPoseVisual({ pose: 'nap', showWebStrand: 'none', wallCling: 'none' });
        scheduleNext(Math.round(randBetween(6500, 11000)));
      } else if (curZone === 'bottom') {
        if (Math.abs(targetX - fromX) > 200 && Math.random() < 0.42) {
          runParabolicJump('bottom', targetX, curBounds.bottomY, true, restAfterMs);
        } else {
          runCrawl('bottom', targetX, curBounds.bottomY, null, restAfterMs);
        }
      } else {
        runParabolicJump('bottom', targetX, curBounds.bottomY, Math.random() < 0.38, restAfterMs);
      }
    };

    scheduleNext(1800);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduledTimer();
        stopMotion();
      } else if (!cancelled && !isFallingRef.current) {
        scheduleNext(2200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      scheduleNextFnRef.current = null;
      clearScheduledTimer();
      stopMotion();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    clearFallSequence,
    clearScheduledTimer,
    getSafeFallbackSpot,
    isDoiSleeping,
    isPausedQuietly,
    isSleepingPref,
    mode,
    mvX,
    mvY,
    prefersReducedMotion,
    setPoseVisual,
    stopMotion,
  ]);

  useEffect(() => {
    return () => {
      clearFallSequence();
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
    };
  }, [clearFallSequence]);

  const updateBubbleAnchorFromLive = useCallback(
    (x?: number, y?: number) => {
      setBubbleAnchor({
        x: x ?? mvX.get(),
        y: y ?? mvY.get(),
      });
    },
    [mvX, mvY]
  );

  const handleSpiderClick = () => {
    // 1. Sleeping (manual, "Dỗi", or spontaneous night nap) -> wake up happily!
    if (isSleepingPref || isDoiSleeping || visualRef.current.pose === 'nap') {
      const wasDoi = isDoiSleeping;
      const wasSpontaneousNightNap = !isSleepingPref && !isDoiSleeping;
      if (isSleepingPref) {
        setIsSleepingPref(false);
        saveSleepPreference(false);
      }
      if (wasDoi) {
        setIsDoiSleeping(false);
      }
      if (wasSpontaneousNightNap) {
        clearScheduledTimer();
      }
      updateBubbleAnchorFromLive();
      setSparkSeq((s) => s + 1);
      setBubbleText(wasDoi ? 'Hết dỗi rồi!' : 'Dậy rồi nè!');
      setPoseVisual({ pose: 'cheer' });

      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      bubbleTimerRef.current = window.setTimeout(() => {
        setBubbleText(null);
        setPoseVisual({ pose: isPausedQuietlyRef.current ? 'nap' : 'idle' });
        if (wasSpontaneousNightNap && !isPausedQuietlyRef.current) {
          scheduleNextFnRef.current?.(Math.round(randBetween(3000, 5500)));
        }
      }, 1450);
      return;
    }

    // 2. Ignore taps while mid-fall / "Huh?" / "Dỗi" sequence
    if (isFallingRef.current) return;

    const { w: vw, h: vh } = getViewportSize();
    const bounds = getPlayBounds(vw, vh);
    const liveX = clamp(mvX.get(), -4, Math.max(12, vw - SPIDER_W + 4));
    const liveY = clamp(mvY.get(), bounds.minY, bounds.maxY + 16);

    const curPose = visualRef.current.pose;
    const isRestingZone = bounds.isMobile
      ? zoneRef.current === 'side'
      : zoneRef.current === 'bottom' && liveY >= bounds.bottomY - 12;

    const isOffGround =
      !isRestingZone ||
      curPose === 'hop' ||
      curPose === 'swing' ||
      curPose === 'rappel';

    // 3. Poked while perched on a card / hanging on a web / jumping -> Fall -> Pop -> "Huh?" -> "Dỗi" -> Auto-Sleep!
    if (isOffGround) {
      perchedRef.current = null;
      clearScheduledTimer();
      stopMotion();
      clearFallSequence();
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = null;
      }

      isFallingRef.current = true;

      let landX: number;
      let landY: number;
      let landZone: ZoneTag;
      if (bounds.isMobile) {
        // On mobile, tumble cleanly to nearest safe outer side edge below Header
        const goLeft = liveX < vw * 0.5;
        landX = goLeft ? 4 : Math.max(10, vw - SPIDER_W - 4);
        landY = clamp(Math.max(liveY + 56, bounds.minY + 36), bounds.minY + 24, bounds.maxY);
        landZone = 'side';
      } else {
        landX = clamp(liveX, 16, Math.max(20, vw - SPIDER_W - 16));
        landY = bounds.bottomY;
        landZone = 'bottom';
      }

      const dropDist = Math.max(36, Math.hypot(landX - liveX, landY - liveY));
      const dropDur = clamp(dropDist / 650, 0.36, 0.62);
      const dropMs = Math.round(dropDur * 1000);

      updateBubbleAnchorFromLive(landX, landY);
      setBubbleText(null);
      setSparkSeq((s) => s + 1);

      // Phase 1: Drop upright smoothly to safe landing spot (desktop bottom or mobile side edge)
      zoneRef.current = landZone;
      setPoseVisual({
        pose: 'fall',
        facing: bounds.isMobile ? (landX < vw * 0.5 ? 1 : -1) : visualRef.current.facing,
        showWebStrand: 'none',
        wallCling: 'none',
      });
      animXRef.current = animate(mvX, landX, { duration: dropDur, ease: 'easeOut' });
      animYRef.current = animate(mvY, landY, {
        duration: dropDur,
        ease: [0.55, 0.06, 0.88, 0.28],
      });

      // Phase 2: Cartoon landing bounce upright
      const tPop = window.setTimeout(() => {
        setSparkSeq((s) => s + 1);
        setPoseVisual({ pose: 'pop' });
        animYRef.current = animate(mvY, [landY, landY - 14, landY], {
          duration: 0.34,
          times: [0, 0.45, 1],
          ease: ['easeOut', 'easeIn'],
        });
      }, dropMs);

      // Phase 3: Puzzled bounce + "Huh?"
      const tHuh = window.setTimeout(() => {
        mvY.set(landY);
        updateBubbleAnchorFromLive(landX, landY);
        setBubbleText('Huh?');
        setPoseVisual({ pose: 'confused' });
      }, dropMs + 340);

      // Phase 4: Grumpy pout + "Dỗi"
      const tDoi = window.setTimeout(() => {
        updateBubbleAnchorFromLive(landX, landY);
        setBubbleText('Dỗi');
        setPoseVisual({ pose: 'pout' });
      }, dropMs + 1680);

      // Phase 5: Hide text & curl into nap right at landing spot
      const tSleep = window.setTimeout(() => {
        setBubbleText(null);
        isFallingRef.current = false;
        setIsDoiSleeping(true);
      }, dropMs + 3200);

      fallTimersRef.current = [tPop, tHuh, tDoi, tSleep];
      return;
    }

    // 4. Resting calmly on side (mobile) or bottom (desktop): joyful upright double-hop
    const nextLine = CHEER_LINES[cheerLineIdxRef.current % CHEER_LINES.length];
    cheerLineIdxRef.current += 1;
    updateBubbleAnchorFromLive();
    setBubbleText(nextLine);
    setSparkSeq((s) => s + 1);
    setPoseVisual({ pose: 'cheer' });

    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubbleText(null);
      setPoseVisual({ pose: isPausedQuietlyRef.current ? 'nap' : 'idle' });
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
      updateBubbleAnchorFromLive();
      setBubbleText('THWIP!');
      setSparkSeq((s) => s + 1);
      setPoseVisual({ pose: 'cheer', showWebStrand: 'none' });
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      bubbleTimerRef.current = window.setTimeout(() => {
        setBubbleText(null);
        setPoseVisual({ pose: isPausedQuietlyRef.current ? 'nap' : 'idle' });
      }, 1100);
    } else {
      setIsSleepingPref(true);
      saveSleepPreference(true);
      setBubbleText(null);
    }
  };

  const bubbleHorizontalClass =
    bubbleAnchor.x < 105
      ? 'left-0'
      : bubbleAnchor.x > viewport.w - 115
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';
  const bubbleVerticalClass =
    bubbleAnchor.y < (viewport.w < 768 ? 215 : 130)
      ? 'top-[calc(100%+6px)]'
      : 'bottom-[calc(100%+6px)]';
  const sleepBtnHorizontalClass = bubbleAnchor.x > viewport.w - 80 ? '-left-5' : '-right-5';

  const isAnySleep = isSleepingPref || isDoiSleeping;
  const isSleepingVisual = visual.pose === 'nap';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      <motion.div
        style={{ left: 0, top: 0, x: mvX, y: mvY }}
        animate={{ scale: viewport.w < 768 ? 0.84 : 1 }}
        transition={{ duration: 0.2 }}
        onMouseEnter={() => {
          updateBubbleAnchorFromLive();
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        className="pointer-events-auto absolute h-7 w-8 select-none"
      >
        {/* Vertical silk web strand rising straight UP to Header seam / viewport top */}
        {visual.showWebStrand === 'vertical' && (
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
        {visual.showWebStrand === 'swing' && (
          <motion.svg
            key={`web-swing-${visual.swingSeq}`}
            viewBox="0 0 80 120"
            aria-hidden="true"
            initial={{ rotate: visual.swingDir > 0 ? 34 : -34, opacity: 0 }}
            animate={{
              rotate: visual.swingDir > 0 ? [34, 0, -34] : [-34, 0, 34],
              opacity: [0, 0.85, 0.85, 0],
            }}
            transition={{
              duration: visual.swingDuration,
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
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -top-4 z-20 ${
              visual.wallCling === 'right' ? 'left-0' : 'right-0'
            }`}
          >
            <motion.span
              animate={{
                y: [0, -8],
                x: visual.wallCling === 'right' ? [0, -3] : [0, 3],
                opacity: [0.85, 0],
              }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut' }}
              className="block font-mono text-[9px] font-black text-[#4338CA] dark:text-[#A5B4FC]"
            >
              z
            </motion.span>
            <motion.span
              animate={{
                y: [0, -10],
                x: visual.wallCling === 'right' ? [-2, -6] : [2, 6],
                opacity: [0, 0.8, 0],
              }}
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

        {/* Spidey-Clawd Tap Target (rotates ±90° sideways ONLY while wall-clinging on mobile edges) */}
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
          <motion.div
            animate={{
              rotate:
                visual.wallCling === 'left'
                  ? 90
                  : visual.wallCling === 'right'
                    ? -90
                    : 0,
            }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex h-full w-full items-center justify-center"
          >
            <SpideyClawdSprite
              pose={visual.pose}
              facing={visual.facing}
              sparkSeq={sparkSeq}
            />
          </motion.div>
        </button>
      </motion.div>
    </div>
  );
};
