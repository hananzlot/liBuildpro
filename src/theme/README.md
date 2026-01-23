# Theme System

A production-grade, reversible theming architecture for the application.

## Quick Start

### Enable Premium Theme
Edit `src/theme/config.ts`:
```ts
themeMode: 'premium', // Change from 'base' to 'premium'
```

### Revert to Base Theme
```ts
themeMode: 'base',
```

## Architecture

```
src/theme/
├── config.ts           # Single toggle for theme mode
├── ThemeProvider.tsx   # React context provider
├── index.ts            # Public exports
└── tokens/
    ├── types.ts        # TypeScript definitions
    ├── base.ts         # Original theme tokens
    ├── premium.ts      # Premium theme tokens
    ├── high-contrast.ts # Accessibility overrides
    └── index.ts        # Token exports
```

## Features

- **One-line toggle** between base and premium themes
- **Light/Dark mode** with system preference detection
- **High contrast mode** for accessibility
- **Reduced motion** support
- **Runtime switching** via `useTheme()` hook
- **Persistent preferences** via localStorage

## Usage

```tsx
import { useTheme } from '@/theme';

function MyComponent() {
  const { 
    themeMode,      // 'base' | 'premium'
    colorMode,      // 'light' | 'dark' | 'system'
    setThemeMode,   // (mode) => void
    setColorMode,   // (mode) => void
    isPremium,      // boolean
    isDark,         // boolean
  } = useTheme();

  return (
    <button onClick={() => setThemeMode('premium')}>
      Enable Premium Theme
    </button>
  );
}
```

## Theme Preview

Visit `/admin/theme-preview` to see all components in both themes.

## Adding New Tokens

1. Add to `tokens/types.ts`
2. Define values in both `base.ts` and `premium.ts`
3. Apply in `ThemeProvider.tsx`
4. Add CSS variable to `index.css`
