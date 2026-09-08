import { useState, useEffect } from 'react';
import { NEON_PRESETS, INDIVIDUAL_COLORS, THEME_PRESETS } from '../constants';

export const FONT_SIZE_MAP: Record<string, number> = { xs: 16, sm: 17, base: 18, lg: 20, xl: 22 };

export const FONT_FAMILY_MAP: Record<string, string> = {
  default: "'Plus Jakarta Sans', 'Google Sans', 'Open Sans', 'Fredoka', 'Comfortaa', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', sans-serif",
  'plus-jakarta-sans': "'Plus Jakarta Sans', sans-serif",
  'google-sans': "'Google Sans', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  fredoka: "'Fredoka', sans-serif",
  comfortaa: "'Comfortaa', sans-serif",
  'space-grotesk': "'Space Grotesk', sans-serif",
};

export function useThemeSettings() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('edward:labs_fontSize') || 'base';
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('edward:labs_fontFamily') || 'default';
  });
  const [neonColor, setNeonColor] = useState<string>(() => {
    return localStorage.getItem('edward:labs_neonColor') || 'red';
  });
  const [neonPreset, setNeonPreset] = useState<string>(() => {
    return localStorage.getItem('edward:labs_neonPreset') || 'cyber';
  });
  const [themePreset, setThemePreset] = useState<string>(() => {
    return localStorage.getItem('edward:labs_themePreset') || 'default';
  });
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(() => {
    const stored = localStorage.getItem('edward:labs_maxOutputTokens');
    if (stored) {
      const val = parseInt(stored, 10);
      return isNaN(val) || val <= 0 ? undefined : val;
    }
    return undefined;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    const mode = isDark ? 'dark' : 'light';

    if (neonPreset) {
      const preset = NEON_PRESETS.find(p => p.id === neonPreset) || NEON_PRESETS[0];
      root.style.setProperty('--neon-rgb', preset.primary[mode].rgb);
      root.style.setProperty('--neon-color', preset.primary[mode].tailwind);
      root.style.setProperty('--neon-secondary-rgb', preset.secondary[mode].rgb);
      root.style.setProperty('--neon-secondary', preset.secondary[mode].tailwind);
      root.style.setProperty('--neon-accent-rgb', preset.accent[mode].rgb);
      root.style.setProperty('--neon-accent', preset.accent[mode].tailwind);
    } else {
      const color = INDIVIDUAL_COLORS[neonColor] || INDIVIDUAL_COLORS.red;
      const variant = color[mode];
      root.style.setProperty('--neon-rgb', variant.rgb);
      root.style.setProperty('--neon-color', variant.tailwind);
      root.style.setProperty('--neon-secondary-rgb', variant.rgb);
      root.style.setProperty('--neon-secondary', variant.tailwind);
      root.style.setProperty('--neon-accent-rgb', variant.rgb);
      root.style.setProperty('--neon-accent', variant.tailwind);
    }

    localStorage.setItem('edward:labs_neonPreset', neonPreset);
    localStorage.setItem('edward:labs_neonColor', neonColor);
  }, [neonColor, neonPreset, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const mode = theme === 'dark' ? 'dark' : 'light';
    const preset = THEME_PRESETS.find(p => p.id === themePreset) || THEME_PRESETS[0];
    const vars = preset[mode];

    const defaultVars = THEME_PRESETS[0][mode];
    for (const key of new Set([...Object.keys(vars), ...Object.keys(defaultVars)])) {
      root.style.setProperty(key, vars[key] || '');
    }

    if (preset.neon) {
      const neonColors = preset.neon[mode];
      root.style.setProperty('--neon-rgb', neonColors.primary.rgb);
      root.style.setProperty('--neon-color', neonColors.primary.tailwind);
      root.style.setProperty('--neon-secondary-rgb', neonColors.secondary.rgb);
      root.style.setProperty('--neon-secondary', neonColors.secondary.tailwind);
      root.style.setProperty('--neon-accent-rgb', neonColors.accent.rgb);
      root.style.setProperty('--neon-accent', neonColors.accent.tailwind);
    }

    localStorage.setItem('edward:labs_themePreset', themePreset);
  }, [themePreset, theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${FONT_SIZE_MAP[fontSize] || 15}px`);
    localStorage.setItem('edward:labs_fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.default);
    localStorage.setItem('edward:labs_fontFamily', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    if (maxOutputTokens) {
      localStorage.setItem('edward:labs_maxOutputTokens', maxOutputTokens.toString());
    } else {
      localStorage.removeItem('edward:labs_maxOutputTokens');
    }
  }, [maxOutputTokens]);

  return {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    neonColor,
    setNeonColor,
    neonPreset,
    setNeonPreset,
    themePreset,
    setThemePreset,
    maxOutputTokens,
    setMaxOutputTokens,
  };
}
