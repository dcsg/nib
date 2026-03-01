# PRD: Phase 7 — "Ship Everywhere"

**Status:** Planned — implement after Phase 6 ships
**Phase:** 7
**Milestone:** Token outputs reach native mobile platforms
**Target users:** Cross-platform product teams building React Native, Flutter, iOS, or Android apps alongside a web product
**References:** [../roadmap.md](../roadmap.md#phase-7--ship-everywhere), [../gap-analysis.md](../gap-analysis.md)
**Depends on:** Phase 2 — DTCG composite types (shadow, typography, transition); Phase 3 — component token tier

---

## Problem

nib Phase 1 outputs CSS variables and a Tailwind preset — both web-only. Teams building cross-platform products (React Native, Flutter, iOS, Android) must manually translate their DTCG tokens to platform-specific formats. This translation is:

- Error-prone (color format differences, unit conversions, platform conventions)
- Repeated every time tokens change
- Not validated against platform constraints (e.g., iOS doesn't support `oklch`)

The result: the design system is authoritative for web, but native platforms drift.

---

## Goals

1. `nib brand build --platform <target>` produces correct, importable token output for each native platform
2. All adapters consume the same DTCG source — one token set drives all platforms
3. Adapters handle unit conversion, color format translation, and platform naming conventions automatically
4. Outputs are typed where the platform supports it (TypeScript, Swift, Kotlin/Dart)

### Non-goals for this phase

- Native component scaffolding (platform-specific component code is out of scope — tokens only)
- Animation/motion adapter (DTCG `transition` tokens are emitted but not wired to platform animation APIs)
- Hot reload / watch mode for native (file output only)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| React Native themed output imports without TypeScript errors | 100% |
| Flutter `ThemeData` compiles without warnings | 100% |
| iOS Swift constants compile on Xcode 15+ | 100% |
| Android Compose theme compiles on API 24+ | 100% |
| All color values converted to platform-correct format | 100% (no web-only formats like `oklch` in native output) |

---

## User Stories

**As a React Native developer**, I want `nib brand build --platform react-native` to produce a typed `theme.ts` with a `useTheme()` hook so I can use brand tokens in my components without manual translation.

**As a Flutter developer**, I want `nib brand build --platform flutter` to produce a `ThemeData` builder and a `ColorScheme` so I can pass my brand colors to `MaterialApp` in one line.

**As an iOS developer**, I want `nib brand build --platform ios` to produce Swift constants and `.xcassets` color entries so I can reference brand colors with full autocomplete support in Xcode.

**As an Android developer**, I want `nib brand build --platform android` to produce Compose theme objects and `colors.xml` / `dimens.xml` resources so I can use brand tokens in both Compose and legacy XML layouts.

---

## Functional Requirements

### FR-1: `nib brand build --platform <target>`

**Command:** `nib brand build --platform react-native|flutter|ios|android|all`

Can be combined with existing build:
```bash
nib brand build                          # existing: CSS + Tailwind + Pencil
nib brand build --platform react-native  # adds RN output alongside existing
nib brand build --platform all           # all platforms
```

---

### FR-2: React Native Adapter

**Output:** `dist/native/react-native/theme.ts`

**Theme object structure:**
```typescript
export const theme = {
  colors: {
    interactive: {
      default: '#2563EB',
      hover: '#1D4ED8',
    },
    background: {
      default: '#FFFFFF',
      subtle: '#F8FAFC',
    },
    // ... all semantic color tokens
  },
  typography: {
    fontFamily: {
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    '1': 4,
    '2': 8,
    '3': 12,
    '4': 16,
    // ... spacing scale as numbers (React Native expects unitless)
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
} as const;

export type Theme = typeof theme;
```

**Helper hooks:**
```typescript
// useTheme.ts
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from './theme';

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
```

**Unit conversions:**
- Spacing: CSS `px` → unitless number (React Native uses dp)
- Font size: CSS `rem` → `px` equivalent (assumes 16px base)
- Border radius: CSS `px` → unitless number

---

### FR-3: Flutter Adapter

**Output:** `dist/native/flutter/theme.dart`

```dart
import 'package:flutter/material.dart';

class AppColors {
  static const Color interactiveDefault = Color(0xFF2563EB);
  static const Color interactiveHover = Color(0xFF1D4ED8);
  static const Color backgroundDefault = Color(0xFFFFFFFF);
  static const Color backgroundSubtle = Color(0xFFF8FAFC);
}

class AppTextStyles {
  static const TextStyle bodyBase = TextStyle(
    fontFamily: 'Inter',
    fontSize: 16,
    height: 1.5,
  );
  // ... all text styles
}

ThemeData buildLightTheme() {
  return ThemeData(
    colorScheme: ColorScheme.light(
      primary: AppColors.interactiveDefault,
      surface: AppColors.backgroundDefault,
    ),
    textTheme: TextTheme(
      bodyMedium: AppTextStyles.bodyBase,
    ),
  );
}

ThemeData buildDarkTheme() { ... }
```

**Color format:** DTCG hex/oklch → Flutter `Color(0xAARRGGBB)` format.

---

### FR-4: iOS Adapter

**Output:**
- `dist/native/ios/Colors.swift` — Swift color constants
- `dist/native/ios/Spacing.swift` — spacing constants
- `dist/native/ios/Typography.swift` — font descriptors
- `dist/native/ios/Assets.xcassets/` — `.colorset` entries for light/dark

**Swift constants:**
```swift
// Colors.swift
import UIKit

public enum AppColor {
    public static let interactiveDefault = UIColor(named: "interactive.default")!
    public static let backgroundDefault = UIColor(named: "background.default")!
}

// Spacing.swift
public enum AppSpacing {
    public static let spacing1: CGFloat = 4
    public static let spacing2: CGFloat = 8
    public static let spacing4: CGFloat = 16
}
```

**`.xcassets` color sets** (light/dark variants):
```json
{
  "colors": [
    { "idiom": "universal", "color": { "color-space": "srgb", "components": { "red": "0.145", "green": "0.392", "blue": "0.922", "alpha": "1.000" } } },
    { "appearances": [{ "appearance": "luminosity", "value": "dark" }], "color": { ... } }
  ]
}
```

**Unit conventions:** CSS `rem` → `CGFloat` points (assumes 16px base, 1rem = 16pt).

---

### FR-5: Android Adapter

**Output:**
- `dist/native/android/Theme.kt` — Jetpack Compose theme
- `dist/native/android/res/values/colors.xml`
- `dist/native/android/res/values/dimens.xml`

**Compose theme:**
```kotlin
// Theme.kt
import androidx.compose.material3.*
import androidx.compose.ui.graphics.Color

object AppColors {
    val InteractiveDefault = Color(0xFF2563EB)
    val BackgroundDefault = Color(0xFFFFFFFF)
}

private val LightColorScheme = lightColorScheme(
    primary = AppColors.InteractiveDefault,
    background = AppColors.BackgroundDefault,
)

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LightColorScheme, content = content)
}
```

**XML resources:**
```xml
<!-- colors.xml -->
<resources>
    <color name="interactive_default">#FF2563EB</color>
    <color name="background_default">#FFFFFFFF</color>
</resources>

<!-- dimens.xml -->
<resources>
    <dimen name="spacing_1">4dp</dimen>
    <dimen name="spacing_4">16dp</dimen>
</resources>
```

**Unit conventions:** CSS `px` → Android `dp` (1:1 at 1x density). Font sizes: CSS `rem` → `sp` (assumes 16px base).

---

### FR-6: Color Format Handling

All adapters must handle these DTCG color formats:

| DTCG format | React Native | Flutter | iOS | Android |
|-------------|-------------|---------|-----|---------|
| `#RRGGBB` | `'#RRGGBB'` | `Color(0xFFRRGGBB)` | `sRGB components` | `#FFRRGGBB` |
| `#RRGGBBAA` | `'#RRGGBBAA'` | `Color(0xAARRGGBB)` | `sRGB + alpha` | `#AARRGGBB` |
| `rgb(r, g, b)` | Converted to hex | Converted | Converted | Converted |
| `rgba(r, g, b, a)` | Converted | Converted | Converted | Converted |
| `oklch(...)` | Converted to sRGB hex | Converted | Converted | Converted |
| Token reference `{color.brand.500}` | Resolved at build time | Resolved | Resolved | Resolved |

`oklch` → sRGB conversion is required because no native mobile platform supports `oklch` natively.

---

## Technical Notes

### Source files to create

| File | Action |
|------|--------|
| `src/brand/adapters/react-native.ts` | Create |
| `src/brand/adapters/flutter.ts` | Create |
| `src/brand/adapters/ios.ts` | Create |
| `src/brand/adapters/android.ts` | Create |
| `src/brand/adapters/color-convert.ts` | Create — shared color format converter |
| `src/brand/build.ts` | Modify — wire `--platform` flag to adapter selection |
| `src/types/brand.ts` | Modify — `Platform` type, adapter interface |

### Adapter interface

All adapters implement a shared interface for consistency:

```typescript
interface PlatformAdapter {
  platform: Platform;
  generate(tokens: DTCGTokenSet, config: BrandConfig): PlatformOutput[];
}

interface PlatformOutput {
  path: string;      // relative output path
  content: string;   // file content
}
```

---

## Open Questions

1. **Dark mode output** — All adapters should emit both light and dark theme. Should dark theme be opt-out (emitted by default) or opt-in? Recommendation: opt-out — emit both if light and dark token sets are present, single theme if not.

2. **Typography as platform TextStyle** — Flutter, iOS, and Android all have their own text style systems. Should the adapter generate a complete text style catalog (all scale steps as named styles) or just primitive font values? Recommendation: complete catalog — named styles are more useful than raw primitives.

3. **Component token tier in native output** — Should component tokens (Phase 3) be included in native adapters, or primitives + semantic only? Recommendation: primitives + semantic only for Phase 7; component tokens in native adapters are Phase 7+.

4. **xcassets generation** — iOS `.xcassets` are directory structures with JSON files. Should nib write these directly to disk, or produce a zip/archive? Recommendation: write directly to disk under the configured output directory.

---

## Done Criteria

- [ ] `nib brand build --platform react-native` produces a typed `theme.ts` with `useTheme()` hook
- [ ] `nib brand build --platform flutter` produces a compilable `theme.dart` with `ThemeData` builder
- [ ] `nib brand build --platform ios` produces Swift constants + `.xcassets` color sets
- [ ] `nib brand build --platform android` produces Compose theme + `colors.xml` + `dimens.xml`
- [ ] All adapters convert `oklch` to sRGB hex
- [ ] All adapters resolve token references at build time
- [ ] `nib brand build --platform all` runs all four adapters in one command
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with fixture-based coverage for each adapter and color converter

---

*Created: 2026-02-28*
*References: roadmap.md Phase 7 — new territory, no direct gap-analysis reference*
