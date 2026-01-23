// Theme token type definitions

export interface ColorTokens {
  // Surfaces
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  
  // Interactive
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  
  // Semantic
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  
  // Structural
  border: string;
  borderSubtle: string;
  input: string;
  ring: string;
  
  // Sidebar
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  
  // Charts
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export interface ShadowTokens {
  '2xs': string;
  xs: string;
  sm: string;
  DEFAULT: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface MotionTokens {
  durationFast: string;
  durationMed: string;
  durationSlow: string;
  easingDefault: string;
  easingIn: string;
  easingOut: string;
  easingInOut: string;
}

export interface RadiusTokens {
  none: string;
  sm: string;
  DEFAULT: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

export interface SpacingScale {
  0: string;
  0.5: string;
  1: string;
  1.5: string;
  2: string;
  2.5: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
  32: string;
  40: string;
  48: string;
  64: string;
}

export interface ThemeTokens {
  name: string;
  colors: {
    light: ColorTokens;
    dark: ColorTokens;
  };
  shadows: {
    light: ShadowTokens;
    dark: ShadowTokens;
  };
  motion: MotionTokens;
  radius: RadiusTokens;
}

export type ThemeMode = 'base' | 'premium';
export type ColorMode = 'light' | 'dark' | 'system';
export type ContrastMode = 'normal' | 'high';
