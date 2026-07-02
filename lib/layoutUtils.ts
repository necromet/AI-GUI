import type { StitchLayout } from '../types';

export function getLayoutDimensions(layout: StitchLayout): { width: number; height: number } {
  switch (layout) {
    case '16:9': return { width: 1920, height: 1080 };
    case '1:1': return { width: 1080, height: 1080 };
    case '9:16': return { width: 1080, height: 1920 };
    case '4:5': return { width: 1080, height: 1350 };
    case '1.91:1': return { width: 1200, height: 628 };
    case '4:3': return { width: 1440, height: 1080 };
    case '3:4': return { width: 1080, height: 1440 };
    case '32:9': return { width: 2560, height: 1080 };
    default: return { width: 1920, height: 1080 };
  }
}
