import React, { useEffect, useRef } from 'react';

export interface SakugaBorderFireProps {
  /** Mastery/completion percentage (0..100). Mounts and animates only at >= 50%. */
  percent: number;
  /** Border radius of the host card in px (matches rounded-xl=12, rounded-2xl=16). */
  radius?: number;
  /** Compact sizing for narrow sidebar chapter cards. */
  compact?: boolean;
  /** Ultra-compact flame outline for inline CTA buttons. */
  mini?: boolean;
}

interface PerimeterPoint {
  px: number;
  py: number;
  nx: number;
  ny: number;
}

interface Point2D {
  x: number;
  y: number;
}

interface BurstShard {
  u: number;
  speed: number;
  size: number;
  color: string;
  isStar: boolean;
  jitter: number;
}

const FRAME_MS = 1000 / 45;
const BURST_DURATION_MS = 850;
const TAU = Math.PI * 2;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function sampleRoundedRectPerimeter(
  uRaw: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number
): PerimeterPoint {
  const u = ((uRaw % 1) + 1) % 1;
  const r = Math.max(0, Math.min(rRaw, w / 2, h / 2));
  const topLen = Math.max(0, w - 2 * r);
  const sideLen = Math.max(0, h - 2 * r);
  const arcLen = (Math.PI / 2) * r;
  const totalLen = 2 * topLen + 2 * sideLen + 4 * arcLen;

  if (totalLen <= 0) {
    return { px: x, py: y, nx: 0, ny: -1 };
  }

  let d = u * totalLen;

  // 1. Top edge (left -> right)
  if (d <= topLen) {
    return { px: x + r + d, py: y, nx: 0, ny: -1 };
  }
  d -= topLen;

  // 2. Top-right arc
  if (d <= arcLen && r > 0) {
    const a = -Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    return { px: x + w - r + nx * r, py: y + r + ny * r, nx, ny };
  }
  d -= arcLen;

  // 3. Right edge (top -> bottom)
  if (d <= sideLen) {
    return { px: x + w, py: y + r + d, nx: 1, ny: 0 };
  }
  d -= sideLen;

  // 4. Bottom-right arc
  if (d <= arcLen && r > 0) {
    const a = (d / arcLen) * (Math.PI / 2);
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    return { px: x + w - r + nx * r, py: y + h - r + ny * r, nx, ny };
  }
  d -= arcLen;

  // 5. Bottom edge (right -> left)
  if (d <= topLen) {
    return { px: x + w - r - d, py: y + h, nx: 0, ny: 1 };
  }
  d -= topLen;

  // 6. Bottom-left arc
  if (d <= arcLen && r > 0) {
    const a = Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    return { px: x + r + nx * r, py: y + h - r + ny * r, nx, ny };
  }
  d -= arcLen;

  // 7. Left edge (bottom -> top)
  if (d <= sideLen) {
    return { px: x, py: y + h - r - d, nx: -1, ny: 0 };
  }
  d -= sideLen;

  // 8. Top-left arc
  if (r > 0) {
    const a = Math.PI + Math.min(1, d / arcLen) * (Math.PI / 2);
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    return { px: x + r + nx * r, py: y + r + ny * r, nx, ny };
  }

  return { px: x, py: y, nx: 0, ny: -1 };
}

function appendRoundedRectSubPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number
): void {
  const r = Math.max(0, Math.min(rRaw, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawRoundedRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number
): void {
  ctx.beginPath();
  appendRoundedRectSubPath(ctx, x, y, w, h, rRaw);
}

function drawStarSpark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  fill: string,
  strokeColor: string,
  rotation: number
): void {
  const innerR = outerR * 0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.75;
  ctx.stroke();
  ctx.restore();
}

/**
 * Multi-octave periodic wave height in [0.18, 1.0].
 * Uses integer multiples of TAU across u so the closed perimeter loop has zero seam.
 */
function computeWaveHeight(u: number, t: number, phaseOffset: number): number {
  const theta1 = u * TAU * 4 - t * 2.1 + phaseOffset;
  const theta2 = u * TAU * 7 + t * 1.5 - phaseOffset * 0.7;
  const theta3 = u * TAU * 11 + t * 3.4 + phaseOffset * 1.3;
  const theta4 = u * TAU * 23 - t * 5.6 + phaseOffset * 0.8;

  const billow = 0.5 + 0.5 * Math.sin(theta1);
  const swell = 0.5 + 0.5 * Math.sin(theta2);
  const crest = Math.pow(1 - Math.abs(Math.sin(theta3)), 1.4);
  const lick = Math.pow(1 - Math.abs(Math.cos(theta4)), 1.65);

  return Math.min(1, 0.18 + 0.24 * billow + 0.2 * swell + 0.24 * crest + 0.14 * lick);
}

function drawSmoothClosedWave(ctx: CanvasRenderingContext2D, points: readonly Point2D[]): void {
  const count = points.length;
  if (count < 3) return;

  const last = points[count - 1];
  const first = points[0];
  ctx.beginPath();
  ctx.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);

  for (let i = 0; i < count; i++) {
    const cur = points[i];
    const next = points[(i + 1) % count];
    ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) * 0.5, (cur.y + next.y) * 0.5);
  }

  ctx.closePath();
}

function buildBurstShards(compact: boolean): BurstShard[] {
  const count = compact ? 14 : 22;
  const palette = ['#F97316', '#FACC15', '#FEF08A', '#34D399'];
  return Array.from({ length: count }, (_, idx) => ({
    u: (idx + 0.35) / count,
    speed: compact ? 8 + (idx % 3) * 2.5 : 10 + (idx % 3) * 3,
    size: compact ? 2.2 + (idx % 2) * 1.1 : 2.8 + (idx % 3) * 1.1,
    color: palette[idx % palette.length],
    isStar: idx % 3 === 0,
    jitter: ((idx * 37) % 10) / 10 - 0.5,
  }));
}

interface FireLayerSpec {
  heightScale: number;
  phaseOffset: number;
  fillStyle: string;
  shadowColor?: string;
  shadowBlur?: number;
}

export const SakugaBorderFire: React.FC<SakugaBorderFireProps> = ({
  percent,
  radius = 16,
  compact = false,
  mini = false,
}) => {
  const clampedPct = clampPercent(percent);
  const active = clampedPct >= 50;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const percentRef = useRef<number>(clampedPct);
  const prevPercentRef = useRef<number>(clampedPct);
  const burstStartRef = useRef<number | null>(null);
  const burstShardsRef = useRef<BurstShard[]>(buildBurstShards(compact));

  useEffect(() => {
    const prev = prevPercentRef.current;
    if (prev < 100 && clampedPct >= 100) {
      burstStartRef.current = performance.now();
    } else if (clampedPct < 50) {
      burstStartRef.current = null;
    }
    prevPercentRef.current = clampedPct;
    percentRef.current = clampedPct;
  }, [clampedPct]);

  useEffect(() => {
    burstShardsRef.current = buildBurstShards(compact);
  }, [compact]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pad = mini ? 7 : compact ? 12 : 16;
    const sampleCount = mini ? 84 : compact ? 140 : 190;

    let width = host.clientWidth;
    let height = host.clientHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let isVisible = true;
    let rafId = 0;
    let lastDraw = 0;

    const perimeterSamples: PerimeterPoint[] = [];
    const layerPoints: Point2D[] = Array.from({ length: sampleCount }, () => ({ x: 0, y: 0 }));

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = motionQuery.matches;

    const rebuildPerimeterCache = () => {
      perimeterSamples.length = 0;
      if (width <= 0 || height <= 0) return;
      for (let i = 0; i < sampleCount; i++) {
        const u = i / sampleCount;
        perimeterSamples.push(sampleRoundedRectPerimeter(u, pad, pad, width, height, radius));
      }
    };

    const syncSize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, Math.round((width + pad * 2) * dpr));
      const ch = Math.max(1, Math.round((height + pad * 2) * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildPerimeterCache();
    };

    const drawFrame = (now: number) => {
      if (width <= 0 || height <= 0 || perimeterSamples.length === 0) return;

      const curPct = percentRef.current;
      const canvasW = width + pad * 2;
      const canvasH = height + pad * 2;

      if (curPct < 50) {
        ctx.clearRect(0, 0, canvasW, canvasH);
        return;
      }

      const ratio = (curPct - 50) / 50; // 0 at 50%, 1 at 100%
      const isMax = curPct >= 100;
      const t = prefersReduced ? 1.2 : now * 0.001;

      ctx.clearRect(0, 0, canvasW, canvasH);

      // Compute one-shot 100% explosion surge progress if active
      let burstP = -1;
      let surgeBoost = 1;
      if (burstStartRef.current !== null && !prefersReduced) {
        const elapsed = now - burstStartRef.current;
        if (elapsed >= BURST_DURATION_MS) {
          burstStartRef.current = null;
        } else {
          burstP = elapsed / BURST_DURATION_MS;
          surgeBoost = 1 + 0.34 * (1 - burstP);
        }
      }

      // Curtain thickness scales smoothly with % while keeping comfortable margin inside pad
      const baseMaxH = mini
        ? 2.4 + ratio * 2.0
        : compact
          ? 5.2 + ratio * 4.4
          : 6.4 + ratio * 5.8;
      const maxWaveH = Math.min(pad - (mini ? 1.5 : 2.5), baseMaxH * surgeBoost);

      // Clip interior of the card using evenodd rule so the fire sheet hugs flush outside border
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvasW, canvasH);
      appendRoundedRectSubPath(
        ctx,
        pad + 1,
        pad + 1,
        Math.max(0, width - 2),
        Math.max(0, height - 2),
        Math.max(0, radius - 1)
      );
      ctx.clip('evenodd');

      const layers: FireLayerSpec[] = [
        {
          heightScale: 1.04,
          phaseOffset: 0,
          fillStyle: 'rgba(194, 65, 12, 0.62)',
          shadowColor: 'rgba(234, 88, 12, 0.7)',
          shadowBlur: mini ? 3.5 : compact ? 5 : 8,
        },
        {
          heightScale: 0.86,
          phaseOffset: 0.42,
          fillStyle: '#F97316',
        },
        {
          heightScale: 0.6,
          phaseOffset: -0.55,
          fillStyle: '#FACC15',
        },
        {
          heightScale: 0.34,
          phaseOffset: 0.9,
          fillStyle: '#FEF9C3',
        },
      ];

      for (const layer of layers) {
        for (let i = 0; i < sampleCount; i++) {
          const u = i / sampleCount;
          const pt = perimeterSamples[i];
          const wave = computeWaveHeight(u, t, layer.phaseOffset);

          // Blend outward normal with upward fire buoyancy while guaranteeing outward clearance
          const buoyX = pt.nx;
          const buoyY = pt.ny - 0.34 * (1 - Math.max(0, pt.ny) * 0.78);
          const norm = Math.hypot(buoyX, buoyY) || 1;
          const dirX = buoyX / norm;
          const dirY = buoyY / norm;

          // Lush billowing crests along top & sides; compact simmering fire rim on bottom
          const edgeWeight = 0.6 + 0.4 * (1 - Math.max(0, pt.ny));
          const disp = wave * maxWaveH * layer.heightScale * edgeWeight;

          // Subtle tangential wind curl on tall wave crests
          const tanX = -pt.ny;
          const tanY = pt.nx;
          const curlScale = mini ? 0.55 : 1;
          const curl =
            (Math.sin(u * TAU * 9 - t * 3.9 + layer.phaseOffset) * 1.7 +
              Math.cos(u * TAU * 17 + t * 4.8) * 0.8) *
            wave *
            (0.45 + ratio * 0.55) *
            curlScale;

          layerPoints[i].x = pt.px + dirX * disp + tanX * curl;
          layerPoints[i].y = pt.py + dirY * disp + tanY * curl;
        }

        ctx.save();
        if (layer.shadowBlur && layer.shadowColor) {
          ctx.shadowBlur = layer.shadowBlur;
          ctx.shadowColor = layer.shadowColor;
        }
        drawSmoothClosedWave(ctx, layerPoints);
        ctx.fillStyle = layer.fillStyle;
        ctx.fill();
        ctx.restore();
      }

      // Floating warm ember sparks drifting off the highest flame crests
      if (!prefersReduced && ratio > 0.1) {
        const emberCount = mini
          ? Math.round(2 + ratio * 3)
          : compact
            ? Math.round(5 + ratio * 5)
            : Math.round(8 + ratio * 9);
        for (let e = 0; e < emberCount; e++) {
          const cycle = (t * 1.15 + e * 0.27) % 1;
          const u = (e + 0.5) / emberCount + Math.sin(e * 4.1) * 0.02;
          const pt = sampleRoundedRectPerimeter(u, pad, pad, width, height, radius);
          const crestH = computeWaveHeight(u, t - cycle * 0.25, 0.42) * maxWaveH;
          const dist = crestH * 0.8 + (mini ? 0.8 : 1.2) + cycle * (mini ? 2.5 : compact ? 4 : 5.5);
          const ex = pt.px + pt.nx * dist + Math.sin(cycle * 7 + e * 2.3) * (mini ? 1.1 : 2);
          const ey = pt.py + pt.ny * dist - cycle * (mini ? 2.5 : compact ? 2.8 : 4);
          const maxEr = mini ? 1.05 : isMax ? 1.7 : 1.35;
          const er = Math.max(mini ? 0.5 : 0.65, (1 - cycle) * maxEr);
          ctx.beginPath();
          ctx.arc(ex, ey, er, 0, TAU);
          ctx.fillStyle = cycle < 0.42 ? '#FEF08A' : isMax && e % 4 === 0 ? '#6EE7B7' : '#FB923C';
          ctx.fill();
        }
      }

      // Crisp 4-point anime star sparkles at >= 80% & 100% (disabled on mini button outlines)
      if (!mini && curPct >= 80) {
        const starCount = isMax ? (compact ? 5 : 8) : compact ? 2 : 4;
        for (let s = 0; s < starCount; s++) {
          const u = (s + 0.22) / starCount;
          const pt = sampleRoundedRectPerimeter(u, pad, pad, width, height, radius);
          const pulse = prefersReduced ? 0.85 : 0.55 + 0.45 * Math.sin(t * 4.8 + s * 1.9);
          if (pulse < 0.34) continue;
          const offset = maxWaveH * 0.82 + (compact ? 2.2 : 3.2);
          const sx = pt.px + pt.nx * offset;
          const sy = pt.py + pt.ny * offset - 1;
          const outerR = (compact ? 2.6 : 3.4) * pulse;
          const fill = s % 2 === 0 ? '#FEF08A' : isMax ? '#6EE7B7' : '#FDE047';
          const stroke = s % 2 === 0 ? 'rgba(120, 53, 15, 0.7)' : 'rgba(6, 78, 59, 0.75)';
          drawStarSpark(ctx, sx, sy, outerR, fill, stroke, t * 1.6 + s);
        }
      }

      // One-shot 100% Sakuga perimeter explosion burst
      if (burstP >= 0) {
        const ease = 1 - Math.pow(1 - burstP, 3);
        const alpha = 1 - Math.pow(burstP, 1.4);

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);

        const ringExpand = ease * (compact ? 9 : 12);
        drawRoundedRectStroke(
          ctx,
          pad - ringExpand,
          pad - ringExpand,
          width + ringExpand * 2,
          height + ringExpand * 2,
          radius + ringExpand * 0.65
        );
        ctx.strokeStyle = burstP < 0.45 ? '#FEF08A' : '#34D399';
        ctx.lineWidth = Math.max(0.9, (1 - burstP) * 2.8);
        ctx.stroke();

        for (const shard of burstShardsRef.current) {
          const pt = sampleRoundedRectPerimeter(shard.u, pad, pad, width, height, radius);
          const dist = ease * shard.speed;
          const px = pt.px + pt.nx * dist + shard.jitter * 4 * ease;
          const py = pt.py + pt.ny * dist + shard.jitter * 4 * ease;
          const curSize = shard.size * (1 - burstP * 0.45);
          if (shard.isStar) {
            drawStarSpark(ctx, px, py, curSize * 1.45, shard.color, '#18181B', ease * 2.4);
          } else {
            ctx.beginPath();
            ctx.arc(px, py, curSize, 0, TAU);
            ctx.fillStyle = shard.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(24, 24, 27, 0.55)';
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      ctx.restore(); // End interior card evenodd clip
    };

    const tick = (now: number) => {
      if (prefersReduced || document.hidden || !isVisible) {
        rafId = 0;
        return;
      }
      if (now - lastDraw >= FRAME_MS) {
        lastDraw = now;
        drawFrame(now);
      }
      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (prefersReduced || document.hidden || !isVisible || rafId !== 0) return;
      lastDraw = 0;
      rafId = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const ro = new ResizeObserver(() => {
      syncSize();
      drawFrame(performance.now());
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((entry) => entry.isIntersecting);
        if (isVisible) {
          drawFrame(performance.now());
          startLoop();
        } else {
          stopLoop();
        }
      },
      { threshold: 0.01 }
    );
    io.observe(host);

    const handleVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        drawFrame(performance.now());
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleMotionChange = () => {
      prefersReduced = motionQuery.matches;
      stopLoop();
      drawFrame(performance.now());
      if (!prefersReduced) startLoop();
    };
    motionQuery.addEventListener('change', handleMotionChange);

    syncSize();
    drawFrame(performance.now());
    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [active, compact, mini, radius]);

  if (!active) return null;

  const pad = mini ? 7 : compact ? 12 : 16;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        top: -pad,
        right: -pad,
        bottom: -pad,
        left: -pad,
        width: `calc(100% + ${pad * 2}px)`,
        height: `calc(100% + ${pad * 2}px)`,
      }}
      className="pointer-events-none absolute z-20"
    />
  );
};
