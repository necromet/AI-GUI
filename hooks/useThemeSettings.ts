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
  inter: "'Inter', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  outfit: "'Outfit', sans-serif",
  manrope: "'Manrope', sans-serif",
  sora: "'Sora', sans-serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  'ibm-plex-sans': "'IBM Plex Sans', sans-serif",
  'work-sans': "'Work Sans', sans-serif",
  nunito: "'Nunito', sans-serif",
  figtree: "'Figtree', sans-serif",
  lato: "'Lato', sans-serif",
  rubik: "'Rubik', sans-serif",
  epilogue: "'Epilogue', sans-serif",
  'jetbrains-mono': "'JetBrains Mono', monospace",
  'ibm-plex-mono': "'IBM Plex Mono', monospace",
  'fira-code': "'Fira Code', monospace",
  'source-code-pro': "'Source Code Pro', monospace",
  'space-mono': "'Space Mono', monospace",
  'roboto-mono': "'Roboto Mono', monospace",
  inconsolata: "'Inconsolata', monospace",
  'playfair-display': "'Playfair Display', serif",
  lora: "'Lora', serif",
  merriweather: "'Merriweather', serif",
  'source-serif-4': "'Source Serif 4', serif",
  'libre-baskerville': "'Libre Baskerville', serif",
  'eb-garamond': "'EB Garamond', serif",
  fraunces: "'Fraunces', serif",
};

export type DesignSystem = 'edward' | 'terminal';

export function useThemeSettings() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return localStorage.getItem('edward:labs_theme') === 'light' ? 'light' : 'dark';
  });
  const [designSystem, setDesignSystem] = useState<DesignSystem>(() => {
    const stored = localStorage.getItem('edward:labs_designSystem');
    return stored === 'terminal' ? 'terminal' : 'edward';
  });
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
    localStorage.setItem('edward:labs_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.designSystem = designSystem;
    localStorage.setItem('edward:labs_designSystem', designSystem);
  }, [designSystem]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    const mode = isDark ? 'dark' : 'light';

    if (neonPreset) {
      const preset = NEON_PRESETS.find(p => p.id === neonPreset)
        || NEON_PRESETS.find(p => p.id === 'cyber')
        || NEON_PRESETS[0];
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
    const preset = THEME_PRESETS.find(p => p.id === themePreset)
      || THEME_PRESETS.find(p => p.id === 'default')
      || THEME_PRESETS[0];
    const vars = preset[mode];

    const allThemeKeys = new Set(
      THEME_PRESETS.flatMap(themePresetDef => [
        ...Object.keys(themePresetDef.light),
        ...Object.keys(themePresetDef.dark),
      ]),
    );
    for (const key of allThemeKeys) {
      root.style.setProperty(key, vars[key] || '');
    }

    localStorage.setItem('edward:labs_themePreset', themePreset);
  }, [themePreset, theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${FONT_SIZE_MAP[fontSize] || 15}px`);
    localStorage.setItem('edward:labs_fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    const stack = FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.default;
    const root = document.documentElement;
    // Keep app font, Tailwind sans utility, and preflight default in sync
    // so the selected family actually reaches every surface.
    root.style.setProperty('--app-font-family', stack);
    root.style.setProperty('--font-sans', stack);
    root.style.setProperty('--default-font-family', stack);
    localStorage.setItem('edward:labs_fontFamily', fontFamily);

    // Kick off webfont load so swap is not stuck on the fallback face.
    const primary = stack.split(',')[0].replace(/['"]/g, '').trim();
    if (primary && 'fonts' in document) {
      void document.fonts.load(`400 16px "${primary}"`).catch(() => undefined);
      void document.fonts.load(`600 16px "${primary}"`).catch(() => undefined);
    }
  }, [fontFamily, designSystem, themePreset]);

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
    designSystem,
    setDesignSystem,
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
