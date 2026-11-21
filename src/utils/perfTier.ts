export type PerfTier = 'low' | 'balanced';

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
  };
}

let cachedLowPower: boolean | null = null;
let lastIsNarrowViewport = false;
let resizeListenerBound = false;

function computeLowPowerDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const isNarrow = window.innerWidth < 768;
  lastIsNarrowViewport = isNarrow;
  if (isNarrow) return true;

  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    return true;
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithHints) : null;
  if (nav) {
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) {
      return true;
    }
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) {
      return true;
    }
    if (nav.connection?.saveData) {
      return true;
    }
  }

  return false;
}

function ensureResizeInvalidation(): void {
  if (resizeListenerBound || typeof window === 'undefined') return;
  resizeListenerBound = true;
  lastIsNarrowViewport = window.innerWidth < 768;

  window.addEventListener(
    'resize',
    () => {
      const nowNarrow = window.innerWidth < 768;
      if (nowNarrow !== lastIsNarrowViewport) {
        lastIsNarrowViewport = nowNarrow;
        cachedLowPower = null;
      }
    },
    { passive: true }
  );
}

/**
 * Returns true on mobile viewports, touch-first devices, low-core/low-RAM hardware,
 * or Data Saver sessions so animations automatically use lighter frame budgets.
 */
export function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  ensureResizeInvalidation();
  if (cachedLowPower === null) {
    cachedLowPower = computeLowPowerDevice();
  }
  return cachedLowPower;
}

export function getPerfTier(): PerfTier {
  return isLowPowerDevice() ? 'low' : 'balanced';
}
