# Component Styling Rules — Flux
<!-- nib-brand-components: v1 -->

## Button

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | interactive.default | text.inverse | none |
| Secondary | transparent | interactive.default | interactive.default |
| Ghost | transparent | interactive.default | none |
| Destructive | feedback.error | text.inverse | none |

**Border radius:** md (8px)
**Padding:** spacing.sm vertical, spacing.md horizontal
**Font:** label size, label weight

## Input

**Border:** border.primary (1px solid)
**Border radius:** md (8px)
**Padding:** spacing.sm vertical, spacing.md horizontal
**Focus:** border → border.focus, ring → brand.500/20%
**Error:** border → feedback.error, helper text → feedback.error

## Card

**Background:** surface.primary
**Border:** border.secondary (1px solid)
**Border radius:** lg (12px)
**Padding:** spacing.lg
**Shadow:** elevation.sm
**Hover:** elevation.md

## Badge

**Border radius:** full (pill)
**Padding:** spacing.2xs vertical, spacing.xs horizontal
**Font:** caption size

## Avatar

**Border radius:** full (circle)
**Sizes:** 24px (sm), 32px (md), 40px (lg), 48px (xl)
