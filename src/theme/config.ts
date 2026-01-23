// Theme configuration - single source of truth for theme mode
// Change this value to switch between themes

export type ThemeMode = 'base' | 'premium';
export type ColorMode = 'light' | 'dark' | 'system';
export type ContrastMode = 'normal' | 'high';

export interface ThemeConfig {
  // Set to 'premium' to enable the new sophisticated theme
  // Set to 'base' to use the original theme
  themeMode: ThemeMode;
  
  // Default color mode preference
  defaultColorMode: ColorMode;
  
  // Enable high contrast mode
  defaultContrastMode: ContrastMode;
  
  // Respect user's prefers-reduced-motion
  respectReducedMotion: boolean;
}

// ============================================
// THEME TOGGLE - Change this to switch themes
// ============================================
export const themeConfig: ThemeConfig = {
  themeMode: 'base', // Change to 'premium' to enable new theme
  defaultColorMode: 'system',
  defaultContrastMode: 'normal',
  respectReducedMotion: true,
};

// For quick switching during development
export const PREMIUM_THEME_ENABLED = themeConfig.themeMode === 'premium';
