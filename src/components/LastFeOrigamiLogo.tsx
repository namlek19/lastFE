import React, { memo } from 'react';

export const LASTFE_VIEWBOX = '0 -2 292 78';
export const LASTFE_VIEWBOX_MIN_Y = -2;
export const LASTFE_VIEWBOX_W = 292;
export const LASTFE_VIEWBOX_H = 78;

export type LastFeToneKey =
  | 'lBright'
  | 'lMid'
  | 'lDeep'
  | 'lViolet'
  | 'fBright'
  | 'fViolet'
  | 'fDeep'
  | 'fRose'
  | 'fCyan';

export interface LastFeFacet {
  points: readonly (readonly [number, number])[];
  ptsStr: string;
  tone: LastFeToneKey;
  cx: number;
  cy: number;
  letterIdx: number;
}

export interface LastFePalette {
  lBright: string;
  lMid: string;
  lDeep: string;
  lViolet: string;
  fBright: string;
  fViolet: string;
  fDeep: string;
  fRose: string;
  fCyan: string;
  crease: string;
  starAccent: string;
}

export const LASTFE_PALETTES: Record<'light' | 'dark', LastFePalette> = {
  light: {
    lBright: '#4F46E5',
    lMid: '#3730A3',
    lDeep: '#1E1B4B',
    lViolet: '#6D28D9',
    fBright: '#7C3AED',
    fViolet: '#5B21B6',
    fDeep: '#312E81',
    fRose: '#DB2777',
    fCyan: '#0284C7',
    crease: 'rgba(224, 231, 255, 0.55)',
    starAccent: '#DB2777',
  },
  dark: {
    lBright: '#FFFFFF',
    lMid: '#DDD6FE',
    lDeep: '#A78BFA',
    lViolet: '#E0E7FF',
    fBright: '#F5F3FF',
    fViolet: '#DDD6FE',
    fDeep: '#C4B5FD',
    fRose: '#F472B6',
    fCyan: '#67E8F9',
    crease: 'rgba(76, 29, 149, 0.28)',
    starAccent: '#F9A8D4',
  },
};

const TONE_CLASS_MAP: Record<LastFeToneKey, string> = {
  lBright: 'fill-[#4F46E5] dark:fill-[#FFFFFF]',
  lMid: 'fill-[#3730A3] dark:fill-[#DDD6FE]',
  lDeep: 'fill-[#1E1B4B] dark:fill-[#A78BFA]',
  lViolet: 'fill-[#6D28D9] dark:fill-[#E0E7FF]',
  fBright: 'fill-[#7C3AED] dark:fill-[#F5F3FF]',
  fViolet: 'fill-[#5B21B6] dark:fill-[#DDD6FE]',
  fDeep: 'fill-[#312E81] dark:fill-[#C4B5FD]',
  fRose: 'fill-[#DB2777] dark:fill-[#F472B6]',
  fCyan: 'fill-[#0284C7] dark:fill-[#67E8F9]',
};

function makeFacet(
  points: readonly (readonly [number, number])[],
  tone: LastFeToneKey,
  letterIdx: number
): LastFeFacet {
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < points.length; i++) {
    sumX += points[i][0];
    sumY += points[i][1];
  }
  const n = Math.max(1, points.length);
  return {
    points,
    ptsStr: points.map((p) => `${p[0]},${p[1]}`).join(' '),
    tone,
    cx: sumX / n,
    cy: sumY / n,
    letterIdx,
  };
}

export const LASTFE_FACETS: readonly LastFeFacet[] = [
  // L (letterIdx 0)
  makeFacet([[8, 17], [20, 12], [20, 34], [8, 40]], 'lBright', 0),
  makeFacet([[8, 40], [20, 34], [20, 53], [8, 64]], 'lMid', 0),
  makeFacet([[8, 64], [20, 53], [27, 64]], 'lDeep', 0),
  makeFacet([[20, 53], [46, 53], [40, 64], [27, 64]], 'lViolet', 0),
  // a (letterIdx 1)
  makeFacet([[52, 38], [62, 28], [65, 37], [62, 40]], 'lViolet', 1),
  makeFacet([[62, 28], [81, 28], [81, 37], [65, 37]], 'lBright', 1),
  makeFacet([[52, 38], [62, 40], [62, 53], [52, 55]], 'lMid', 1),
  makeFacet([[52, 55], [62, 53], [65, 55], [61, 64]], 'lDeep', 1),
  makeFacet([[61, 64], [65, 55], [81, 55], [76, 64]], 'lMid', 1),
  makeFacet([[81, 28], [92, 32], [92, 48], [81, 46]], 'lBright', 1),
  makeFacet([[81, 46], [92, 48], [92, 64], [81, 64]], 'lDeep', 1),
  // s (letterIdx 2)
  makeFacet([[106, 28], [135, 28], [131, 36], [108, 36]], 'lBright', 2),
  makeFacet([[99, 35], [106, 28], [108, 36], [108, 40], [99, 47]], 'lDeep', 2),
  makeFacet([[99, 47], [108, 40], [136, 46], [126, 53]], 'lViolet', 2),
  makeFacet([[126, 53], [136, 46], [136, 56], [128, 64], [126, 56]], 'lDeep', 2),
  makeFacet([[102, 56], [126, 56], [128, 64], [98, 64]], 'lMid', 2),
  // t (letterIdx 3)
  makeFacet([[148, 20], [159, 16], [159, 28], [148, 28]], 'lBright', 3),
  makeFacet([[141, 36], [144, 28], [148, 28], [148, 36]], 'lDeep', 3),
  makeFacet([[148, 28], [169, 28], [165, 36], [148, 36]], 'lViolet', 3),
  makeFacet([[148, 36], [159, 36], [159, 54], [148, 57]], 'lMid', 3),
  makeFacet([[148, 57], [159, 54], [162, 64], [155, 64]], 'lDeep', 3),
  makeFacet([[159, 54], [170, 55], [167, 64], [162, 64]], 'lBright', 3),
  // F (letterIdx 4)
  makeFacet([[179, 12], [218, 12], [213, 23], [191, 23]], 'fBright', 4),
  makeFacet([[179, 12], [191, 23], [191, 35], [179, 41]], 'fDeep', 4),
  makeFacet([[191, 35], [213, 35], [208, 45], [191, 45]], 'fRose', 4),
  makeFacet([[179, 41], [191, 35], [191, 60], [179, 64]], 'fViolet', 4),
  // E (letterIdx 5)
  makeFacet([[224, 12], [266, 12], [261, 23], [236, 23]], 'fBright', 5),
  makeFacet([[224, 12], [236, 23], [236, 35], [224, 41]], 'fDeep', 5),
  makeFacet([[236, 35], [258, 35], [253, 45], [236, 45]], 'fCyan', 5),
  makeFacet([[224, 41], [236, 35], [236, 53], [224, 64]], 'fDeep', 5),
  makeFacet([[224, 64], [236, 53], [266, 53], [261, 64]], 'fBright', 5),
];

export const LASTFE_STAR_POINTS: readonly (readonly [number, number])[] = [
  [154, 3],
  [155.3, 7],
  [159.3, 8.3],
  [155.3, 9.6],
  [154, 13.6],
  [152.7, 9.6],
  [148.7, 8.3],
  [152.7, 7],
];

export const LASTFE_STAR_PTS = LASTFE_STAR_POINTS.map((p) => `${p[0]},${p[1]}`).join(' ');

export const LASTFE_PERCHED_BUTTERFLY_TRANSFORM = {
  tx: 255,
  ty: 1,
  rotDeg: 14,
  scale: 0.76,
} as const;

export interface PerchedButterflyPoly {
  points: readonly (readonly [number, number])[];
  ptsStr: string;
  lightFill: string;
  darkFill: string;
  twClass: string;
}

function makeBfPoly(
  points: readonly (readonly [number, number])[],
  lightFill: string,
  darkFill: string,
  twClass: string
): PerchedButterflyPoly {
  return {
    points,
    ptsStr: points.map((p) => `${p[0]},${p[1]}`).join(' '),
    lightFill,
    darkFill,
    twClass,
  };
}

export const LASTFE_PERCHED_BUTTERFLY_POLYS: readonly PerchedButterflyPoly[] = [
  makeBfPoly([[18, 14], [1.5, 5], [12, 18]], '#312E81', '#FFFFFF', 'fill-[#312E81] dark:fill-[#FFFFFF]'),
  makeBfPoly([[18, 14], [12, 18], [17.4, 19]], '#4F46E5', '#DDD6FE', 'fill-[#4F46E5] dark:fill-[#DDD6FE]'),
  makeBfPoly([[17.6, 18], [8.5, 20], [12.2, 31.5]], '#1E1B4B', '#F5F3FF', 'fill-[#1E1B4B] dark:fill-[#F5F3FF]'),
  makeBfPoly([[17.6, 18], [12.2, 31.5], [16.2, 24.5]], '#DB2777', '#F472B6', 'fill-[#DB2777] dark:fill-[#F472B6]'),
  makeBfPoly([[18, 14], [34.5, 5], [24, 18]], '#3730A3', '#FFFFFF', 'fill-[#3730A3] dark:fill-[#FFFFFF]'),
  makeBfPoly([[18, 14], [24, 18], [18.6, 19]], '#6D28D9', '#E0E7FF', 'fill-[#6D28D9] dark:fill-[#E0E7FF]'),
  makeBfPoly([[18.4, 18], [27.5, 20], [23.8, 31.5]], '#1E1B4B', '#FFFFFF', 'fill-[#1E1B4B] dark:fill-[#FFFFFF]'),
  makeBfPoly([[18.4, 18], [23.8, 31.5], [19.8, 24.5]], '#0284C7', '#C4B5FD', 'fill-[#0284C7] dark:fill-[#C4B5FD]'),
  makeBfPoly([[18, 11.5], [18.8, 17], [18, 22], [17.2, 17]], '#0F172A', '#FFFFFF', 'fill-[#0F172A] dark:fill-[#FFFFFF]'),
];

export interface LastFeOrigamiLogoProps {
  className?: string;
  showGlow?: boolean;
  ariaLabel?: string;
}

/**
 * Approved Origami "LastFE" (Mẫu 2) wordmark with perched crystal origami butterfly on E.
 * Shares exact polygon vertices & colors with SakugaSumieIntro for 1:1 visual handoff.
 */
const LastFeOrigamiLogoComponent: React.FC<LastFeOrigamiLogoProps> = ({
  className = '',
  ariaLabel = 'LastFE',
}) => {
  const { tx, ty, rotDeg, scale } = LASTFE_PERCHED_BUTTERFLY_TRANSFORM;

  return (
    <svg
      viewBox={LASTFE_VIEWBOX}
      role="img"
      aria-label={ariaLabel}
      className={`overflow-visible select-none ${className}`}
    >
      {LASTFE_FACETS.map((facet, idx) => (
        <polygon
          key={idx}
          points={facet.ptsStr}
          className={`${TONE_CLASS_MAP[facet.tone]} stroke-[#E0E7FF]/55 dark:stroke-[#4C1D95]/30`}
          strokeWidth="0.45"
          strokeLinejoin="round"
        />
      ))}

      <polygon points={LASTFE_STAR_PTS} className="fill-[#DB2777] dark:fill-[#F9A8D4]" />

      <g transform={`translate(${tx}, ${ty}) rotate(${rotDeg}) scale(${scale})`}>
        {LASTFE_PERCHED_BUTTERFLY_POLYS.map((poly, idx) => (
          <polygon
            key={idx}
            points={poly.ptsStr}
            className={`${poly.twClass} stroke-[#E0E7FF]/55 dark:stroke-[#4C1D95]/30`}
            strokeWidth="0.45"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
};

export const LastFeOrigamiLogo = memo(LastFeOrigamiLogoComponent);
LastFeOrigamiLogo.displayName = 'LastFeOrigamiLogo';
