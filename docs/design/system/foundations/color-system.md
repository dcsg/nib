# Color System
<!-- nib-foundation: color-system | generated: 2026-03-03 | do not edit manually -->

## Overview

The color system is organized into three tiers:

1. **Primitives** — raw color scales (brand, neutral, feedback). Never reference these directly in components.
2. **Semantic** — intent-based aliases (background, text, border, interactive, feedback). Use these in all components.
3. **Component** — scoped overrides per component (Phase 3).

---

## Brand Color Scale

The primary brand scale has 11 steps (50–950), derived algorithmically from the brand's primary color using HSL math. The scale covers the full lightness range from near-white to near-black while preserving the brand hue.

| Step | Token | Light use | Dark use |
|------|-------|-----------|----------|
| 50 | `color.brand.50` | Subtle tinted backgrounds | — |
| 100 | `color.brand.100` | Hover tints on light bg | — |
| 200 | `color.brand.200` | Tinted borders | — |
| 300 | `color.brand.300` | — | Subtle dark-mode tints |
| 400 | `color.brand.400` | — | Interactive default (dark) |
| 500 | `color.brand.500` | Focus rings | Focus rings (dark) |
| 600 | `color.brand.600` | **Interactive default** | — |
| 700 | `color.brand.700` | Interactive hover | — |
| 800 | `color.brand.800` | Interactive active/pressed | — |
| 900 | `color.brand.900` | Dark text on brand bg | — |
| 950 | `color.brand.950` | Darkest brand shade | — |

---

## Semantic Token Map

Semantic tokens express **intent**, not appearance. Always use semantic tokens in component styles.

### Background

| Token | Light | Dark | When to use |
|-------|-------|------|-------------|
| `color.background.primary` | White | Neutral 950 | Page / screen background |
| `color.background.secondary` | Neutral 50 | Neutral 900 | Slightly elevated surface (sidebar, panels) |
| `color.background.tertiary` | Neutral 100 | Neutral 800 | Inset/recessed areas (code blocks, inputs) |

### Surface

| Token | Light | Dark | When to use |
|-------|-------|------|-------------|
| `color.surface.primary` | White | Neutral 900 | Cards, dialogs, popovers |
| `color.surface.secondary` | Neutral 50 | Neutral 800 | Nested cards, table row hover |
| `color.surface.elevated` | White | Neutral 800 | Floating elements (tooltips, dropdowns) |

### Text

| Token | Light | Dark | When to use |
|-------|-------|------|-------------|
| `color.text.primary` | Neutral 900 | Neutral 50 | Body text, headings |
| `color.text.secondary` | Neutral 700 | Neutral 300 | Supporting text, labels |
| `color.text.tertiary` | Neutral 600 | Neutral 500 | Captions, timestamps, metadata |
| `color.text.inverse` | White | Neutral 900 | Text on brand/dark backgrounds |

### Border

| Token | Light | Dark | When to use |
|-------|-------|------|-------------|
| `color.border.primary` | Neutral 200 | Neutral 700 | Default borders, dividers |
| `color.border.secondary` | Neutral 100 | Neutral 800 | Subtle separators |
| `color.border.focus` | Brand 500 | Brand 400 | Keyboard focus ring |

### Interactive

| Token | Light | Dark | When to use |
|-------|-------|------|-------------|
| `color.interactive.default` | Brand 600 | Brand 400 | Default state: buttons, links |
| `color.interactive.hover` | Brand 700 | Brand 300 | Hover state |
| `color.interactive.active` | Brand 800 | Brand 200 | Pressed/active state |
| `color.interactive.disabled` | Neutral 300 | Neutral 700 | Disabled state |

### Feedback

| Token | When to use |
|-------|-------------|
| `color.feedback.success` | Confirmation, completed actions |
| `color.feedback.warning` | Caution, potentially destructive |
| `color.feedback.error` | Validation errors, destructive actions |
| `color.feedback.info` | Informational messages |
| `color.feedback.success-bg` | Background for success states |
| `color.feedback.warning-bg` | Background for warning states |
| `color.feedback.error-bg` | Background for error states |
| `color.feedback.info-bg` | Background for info states |

---

## Usage Rules

| Rule | Do | Don't |
|------|----|-------|
| Use semantic tokens | `color.interactive.default` | `color.brand.600` directly |
| Reserve feedback colors | Use `color.feedback.error` only for errors | Use for decoration |
| Respect theme | Semantic tokens auto-switch light/dark | Hard-code hex values |
| Background hierarchy | `primary` → `secondary` → `tertiary` for depth | Skip levels |
| Text contrast | Use `text.primary` on `background.primary` | Mix unvetted pairs |

---

## Light / Dark Theme

Semantic tokens automatically resolve to the correct value based on the user's system preference (`prefers-color-scheme`) or the `data-theme="dark"` attribute.

All primitive references in semantic tokens are resolved at CSS variable level — no JavaScript theming required.

---

## WCAG Contrast

Run `nib brand audit` to generate a full contrast matrix for all text/background pairings.

Key pairs to ensure pass AA (4.5:1 for normal text, 3:1 for large text):

- `color.text.primary` on `color.background.primary`
- `color.text.secondary` on `color.background.primary`
- `color.text.inverse` on `color.interactive.default`
- Any feedback text on its corresponding `-bg` token

---

## Neutral Scale

The neutral scale uses a warm/cool tint derived from the primary brand hue at 10% saturation. This ensures the grays feel harmonious with the brand while remaining neutral.

---

*Generated by nib. Run `nib brand build` to regenerate.*
