// Premium theme tokens - sophisticated, high-end enterprise design
import type { ThemeTokens } from './types';

export const premiumTheme: ThemeTokens = {
  name: 'premium',
  colors: {
    light: {
      // Surfaces - warm off-whites, never pure white
      background: '220 20% 97%',
      foreground: '224 71% 4%',
      card: '0 0% 100%',
      cardForeground: '224 71% 4%',
      popover: '0 0% 100%',
      popoverForeground: '224 71% 4%',
      
      // Interactive - refined navy with subtle warmth
      primary: '221 83% 28%',
      primaryForeground: '0 0% 100%',
      secondary: '220 14% 95%',
      secondaryForeground: '220 9% 30%',
      accent: '221 83% 96%',
      accentForeground: '221 83% 28%',
      
      // Semantic - muted, professional tones
      muted: '220 14% 94%',
      mutedForeground: '220 9% 42%',
      destructive: '0 65% 55%',
      destructiveForeground: '0 0% 100%',
      success: '152 60% 38%',
      successForeground: '0 0% 100%',
      warning: '38 85% 48%',
      warningForeground: '0 0% 100%',
      info: '210 92% 45%',
      infoForeground: '0 0% 100%',
      
      // Structural - ultra-subtle borders
      border: '220 13% 88%',
      borderSubtle: '220 13% 92%',
      input: '220 13% 88%',
      ring: '221 83% 53%',
      
      // Sidebar - dark, sophisticated
      sidebarBackground: '224 71% 4%',
      sidebarForeground: '220 20% 92%',
      sidebarPrimary: '210 92% 55%',
      sidebarPrimaryForeground: '224 71% 4%',
      sidebarAccent: '220 17% 12%',
      sidebarAccentForeground: '220 20% 98%',
      sidebarBorder: '220 17% 12%',
      sidebarRing: '210 92% 55%',
      
      // Charts - harmonious, sophisticated palette
      chart1: '221 83% 45%',
      chart2: '210 92% 50%',
      chart3: '152 60% 42%',
      chart4: '38 85% 52%',
      chart5: '270 67% 55%',
    },
    dark: {
      // Surfaces - rich, deep tones
      background: '224 71% 4%',
      foreground: '220 20% 96%',
      card: '220 17% 8%',
      cardForeground: '220 20% 96%',
      popover: '220 17% 10%',
      popoverForeground: '220 20% 96%',
      
      // Interactive - vibrant but refined
      primary: '210 92% 55%',
      primaryForeground: '224 71% 4%',
      secondary: '220 17% 17%',
      secondaryForeground: '220 20% 90%',
      accent: '220 17% 14%',
      accentForeground: '210 92% 65%',
      
      // Semantic
      muted: '220 17% 14%',
      mutedForeground: '220 14% 55%',
      destructive: '0 72% 58%',
      destructiveForeground: '0 0% 100%',
      success: '152 60% 48%',
      successForeground: '0 0% 100%',
      warning: '38 85% 55%',
      warningForeground: '0 0% 100%',
      info: '210 92% 55%',
      infoForeground: '0 0% 100%',
      
      // Structural
      border: '220 17% 18%',
      borderSubtle: '220 17% 14%',
      input: '220 17% 18%',
      ring: '210 92% 55%',
      
      // Sidebar
      sidebarBackground: '224 71% 3%',
      sidebarForeground: '220 20% 92%',
      sidebarPrimary: '210 92% 55%',
      sidebarPrimaryForeground: '224 71% 4%',
      sidebarAccent: '220 17% 10%',
      sidebarAccentForeground: '220 20% 98%',
      sidebarBorder: '220 17% 10%',
      sidebarRing: '210 92% 55%',
      
      // Charts
      chart1: '210 92% 58%',
      chart2: '221 83% 55%',
      chart3: '152 60% 52%',
      chart4: '38 85% 58%',
      chart5: '270 67% 62%',
    },
  },
  shadows: {
    light: {
      // Ultra-refined, barely-there shadows for premium feel
      '2xs': '0 1px 2px 0 hsl(224 71% 4% / 0.02)',
      xs: '0 1px 2px 0 hsl(224 71% 4% / 0.03)',
      sm: '0 1px 3px 0 hsl(224 71% 4% / 0.03), 0 1px 2px -1px hsl(224 71% 4% / 0.02)',
      DEFAULT: '0 1px 3px 0 hsl(224 71% 4% / 0.04), 0 1px 2px -1px hsl(224 71% 4% / 0.03)',
      md: '0 4px 6px -1px hsl(224 71% 4% / 0.04), 0 2px 4px -2px hsl(224 71% 4% / 0.02)',
      lg: '0 10px 15px -3px hsl(224 71% 4% / 0.05), 0 4px 6px -4px hsl(224 71% 4% / 0.02)',
      xl: '0 20px 25px -5px hsl(224 71% 4% / 0.05), 0 8px 10px -6px hsl(224 71% 4% / 0.02)',
      '2xl': '0 25px 50px -12px hsl(224 71% 4% / 0.1)',
    },
    dark: {
      '2xs': '0 1px 2px 0 hsl(224 71% 0% / 0.15)',
      xs: '0 1px 2px 0 hsl(224 71% 0% / 0.2)',
      sm: '0 1px 3px 0 hsl(224 71% 0% / 0.25), 0 1px 2px -1px hsl(224 71% 0% / 0.15)',
      DEFAULT: '0 1px 3px 0 hsl(224 71% 0% / 0.3), 0 1px 2px -1px hsl(224 71% 0% / 0.2)',
      md: '0 4px 6px -1px hsl(224 71% 0% / 0.35), 0 2px 4px -2px hsl(224 71% 0% / 0.2)',
      lg: '0 10px 15px -3px hsl(224 71% 0% / 0.4), 0 4px 6px -4px hsl(224 71% 0% / 0.25)',
      xl: '0 20px 25px -5px hsl(224 71% 0% / 0.4), 0 8px 10px -6px hsl(224 71% 0% / 0.25)',
      '2xl': '0 25px 50px -12px hsl(224 71% 0% / 0.55)',
    },
  },
  motion: {
    // Slightly slower, more elegant transitions
    durationFast: '120ms',
    durationMed: '220ms',
    durationSlow: '350ms',
    easingDefault: 'cubic-bezier(0.32, 0.72, 0, 1)',
    easingIn: 'cubic-bezier(0.32, 0, 0.67, 0)',
    easingOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
    easingInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
  radius: {
    // Tighter, more refined radius
    none: '0',
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.25rem',
    lg: '0.375rem',
    xl: '0.5rem',
    '2xl': '0.75rem',
    full: '9999px',
  },
};
