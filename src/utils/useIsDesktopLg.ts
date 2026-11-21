import { useEffect, useState } from 'react';

const DESKTOP_LG_QUERY = '(min-width: 1024px)';

let sharedMql: MediaQueryList | null = null;
const listeners = new Set<() => void>();
let boundListener = false;

function getMql(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  if (!sharedMql) {
    sharedMql = window.matchMedia(DESKTOP_LG_QUERY);
  }
  if (!boundListener) {
    boundListener = true;
    sharedMql.addEventListener('change', () => {
      for (const cb of listeners) {
        cb();
      }
    });
  }
  return sharedMql;
}

export function getIsDesktopLg(): boolean {
  const mql = getMql();
  return mql ? mql.matches : true;
}

export function useIsDesktopLg(): boolean {
  const [isDesktopLg, setIsDesktopLg] = useState<boolean>(getIsDesktopLg);

  useEffect(() => {
    const mql = getMql();
    if (!mql) return;

    const handleChange = () => {
      setIsDesktopLg(mql.matches);
    };

    if (isDesktopLg !== mql.matches) {
      setIsDesktopLg(mql.matches);
    }

    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, [isDesktopLg]);

  return isDesktopLg;
}
