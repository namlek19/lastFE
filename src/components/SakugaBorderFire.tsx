import React, { useEffect, useRef } from 'react';

export interface SakugaBorderFireProps {
  /** Mastery/completion percentage (0..100). Mounts and animates only at >= 50%. */
  percent: number;
  /** Border radius of the host card in px (matches rounded-xl=12, rounded-2xl=16). */
  radius?: number;
  /** Compact sizing for narrow sidebar chapter cards. */
  compact?: boolean;
}

interface PerimeterPoint {
  px: number;
  py: number;
  nx: number;
  ny: number;
}

interface BurstShard {
  u: number;
  speed: number;
  size: number;
  color: string;
  isStar: boolean;
  jitter: number;
}

const FRAME_MS = 1000 / 30;
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

function drawRoundedRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number
): void {
  const r = Math.max(0, Math.min(rRaw, w / 2, h / 2));
  ctx.beginPath();
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

function drawCelFlameTongue(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  dirX: number,
  dirY: number,
  width: number,
  height: number,
  sway: number,
  outerColor: string
): void {
  const perpX = -dirY;
  const perpY = dirX;
  const hw = width * 0.5;
  const tipSway = sway * width * 0.72;
  const midSway = sway * width * 0.28;

  const leftX = bx - perpX * hw;
  const leftY = by - perpY * hw;
  const rightX = bx + perpX * hw;
  const rightY = by + perpY * hw;
  const tipX = bx + dirX * height + perpX * tipSway;
  const tipY = by + dirY * height + perpY * tipSway;

  // Outer cel-shaded flame silhouette
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.quadraticCurveTo(
    bx - perpX * (hw * 0.85) + dirX * (height * 0.55) + perpX * midSway,
    by - perpY * (hw * 0.85) + dirY * (height * 0.55) + perpY * midSway,
    tipX,
    tipY
  );
  ctx.quadraticCurveTo(
    bx + perpX * (hw * 0.85) + dirX * (height * 0.55) + perpX * midSway,
    by + perpY * (hw * 0.85) + dirY * (height * 0.55) + perpY * midSway,
    rightX,
    rightY
  );
  ctx.closePath();
  ctx.fillStyle = outerColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(67, 20, 7, 0.42)';
  ctx.lineWidth = 0.9;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Middle golden flame tongue (counter-sway)
  const midH = height * 0.68;
  const midHw = hw * 0.62;
  const mTipSway = -sway * width * 0.25;
  ctx.beginPath();
  ctx.moveTo(bx - perpX * midHw + dirX * 0.8, by - perpY * midHw + dirY * 0.8);
  ctx.quadraticCurveTo(
    bx - perpX * (midHw * 0.7) + dirX * (midH * 0.56),
    by - perpY * (midHw * 0.7) + dirY * (midH * 0.56),
    bx + dirX * midH + perpX * mTipSway,
    by + dirY * midH + perpY * mTipSway
  );
  ctx.quadraticCurveTo(
    bx + perpX * (midHw * 0.7) + dirX * (midH * 0.56),
    by + perpY * (midHw * 0.7) + dirY * (midH * 0.56),
    bx + perpX * midHw + dirX * 0.8,
    by + perpY * midHw + dirY * 0.8
  );
  ctx.closePath();
  ctx.fillStyle = '#FACC15';
  ctx.fill();

  // Bright hot yellow-cream core
  const coreH = height * 0.38;
  const coreHw = hw * 0.34;
  ctx.beginPath();
  ctx.moveTo(bx - perpX * coreHw + dirX * 1.1, by - perpY * coreHw + dirY * 1.1);
  ctx.quadraticCurveTo(
    bx + dirX * (coreH * 0.65),
    by + dirY * (coreH * 0.65),
    bx + dirX * coreH,
    by + dirY * coreH
  );
  ctx.quadraticCurveTo(
    bx + dirX * (coreH * 0.65),
    by + dirY * (coreH * 0.65),
    bx + perpX * coreHw + dirX * 1.1,
    by + perpY * coreHw + dirY * 1.1
  );
  ctx.closePath();
  ctx.fillStyle = '#FEF9C3';
  ctx.fill();
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

export const SakugaBorderFire: React.FC<SakugaBorderFireProps> = ({
  percent,
  radius = 16,
  compact = false,
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

    const pad = compact ? 10 : 13;
    let width = host.clientWidth;
    let height = host.clientHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let isVisible = true;
    let rafId = 0;
    let lastDraw = 0;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = motionQuery.matches;

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
    };

    const drawFrame = (now: number) => {
      if (width <= 0 || height <= 0) return;

      const curPct = percentRef.current;
      if (curPct < 50) {
        ctx.clearRect(0, 0, width + pad * 2, height + pad * 2);
        return;
      }

      const ratio = (curPct - 50) / 50; // 0 at 50%, 1 at 100%
      const isMax = curPct >= 100;
      const t = prefersReduced ? 1.2 : now * 0.001;

      ctx.clearRect(0, 0, width + pad * 2, height + pad * 2);

      // Subtle warm aura line right along the card edge, brightening at 100%
      ctx.save();
      drawRoundedRectStroke(ctx, pad, pad, width, height, radius);
      ctx.strokeStyle = isMax
        ? 'rgba(16, 185, 129, 0.48)'
        : `rgba(249, 115, 22, ${(0.12 + ratio * 0.16).toFixed(2)})`;
      ctx.lineWidth = isMax ? 2 : 1.25;
      ctx.stroke();
      ctx.restore();

      // Spaced-out cel-shaded anime flames burning around the perimeter
      const flameCount = compact
        ? Math.round(7 + ratio * 7)
        : Math.round(10 + ratio * 12);

      const maxBaseH = compact ? 5 + ratio * 4.5 : 6 + ratio * 6;
      const maxBaseW = compact ? 4.4 + ratio * 2.4 : 5.4 + ratio * 3;

      for (let i = 0; i < flameCount; i++) {
        const seed = i * 1.93 + 0.4;
        const drift = prefersReduced ? 0 : Math.sin(t * 2.1 + seed) * 0.004;
        const u = (i + 0.5) / flameCount + drift;
        const pt = sampleRoundedRectPerimeter(u, pad, pad, width, height, radius);

        // Blend outward normal with upward fire buoyancy while preserving outward direction
        const rawX = pt.nx;
        const rawY = pt.ny - 0.36 * (1 - Math.max(0, pt.ny) * 0.78);
        const norm = Math.hypot(rawX, rawY) || 1;
        const dirX = rawX / norm;
        const dirY = rawY / norm;

        const flicker = prefersReduced
          ? 1
          : 0.8 + 0.24 * Math.sin(t * 6.8 + seed * 1.7) + 0.12 * Math.cos(t * 10.3 + seed);
        const edgeFactor = pt.ny > 0.55 ? 0.76 : 1;
        const fH = maxBaseH * flicker * edgeFactor * (i % 3 === 0 ? 1.12 : 0.92);
        const fW = maxBaseW * (0.9 + 0.12 * Math.sin(t * 5.2 + seed));
        const sway = prefersReduced ? 0.1 : Math.sin(t * 7.4 + seed * 2.1);

        const outerColor = isMax && i % 4 === 0 ? '#EA580C' : i % 2 === 0 ? '#F97316' : '#EA580C';

        drawCelFlameTongue(
          ctx,
          pt.px - dirX * 0.8,
          pt.py - dirY * 0.8,
          dirX,
          dirY,
          fW,
          fH,
          sway,
          outerColor
        );

        // Sparse rising ember spark above alternating flame tips
        if (!prefersReduced && i % 2 === 0 && ratio > 0.15) {
          const emberCycle = (t * 1.35 + i * 0.31) % 1;
          if (emberCycle < 0.82) {
            const dist = fH + 1.5 + emberCycle * (compact ? 4 : 5.5);
            const ex = pt.px + dirX * dist + Math.sin(emberCycle * 8 + seed) * 1.6;
            const ey = pt.py + dirY * dist - emberCycle * 2.2;
            const er = Math.max(0.7, (1 - emberCycle) * (isMax ? 1.9 : 1.45));
            ctx.beginPath();
            ctx.arc(ex, ey, er, 0, TAU);
            ctx.fillStyle = emberCycle < 0.45 ? '#FDE047' : '#FB923C';
            ctx.fill();
          }
        }
      }

      // Sparse 4-point anime star sparkles at >= 80% and 100%
      if (curPct >= 80) {
        const starCount = isMax ? (compact ? 5 : 7) : compact ? 2 : 4;
        for (let s = 0; s < starCount; s++) {
          const u = (s + 0.18) / starCount;
          const pt = sampleRoundedRectPerimeter(u, pad, pad, width, height, radius);
          const pulse = prefersReduced ? 0.85 : 0.55 + 0.45 * Math.sin(t * 4.8 + s * 1.9);
          if (pulse < 0.32) continue;
          const offset = (compact ? 6.5 : 8.5) + (s % 2) * 1.5;
          const sx = pt.px + pt.nx * offset;
          const sy = pt.py + pt.ny * offset - 1.2;
          const outerR = (compact ? 2.8 : 3.5) * pulse;
          const fill = s % 2 === 0 ? '#FEF08A' : isMax ? '#6EE7B7' : '#FDE047';
          const stroke = s % 2 === 0 ? 'rgba(120, 53, 15, 0.7)' : 'rgba(6, 78, 59, 0.75)';
          drawStarSpark(ctx, sx, sy, outerR, fill, stroke, t * 1.6 + s);
        }
      }

      // One-shot Sakuga 100% perimeter explosion burst
      if (burstStartRef.current !== null && !prefersReduced) {
        const elapsed = now - burstStartRef.current;
        if (elapsed >= BURST_DURATION_MS) {
          burstStartRef.current = null;
        } else {
          const p = elapsed / BURST_DURATION_MS;
          const ease = 1 - Math.pow(1 - p, 3);
          const alpha = 1 - Math.pow(p, 1.4);

          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);

          // Expanding shock ring
          const ringExpand = ease * (compact ? 8 : 11);
          drawRoundedRectStroke(
            ctx,
            pad - ringExpand,
            pad - ringExpand,
            width + ringExpand * 2,
            height + ringExpand * 2,
            radius + ringExpand * 0.65
          );
          ctx.strokeStyle = p < 0.45 ? '#FEF08A' : '#34D399';
          ctx.lineWidth = Math.max(0.8, (1 - p) * 2.8);
          ctx.stroke();

          // Radial cel shards & stars
          for (const shard of burstShardsRef.current) {
            const pt = sampleRoundedRectPerimeter(shard.u, pad, pad, width, height, radius);
            const dist = ease * shard.speed;
            const px = pt.px + pt.nx * dist + shard.jitter * 4 * ease;
            const py = pt.py + pt.ny * dist + shard.jitter * 4 * ease;
            const curSize = shard.size * (1 - p * 0.45);
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
      }
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
  }, [active, compact, radius]);

  if (!active) return null;

  const pad = compact ? 10 : 13;

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
