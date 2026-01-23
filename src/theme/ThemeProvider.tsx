import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { baseTheme, premiumTheme, highContrastLightOverrides, highContrastDarkOverrides } from './tokens';
import type { ThemeTokens, ColorTokens } from './tokens/types';
import { themeConfig, type ThemeMode, type ColorMode, type ContrastMode } from './config';

interface ThemeContextValue {
  // Current theme configuration
  themeMode: ThemeMode;
  colorMode: ColorMode;
  contrastMode: ContrastMode;
  reducedMotion: boolean;
  
  // Resolved values
  resolvedColorMode: 'light' | 'dark';
  currentTheme: ThemeTokens;
  
  // Setters
  setThemeMode: (mode: ThemeMode) => void;
  setColorMode: (mode: ColorMode) => void;
  setContrastMode: (mode: ContrastMode) => void;
  
  // Utilities
  isPremium: boolean;
  isDark: boolean;
  isHighContrast: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  themeMode: 'theme-mode',
  colorMode: 'color-mode',
  contrastMode: 'contrast-mode',
};

function getSystemColorMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSystemReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyColorTokens(tokens: ColorTokens, overrides?: Partial<ColorTokens>) {
  const merged = { ...tokens, ...overrides };
  const root = document.documentElement;
  
  // Map token keys to CSS variable names
  const cssVarMap: Record<keyof ColorTokens, string> = {
    background: '--background',
    foreground: '--foreground',
    card: '--card',
    cardForeground: '--card-foreground',
    popover: '--popover',
    popoverForeground: '--popover-foreground',
    primary: '--primary',
    primaryForeground: '--primary-foreground',
    secondary: '--secondary',
    secondaryForeground: '--secondary-foreground',
    accent: '--accent',
    accentForeground: '--accent-foreground',
    muted: '--muted',
    mutedForeground: '--muted-foreground',
    destructive: '--destructive',
    destructiveForeground: '--destructive-foreground',
    success: '--success',
    successForeground: '--success-foreground',
    warning: '--warning',
    warningForeground: '--warning-foreground',
    info: '--info',
    infoForeground: '--info-foreground',
    border: '--border',
    borderSubtle: '--border-subtle',
    input: '--input',
    ring: '--ring',
    sidebarBackground: '--sidebar-background',
    sidebarForeground: '--sidebar-foreground',
    sidebarPrimary: '--sidebar-primary',
    sidebarPrimaryForeground: '--sidebar-primary-foreground',
    sidebarAccent: '--sidebar-accent',
    sidebarAccentForeground: '--sidebar-accent-foreground',
    sidebarBorder: '--sidebar-border',
    sidebarRing: '--sidebar-ring',
    chart1: '--chart-1',
    chart2: '--chart-2',
    chart3: '--chart-3',
    chart4: '--chart-4',
    chart5: '--chart-5',
  };
  
  Object.entries(merged).forEach(([key, value]) => {
    const cssVar = cssVarMap[key as keyof ColorTokens];
    if (cssVar && value) {
      root.style.setProperty(cssVar, value);
    }
  });
}

function applyShadowTokens(shadows: ThemeTokens['shadows']['light']) {
  const root = document.documentElement;
  root.style.setProperty('--shadow-2xs', shadows['2xs']);
  root.style.setProperty('--shadow-xs', shadows.xs);
  root.style.setProperty('--shadow-sm', shadows.sm);
  root.style.setProperty('--shadow', shadows.DEFAULT);
  root.style.setProperty('--shadow-md', shadows.md);
  root.style.setProperty('--shadow-lg', shadows.lg);
  root.style.setProperty('--shadow-xl', shadows.xl);
  root.style.setProperty('--shadow-2xl', shadows['2xl']);
}

function applyMotionTokens(motion: ThemeTokens['motion'], reducedMotion: boolean) {
  const root = document.documentElement;
  
  if (reducedMotion) {
    root.style.setProperty('--duration-fast', '0ms');
    root.style.setProperty('--duration-med', '0ms');
    root.style.setProperty('--duration-slow', '0ms');
  } else {
    root.style.setProperty('--duration-fast', motion.durationFast);
    root.style.setProperty('--duration-med', motion.durationMed);
    root.style.setProperty('--duration-slow', motion.durationSlow);
  }
  
  root.style.setProperty('--easing-default', motion.easingDefault);
  root.style.setProperty('--easing-in', motion.easingIn);
  root.style.setProperty('--easing-out', motion.easingOut);
  root.style.setProperty('--easing-in-out', motion.easingInOut);
}

function applyRadiusTokens(radius: ThemeTokens['radius']) {
  const root = document.documentElement;
  root.style.setProperty('--radius', radius.DEFAULT);
  root.style.setProperty('--radius-sm', radius.sm);
  root.style.setProperty('--radius-md', radius.md);
  root.style.setProperty('--radius-lg', radius.lg);
  root.style.setProperty('--radius-xl', radius.xl);
  root.style.setProperty('--radius-2xl', radius['2xl']);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return themeConfig.themeMode;
    const stored = localStorage.getItem(STORAGE_KEYS.themeMode) as ThemeMode | null;
    return stored || themeConfig.themeMode;
  });
  
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    if (typeof window === 'undefined') return themeConfig.defaultColorMode;
    const stored = localStorage.getItem(STORAGE_KEYS.colorMode) as ColorMode | null;
    return stored || themeConfig.defaultColorMode;
  });
  
  const [contrastMode, setContrastModeState] = useState<ContrastMode>(() => {
    if (typeof window === 'undefined') return themeConfig.defaultContrastMode;
    const stored = localStorage.getItem(STORAGE_KEYS.contrastMode) as ContrastMode | null;
    return stored || themeConfig.defaultContrastMode;
  });
  
  const [reducedMotion, setReducedMotion] = useState(() => 
    themeConfig.respectReducedMotion && getSystemReducedMotion()
  );
  
  const [systemColorMode, setSystemColorMode] = useState<'light' | 'dark'>(getSystemColorMode);
  
  // Resolve the actual color mode
  const resolvedColorMode = colorMode === 'system' ? systemColorMode : colorMode;
  
  // Get the current theme tokens
  const currentTheme = themeMode === 'premium' ? premiumTheme : baseTheme;
  
  // Setters with persistence
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_KEYS.themeMode, mode);
  }, []);
  
  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem(STORAGE_KEYS.colorMode, mode);
  }, []);
  
  const setContrastMode = useCallback((mode: ContrastMode) => {
    setContrastModeState(mode);
    localStorage.setItem(STORAGE_KEYS.contrastMode, mode);
  }, []);
  
  // Listen for system preference changes
  useEffect(() => {
    const colorModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleColorChange = (e: MediaQueryListEvent) => {
      setSystemColorMode(e.matches ? 'dark' : 'light');
    };
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (themeConfig.respectReducedMotion) {
        setReducedMotion(e.matches);
      }
    };
    
    colorModeQuery.addEventListener('change', handleColorChange);
    motionQuery.addEventListener('change', handleMotionChange);
    
    return () => {
      colorModeQuery.removeEventListener('change', handleColorChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);
  
  // Apply theme changes
  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolvedColorMode === 'dark';
    const isHighContrast = contrastMode === 'high';
    
    // Apply dark mode class
    root.classList.toggle('dark', isDark);
    
    // Apply theme mode class for potential CSS overrides
    root.dataset.theme = themeMode;
    root.dataset.contrast = contrastMode;
    
    // Get color tokens for current mode
    const colorTokens = isDark ? currentTheme.colors.dark : currentTheme.colors.light;
    
    // Get high contrast overrides if enabled
    const contrastOverrides = isHighContrast
      ? (isDark ? highContrastDarkOverrides : highContrastLightOverrides)
      : undefined;
    
    // Apply all tokens
    applyColorTokens(colorTokens, contrastOverrides);
    applyShadowTokens(isDark ? currentTheme.shadows.dark : currentTheme.shadows.light);
    applyMotionTokens(currentTheme.motion, reducedMotion);
    applyRadiusTokens(currentTheme.radius);
    
  }, [themeMode, resolvedColorMode, contrastMode, reducedMotion, currentTheme]);
  
  const value: ThemeContextValue = {
    themeMode,
    colorMode,
    contrastMode,
    reducedMotion,
    resolvedColorMode,
    currentTheme,
    setThemeMode,
    setColorMode,
    setContrastMode,
    isPremium: themeMode === 'premium',
    isDark: resolvedColorMode === 'dark',
    isHighContrast: contrastMode === 'high',
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export a simple hook for checking premium theme
export function useIsPremiumTheme(): boolean {
  const context = useContext(ThemeContext);
  return context?.isPremium ?? false;
}
