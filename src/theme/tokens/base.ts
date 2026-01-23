// Base theme tokens - matches the current app theme
import type { ThemeTokens } from './types';

export const baseTheme: ThemeTokens = {
  name: 'base',
  colors: {
    light: {
      // Surfaces
      background: '220 14% 96%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      popover: '0 0% 100%',
      popoverForeground: '222 47% 11%',
      
      // Interactive
      primary: '217 91% 32%',
      primaryForeground: '0 0% 100%',
      secondary: '215 20% 65%',
      secondaryForeground: '222 47% 11%',
      accent: '217 91% 95%',
      accentForeground: '217 91% 32%',
      
      // Semantic
      muted: '220 14% 92%',
      mutedForeground: '220 9% 46%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      success: '142 71% 45%',
      successForeground: '0 0% 100%',
      warning: '38 92% 50%',
      warningForeground: '0 0% 100%',
      info: '199 89% 48%',
      infoForeground: '0 0% 100%',
      
      // Structural
      border: '220 13% 86%',
      borderSubtle: '220 13% 90%',
      input: '220 13% 86%',
      ring: '217 91% 32%',
      
      // Sidebar
      sidebarBackground: '222 47% 11%',
      sidebarForeground: '210 40% 96%',
      sidebarPrimary: '199 89% 48%',
      sidebarPrimaryForeground: '222 47% 11%',
      sidebarAccent: '217 33% 17%',
      sidebarAccentForeground: '210 40% 98%',
      sidebarBorder: '217 33% 17%',
      sidebarRing: '199 89% 48%',
      
      // Charts
      chart1: '217 91% 45%',
      chart2: '199 89% 48%',
      chart3: '142 71% 45%',
      chart4: '38 92% 50%',
      chart5: '262 83% 58%',
    },
    dark: {
      // Surfaces
      background: '222 47% 8%',
      foreground: '210 40% 98%',
      card: '222 47% 11%',
      cardForeground: '210 40% 98%',
      popover: '222 47% 13%',
      popoverForeground: '210 40% 98%',
      
      // Interactive
      primary: '199 89% 48%',
      primaryForeground: '222 47% 8%',
      secondary: '217 33% 25%',
      secondaryForeground: '210 40% 98%',
      accent: '217 33% 17%',
      accentForeground: '199 89% 60%',
      
      // Semantic
      muted: '217 33% 17%',
      mutedForeground: '215 20% 55%',
      destructive: '0 72% 55%',
      destructiveForeground: '0 0% 100%',
      success: '142 71% 50%',
      successForeground: '0 0% 100%',
      warning: '38 92% 55%',
      warningForeground: '0 0% 100%',
      info: '199 89% 55%',
      infoForeground: '0 0% 100%',
      
      // Structural
      border: '217 33% 20%',
      borderSubtle: '217 33% 16%',
      input: '217 33% 20%',
      ring: '199 89% 48%',
      
      // Sidebar
      sidebarBackground: '222 47% 6%',
      sidebarForeground: '210 40% 96%',
      sidebarPrimary: '199 89% 48%',
      sidebarPrimaryForeground: '222 47% 8%',
      sidebarAccent: '217 33% 14%',
      sidebarAccentForeground: '210 40% 98%',
      sidebarBorder: '217 33% 14%',
      sidebarRing: '199 89% 48%',
      
      // Charts
      chart1: '199 89% 55%',
      chart2: '217 91% 55%',
      chart3: '142 71% 50%',
      chart4: '38 92% 55%',
      chart5: '262 83% 65%',
    },
  },
  shadows: {
    light: {
      '2xs': '0 1px 2px 0 hsl(222 47% 11% / 0.03)',
      xs: '0 1px 3px 0 hsl(222 47% 11% / 0.04)',
      sm: '0 1px 2px 0 hsl(222 47% 11% / 0.05)',
      DEFAULT: '0 1px 3px 0 hsl(222 47% 11% / 0.06), 0 1px 2px -1px hsl(222 47% 11% / 0.04)',
      md: '0 4px 6px -1px hsl(222 47% 11% / 0.07), 0 2px 4px -2px hsl(222 47% 11% / 0.04)',
      lg: '0 10px 15px -3px hsl(222 47% 11% / 0.08), 0 4px 6px -4px hsl(222 47% 11% / 0.04)',
      xl: '0 20px 25px -5px hsl(222 47% 11% / 0.08), 0 8px 10px -6px hsl(222 47% 11% / 0.04)',
      '2xl': '0 25px 50px -12px hsl(222 47% 11% / 0.15)',
    },
    dark: {
      '2xs': '0 1px 2px 0 hsl(222 47% 0% / 0.1)',
      xs: '0 1px 3px 0 hsl(222 47% 0% / 0.15)',
      sm: '0 1px 2px 0 hsl(222 47% 0% / 0.2)',
      DEFAULT: '0 1px 3px 0 hsl(222 47% 0% / 0.25), 0 1px 2px -1px hsl(222 47% 0% / 0.15)',
      md: '0 4px 6px -1px hsl(222 47% 0% / 0.3), 0 2px 4px -2px hsl(222 47% 0% / 0.15)',
      lg: '0 10px 15px -3px hsl(222 47% 0% / 0.35), 0 4px 6px -4px hsl(222 47% 0% / 0.2)',
      xl: '0 20px 25px -5px hsl(222 47% 0% / 0.35), 0 8px 10px -6px hsl(222 47% 0% / 0.2)',
      '2xl': '0 25px 50px -12px hsl(222 47% 0% / 0.5)',
    },
  },
  motion: {
    durationFast: '100ms',
    durationMed: '200ms',
    durationSlow: '300ms',
    easingDefault: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easingIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easingOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easingInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    DEFAULT: '0.375rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
};
