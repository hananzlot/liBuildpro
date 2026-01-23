// High contrast accessibility overrides
import type { ColorTokens } from './types';

export const highContrastLightOverrides: Partial<ColorTokens> = {
  background: '0 0% 100%',
  foreground: '0 0% 0%',
  card: '0 0% 100%',
  cardForeground: '0 0% 0%',
  popover: '0 0% 100%',
  popoverForeground: '0 0% 0%',
  
  primary: '221 83% 25%',
  primaryForeground: '0 0% 100%',
  
  muted: '220 14% 90%',
  mutedForeground: '0 0% 20%',
  
  border: '0 0% 50%',
  borderSubtle: '0 0% 60%',
  input: '0 0% 50%',
  ring: '221 100% 40%',
  
  destructive: '0 100% 40%',
  success: '142 100% 30%',
  warning: '38 100% 40%',
  info: '210 100% 40%',
};

export const highContrastDarkOverrides: Partial<ColorTokens> = {
  background: '0 0% 0%',
  foreground: '0 0% 100%',
  card: '0 0% 5%',
  cardForeground: '0 0% 100%',
  popover: '0 0% 5%',
  popoverForeground: '0 0% 100%',
  
  primary: '210 100% 65%',
  primaryForeground: '0 0% 0%',
  
  muted: '0 0% 15%',
  mutedForeground: '0 0% 75%',
  
  border: '0 0% 50%',
  borderSubtle: '0 0% 40%',
  input: '0 0% 50%',
  ring: '210 100% 60%',
  
  destructive: '0 100% 60%',
  success: '142 100% 55%',
  warning: '38 100% 55%',
  info: '210 100% 60%',
};
